import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command
from test_workflow import HASH, Script, hypotheses, request

from hypothron.agents.workflow import build_workflow, initial_state


@pytest.mark.asyncio
async def test_disagreement_is_preserved_and_correction_stops_after_two_without_llm_override():
    provider = Script(
        [
            ("planner", hypotheses()),
            ("analyst", {"action": "execute", "hypothesisId": "h1", "reason": "Test"}),
            ("report", {"conclusion": "The disagreement remains unresolved.", "citations": []}),
        ]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "correction"}}
    result = await graph.ainvoke(initial_state(request()), cfg)
    ids = []
    for attempt in range(3):
        job = result["__interrupt__"][0].value
        ids.append(job["id"])
        assert job["dependsOn"] == ids[:-1]
        provider.replies[-1][1]["citations"] = ids.copy()
        result = await graph.ainvoke(
            Command(
                resume={
                    "jobId": job["id"],
                    "datasetHash": HASH,
                    "sql": {"minorUnits": "11800", "count": 3},
                    "python": {"minorUnits": "12000", "count": 3},
                }
            ),
            cfg,
        )
    assert result["status"] == "COMPLETE"
    assert len(result["jobs"]) == 3
    assert provider.calls == ["planner", "analyst", "report"]
    assert all(e["verification"] == "DISPUTED" for e in result["evidence"])
    assert all(e["classification"] == "VALUE_MISMATCH" for e in result["evidence"])
    assert all(e["provenance"] == "CLIENT_REPORTED" for e in result["evidence"])
    assert result["evidence"][-1]["dependsOn"] == ids[:-1]
    assert len(result["evidence"][-1]["contractHash"]) == 64


@pytest.mark.parametrize(
    "left,right,classification,status",
    [
        (
            {"minorUnits": "1", "count": 1},
            {"minorUnits": "1", "count": 2},
            "POPULATION_MISMATCH",
            "DISPUTED",
        ),
        (
            {"minorUnits": None, "count": 0},
            {"minorUnits": None, "count": 0},
            "EMPTY_POPULATION",
            "INCONCLUSIVE",
        ),
        ({"minorUnits": "1", "count": 1}, {"minorUnits": "1", "count": 1}, "AGREEMENT", "VERIFIED"),
    ],
)
def test_exact_classification(left, right, classification, status):
    from hypothron.agents.models import EvidenceInput, MetricPlan
    from hypothron.verification import verify_evidence

    verdict = verify_evidence(
        MetricPlan.model_validate(request()["datasets"][0]["contract"]),
        EvidenceInput.model_validate(
            {"jobId": "x", "datasetHash": HASH, "sql": left, "python": right}
        ),
    )
    assert verdict["verification"] == status
    assert verdict["classification"] == classification
    assert verdict["provenance"] == "CLIENT_REPORTED"


def v2plan():
    return {
        **request()["datasets"][0]["contract"],
        "version": 2,
        "currency": "EUR",
        "grainKeys": ["order_id"],
        "relationship": None,
    }


def diagnostics(plan, **changes):
    counts = {
        "populationRows": 3,
        "periodRows": 3,
        "nullAmounts": 0,
        "grainUniqueRows": 3,
        "joinUniqueRows": 3,
    }
    return {"contract": plan, "sql": counts, "python": {**counts, **changes}}


@pytest.mark.parametrize(
    "change,expected",
    [
        ({"grainUniqueRows": 2}, "GRAIN_VIOLATION"),
        ({"periodRows": 2}, "SEMANTIC_DIAGNOSTIC_MISMATCH"),
        ({"populationRows": 4}, "GRAIN_VIOLATION"),
    ],
)
def test_v2_equal_totals_do_not_override_semantic_invariants(change, expected):
    from hypothron.agents.models import EvidenceInput, MetricPlan
    from hypothron.verification import verify_evidence

    plan = MetricPlan.model_validate(v2plan())
    evidence = EvidenceInput.model_validate(
        {
            "jobId": "x",
            "datasetHash": HASH,
            "sql": {"minorUnits": "3033", "count": 3},
            "python": {"minorUnits": "3033", "count": 3},
            "diagnostics": diagnostics(v2plan(), **change),
        }
    )
    result = verify_evidence(plan, evidence)
    assert result["verification"] != "VERIFIED"
    assert result["classification"] == expected


def test_v2_missing_or_incompatible_diagnostics_are_inconclusive():
    from pydantic import ValidationError

    from hypothron.agents.models import EvidenceInput, MetricPlan
    from hypothron.verification import verify_evidence

    plan = MetricPlan.model_validate(v2plan())
    payload = {
        "jobId": "x",
        "datasetHash": HASH,
        "sql": {"minorUnits": "3033", "count": 3},
        "python": {"minorUnits": "3033", "count": 3},
    }
    assert (
        verify_evidence(plan, EvidenceInput.model_validate(payload))["verification"]
        == "INCONCLUSIVE"
    )
    bad = diagnostics({**v2plan(), "currency": "JPY"})
    assert (
        verify_evidence(plan, EvidenceInput.model_validate({**payload, "diagnostics": bad}))[
            "verification"
        ]
        == "INCONCLUSIVE"
    )
    with pytest.raises(ValidationError):
        MetricPlan.model_validate({**v2plan(), "currency": "BTC"})
    with pytest.raises(ValidationError):
        MetricPlan.model_validate({**v2plan(), "timezone": "America/New_York"})
    with pytest.raises(ValidationError):
        MetricPlan.model_validate({**v2plan(), "grainKeys": []})
    original = request()["datasets"][0]["contract"]
    assert MetricPlan.model_validate(original).model_dump(mode="json", by_alias=True) == original


@pytest.mark.asyncio
async def test_correction_recovery_keeps_job_and_cancel_fences_pending_verification():
    import os

    from pydantic import SecretStr
    from test_ledger import setup

    from hypothron.driver import InvestigationDriver
    from hypothron.ledger import LedgerError

    app, ledger, owner, run = await setup()
    provider = Script(
        [
            ("planner", hypotheses()),
            ("analyst", {"action": "execute", "hypothesisId": "h1", "reason": "Test"}),
        ]
    )
    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    first = await driver.advance(owner, run.id, SecretStr("ephemeral-canary"), provider=provider)
    original = first["pending"]
    payload = {
        "jobId": original["id"],
        "datasetHash": HASH,
        "sql": {"minorUnits": "11800", "count": 3},
        "python": {"minorUnits": "12000", "count": 3},
    }
    await ledger.submit(owner, run.id, payload)
    correction = await driver.advance(
        owner, run.id, SecretStr("ephemeral-canary"), provider=provider
    )
    fresh = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    recovered = await fresh.advance(owner, run.id, SecretStr("ephemeral-canary"), provider=provider)
    assert recovered["pending"]["id"] == correction["pending"]["id"]
    assert recovered["pending"]["dependsOn"] == [original["id"]]
    assert recovered["evidence"][0]["classification"] == "VALUE_MISMATCH"
    assert "ephemeral-canary" not in repr(recovered)
    await ledger.cancel(owner, run.id)
    with pytest.raises(LedgerError, match="RUN_TERMINAL"):
        await ledger.submit(owner, run.id, {**payload, "jobId": correction["pending"]["id"]})
    assert provider.calls == ["planner", "analyst"]
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.parametrize(
    "timezone,start,end",
    [
        ("+05:30", "2025-07-01T00:00:00+05:30", "2025-10-01T00:00:00+05:30"),
        ("-04:00", "2025-07-01T00:00:00-04:00", "2025-10-01T00:00:00-04:00"),
    ],
)
def test_v2_fixed_offset_period_contract(timezone, start, end):
    from pydantic import ValidationError

    from hypothron.agents.models import MetricPlan

    assert (
        MetricPlan.model_validate(
            {**v2plan(), "timezone": timezone, "start": start, "end": end}
        ).timezone
        == timezone
    )
    with pytest.raises(ValidationError):
        MetricPlan.model_validate({**v2plan(), "timezone": timezone})


def test_metric_contract_has_deep_immutable_semantics():
    from pydantic import ValidationError

    from hypothron.agents.models import MetricPlan

    plan = MetricPlan.model_validate(
        {
            **v2plan(),
            "relationship": {
                "datasetHash": "b" * 64,
                "keyColumn": "customer_id",
                "lookupKeyColumn": "customer_id",
                "cardinality": "many_to_one",
                "populationCount": 3,
            },
        }
    )
    with pytest.raises((AttributeError, TypeError)):
        plan.grain_keys.append("other")
    with pytest.raises(ValidationError):
        plan.relationship.population_count = 4


@pytest.mark.parametrize(
    "policy,left,right,changes,expected",
    [
        (
            "exclude",
            {"minorUnits": None, "count": 0},
            {"minorUnits": "1", "count": 1},
            None,
            "POPULATION_MISMATCH",
        ),
        (
            "error",
            {"minorUnits": "3033", "count": 2},
            {"minorUnits": "3033", "count": 2},
            {"nullAmounts": 1},
            "NULL_POLICY_VIOLATION",
        ),
    ],
)
def test_missing_population_or_forbidden_nulls_cannot_be_verified(
    policy, left, right, changes, expected
):
    from hypothron.agents.models import EvidenceInput, MetricPlan
    from hypothron.verification import verify_evidence

    plan = {**v2plan(), "nullPolicy": policy} if changes else request()["datasets"][0]["contract"]
    payload = {"jobId": "x", "datasetHash": HASH, "sql": left, "python": right}
    if changes:
        d = diagnostics(plan, **changes)
        d["sql"] = d["python"].copy()
        payload["diagnostics"] = d
    verdict = verify_evidence(
        MetricPlan.model_validate(plan), EvidenceInput.model_validate(payload)
    )
    assert verdict["verification"] == "DISPUTED" and verdict["classification"] == expected
