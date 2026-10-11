import os
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import update
from test_workflow import HASH, request

from hypothron.agents.workflow import initial_state
from hypothron.api import create_app
from hypothron.ledger import Ledger, LedgerError
from hypothron.records import AttemptRecord, JobRecord, RunRecord


async def setup():
    app = create_app(database_url=os.environ["DATABASE_URL"])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        owner = (await client.post("/v1/sessions")).json()["id"]
    ledger = Ledger(app.state.sessions)
    run = await ledger.create(owner, initial_state(request())["request"], "gemini", "gemini-test")
    return app, ledger, owner, run


@pytest.mark.asyncio
async def test_atomic_attempt_reservation_cache_and_billing_uncertainty():
    app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    assert await ledger.reserve(lease, 1, "planner", "context") is None
    with pytest.raises(LedgerError, match="BILLING_UNKNOWN"):
        await ledger.reserve(lease, 1, "planner", "context")
    await ledger.complete_attempt(lease, 1, {"clarification": "Which metric?", "hypotheses": []})
    cached = await ledger.reserve(lease, 1, "planner", "context")
    assert cached["clarification"] == "Which metric?"
    async with app.state.sessions() as db:
        assert (await db.get(RunRecord, run.id)).attempts == 1
        assert (await db.get(AttemptRecord, (run.id, 1))).status == "COMPLETE"


@pytest.mark.asyncio
async def test_cross_owner_idempotent_results_and_conflicting_duplicate():
    app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    job = {
        "id": f"{run.id}-job-test",
        "plan": request()["datasets"][0]["contract"],
        "dependsOn": [],
        "hypothesisId": "h1",
        "reason": "approved",
        "kind": "execution",
    }
    await ledger.issue(lease, job)
    payload = {
        "jobId": f"{run.id}-job-test",
        "datasetHash": HASH,
        "sql": {"minorUnits": "3033", "count": 3},
        "python": {"minorUnits": "3033", "count": 3},
    }
    with pytest.raises(LedgerError, match="NOT_FOUND"):
        await ledger.submit("other-owner", run.id, payload)
    assert (await ledger.submit(owner, run.id, payload))["duplicate"] is False
    assert (await ledger.submit(owner, run.id, payload))["duplicate"] is True
    with pytest.raises(LedgerError, match="RESULT_CONFLICT"):
        await ledger.submit(owner, run.id, {**payload, "sql": {"minorUnits": "999", "count": 3}})
    async with app.state.sessions() as db:
        assert (await db.get(JobRecord, f"{run.id}-job-test")).status == "ACCEPTED"


@pytest.mark.asyncio
async def test_expired_lease_is_fenced_and_cancellation_invalidates_owner():
    app, ledger, owner, run = await setup()
    old = await ledger.claim(owner, run.id)
    with pytest.raises(LedgerError, match="RUN_BUSY"):
        await ledger.claim(owner, run.id)
    async with app.state.sessions.begin() as db:
        await db.execute(
            update(RunRecord)
            .where(RunRecord.id == run.id)
            .values(lease_expires=datetime.now(UTC) - timedelta(seconds=1))
        )
    new = await ledger.claim(owner, run.id)
    assert new.epoch > old.epoch
    with pytest.raises(LedgerError, match="LEASE_LOST"):
        await ledger.reserve(old, 1, "planner", "context")
    await ledger.cancel(owner, run.id)
    with pytest.raises(LedgerError, match="LEASE_LOST"):
        await ledger.reserve(new, 1, "planner", "context")


@pytest.mark.asyncio
async def test_attempt_cap_is_durable_and_expired_runs_are_not_readable():
    app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    for ordinal in range(1, 13):
        await ledger.reserve(lease, ordinal, "analyst", str(ordinal))
    with pytest.raises(LedgerError, match="BUDGET_EXHAUSTED"):
        await ledger.reserve(lease, 13, "report", "context")
    async with app.state.sessions.begin() as db:
        await db.execute(
            update(RunRecord)
            .where(RunRecord.id == run.id)
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    with pytest.raises(LedgerError, match="NOT_FOUND"):
        await ledger.get(owner, run.id)


@pytest.mark.asyncio
async def test_job_budget_is_enforced_independently_of_graph_and_invalid_reply_rejected():
    _app, ledger, owner, run = await setup()
    lease = await ledger.claim(owner, run.id)
    for index in range(6):
        await ledger.issue(
            lease,
            {
                "id": f"{run.id}-{index}",
                "kind": "execution",
                "plan": request()["datasets"][0]["contract"],
                "dependsOn": [],
                "hypothesisId": "h1",
                "reason": "approved",
            },
        )
    with pytest.raises(LedgerError, match="JOB_BUDGET_EXHAUSTED"):
        await ledger.issue(
            lease,
            {
                "id": f"{run.id}-extra",
                "kind": "execution",
                "plan": request()["datasets"][0]["contract"],
                "dependsOn": [],
                "hypothesisId": "h1",
                "reason": "approved",
            },
        )
    await ledger.reserve(lease, 1, "planner", "context")
    with pytest.raises(LedgerError, match="INVALID_ROLE_OUTPUT"):
        await ledger.complete_attempt(lease, 1, {"arbitrary": "unvalidated"})
