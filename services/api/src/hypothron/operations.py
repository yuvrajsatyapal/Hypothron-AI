"""Strict operational telemetry. Never accepts application payloads or exception text."""

import hashlib
import json
import logging
import re

LOGGER = logging.getLogger("hypothron.operations")
EVENTS = frozenset(
    {
        "segment_started",
        "segment_completed",
        "segment_failed",
        "node_started",
        "node_completed",
        "node_paused",
        "node_failed",
        "provider_dispatch",
        "provider_cached",
        "provider_completed",
        "provider_failed",
        "checkpoint_resume",
        "job_reconciled",
        "purge_completed",
        "purge_failed",
    }
)
ENUMS = {
    "role": {"planner", "analyst", "report"},
    "node": {"planner", "clarify", "analyst", "issue", "accept", "report", "correction"},
    "status": {
        "PLANNING",
        "ANALYZING",
        "CLARIFYING",
        "ISSUING",
        "WAITING_RESULT",
        "REPORTING",
        "COMPLETE",
        "FAILED",
        "BUDGET_EXHAUSTED",
        "CANCELLED",
    },
    "category": {"TIMEOUT", "POLICY", "INTERNAL", "DATABASE"},
}
RUN_ID = re.compile(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")


def correlation(value: str) -> dict[str, object]:
    return {"run_id": value} if RUN_ID.fullmatch(value) else {}


NUMBERS = {"elapsed_ms": 600000, "attempt": 12}


def emit(event: str, **fields: object) -> None:
    if event not in EVENTS:
        raise ValueError("INVALID_DIAGNOSTIC")
    payload: dict[str, object] = {"event": event}
    for name, value in fields.items():
        if name == "run_id":
            if not isinstance(value, str) or not re.fullmatch(
                r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", value
            ):
                raise ValueError("INVALID_DIAGNOSTIC")
            payload["runDigest"] = hashlib.sha256(value.encode("ascii")).hexdigest()
        elif name in ENUMS:
            if not isinstance(value, str) or value not in ENUMS[name]:
                raise ValueError("INVALID_DIAGNOSTIC")
            payload[name] = value
        elif name in NUMBERS:
            if type(value) is not int or not 0 <= value <= NUMBERS[name]:
                raise ValueError("INVALID_DIAGNOSTIC")
            payload["elapsedMs" if name == "elapsed_ms" else name] = value
        else:
            raise ValueError("INVALID_DIAGNOSTIC")
    LOGGER.info(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def configure() -> None:
    """Emit only this bounded stream; no SDK trace exporter is enabled."""
    if not LOGGER.handlers:
        LOGGER.addHandler(logging.StreamHandler())
    LOGGER.setLevel(logging.INFO)
    LOGGER.propagate = False
