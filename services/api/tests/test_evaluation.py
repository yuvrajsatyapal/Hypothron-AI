import json
import os

import httpx
import pytest
from test_workflow import HASH, request

from hypothron import evaluation
from hypothron.evaluation import (
    BaselineDecision,
    ScriptedGemini,
    evaluate_multi,
    evaluate_single,
    load_observations,
)


def observation():
    return {
        "id": "unit-only",
        "actual": {
            "plan": request()["datasets"][0]["contract"],
            "sql": {"minorUnits": "3033", "count": 3},
            "python": {"minorUnits": "3033", "count": 3},
        },
    }


@pytest.mark.asyncio
async def test_single_loop_uses_real_wire_contract_verifier_and_validated_report():
    wire = ScriptedGemini()
    result = await evaluate_single(request(), observation(), transport=httpx.MockTransport(wire))
    assert result["calls"] == 2
    assert result["status"] == "COMPLETE"
    assert result["evidence"][0]["verification"] == "VERIFIED"
    assert result["evidence"][0]["provenance"] == "CLIENT_REPORTED"
    assert result["report"]["source"] == "validated"
    assert result["report"]["claims"][0]["value"] == "3033"
    assert result["tokens"] is None
    assert all(call["maxOutputTokens"] == 1024 for call in wire.calls)
    assert all(call["model"] == "gemini-test" for call in wire.calls)


@pytest.mark.asyncio
async def test_single_loop_denies_unapproved_selection_and_falls_back_on_bad_report():
    async def invalid(context, schema):
        return {"action": "execute", "datasetHash": "b" * 64, "report": None}

    denied = await evaluate_single(request(), observation(), decision=invalid)
    assert denied["status"] == "FAILED"
    assert denied["error"] == "UNAPPROVED_DATASET"
    assert denied["evidence"] == []

    async def bad_report(context, schema):
        if not context["evidence"]:
            return {"action": "execute", "datasetHash": HASH, "report": None}
        return {
            "action": "finish",
            "datasetHash": None,
            "report": {"conclusion": "Evidence collected.", "citations": ["invented"]},
        }

    result = await evaluate_single(request(), observation(), decision=bad_report)
    assert result["report"]["source"] == "deterministic_fallback"
    assert result["report"]["rejection"] == "ORPHAN_CITATION"


@pytest.mark.asyncio
async def test_single_loop_bounds_jobs_and_counts_invalid_attempts():
    async def repeat(context, schema):
        return {"action": "execute", "datasetHash": HASH, "report": None}

    result = await evaluate_single(request(), observation(), decision=repeat)
    assert result["calls"] == 6
    assert len(result["evidence"]) == 6
    assert result["error"] == "JOB_BUDGET_EXHAUSTED"

    async def malformed(context, schema):
        return {"action": "finish", "datasetHash": None, "report": None}

    result = await evaluate_single(request(), observation(), decision=malformed)
    assert result["calls"] == 1
    assert result["status"] == "FAILED"
    with pytest.raises(ValueError):
        BaselineDecision.model_validate(
            {
                "action": "execute",
                "datasetHash": HASH,
                "report": {"conclusion": "x", "citations": []},
            }
        )


@pytest.mark.asyncio
async def test_real_durable_multirole_adapter_matches_single_shared_verifier():
    wire = ScriptedGemini()
    multi = await evaluate_multi(os.environ["DATABASE_URL"], request(), observation(), wire)
    single = await evaluate_single(
        request(), observation(), transport=httpx.MockTransport(ScriptedGemini())
    )
    assert multi["status"] == single["status"] == "COMPLETE"
    assert multi["calls"] == multi["durableAttempts"] == 4
    assert multi["tokens"] is single["tokens"] is None
    assert multi["evidence"][0]["sql"] == single["evidence"][0]["sql"]
    assert multi["evidence"][0]["verification"] == single["evidence"][0]["verification"]
    assert multi["report"]["source"] == "validated"
    assert [call["role"] for call in wire.calls] == ["planner", "analyst", "analyst", "report"]


def test_observation_loader_refuses_missing_and_duplicated_measured_population(tmp_path):
    path = tmp_path / "measured.json"
    path.write_text(json.dumps({"schemaVersion": 1, "observations": []}))
    with pytest.raises(ValueError, match="OBSERVATION_POPULATION"):
        load_observations(path)
    fixtures = json.loads((evaluation.ROOT / "tests/fixtures/phase5-golden.json").read_text())
    entries = [{"id": item["id"]} for item in fixtures["golden"] + fixtures["adversarial"]]
    entries[-1] = entries[0]
    path.write_text(json.dumps({"schemaVersion": 1, "observations": entries}))
    with pytest.raises(ValueError, match="OBSERVATION_POPULATION"):
        load_observations(path)


@pytest.mark.asyncio
async def test_single_attempt_ceiling_and_unmeasured_contract_are_fail_closed(monkeypatch):
    async def repeat(context, schema):
        return {"action": "execute", "datasetHash": HASH, "report": None}

    monkeypatch.setattr(evaluation, "MAX_CALLS", 1)
    result = await evaluate_single(request(), observation(), decision=repeat)
    assert result["calls"] == 1
    assert result["status"] == "BUDGET_EXHAUSTED"
    assert result["report"]["rejection"] == "BUDGET_EXHAUSTED"
    altered = observation()
    altered["actual"]["plan"]["end"] = "2025-11-01T00:00:00Z"
    denied = await evaluate_single(request(), altered, decision=repeat)
    assert denied["status"] == "FAILED"
    assert denied["error"] == "UNMEASURED_CONTRACT"
    assert denied["evidence"] == []


@pytest.mark.asyncio
async def test_shared_verifier_and_report_refuse_disagreement_and_causality():
    altered = observation()
    altered["actual"]["python"]["minorUnits"] = "3000"
    disputed = await evaluate_single(request(), altered)
    assert disputed["evidence"][0]["verification"] == "DISPUTED"
    assert disputed["report"]["claims"] == []

    async def causal(context, schema):
        if not context["evidence"]:
            return {"action": "execute", "datasetHash": HASH, "report": None}
        item = context["evidence"][0]
        claim = evaluation.proposal(context["evidence"])["claims"][0]
        claim["kind"] = "causal"
        return {
            "action": "finish",
            "datasetHash": None,
            "report": {
                "conclusion": "Evidence collected.",
                "citations": [item["jobId"]],
                "claims": [claim],
            },
        }

    rejected = await evaluate_single(request(), observation(), decision=causal)
    assert rejected["report"]["source"] == "deterministic_fallback"
    assert rejected["report"]["rejection"] == "UNSUPPORTED_RELATION"
