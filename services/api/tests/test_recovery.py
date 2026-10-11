import os

import pytest
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command
from test_ledger import setup

from hypothron.agents.workflow import build_workflow, initial_state
from hypothron.checkpoints import checkpoint_store
from hypothron.ledger import LedgerError


@pytest.mark.asyncio
async def test_postgres_interrupt_reopens_without_duplicate_planner_call():
    app, ledger, owner, run = await setup()
    calls = []

    async def provider(role, context, schema):
        calls.append(role)
        if role == "planner":
            return {"clarification": "Which period?", "hypotheses": []}
        return {"action": "finish", "hypothesisId": None, "reason": "No supported hypothesis"}

    config: RunnableConfig = {"configurable": {"thread_id": run.id}}
    lease = await ledger.claim(owner, run.id)
    async with checkpoint_store(os.environ["DATABASE_URL"], ledger, lease) as saver:
        graph = build_workflow(provider, saver)
        result = await graph.ainvoke(initial_state(run.request), config)
        assert result["status"] == "CLARIFYING"
    await ledger.release(lease)
    lease2 = await ledger.claim(owner, run.id)
    async with checkpoint_store(os.environ["DATABASE_URL"], ledger, lease2) as saver:
        graph = build_workflow(provider, saver)
        snapshot = await graph.aget_state(config)
        assert snapshot.values["calls"] == 1
        assert snapshot.next == ("clarify",)
        # Reading a fresh saver is inference-free. Invalid resume terminates without a call.
        result = await graph.ainvoke(Command(resume={"answer": ""}), config)
        assert result["error"] == "INVALID_CLARIFICATION"
    assert calls == ["planner"]
    await ledger.release(lease2)
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_cancelled_worker_cannot_write_native_checkpoint():
    app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    async with checkpoint_store(os.environ["DATABASE_URL"], ledger, lease) as saver:
        await ledger.cancel(owner, run.id)
        with pytest.raises(LedgerError, match="LEASE_LOST"):
            await saver.aput_writes(
                {
                    "configurable": {
                        "thread_id": run.id,
                        "checkpoint_ns": "",
                        "checkpoint_id": "test",
                    }
                },
                [("status", "COMPLETE")],
                "task",
            )
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_native_saver_rejects_cross_run_reads_lists_and_deletion():
    _app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    async with checkpoint_store(os.environ["DATABASE_URL"], ledger, lease) as saver:
        with pytest.raises(LedgerError, match="NOT_FOUND"):
            await saver.aget_tuple({"configurable": {"thread_id": "another-run"}})
        with pytest.raises(LedgerError, match="NOT_FOUND"):
            async for _ in saver.alist(None):
                pass
        with pytest.raises(LedgerError, match="NOT_FOUND"):
            await saver.adelete_thread("another-run")


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["COMPLETE", "FAILED", "BUDGET_EXHAUSTED", "CANCELLED"])
async def test_terminal_run_rejects_retained_lease_mutation(status):
    _app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    await ledger.status(lease, status)
    with pytest.raises(LedgerError, match="LEASE_LOST"):
        await ledger.reserve(lease, 1, "planner", "context")


@pytest.mark.asyncio
async def test_expiry_purge_removes_native_checkpoint_blobs_and_business_metadata():
    from datetime import UTC, datetime, timedelta

    import httpx
    from sqlalchemy import text, update

    from hypothron.db import SessionRecord

    app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)

    async def provider(role, context, schema):
        return {"clarification": "Which period?", "hypotheses": []}

    async with checkpoint_store(os.environ["DATABASE_URL"], ledger, lease) as saver:
        await build_workflow(provider, saver).ainvoke(
            initial_state(run.request), {"configurable": {"thread_id": run.id}}
        )
    await ledger.release(lease)
    async with app.state.sessions.begin() as db:
        await db.execute(
            update(SessionRecord)
            .where(SessionRecord.id == owner)
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        assert (await client.post("/v1/sessions")).status_code == 201
    async with app.state.sessions() as db:
        assert (
            await db.scalar(
                text("SELECT count(*) FROM checkpoints WHERE thread_id=:id"), {"id": run.id}
            )
            == 0
        )
        assert await db.scalar(text("SELECT count(*) FROM runs WHERE id=:id"), {"id": run.id}) == 0
