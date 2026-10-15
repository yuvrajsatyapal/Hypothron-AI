import os

import pytest
from pydantic import SecretStr
from sqlalchemy import select
from test_ledger import setup
from test_workflow import request

from hypothron.driver import InvestigationDriver
from hypothron.ledger import LedgerError
from hypothron.providers.http import ProviderError
from hypothron.records import AttemptRecord


async def test_durable_pause_restart_approval_and_attempt_lineage():
    app, ledger, owner, _ = await setup()
    run = await ledger.create(owner, request(), "openrouter", "vendor/first")

    async def limited(role, context, schema):
        raise ProviderError("PROVIDER_RATE_LIMIT")

    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    paused = await driver.advance(owner, run.id, SecretStr("test-canary-key"), provider=limited)
    assert paused["status"] == "MODEL_APPROVAL_REQUIRED" and paused["calls"] == 1
    assert (await ledger.get(owner, run.id)).attempts == 1
    restarted = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    assert (await restarted.advance(owner, run.id, SecretStr("test-canary-key"), provider=limited))[
        "calls"
    ] == 1
    args = {
        "expected_model": "vendor/first",
        "expected_revision": 0,
        "selected_model": "vendor/second",
        "idempotency_token": "approve-1",
    }
    with pytest.raises(LedgerError, match="NOT_FOUND"):
        await ledger.approve_model("foreign-owner", run.id, **args)
    with pytest.raises(LedgerError, match="MODEL_APPROVAL_CONFLICT"):
        await ledger.approve_model(owner, run.id, **(args | {"expected_revision": 1}))
    switched = await ledger.approve_model(owner, run.id, **args)
    assert switched.model_revision == 1 and switched.original_model == "vendor/first"
    assert (await ledger.approve_model(owner, run.id, **args)).model_revision == 1

    async def clarification(role, context, schema):
        assert context["callOrdinal"] == 2
        return {"clarification": "Which metric?", "hypotheses": []}

    state = await restarted.advance(
        owner, run.id, SecretStr("test-canary-key"), provider=clarification
    )
    assert state["status"] == "CLARIFYING" and state["calls"] == 2
    async with app.state.sessions() as db:
        attempts = list(
            await db.scalars(
                select(AttemptRecord)
                .where(AttemptRecord.run_id == run.id)
                .order_by(AttemptRecord.ordinal)
            )
        )
    assert [(a.status, a.model, a.model_revision) for a in attempts] == [
        ("REJECTED", "vendor/first", 0),
        ("COMPLETE", "vendor/second", 1),
    ]


async def test_unresolved_reservation_and_active_lease_cannot_be_approved():
    _, ledger, owner, _ = await setup()
    run = await ledger.create(owner, request(), "openrouter", "vendor/first")
    lease = await ledger.claim(owner, run.id)
    await ledger.reserve(lease, 1, "planner", "context")
    await ledger.pause_model(lease, "planner", "PROVIDER_RATE_LIMIT")
    args = {
        "expected_model": "vendor/first",
        "expected_revision": 0,
        "selected_model": "vendor/second",
        "idempotency_token": "approve-1",
    }
    with pytest.raises(LedgerError, match="RUN_BUSY"):
        await ledger.approve_model(owner, run.id, **args)
    await ledger.release(lease)
    with pytest.raises(LedgerError, match="BILLING_UNKNOWN"):
        await ledger.approve_model(owner, run.id, **args)
    await ledger.cancel(owner, run.id)
    with pytest.raises(LedgerError, match="MODEL_APPROVAL_REQUIRED"):
        await ledger.approve_model(owner, run.id, **args)


async def test_preflight_pause_does_not_reserve_and_rejected_crash_reconciles():
    from hypothron.providers.catalogue import CatalogError, ModelCatalog

    _, ledger, owner, _ = await setup()
    run = await ledger.create(owner, request(), "openrouter", "vendor/first")

    class Unavailable(ModelCatalog):
        async def validate(self, model, key=None):
            raise CatalogError("CATALOG_UNAVAILABLE")

    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger, Unavailable())
    state = await driver.advance(owner, run.id, SecretStr("test-canary-key"))
    assert state["status"] == "MODEL_APPROVAL_REQUIRED" and state["calls"] == 0
    assert (await ledger.get(owner, run.id)).attempts == 0

    # Crash after definitive rejection commits but before the role checkpoint is written.
    from hypothron.agents.workflow import initial_state
    from hypothron.ledger import digest

    recovered = await ledger.create(owner, request(), "openrouter", "vendor/first")
    initial = initial_state(request())
    context = {
        "callOrdinal": 1,
        "question": initial["request"]["question"],
        "datasets": initial["request"]["datasets"],
        "clarificationAnswers": [],
        "hypotheses": [],
        "evidence": [],
        "role": "planner",
    }
    lease = await ledger.claim(owner, recovered.id)
    await ledger.reserve(lease, 1, "planner", digest(context))
    await ledger.reject_attempt(lease, 1, "PROVIDER_RATE_LIMIT")
    await ledger.release(lease)

    async def forbidden(role, context, schema):
        raise AssertionError("A committed rejection cannot redispatch on recovery")

    state = await InvestigationDriver(os.environ["DATABASE_URL"], ledger).advance(
        owner, recovered.id, SecretStr("test-canary-key"), provider=forbidden
    )
    assert state["status"] == "MODEL_APPROVAL_REQUIRED" and state["calls"] == 1
    assert (await ledger.get(owner, recovered.id)).attempts == 1


async def test_gemini_definitive_failure_preserves_original_terminal_behavior():
    _, ledger, owner, run = await setup()

    async def limited(role, context, schema):
        raise ProviderError("PROVIDER_RATE_LIMIT")

    state = await InvestigationDriver(os.environ["DATABASE_URL"], ledger).advance(
        owner, run.id, SecretStr("test-canary-key"), provider=limited
    )
    assert state["status"] == "FAILED" and state["error"] == "PROVIDER_RATE_LIMIT"


async def test_approval_racing_initial_read_dispatches_claimed_revision(monkeypatch):
    import json

    import httpx

    from hypothron.providers.catalogue import CatalogModel, ModelCatalog

    _, ledger, owner, _ = await setup()
    run = await ledger.create(owner, request(), "openrouter", "vendor/first")

    async def limited(role, context, schema):
        raise ProviderError("PROVIDER_RATE_LIMIT")

    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    await driver.advance(owner, run.id, SecretStr("test-canary-key"), provider=limited)
    original_claim = ledger.claim

    async def race_claim(claim_owner, claim_run):
        await ledger.approve_model(
            owner,
            run.id,
            expected_model="vendor/first",
            expected_revision=0,
            selected_model="vendor/second",
            idempotency_token="race-approval",
        )
        return await original_claim(claim_owner, claim_run)

    monkeypatch.setattr(ledger, "claim", race_claim)

    class Eligible(ModelCatalog):
        async def validate(self, model, key=None):
            assert model == "vendor/second"
            return CatalogModel(model, model, 65536, 2048)

    def wire(req):
        assert json.loads(req.content)["model"] == "vendor/second"
        return httpx.Response(
            200,
            json={
                "model": "vendor/second",
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "content": json.dumps(
                                {"clarification": "Which metric?", "hypotheses": []}
                            )
                        },
                    }
                ],
            },
        )

    driver.catalogue = Eligible()
    state = await driver.advance(
        owner, run.id, SecretStr("test-canary-key"), transport=httpx.MockTransport(wire)
    )
    assert state["status"] == "CLARIFYING" and state["calls"] == 2
