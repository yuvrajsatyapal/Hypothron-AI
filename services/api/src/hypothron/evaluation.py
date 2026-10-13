"""Offline scripted-policy comparison; never mounted by the application.

Only MockTransport is constructed here. Browser observations supply measured
arithmetic, while genuine PostgreSQL checkpoints/ledger drive the multi-role arm.
The baseline has one structured decision loop combining selection and reporting.
"""

import argparse
import asyncio
import hashlib
import json
import os
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path
from statistics import median
from time import monotonic
from typing import Any, Literal
from uuid import uuid4

import httpx
from pydantic import BaseModel, Field, SecretStr, ValidationError, model_validator

from hypothron.agents.models import (
    EvidenceInput,
    Hash,
    MetricPlan,
    ReportReply,
    RunInput,
    StrictModel,
)
from hypothron.api import create_app
from hypothron.driver import InvestigationDriver
from hypothron.ledger import Ledger
from hypothron.providers.http import ProviderError, generate
from hypothron.reporting import ReportError, fallback_report, validated_report
from hypothron.verification import verify_evidence

MODEL = "gemini-test"
MAX_CALLS = 12
MAX_JOBS = 6
Decision = Callable[[dict[str, Any], type[BaseModel]], Awaitable[dict[str, Any]]]
ROOT = Path(__file__).resolve().parents[4]


class BaselineDecision(StrictModel):
    action: Literal["execute", "finish"]
    dataset_hash: Hash | None = Field(alias="datasetHash")
    report: ReportReply | None

    @model_validator(mode="after")
    def exclusive(self) -> "BaselineDecision":
        if self.action == "execute":
            if self.dataset_hash is None or self.report is not None:
                raise ValueError("INVALID_DECISION")
        elif self.dataset_hash is not None or self.report is None:
            raise ValueError("INVALID_DECISION")
        return self


def proposal(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    """Script only quotes verified observed values; the shared validator decides authority."""
    claims = []
    for item in evidence:
        if item["verification"] == "VERIFIED":
            claims.append(
                {
                    "kind": "total",
                    "evidenceIds": [item["jobId"]],
                    "datasetHash": item["datasetHash"],
                    "contractHash": item["contractHash"],
                    "value": item["sql"]["minorUnits"],
                    "unit": "minor_units",
                }
            )
    return {
        "conclusion": "Evidence collected.",
        "citations": [item["jobId"] for item in evidence],
        "claims": claims,
    }


class ScriptedGemini:
    """Same zero-temperature mock Gemini model and wire envelope in both arms.

    Scripts are schema-specific policies, not cached golden numerical answers.
    No usageMetadata is supplied: token observations must remain unavailable.
    """

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert request.url.host == "generativelanguage.googleapis.com"
        assert request.url.path.endswith(f"/{MODEL}:generateContent")
        config = body["generationConfig"]
        assert config["maxOutputTokens"] == 1024
        assert config["temperature"] == 0
        prompt = body["contents"][0]["parts"][0]["text"]
        context = json.loads(prompt.split("\nApproved context: ", 1)[1])
        role = context["role"]
        datasets, evidence = context["datasets"], context["evidence"]
        self.calls.append(
            {"role": role, "model": MODEL, "maxOutputTokens": config["maxOutputTokens"]}
        )
        if role == "single":
            done = {item["datasetHash"] for item in evidence}
            next_dataset = next(
                (item for item in datasets if item["datasetHash"] not in done), None
            )
            reply = (
                {"action": "execute", "datasetHash": next_dataset["datasetHash"], "report": None}
                if next_dataset
                else {"action": "finish", "datasetHash": None, "report": proposal(evidence)}
            )
        elif role == "planner":
            reply = {
                "clarification": None,
                "hypotheses": [
                    {
                        "id": f"h{i + 1}",
                        "statement": "Test the approved revenue contract",
                        "datasetHash": dataset["datasetHash"],
                        "priority": i + 1,
                    }
                    for i, dataset in enumerate(datasets)
                ],
            }
        elif role == "analyst":
            done = {item["hypothesisId"] for item in evidence}
            hypothesis = next(
                (item for item in context["hypotheses"] if item["id"] not in done), None
            )
            reply = {
                "action": "execute" if hypothesis else "finish",
                "hypothesisId": hypothesis["id"] if hypothesis else None,
                "reason": "Evaluate each approved contract once",
            }
        else:
            assert role == "report"
            reply = proposal(evidence)
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(reply)}]}}
                ]
            },
        )


def measured_evidence(observation: dict[str, Any], job_id: str) -> dict[str, Any]:
    actual = observation["actual"]
    payload = {
        "jobId": job_id,
        "datasetHash": actual["plan"]["datasetHash"],
        "sql": actual["sql"],
        "python": actual["python"],
    }
    if actual.get("diagnostics") is not None:
        payload["diagnostics"] = actual["diagnostics"]
    return EvidenceInput.model_validate(payload).model_dump(mode="json", by_alias=True)


async def evaluate_single(
    request: object,
    observation: dict[str, Any],
    *,
    transport: httpx.MockTransport | None = None,
    decision: Decision | None = None,
) -> dict[str, Any]:
    approved = RunInput.model_validate(request).model_dump(mode="json", by_alias=True)
    state: dict[str, Any] = {"calls": 0, "evidence": [], "status": "ANALYZING", "tokens": None}
    started = monotonic()

    async def ask(context: dict[str, Any], schema: type[BaseModel]) -> dict[str, Any]:
        async def reserve() -> None:
            if state["calls"] >= MAX_CALLS:
                raise ProviderError("BUDGET_EXHAUSTED")
            state["calls"] += 1

        if decision is not None:
            await reserve()
            return await decision(context, schema)
        result = await generate(
            provider="gemini",
            model=MODEL,
            key=SecretStr("evaluation-mock-only"),
            prompt="Select an approved dataset or finish with an evidence-grounded report. "
            "No source code or contract changes.\nApproved context: " + json.dumps(context),
            reply_model=schema,
            reserve_attempt=reserve,
            transport=transport or httpx.MockTransport(ScriptedGemini()),
        )
        return result.reply.model_dump(mode="json", by_alias=True)

    corrections: dict[str, int] = {}
    try:
        while state["calls"] < MAX_CALLS:
            if len(state["evidence"]) >= MAX_JOBS:
                state.update(
                    status="COMPLETE",
                    error="JOB_BUDGET_EXHAUSTED",
                    report=fallback_report(state["evidence"], "JOB_BUDGET_EXHAUSTED"),
                )
                break
            context = approved | {
                "role": "single",
                "callOrdinal": state["calls"] + 1,
                "evidence": state["evidence"],
            }
            reply = BaselineDecision.model_validate(await ask(context, BaselineDecision))
            if reply.action == "finish":
                assert reply.report is not None
                try:
                    report = validated_report(
                        reply.report.model_dump(mode="json", by_alias=True), state["evidence"]
                    )
                except ReportError as error:
                    report = fallback_report(state["evidence"], str(error))
                state.update(status="COMPLETE", report=report)
                break
            dataset = next(
                (
                    item
                    for item in approved["datasets"]
                    if item["datasetHash"] == reply.dataset_hash
                ),
                None,
            )
            if dataset is None:
                raise ProviderError("UNAPPROVED_DATASET")
            plan = MetricPlan.model_validate(dataset["contract"])
            # The offline seam only has this measured contract, not an analytics runtime.
            if plan.model_dump(mode="json", by_alias=True) != observation["actual"]["plan"]:
                raise ProviderError("UNMEASURED_CONTRACT")
            payload = measured_evidence(observation, str(uuid4()))
            verdict = verify_evidence(plan, EvidenceInput.model_validate(payload))
            identity = verdict["contractHash"]
            if corrections.get(identity, 0) >= 3:
                state.update(
                    status="COMPLETE", report=fallback_report(state["evidence"], "CORRECTION_LIMIT")
                )
                break
            record = (
                payload | verdict | {"dependsOn": [item["jobId"] for item in state["evidence"]]}
            )
            state["evidence"].append(record)
            if verdict["verification"] == "DISPUTED":
                corrections[identity] = corrections.get(identity, 0) + 1
        else:
            state.update(
                status="BUDGET_EXHAUSTED",
                error="BUDGET_EXHAUSTED",
                report=fallback_report(state["evidence"], "BUDGET_EXHAUSTED"),
            )
    except (ValidationError, ProviderError) as error:
        state.update(
            status="FAILED",
            error=str(error) if isinstance(error, ProviderError) else "INVALID_ROLE_OUTPUT",
            report=fallback_report(state["evidence"]),
        )
    state["orchestrationElapsedMs"] = (monotonic() - started) * 1000
    return state


async def evaluate_multi(
    database_url: str,
    request: object,
    observation: dict[str, Any],
    wire: ScriptedGemini,
) -> dict[str, Any]:
    app = create_app(database_url=database_url)
    sessions = app.state.sessions
    started = monotonic()
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/v1/sessions")
            if response.status_code != 201:
                raise ValueError("EVALUATION_SESSION_UNAVAILABLE")
            owner = response.json()["id"]
        ledger = Ledger(sessions)
        run = await ledger.create(owner, request, "gemini", MODEL)
        driver = InvestigationDriver(database_url, ledger)
        for _ in range(MAX_JOBS + 1):
            state = await driver.advance(
                owner,
                run.id,
                SecretStr("evaluation-mock-only"),
                transport=httpx.MockTransport(wire),
            )
            if state["status"] != "WAITING_RESULT":
                break
            job = state["pending"]
            if job["plan"] != observation["actual"]["plan"]:
                raise ValueError("UNMEASURED_CONTRACT")
            await ledger.submit(owner, run.id, measured_evidence(observation, job["id"]))
        measurement = await ledger.measurements(owner, run.id)
        state.update(
            tokens=measurement["tokens"],
            durableAttempts=measurement["attempts"],
            providerElapsedMs=measurement["providerElapsedMs"],
            orchestrationElapsedMs=(monotonic() - started) * 1000,
        )
        if state["calls"] != measurement["attempts"] or state["calls"] > MAX_CALLS:
            raise ValueError("ATTEMPT_ACCOUNTING")
        return state
    finally:
        await sessions.kw["bind"].dispose()


def fixture_plan(fixture: dict[str, Any]) -> dict[str, Any]:
    relationship = None
    if "lookupCSV" in fixture:
        relationship = {
            "datasetHash": hashlib.sha256(fixture["lookupCSV"].encode()).hexdigest(),
            **fixture["relationship"],
        }
    return {
        "version": 2,
        "kind": "revenue_sum",
        "datasetHash": hashlib.sha256(fixture["csv"].encode()).hexdigest(),
        "amountColumn": "revenue",
        "dateColumn": "completed_at",
        **fixture["plan"],
        "relationship": relationship,
    }


def load_observations(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    report = json.loads(path.read_text())
    fixtures = json.loads((ROOT / "tests/fixtures/phase5-golden.json").read_text())
    population = fixtures["golden"] + fixtures["adversarial"]
    observed = report.get("observations", [])
    ids = [item["id"] for item in observed]
    if (
        report.get("schemaVersion") != 1
        or len(ids) != len(set(ids))
        or set(ids) != {item["id"] for item in population}
        or len(fixtures["golden"]) != 20
    ):
        raise ValueError("OBSERVATION_POPULATION")
    for fixture in population:
        item = next(item for item in observed if item["id"] == fixture["id"])
        if not item.get("pass"):
            raise ValueError("FAILED_ENGINE_OBSERVATION")
        if "expectedError" in fixture:
            if item.get("actualError") != fixture["expectedError"]:
                raise ValueError("ADVERSE_OBSERVATION_MISMATCH")
            continue
        actual, expected = item["actual"], fixture["expected"]
        if actual["plan"] != fixture_plan(fixture):
            raise ValueError("MEASURED_CONTRACT_MISMATCH")
        payload = measured_evidence(item, "validate")
        verdict = verify_evidence(
            MetricPlan.model_validate(actual["plan"]), EvidenceInput.model_validate(payload)
        )
        if (
            actual["sql"] != {"minorUnits": expected["minorUnits"], "count": expected["count"]}
            or actual["python"] != actual["sql"]
            or verdict["verification"] != expected["status"]
            or actual["status"] != expected["status"]
            or actual["provenance"] != "CLIENT_REPORTED"
        ):
            raise ValueError("ENGINE_GROUND_TRUTH_MISMATCH")
    return report, fixtures


def score(state: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    evidence = state["evidence"]
    target = {"minorUnits": expected["minorUnits"], "count": expected["count"]}
    correct = (
        len(evidence) == 1 and evidence[0]["sql"] == target and evidence[0]["python"] == target
    )
    status_correct = len(evidence) == 1 and evidence[0]["verification"] == expected["status"]
    return {
        "status": state["status"],
        "calls": state["calls"],
        "tokens": state["tokens"],
        "jobs": len(evidence),
        "evidenceCorrect": correct,
        "statusCorrect": status_correct,
        "completed": state["status"] == "COMPLETE" and correct and status_correct,
        "verified": sum(item["verification"] == "VERIFIED" for item in evidence),
        "independentlyChecked": len(evidence),
        "reportSource": state["report"]["source"],
        "reportClaimCount": len(state["report"]["claims"]),
        "orchestrationElapsedMs": state["orchestrationElapsedMs"],
    }


async def compare(path: Path, database_url: str) -> dict[str, Any]:
    source, fixtures = load_observations(path)
    rows = []
    for fixture in fixtures["golden"]:
        observed = next(item for item in source["observations"] if item["id"] == fixture["id"])
        plan = observed["actual"]["plan"]
        request = {
            "question": fixture["question"],
            "datasets": [
                {
                    "datasetHash": plan["datasetHash"],
                    "columns": fixture["csv"].splitlines()[0].split(","),
                    "contract": plan,
                }
            ],
        }
        single = await evaluate_single(request, observed)
        multi = await evaluate_multi(database_url, request, observed, ScriptedGemini())
        rows.append(
            {
                "id": fixture["id"],
                "expectedStatus": fixture["expected"]["status"],
                "engineElapsedMs": observed["elapsedMs"],
                "workerElapsedMs": observed["workerElapsedMs"],
                "engineMemory": observed["memory"],
                "engineRuntime": observed["runtime"],
                "single": score(single, fixture["expected"]),
                "multi": score(multi, fixture["expected"]),
                "multiDurableAttempts": multi["durableAttempts"],
            }
        )
    summaries = {}
    for arm in ("single", "multi"):
        measurements = [row[arm] for row in rows]
        summaries[arm] = {
            "runs": len(rows),
            "completed": sum(item["completed"] for item in measurements),
            "evidenceCorrect": sum(item["evidenceCorrect"] for item in measurements),
            "statusCorrect": sum(item["statusCorrect"] for item in measurements),
            "independentlyChecked": sum(item["independentlyChecked"] for item in measurements),
            "verified": sum(item["verified"] for item in measurements),
            "verifiedDenominator": sum(item["verified"] for item in measurements),
            "materialFindingsDenominator": sum(item["jobs"] for item in measurements),
            "reportClaims": sum(item["reportClaimCount"] for item in measurements),
            "falseVerified": sum(
                item["verified"] for item in measurements if not item["evidenceCorrect"]
            ),
            "attemptedCalls": sum(item["calls"] for item in measurements),
            "tokens": None,
            "cost": None,
            "orchestrationLatencyMs": {
                "samples": len(rows),
                "median": median(item["orchestrationElapsedMs"] for item in measurements),
                "p95": None,
            },
        }
    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(UTC).isoformat(),
        "source": {
            "path": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else path.name,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "generatedAt": source["generatedAt"],
            "target": source["target"],
            "fixtureSha256": hashlib.sha256(
                (ROOT / "tests/fixtures/phase5-golden.json").read_bytes()
            ).hexdigest(),
        },
        "conditions": {
            "provider": "gemini",
            "model": MODEL,
            "temperature": 0,
            "transport": "mock HTTP only",
            "attemptCeiling": MAX_CALLS,
            "outputTokenCeilingPerCall": 1024,
            "jobCeiling": MAX_JOBS,
            "multiPersistence": "real PostgreSQL/fenced checkpoints/ledger",
            "singlePersistence": "ephemeral offline decision loop",
            "sharedVerifier": "hypothron.verification.verify_evidence",
            "sharedReportValidator": "hypothron.reporting.validated_report",
        },
        "summary": summaries,
        "observations": rows,
        "adverseEngineRejections": {
            "observed": len(fixtures["adversarial"]),
            "orchestrationComparisonEligible": 0,
            "falseVerified": 0,
        },
        "limitations": [
            "Scripted regression policies, not held-out live-model evaluation or superiority evidence.",
            "Both policies consume the same measured browser results; engines are not re-executed inside Python.",
            "Orchestration timings exclude browser computation and are sequential warm/cold observations, not controlled performance trials.",
            "Single policy combines selection/reporting; multi policy additionally plans hypotheses and uses durable PostgreSQL.",
            "Tokens and cost unavailable: mock envelope omits usage, no paid inference occurred.",
            "No recovery, allocation or unsupported-claim rate is inferred from this orchestration comparison.",
            "CLIENT_REPORTED agreement is not execution attestation.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--observations", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = asyncio.run(compare(args.observations.resolve(), os.environ["DATABASE_URL"]))
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["summary"], indent=2))


if __name__ == "__main__":
    main()
