"""Evidence-grounded presentation. Untrusted prose has no publication authority."""

from fractions import Fraction
from typing import Any

from hypothron.agents.models import ReportReply


class ReportError(ValueError):
    pass


def fallback_report(evidence: list[dict[str, Any]], rejection: str | None = None) -> dict[str, Any]:
    findings = [
        {
            "id": f"finding-{i + 1}",
            "evidenceId": e["jobId"],
            "datasetHash": e["datasetHash"],
            "contractHash": e["contractHash"],
            "metricVersion": e["metricVersion"],
            "currency": e["currency"],
            "verification": e["verification"],
            "provenance": "CLIENT_REPORTED",
            "assessment": "SUPPORTED" if e["verification"] == "VERIFIED" else e["verification"],
            "relation": "observed",
            "sql": e["sql"],
            "python": e["python"],
            "dependsOn": e["dependsOn"],
        }
        for i, e in enumerate(evidence)
    ]
    return {
        "version": 1,
        "conclusion": (
            "Observed computations are client-reported; evidence states are shown below. Arithmetic agreement does not establish causality."
            if evidence
            else "No calculation evidence was collected; no numerical claim is supported."
        ),
        "citations": [e["jobId"] for e in evidence],
        "source": "deterministic_fallback",
        "rejection": rejection,
        "findings": findings,
        "claims": [],
        "charts": [
            {
                "kind": "engine_comparison",
                "evidenceId": e["jobId"],
                "currency": e["currency"],
                "sqlMinorUnits": e["sql"]["minorUnits"],
                "pythonMinorUnits": e["python"]["minorUnits"],
            }
            for e in evidence
        ],
    }


def _compatible(left: dict[str, Any], right: dict[str, Any]) -> bool:
    # Comparisons may intentionally change source/period; every other business rule must agree.
    a, b = left.get("contract"), right.get("contract")
    if not isinstance(a, dict) or not isinstance(b, dict):
        return False
    return (
        left["currency"] == right["currency"]
        and left["metricVersion"] == right["metricVersion"]
        and {k: v for k, v in a.items() if k not in {"datasetHash", "start", "end"}}
        == {k: v for k, v in b.items() if k not in {"datasetHash", "start", "end"}}
    )


def validated_report(proposal: object, evidence: list[dict[str, Any]]) -> dict[str, Any]:
    reply = ReportReply.model_validate(proposal)
    known = {e["jobId"]: e for e in evidence}
    if (
        (evidence and not reply.citations)
        or len(set(reply.citations)) != len(reply.citations)
        or any(ref not in known for ref in reply.citations)
    ):
        raise ReportError("ORPHAN_CITATION")
    # Fixed qualitative grammar makes spelled-out or obfuscated numerical/causal prose inert.
    if reply.conclusion not in {
        "Evidence collected.",
        "Local evidence agrees.",
        "The independent local computations agree.",
        "The disagreement remains unresolved.",
    }:
        raise ReportError("UNTRUSTED_NARRATIVE")
    if reply.conclusion in {
        "Local evidence agrees.",
        "The independent local computations agree.",
    } and any(known[ref]["verification"] != "VERIFIED" for ref in reply.citations):
        raise ReportError("UNVERIFIED_OPERAND")
    claims = []
    for claim in reply.claims:
        if claim.kind not in {"total", "count", "percent_change"}:
            raise ReportError("UNSUPPORTED_RELATION")
        refs = claim.evidence_ids
        if len(set(refs)) != len(refs) or any(
            ref not in known or ref not in reply.citations for ref in refs
        ):
            raise ReportError("ORPHAN_CITATION")
        values = [known[ref] for ref in refs]
        current = values[-1]
        if (
            current["datasetHash"] != claim.dataset_hash
            or current["contractHash"] != claim.contract_hash
        ):
            raise ReportError("INCOMPATIBLE_CITATION")
        if any(
            e["verification"] != "VERIFIED"
            or e["provenance"] != "CLIENT_REPORTED"
            or e["sql"] != e["python"]
            for e in values
        ):
            raise ReportError("UNVERIFIED_OPERAND")
        if claim.kind in {"total", "count"}:
            if len(values) != 1 or claim.unit != (
                "minor_units" if claim.kind == "total" else "rows"
            ):
                raise ReportError("INCOMPATIBLE_CITATION")
            raw = current["sql"]["minorUnits"] if claim.kind == "total" else current["sql"]["count"]
            if raw is None:
                raise ReportError("UNVERIFIED_OPERAND")
            expected = Fraction(int(raw))
        else:
            if len(values) != 2 or claim.unit != "percent" or not _compatible(values[0], current):
                raise ReportError("INCOMPATIBLE_CITATION")
            baseline_raw, current_raw = values[0]["sql"]["minorUnits"], current["sql"]["minorUnits"]
            if baseline_raw is None or current_raw is None:
                raise ReportError("UNVERIFIED_OPERAND")
            baseline = int(baseline_raw)
            if baseline == 0:
                raise ReportError("UNDEFINED_BASELINE")
            expected = Fraction((int(current_raw) - baseline) * 100, baseline)
        if Fraction(claim.value) != expected:
            raise ReportError("UNSUPPORTED_NUMERICAL_CLAIM")
        normalized = claim.model_dump(mode="json", by_alias=True)
        if claim.kind in {"total", "count"}:
            normalized["value"] = str(expected.numerator)
        claims.append(normalized)
    result = fallback_report(evidence)
    result.update(source="validated", claims=claims)
    return result
