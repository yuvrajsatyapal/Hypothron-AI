import json

import pytest
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from hypothron.agents.workflow import build_workflow, initial_state

HASH = "a" * 64


def request():
    return {
        "question": "Why did revenue change?",
        "datasets": [
            {
                "datasetHash": HASH,
                "columns": ["revenue", "completed_at"],
                "contract": {
                    "version": 1,
                    "kind": "revenue_sum",
                    "datasetHash": HASH,
                    "amountColumn": "revenue",
                    "dateColumn": "completed_at",
                    "start": "2025-07-01T00:00:00Z",
                    "end": "2025-10-01T00:00:00Z",
                    "timezone": "UTC",
                    "currency": "USD",
                    "nullPolicy": "exclude",
                },
            }
        ],
    }


def hypotheses():
    return {
        "clarification": None,
        "hypotheses": [
            {
                "id": "h1",
                "statement": "Revenue differs in the approved population",
                "datasetHash": HASH,
                "priority": 1,
            }
        ],
    }


class Script:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    async def __call__(self, role, context, schema):
        expected, reply = self.replies.pop(0)
        assert role == expected
        assert "key" not in json.dumps(context)
        self.calls.append(role)
        return reply


@pytest.mark.asyncio
async def test_conditional_agents_clarify_execute_follow_up_and_report():
    provider = Script(
        [
            ("planner", {"clarification": "Use which approved period?", "hypotheses": []}),
            ("planner", hypotheses()),
            (
                "analyst",
                {
                    "action": "execute",
                    "hypothesisId": "h1",
                    "reason": "Test the primary hypothesis",
                },
            ),
            (
                "analyst",
                {
                    "action": "execute",
                    "hypothesisId": "h1",
                    "reason": "Recompute after conflicting evidence",
                },
            ),
            ("analyst", {"action": "finish", "hypothesisId": None, "reason": "Evidence collected"}),
            (
                "report",
                {
                    "conclusion": "Two recomputations agree under the approved definition",
                    "citations": ["placeholder"],
                },
            ),
        ]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "flow"}}
    first = await graph.ainvoke(initial_state(request()), cfg)
    assert first["__interrupt__"][0].value["kind"] == "clarification"
    second = await graph.ainvoke(Command(resume={"answer": "The approved Q3 UTC period"}), cfg)
    job = second["__interrupt__"][0].value
    assert job["kind"] == "execution" and job["plan"]["datasetHash"] == HASH
    evidence = {
        "jobId": job["id"],
        "datasetHash": HASH,
        "sql": {"minorUnits": "3033", "count": 3},
        "python": {"minorUnits": "3033", "count": 3},
    }
    third = await graph.ainvoke(Command(resume=evidence), cfg)
    following = third["__interrupt__"][0].value
    assert following["id"] != job["id"] and following["dependsOn"] == [job["id"]]
    provider.replies[-1][1]["citations"] = [job["id"], following["id"]]
    final = await graph.ainvoke(Command(resume={**evidence, "jobId": following["id"]}), cfg)
    assert final["status"] == "COMPLETE" and final["calls"] == 6
    assert len(final["evidence"]) == 2 and final["evidence"][0]["verification"] == "VERIFIED"
    assert provider.calls == ["planner", "planner", "analyst", "analyst", "analyst", "report"]


@pytest.mark.asyncio
async def test_budget_stops_before_outbound_attempt():
    provider = Script([])
    graph = build_workflow(provider, InMemorySaver())
    state = initial_state(request())
    state["calls"] = 12
    result = await graph.ainvoke(state, {"configurable": {"thread_id": "budget"}})
    assert result["status"] == "BUDGET_EXHAUSTED" and provider.calls == []


@pytest.mark.asyncio
async def test_unknown_dataset_hypothesis_fails_before_any_execution():
    bad = hypotheses()
    bad["hypotheses"][0]["datasetHash"] = "b" * 64
    provider = Script([("planner", bad)])
    graph = build_workflow(provider, InMemorySaver())
    result = await graph.ainvoke(initial_state(request()), {"configurable": {"thread_id": "bad"}})
    assert result["status"] == "FAILED" and result["error"] == "INVALID_ROLE_OUTPUT"


@pytest.mark.asyncio
async def test_result_is_bound_to_issued_job_and_snapshot():
    provider = Script(
        [
            ("planner", hypotheses()),
            ("analyst", {"action": "execute", "hypothesisId": "h1", "reason": "Test"}),
        ]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "bind"}}
    output = await graph.ainvoke(initial_state(request()), cfg)
    job = output["__interrupt__"][0].value
    result = await graph.ainvoke(
        Command(
            resume={
                "jobId": job["id"],
                "datasetHash": "b" * 64,
                "sql": {"minorUnits": "3033", "count": 3},
                "python": {"minorUnits": "3033", "count": 3},
            }
        ),
        cfg,
    )
    assert result["status"] == "FAILED" and result["error"] == "INVALID_EVIDENCE"


@pytest.mark.asyncio
async def test_report_cannot_cite_nonexistent_evidence():
    provider = Script(
        [
            ("planner", hypotheses()),
            ("analyst", {"action": "execute", "hypothesisId": "h1", "reason": "Test"}),
            ("analyst", {"action": "finish", "hypothesisId": None, "reason": "Enough"}),
            ("report", {"conclusion": "Claim", "citations": ["orphan"]}),
        ]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "cite"}}
    output = await graph.ainvoke(initial_state(request()), cfg)
    job = output["__interrupt__"][0].value
    final = await graph.ainvoke(
        Command(
            resume={
                "jobId": job["id"],
                "datasetHash": HASH,
                "sql": {"minorUnits": "3033", "count": 3},
                "python": {"minorUnits": "3033", "count": 3},
            }
        ),
        cfg,
    )
    assert final["status"] == "FAILED" and final["error"] == "ORPHAN_CITATION"


@pytest.mark.asyncio
async def test_invalid_clarification_does_not_restart_inference():
    provider = Script([("planner", {"clarification": "Which approved metric?", "hypotheses": []})])
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "clarification-invalid"}}
    await graph.ainvoke(initial_state(request()), cfg)
    final = await graph.ainvoke(Command(resume={"answer": "", "key": "forbidden"}), cfg)
    assert final["status"] == "FAILED" and len(provider.calls) == 1


@pytest.mark.asyncio
async def test_job_cap_terminates_execution_loop_deterministically():
    provider = Script(
        [("planner", hypotheses())]
        + [
            ("analyst", {"action": "execute", "hypothesisId": "h1", "reason": "Test"})
            for _ in range(6)
        ]
        + [("report", {"conclusion": "Capped run", "citations": []})]
    )
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "job-limit"}}
    result = await graph.ainvoke(initial_state(request()), cfg)
    ids = []
    for _ in range(6):
        job = result["__interrupt__"][0].value
        ids.append(job["id"])
        if len(ids) == 6:
            provider.replies[-1][1]["citations"] = ids
        result = await graph.ainvoke(
            Command(
                resume={
                    "jobId": job["id"],
                    "datasetHash": HASH,
                    "sql": {"minorUnits": "1", "count": 1},
                    "python": {"minorUnits": "2", "count": 1},
                }
            ),
            cfg,
        )
    assert result["status"] == "COMPLETE" and result["calls"] == 8
    assert len(result["jobs"]) == 6 and all(
        e["verification"] == "DISPUTED" for e in result["evidence"]
    )


@pytest.mark.asyncio
async def test_provider_timeout_is_counted_and_never_automatically_retried():
    from hypothron.providers.http import ProviderError

    class TimeoutProvider:
        async def __call__(self, role, context, schema):
            raise ProviderError("PROVIDER_TIMEOUT_BILLING_UNKNOWN")

    graph = build_workflow(TimeoutProvider(), InMemorySaver())
    result = await graph.ainvoke(
        initial_state(request()), {"configurable": {"thread_id": "timeout"}}
    )
    assert result["status"] == "FAILED" and result["calls"] == 1
    assert result["error"] == "PROVIDER_TIMEOUT_BILLING_UNKNOWN"


@pytest.mark.asyncio
async def test_one_clarification_limit_stops_a_repeating_planner():
    provider = Script([("planner", {"clarification": "Which metric?", "hypotheses": []})] * 2)
    graph = build_workflow(provider, InMemorySaver())
    cfg = {"configurable": {"thread_id": "repeat-clarification"}}
    await graph.ainvoke(initial_state(request()), cfg)
    result = await graph.ainvoke(Command(resume={"answer": "The approved contract"}), cfg)
    assert (
        result["status"] == "FAILED"
        and result["error"] == "CLARIFICATION_LIMIT"
        and result["calls"] == 2
    )


@pytest.mark.asyncio
async def test_third_approved_dataset_can_be_selected_without_raw_rows():
    req = request()
    for letter in "bc":
        req["datasets"].append(
            {
                "datasetHash": letter * 64,
                "columns": ["revenue", "completed_at"],
                "contract": {**req["datasets"][0]["contract"], "datasetHash": letter * 64},
            }
        )
    chosen = hypotheses()
    chosen["hypotheses"][0]["datasetHash"] = "c" * 64
    provider = Script(
        [
            ("planner", chosen),
            (
                "analyst",
                {"action": "execute", "hypothesisId": "h1", "reason": "Compare approved data"},
            ),
        ]
    )
    graph = build_workflow(provider, InMemorySaver())
    result = await graph.ainvoke(initial_state(req), {"configurable": {"thread_id": "three"}})
    assert result["__interrupt__"][0].value["plan"]["datasetHash"] == "c" * 64
    serialized = json.dumps(
        (await graph.aget_state({"configurable": {"thread_id": "three"}})).values
    )
    assert "rawRows" not in serialized and "csv_text" not in serialized


@pytest.mark.asyncio
async def test_genuine_role_adapter_uses_header_key_and_reservation_without_checkpoint_credentials():
    import httpx
    from pydantic import SecretStr

    from hypothron.agents.provider import RequestRoleProvider

    reservations = []
    usage = []

    async def reserve(role):
        reservations.append(role)

    async def observe(role, tokens, elapsed):
        usage.append((role, tokens.total_tokens, elapsed))

    async def respond(req):
        assert req.headers["x-goog-api-key"] == "test-canary-key"
        body = json.loads(req.content)
        assert "test-canary-key" not in json.dumps(body)
        assert reservations == ["planner"]
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {"clarification": "Which metric?", "hypotheses": []}
                                    )
                                }
                            ]
                        },
                    }
                ]
            },
        )

    provider = RequestRoleProvider(
        provider="gemini",
        model="gemini-test",
        key=SecretStr("test-canary-key"),
        reserve=reserve,
        observe=observe,
        transport=httpx.MockTransport(respond),
    )
    saver = InMemorySaver()
    graph = build_workflow(provider, saver)
    cfg = {"configurable": {"thread_id": "real-adapter"}}
    result = await graph.ainvoke(initial_state(request()), cfg)
    assert result["__interrupt__"][0].value["kind"] == "clarification"
    assert usage[0][1] is None
    for checkpoint in saver.list(cfg):
        assert "test-canary-key" not in repr(
            checkpoint.checkpoint
        ) and "test-canary-key" not in repr(checkpoint.metadata)
