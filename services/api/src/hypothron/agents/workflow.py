"""Genuine conditional LangGraph, with JSON-only checkpoint state and finite policy.

Caller supplies request-scoped role transport and checkpointer. Production ownership,
atomic reservation/fencing and reconciliation belong to the PostgreSQL ledger.
"""

from typing import Any, Literal, Protocol, TypedDict
from uuid import uuid4

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import interrupt
from pydantic import BaseModel, ValidationError

from hypothron.agents.models import (
    AnalystReply,
    Clarification,
    EvidenceInput,
    MetricPlan,
    PlannerReply,
    ReportReply,
    RunInput,
)
from hypothron.providers.http import ProviderError
from hypothron.verification import contract_hash, verify_evidence

Role = Literal["planner", "analyst", "report"]


class RoleProvider(Protocol):
    async def __call__(
        self, role: Role, context: dict[str, Any], schema: type[BaseModel]
    ) -> dict[str, Any]: ...


class State(TypedDict, total=False):
    request: dict[str, Any]
    calls: int
    clarifications: int
    answers: list[str]
    hypotheses: list[dict[str, Any]]
    jobs: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    pending: dict[str, Any]
    decision: dict[str, Any]
    clarification: str | None
    status: str
    error: str
    report: dict[str, Any]
    corrections: dict[str, int]


def initial_state(request: object) -> State:
    validated = RunInput.model_validate(request)
    return {
        "request": validated.model_dump(mode="json", by_alias=True),
        "calls": 0,
        "clarifications": 0,
        "answers": [],
        "hypotheses": [],
        "jobs": [],
        "evidence": [],
        "status": "PLANNING",
        "corrections": {},
    }


class RoleFailure(Exception):
    pass


def build_workflow(
    provider: RoleProvider, checkpointer: BaseCheckpointSaver[Any]
) -> CompiledStateGraph[State, None, State, State]:
    async def ask(state: State, role: Role, schema: type[BaseModel]) -> BaseModel:
        if state["calls"] >= 12:
            raise RoleFailure("BUDGET_EXHAUSTED")
        context = {
            "callOrdinal": state["calls"] + 1,
            "question": state["request"]["question"],
            "datasets": state["request"]["datasets"],
            "clarificationAnswers": state["answers"],
            "hypotheses": state["hypotheses"],
            "evidence": state["evidence"],
            "role": role,
        }
        try:
            return schema.model_validate(await provider(role, context, schema), strict=True)
        except ValidationError:
            raise RoleFailure("INVALID_ROLE_OUTPUT") from None
        except ProviderError as error:
            # Adapter owns stable public codes; never persist its request/client/exception object.
            raise RoleFailure(str(error)) from None

    def failed(state: State, error: RoleFailure) -> State:
        budget = str(error) == "BUDGET_EXHAUSTED"
        return {
            "status": "BUDGET_EXHAUSTED" if budget else "FAILED",
            "error": str(error),
            "calls": state["calls"] + (0 if budget else 1),
        }

    async def planner(state: State) -> State:
        try:
            reply = await ask(state, "planner", PlannerReply)
            assert isinstance(reply, PlannerReply)
            hashes = {d["datasetHash"] for d in state["request"]["datasets"]}
            if any(h.dataset_hash not in hashes for h in reply.hypotheses):
                raise RoleFailure("INVALID_ROLE_OUTPUT")
            if reply.clarification and state["clarifications"] >= 1:
                raise RoleFailure("CLARIFICATION_LIMIT")
            return {
                "calls": state["calls"] + 1,
                "clarification": reply.clarification,
                "hypotheses": [
                    h.model_dump(mode="json", by_alias=True)
                    for h in sorted(reply.hypotheses, key=lambda h: h.priority)
                ],
                "status": "CLARIFYING" if reply.clarification else "ANALYZING",
            }
        except RoleFailure as error:
            return failed(state, error)

    def clarify(state: State) -> State:
        try:
            response = Clarification.model_validate(
                interrupt({"kind": "clarification", "question": state["clarification"]})
            )
        except ValidationError:
            return {"status": "FAILED", "error": "INVALID_CLARIFICATION"}
        return {
            "answers": state["answers"] + [response.answer],
            "clarifications": state["clarifications"] + 1,
            "status": "PLANNING",
        }

    async def analyst(state: State) -> State:
        if len(state["jobs"]) >= 6:
            return {"decision": {"action": "finish"}, "status": "REPORTING"}
        try:
            reply = await ask(state, "analyst", AnalystReply)
            assert isinstance(reply, AnalystReply)
            if reply.action == "execute" and reply.hypothesis_id not in {
                h["id"] for h in state["hypotheses"]
            }:
                raise RoleFailure("INVALID_ROLE_OUTPUT")
            if reply.action == "execute":
                hypothesis = next(h for h in state["hypotheses"] if h["id"] == reply.hypothesis_id)
                dataset = next(
                    d
                    for d in state["request"]["datasets"]
                    if d["datasetHash"] == hypothesis["datasetHash"]
                )
                identity = contract_hash(MetricPlan.model_validate(dataset["contract"]))
                if state.get("corrections", {}).get(identity, 0) >= 2:
                    return {
                        "calls": state["calls"] + 1,
                        "decision": {"action": "finish"},
                        "status": "REPORTING",
                    }
            return {
                "calls": state["calls"] + 1,
                "decision": reply.model_dump(mode="json", by_alias=True),
                "status": "ISSUING" if reply.action == "execute" else "REPORTING",
            }
        except RoleFailure as error:
            return failed(state, error)

    def issue(state: State) -> State:
        hypothesis = next(
            h for h in state["hypotheses"] if h["id"] == state["decision"]["hypothesisId"]
        )
        dataset = next(
            d for d in state["request"]["datasets"] if d["datasetHash"] == hypothesis["datasetHash"]
        )
        # This node completes/checkpoints before the interrupt node restarts on resume.
        # No fresh job ID is generated inside the replayed wait node.
        job = {
            "kind": "execution",
            "id": str(uuid4()),
            "hypothesisId": hypothesis["id"],
            "plan": dataset["contract"],
            "dependsOn": [e["jobId"] for e in state["evidence"]],
            "reason": state["decision"]["reason"],
        }
        return {"pending": job, "jobs": state["jobs"] + [job], "status": "WAITING_RESULT"}

    def accept(state: State) -> State:
        try:
            evidence = EvidenceInput.model_validate(interrupt(state["pending"]))
            if (
                evidence.job_id != state["pending"]["id"]
                or evidence.dataset_hash != state["pending"]["plan"]["datasetHash"]
            ):
                raise ValueError("INVALID_EVIDENCE")
        except (ValidationError, ValueError):
            return {"status": "FAILED", "error": "INVALID_EVIDENCE"}
        verdict = verify_evidence(MetricPlan.model_validate(state["pending"]["plan"]), evidence)
        record = (
            evidence.model_dump(mode="json", by_alias=True)
            | verdict
            | {
                "hypothesisId": state["pending"]["hypothesisId"],
                "dependsOn": state["pending"]["dependsOn"],
            }
        )
        return {"evidence": state["evidence"] + [record], "pending": {}, "status": "ANALYZING"}

    def correction(state: State) -> State:
        last = state["evidence"][-1]
        identity = last["contractHash"]
        used = state.get("corrections", {}).get(identity, 0)
        if used >= 2 or len(state["jobs"]) >= 6:
            return {"status": "REPORTING", "decision": {"action": "finish"}}
        return {
            "corrections": state.get("corrections", {}) | {identity: used + 1},
            "decision": {
                "action": "execute",
                "hypothesisId": last["hypothesisId"],
                "reason": "Deterministic correction: recompute original approved contract",
            },
            "status": "ISSUING",
        }

    def route_accept(state: State) -> str:
        if state["status"] == "FAILED":
            return END
        return "correction" if state["evidence"][-1]["verification"] == "DISPUTED" else "analyst"

    async def report(state: State) -> State:
        if not state["evidence"]:
            return {
                "status": "COMPLETE",
                "report": {
                    "conclusion": "No calculation evidence was collected; no numerical claim is supported.",
                    "citations": [],
                },
            }
        try:
            reply = await ask(state, "report", ReportReply)
            assert isinstance(reply, ReportReply)
            known = {e["jobId"] for e in state["evidence"]}
            if not reply.citations or any(ref not in known for ref in reply.citations):
                raise RoleFailure("ORPHAN_CITATION")
            return {
                "calls": state["calls"] + 1,
                "status": "COMPLETE",
                "report": reply.model_dump(mode="json", by_alias=True),
            }
        except RoleFailure as error:
            return failed(state, error)

    def route_planner(state: State) -> str:
        if state["status"] in {"FAILED", "BUDGET_EXHAUSTED"}:
            return END
        return "clarify" if state["clarification"] else "analyst"

    def route_analyst(state: State) -> str:
        if state["status"] in {"FAILED", "BUDGET_EXHAUSTED"}:
            return END
        return "issue" if state["decision"]["action"] == "execute" else "report"

    graph = StateGraph(State)
    for name, node in [
        ("planner", planner),
        ("clarify", clarify),
        ("analyst", analyst),
        ("issue", issue),
        ("accept", accept),
        ("report", report),
        ("correction", correction),
    ]:
        graph.add_node(name, node)
    graph.add_edge(START, "planner")
    graph.add_conditional_edges("planner", route_planner)
    graph.add_conditional_edges("clarify", lambda s: END if s["status"] == "FAILED" else "planner")
    graph.add_conditional_edges("analyst", route_analyst)
    graph.add_edge("issue", "accept")
    graph.add_conditional_edges("accept", route_accept)
    graph.add_conditional_edges(
        "correction", lambda s: "issue" if s["status"] == "ISSUING" else "report"
    )
    graph.add_edge("report", END)
    return graph.compile(checkpointer=checkpointer)
