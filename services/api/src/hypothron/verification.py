"""Deterministic comparisons of untrusted client evidence; never attestation."""

import hashlib
import json
from typing import Any

from hypothron.agents.models import EvidenceInput, MetricPlan


def contract_hash(plan: MetricPlan) -> str:
    payload = json.dumps(
        plan.model_dump(mode="json", by_alias=True),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def verify_evidence(plan: MetricPlan, evidence: EvidenceInput) -> dict[str, Any]:
    if plan.dataset_hash != evidence.dataset_hash:
        raise ValueError("INCOMPATIBLE_EVIDENCE")
    left, right = evidence.sql, evidence.python
    if left.count != right.count:
        status, classification = "DISPUTED", "POPULATION_MISMATCH"
    elif left.minor_units is None or right.minor_units is None:
        status, classification = "INCONCLUSIVE", "EMPTY_POPULATION"
    elif left.minor_units != right.minor_units:
        status, classification = "DISPUTED", "VALUE_MISMATCH"
    else:
        status, classification = "VERIFIED", "AGREEMENT"
    if plan.version == 2:
        diagnostic = evidence.diagnostics
        if diagnostic is None or diagnostic.contract != plan:
            status, classification = "INCONCLUSIVE", "INCOMPATIBLE_SEMANTICS"
        else:
            a, b = diagnostic.sql, diagnostic.python
            if any(d.grain_unique_rows != d.population_rows for d in (a, b)):
                status, classification = "DISPUTED", "GRAIN_VIOLATION"
            elif plan.null_policy == "error" and any(d.null_amounts > 0 for d in (a, b)):
                status, classification = "DISPUTED", "NULL_POLICY_VIOLATION"
            elif a != b:
                status, classification = "DISPUTED", "SEMANTIC_DIAGNOSTIC_MISMATCH"
            elif any(
                d.period_rows - d.null_amounts != value.count
                or d.period_rows > d.population_rows
                or d.null_amounts > d.period_rows
                for d, value in ((a, left), (b, right))
            ):
                status, classification = "DISPUTED", "POPULATION_MISMATCH"
            elif plan.relationship and any(
                d.population_rows != plan.relationship.population_count
                or d.join_unique_rows != d.population_rows
                for d in (a, b)
            ):
                status, classification = "DISPUTED", "JOIN_CARDINALITY"
    return {
        "verification": status,
        "classification": classification,
        "provenance": "CLIENT_REPORTED",
        "contractHash": contract_hash(plan),
        "metricVersion": plan.version,
        "currency": plan.currency,
        "tolerance": {"policy": "exact-minor-units-v1", "absolute": "0", "relative": "0"},
    }
