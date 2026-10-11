import os

import pytest
from pydantic import SecretStr
from test_ledger import setup
from test_workflow import HASH

from hypothron.driver import InvestigationDriver


@pytest.mark.asyncio
async def test_fresh_driver_recovers_job_and_accepted_result_without_reissuing_inference():
    app, ledger, owner, run = await setup()
    roles = []

    async def provider(role, context, schema):
        roles.append(role)
        if role == "planner":
            return {
                "clarification": None,
                "hypotheses": [
                    {"id": "h1", "statement": "Revenue exists", "datasetHash": HASH, "priority": 1}
                ],
            }
        if role == "analyst":
            return {
                "action": "finish" if context["evidence"] else "execute",
                "hypothesisId": None if context["evidence"] else "h1",
                "reason": "Inspect approved evidence",
            }
        return {
            "conclusion": "The independent local computations agree.",
            "citations": [context["evidence"][0]["jobId"]],
        }

    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    result = await driver.advance(
        owner, run.id, SecretStr("test-key-never-checkpoint"), provider=provider
    )
    job = result["pending"]
    assert result["status"] == "WAITING_RESULT"
    assert (await ledger.job(owner, run.id, job["id"])).status == "PENDING"
    reopened = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    restored = await reopened.advance(
        owner, run.id, SecretStr("test-key-never-checkpoint"), provider=provider
    )
    assert restored["pending"]["id"] == job["id"]
    assert roles == ["planner", "analyst"]
    evidence = {
        "jobId": job["id"],
        "datasetHash": HASH,
        "sql": {"minorUnits": "3033", "count": 3},
        "python": {"minorUnits": "3033", "count": 3},
    }
    await ledger.submit(owner, run.id, evidence)
    result = await reopened.advance(
        owner, run.id, SecretStr("test-key-never-checkpoint"), provider=provider
    )
    assert result["status"] == "COMPLETE"
    assert result["evidence"][0]["provenance"] == "CLIENT_REPORTED"
    assert roles == ["planner", "analyst", "analyst", "report"]
    assert (await ledger.get(owner, run.id)).attempts == 4
    assert (await ledger.submit(owner, run.id, evidence))["duplicate"]
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_crash_after_checkpoint_job_issuance_recovers_same_job_without_call(monkeypatch):
    _app, ledger, owner, run = await setup()
    calls = []

    async def provider(role, context, schema):
        calls.append(role)
        if role == "planner":
            return {
                "clarification": None,
                "hypotheses": [
                    {"id": "h1", "statement": "Test revenue", "datasetHash": HASH, "priority": 1}
                ],
            }
        return {"action": "execute", "hypothesisId": "h1", "reason": "Inspect"}

    original = ledger.issue
    failed_job = None

    async def crash(lease, job):
        nonlocal failed_job
        failed_job = job["id"]
        raise RuntimeError("simulated process failure after checkpoint")

    monkeypatch.setattr(ledger, "issue", crash)
    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    with pytest.raises(RuntimeError, match="simulated"):
        await driver.advance(owner, run.id, SecretStr("canary-key"), provider=provider)
    monkeypatch.setattr(ledger, "issue", original)
    reopened = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    result = await reopened.advance(owner, run.id, SecretStr("canary-key"), provider=provider)
    assert result["pending"]["id"] == failed_job
    assert calls == ["planner", "analyst"]


@pytest.mark.asyncio
async def test_crash_after_reservation_surfaces_billing_unknown_without_second_inference():
    import asyncio

    from langgraph.errors import NodeCancelledError

    _app, ledger, owner, run = await setup()
    calls = []

    async def interrupted(role, context, schema):
        calls.append(role)
        raise asyncio.CancelledError()

    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    with pytest.raises(NodeCancelledError):
        await driver.advance(owner, run.id, SecretStr("canary-key"), provider=interrupted)
    reopened = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    result = await reopened.advance(owner, run.id, SecretStr("canary-key"), provider=interrupted)
    assert result["status"] == "FAILED"
    assert result["error"] == "BILLING_UNKNOWN"
    assert calls == ["planner"]
    assert (await ledger.get(owner, run.id)).attempts == 1


@pytest.mark.asyncio
async def test_invalid_stored_provider_is_rejected_without_dispatch():
    from sqlalchemy import update

    from hypothron.ledger import LedgerError
    from hypothron.records import RunRecord

    app, ledger, owner, run = await setup()
    async with app.state.sessions.begin() as db:
        await db.execute(
            update(RunRecord).where(RunRecord.id == run.id).values(provider="invalid-provider")
        )
    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    with pytest.raises(LedgerError, match="INVALID_PROVIDER"):
        await driver.advance(owner, run.id, SecretStr("test-key"))
    assert (await ledger.get(owner, run.id)).attempts == 0


@pytest.mark.asyncio
async def test_segment_deadline_includes_initial_database_read(monkeypatch):
    import asyncio

    import hypothron.driver as module
    from hypothron.ledger import LedgerError

    _app, ledger, owner, run = await setup()

    async def stalled(*args):
        await asyncio.sleep(1)

    monkeypatch.setattr(ledger, "get", stalled)
    monkeypatch.setattr(module, "SEGMENT_TIMEOUT_SECONDS", 0.01)
    with pytest.raises(LedgerError, match="SEGMENT_TIMEOUT"):
        await InvestigationDriver(os.environ["DATABASE_URL"], ledger).advance(
            owner, run.id, SecretStr("test-key")
        )
