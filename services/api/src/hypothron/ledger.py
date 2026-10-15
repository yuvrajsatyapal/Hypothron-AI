import hashlib
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hypothron.agents.models import (
    AnalystReply,
    EvidenceInput,
    ExecutionJob,
    PlannerReply,
    ReportReply,
    RunInput,
)
from hypothron.records import AttemptRecord, EventRecord, JobRecord, RunRecord


class LedgerError(Exception):
    """Stable sanitized policy failure."""


TERMINAL = {"CANCELLED", "COMPLETE", "FAILED", "BUDGET_EXHAUSTED"}


@dataclass(frozen=True)
class Lease:
    run_id: str
    holder: str
    epoch: int


def digest(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class Ledger:
    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def create(
        self,
        owner: str,
        request: object,
        provider: str,
        model: str,
        *,
        request_id: str | None = None,
    ) -> RunRecord:
        if provider not in {"gemini", "openrouter"}:
            raise LedgerError("INVALID_PROVIDER")
        validated = RunInput.model_validate(request).model_dump(mode="json", by_alias=True)
        run = RunRecord(
            id=request_id or str(uuid4()),
            owner=owner,
            request=validated,
            provider=provider,
            model=model,
            original_model=model,
            model_revision=0,
            model_history=[],
            status="PLANNING",
            attempts=0,
            epoch=0,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        async with self.sessions.begin() as db:
            inserted = await db.scalar(
                insert(RunRecord)
                .values(
                    id=run.id,
                    owner=owner,
                    request=validated,
                    provider=provider,
                    model=model,
                    original_model=model,
                    model_revision=0,
                    model_history=[],
                    status="PLANNING",
                    attempts=0,
                    epoch=0,
                    expires_at=run.expires_at,
                )
                .on_conflict_do_nothing(index_elements=[RunRecord.id])
                .returning(RunRecord.id)
            )
            stored = await db.scalar(
                select(RunRecord).where(RunRecord.id == run.id).with_for_update()
            )
            if (
                stored is None
                or stored.owner != owner
                or stored.request != validated
                or stored.provider != provider
                or stored.original_model != model
                or stored.expires_at <= datetime.now(UTC)
            ):
                raise LedgerError("CREATION_CONFLICT")
            if inserted:
                db.add(EventRecord(run_id=run.id, kind="created", payload={"status": "PLANNING"}))
            return stored

    async def owned(
        self, db: AsyncSession, owner: str, run_id: str, *, lock: bool = False
    ) -> RunRecord:
        query = select(RunRecord).where(
            RunRecord.id == run_id,
            RunRecord.owner == owner,
            RunRecord.expires_at > datetime.now(UTC),
        )
        if lock:
            query = query.with_for_update()
        row = await db.scalar(query)
        if row is None:
            raise LedgerError("NOT_FOUND")
        return row

    async def get(self, owner: str, run_id: str) -> RunRecord:
        async with self.sessions() as db:
            return await self.owned(db, owner, run_id)

    async def measurements(self, owner: str, run_id: str) -> dict[str, int | None]:
        """Owned, bounded ledger observations; unknown billing is never zero."""
        async with self.sessions() as db:
            await self.owned(db, owner, run_id)
            rows = list(
                await db.scalars(
                    select(AttemptRecord)
                    .where(AttemptRecord.run_id == run_id)
                    .order_by(AttemptRecord.ordinal)
                    .limit(12)
                )
            )

            def known(value: object) -> bool:
                return type(value) is int and 0 <= value <= 1_000_000_000

            tokens = [r.usage.get("total_tokens") if r.usage else None for r in rows]
            times = [r.elapsed_ms for r in rows]
            complete = all(r.status == "COMPLETE" for r in rows)
            return {
                "attempts": len(rows),
                "tokens": sum(int(v) for v in tokens if v is not None)
                if complete and all(known(v) for v in tokens)
                else None,
                "providerElapsedMs": sum(int(v) for v in times if v is not None)
                if complete and all(known(v) for v in times)
                else None,
            }

    async def claim(self, owner: str, run_id: str) -> Lease:
        async with self.sessions.begin() as db:
            row = await self.owned(db, owner, run_id, lock=True)
            now = datetime.now(UTC)
            if row.status in TERMINAL:
                raise LedgerError("RUN_TERMINAL")
            if row.lease_holder and row.lease_expires and row.lease_expires > now:
                raise LedgerError("RUN_BUSY")
            row.epoch += 1
            row.lease_holder = str(uuid4())
            row.lease_expires = now + timedelta(seconds=90)
            return Lease(row.id, row.lease_holder, row.epoch)

    @asynccontextmanager
    async def fence(self, lease: Lease) -> AsyncIterator[tuple[AsyncSession, RunRecord]]:
        async with self.sessions.begin() as db:
            row = await db.scalar(
                select(RunRecord).where(RunRecord.id == lease.run_id).with_for_update()
            )
            now = datetime.now(UTC)
            if (
                row is None
                or row.epoch != lease.epoch
                or row.lease_holder != lease.holder
                or row.lease_expires is None
                or row.lease_expires <= now
                or row.expires_at <= now
                or row.status in TERMINAL
            ):
                raise LedgerError("LEASE_LOST")
            yield db, row

    async def release(self, lease: Lease) -> None:
        async with self.sessions.begin() as db:
            await db.execute(
                update(RunRecord)
                .where(
                    RunRecord.id == lease.run_id,
                    RunRecord.epoch == lease.epoch,
                    RunRecord.lease_holder == lease.holder,
                )
                .values(lease_holder=None, lease_expires=None)
            )

    async def reserve(
        self, lease: Lease, ordinal: int, role: str, context_hash: str
    ) -> dict[str, Any] | None:
        async with self.fence(lease) as (db, row):
            previous = await db.get(AttemptRecord, (row.id, ordinal))
            if previous:
                if previous.role != role or previous.context_hash != context_hash:
                    raise LedgerError("ATTEMPT_CONFLICT")
                if previous.status == "COMPLETE" and previous.response is not None:
                    return previous.response
                if previous.status == "REJECTED" and previous.failure_code:
                    raise LedgerError(previous.failure_code)
                raise LedgerError("BILLING_UNKNOWN")
            if row.attempts >= 12:
                raise LedgerError("BUDGET_EXHAUSTED")
            if ordinal != row.attempts + 1:
                raise LedgerError("INVALID_ATTEMPT")
            row.attempts += 1
            db.add(
                AttemptRecord(
                    run_id=row.id,
                    ordinal=ordinal,
                    role=role,
                    context_hash=context_hash,
                    model=row.model,
                    model_revision=row.model_revision,
                    status="RESERVED",
                )
            )
            db.add(
                EventRecord(
                    run_id=row.id,
                    kind="attempt_reserved",
                    payload={"ordinal": ordinal, "role": role},
                )
            )
            return None

    async def complete_attempt(
        self,
        lease: Lease,
        ordinal: int,
        response: dict[str, Any],
        usage: dict[str, Any] | None = None,
        elapsed_ms: int | None = None,
    ) -> None:
        async with self.fence(lease) as (db, row):
            attempt = await db.get(AttemptRecord, (row.id, ordinal))
            if attempt is None or attempt.status != "RESERVED":
                raise LedgerError("ATTEMPT_CONFLICT")
            schemas: dict[str, type[BaseModel]] = {
                "planner": PlannerReply,
                "analyst": AnalystReply,
                "report": ReportReply,
            }
            try:
                attempt.response = (
                    schemas[attempt.role]
                    .model_validate(response)
                    .model_dump(mode="json", by_alias=True)
                )
            except (KeyError, ValidationError):
                raise LedgerError("INVALID_ROLE_OUTPUT") from None
            attempt.status = "COMPLETE"
            attempt.usage = usage
            attempt.elapsed_ms = elapsed_ms
            db.add(
                EventRecord(run_id=row.id, kind="attempt_complete", payload={"ordinal": ordinal})
            )

    async def issue(self, lease: Lease, job: dict[str, Any]) -> None:
        try:
            job = ExecutionJob.model_validate(job).model_dump(mode="json", by_alias=True)
        except ValidationError:
            raise LedgerError("INVALID_JOB") from None
        async with self.fence(lease) as (db, row):
            contracts = [d["contract"] for d in row.request["datasets"]]
            if job["plan"] not in contracts:
                raise LedgerError("UNAPPROVED_PLAN")
            previous = await db.get(JobRecord, job["id"])
            if previous:
                if previous.run_id != row.id or previous.job != job:
                    raise LedgerError("JOB_CONFLICT")
                return
            count = await db.scalar(
                select(func.count()).select_from(JobRecord).where(JobRecord.run_id == row.id)
            )
            if count is not None and count >= 6:
                raise LedgerError("JOB_BUDGET_EXHAUSTED")
            dependencies = job["dependsOn"]
            if dependencies:
                accepted = set(
                    await db.scalars(
                        select(JobRecord.id).where(
                            JobRecord.run_id == row.id,
                            JobRecord.status == "ACCEPTED",
                            JobRecord.id.in_(dependencies),
                        )
                    )
                )
                if accepted != set(dependencies):
                    raise LedgerError("INVALID_DEPENDENCY")
            db.add(JobRecord(id=job["id"], run_id=row.id, job=job, status="PENDING"))
            db.add(EventRecord(run_id=row.id, kind="job_issued", payload={"jobId": job["id"]}))

    async def submit(self, owner: str, run_id: str, payload: object) -> dict[str, Any]:
        evidence = EvidenceInput.model_validate(payload).model_dump(mode="json", by_alias=True)
        hashed = digest(evidence)
        async with self.sessions.begin() as db:
            row = await self.owned(db, owner, run_id, lock=True)
            job = await db.get(JobRecord, evidence["jobId"])
            if job is None or job.run_id != row.id:
                raise LedgerError("NOT_FOUND")
            if evidence["datasetHash"] != job.job["plan"]["datasetHash"]:
                raise LedgerError("INVALID_EVIDENCE")
            if job.status == "ACCEPTED":
                if job.digest != hashed:
                    raise LedgerError("RESULT_CONFLICT")
                return {"jobId": job.id, "accepted": True, "duplicate": True}
            if row.status in TERMINAL:
                raise LedgerError("RUN_TERMINAL")
            if job.status != "PENDING":
                raise LedgerError("RUN_TERMINAL")
            job.status = "ACCEPTED"
            job.result = evidence
            job.digest = hashed
            db.add(
                EventRecord(
                    run_id=row.id,
                    kind="result_accepted",
                    payload={"jobId": job.id, "digest": hashed},
                )
            )
            return {"jobId": job.id, "accepted": True, "duplicate": False}

    async def job(self, owner: str, run_id: str, job_id: str) -> JobRecord:
        async with self.sessions() as db:
            await self.owned(db, owner, run_id)
            row = await db.get(JobRecord, job_id)
            if row is None or row.run_id != run_id:
                raise LedgerError("NOT_FOUND")
            return row

    async def status(self, lease: Lease, status: str) -> None:
        async with self.fence(lease) as (db, row):
            row.status = status
            db.add(EventRecord(run_id=row.id, kind="state", payload={"status": status}))

    async def cancel(self, owner: str, run_id: str) -> None:
        async with self.sessions.begin() as db:
            row = await self.owned(db, owner, run_id, lock=True)
            row.status = "CANCELLED"
            row.epoch += 1
            row.lease_holder = None
            row.lease_expires = None
            await db.execute(
                update(JobRecord)
                .where(JobRecord.run_id == run_id, JobRecord.status == "PENDING")
                .values(status="CANCELLED")
            )
            db.add(EventRecord(run_id=run_id, kind="cancelled", payload={"status": "CANCELLED"}))

    async def events(self, owner: str, run_id: str, after: int = 0) -> list[dict[str, Any]]:
        async with self.sessions() as db:
            await self.owned(db, owner, run_id)
            rows = await db.scalars(
                select(EventRecord)
                .where(EventRecord.run_id == run_id, EventRecord.id > after)
                .order_by(EventRecord.id)
                .limit(100)
            )
            return [{"id": r.id, "kind": r.kind, "payload": r.payload} for r in rows]

    async def cached_attempt(
        self, lease: Lease, ordinal: int, role: str, context_hash: str
    ) -> dict[str, Any] | None:
        """Read completed replies before catalogue I/O; reject ambiguous/rejected retries."""
        async with self.fence(lease) as (db, row):
            previous = await db.get(AttemptRecord, (row.id, ordinal))
            if previous is None:
                return None
            if previous.role != role or previous.context_hash != context_hash:
                raise LedgerError("ATTEMPT_CONFLICT")
            if previous.status == "COMPLETE" and previous.response is not None:
                return previous.response
            if previous.status == "REJECTED" and previous.failure_code:
                raise LedgerError(previous.failure_code)
            raise LedgerError("BILLING_UNKNOWN")

    async def reject_attempt(self, lease: Lease, ordinal: int, code: str) -> None:
        if code not in {"PROVIDER_RATE_LIMIT", "PROVIDER_MODEL_UNAVAILABLE"}:
            raise LedgerError("INVALID_REJECTION")
        async with self.fence(lease) as (db, row):
            attempt = await db.get(AttemptRecord, (row.id, ordinal))
            if attempt is None or attempt.status != "RESERVED":
                raise LedgerError("ATTEMPT_CONFLICT")
            attempt.status = "REJECTED"
            attempt.failure_code = code
            db.add(
                EventRecord(
                    run_id=row.id,
                    kind="attempt_rejected",
                    payload={
                        "ordinal": ordinal,
                        "reason": code,
                        "model": attempt.model,
                        "revision": attempt.model_revision,
                    },
                )
            )

    async def pause_model(self, lease: Lease, role: str, reason: str) -> None:
        if role not in {"planner", "analyst", "report"} or reason not in {
            "PROVIDER_RATE_LIMIT",
            "PROVIDER_MODEL_UNAVAILABLE",
            "MODEL_PREFLIGHT_FAILED",
        }:
            raise LedgerError("INVALID_MODEL_PAUSE")
        async with self.fence(lease) as (db, row):
            row.status = "MODEL_APPROVAL_REQUIRED"
            row.paused_role = role
            row.pause_reason = reason
            db.add(
                EventRecord(
                    run_id=row.id,
                    kind="model_approval_required",
                    payload={
                        "role": role,
                        "reason": reason,
                        "model": row.model,
                        "revision": row.model_revision,
                    },
                )
            )

    async def approve_model(
        self,
        owner: str,
        run_id: str,
        *,
        expected_model: str,
        expected_revision: int,
        selected_model: str,
        idempotency_token: str,
    ) -> RunRecord:
        """Caller validates fresh catalogue and fresh consent/key before this mutation.

        The row lock serializes approval against claim/cancel; history stores only a
        digest of the bounded idempotency token and never request credentials.
        """
        from hypothron.providers.catalogue import concrete

        if (
            not concrete(selected_model)
            or not 1 <= len(idempotency_token) <= 128
            or type(expected_revision) is not int
        ):
            raise LedgerError("INVALID_MODEL_APPROVAL")
        token_hash = digest(idempotency_token)
        async with self.sessions.begin() as db:
            row = await self.owned(db, owner, run_id, lock=True)
            now = datetime.now(UTC)
            if row.lease_holder and row.lease_expires and row.lease_expires > now:
                raise LedgerError("RUN_BUSY")
            for event in row.model_history:
                if event["tokenHash"] == token_hash:
                    if (
                        event["oldModel"] != expected_model
                        or event["newModel"] != selected_model
                        or event["revision"] != expected_revision + 1
                    ):
                        raise LedgerError("MODEL_APPROVAL_CONFLICT")
                    return row
            if (
                row.status != "MODEL_APPROVAL_REQUIRED"
                or row.provider != "openrouter"
                or row.paused_role not in {"planner", "analyst", "report"}
            ):
                raise LedgerError("MODEL_APPROVAL_REQUIRED")
            if (
                row.model != expected_model
                or row.model_revision != expected_revision
                or selected_model == row.model
            ):
                raise LedgerError("MODEL_APPROVAL_CONFLICT")
            if row.attempts >= 12 or row.model_revision >= 12:
                raise LedgerError("BUDGET_EXHAUSTED")
            unresolved = await db.scalar(
                select(AttemptRecord.ordinal)
                .where(AttemptRecord.run_id == row.id, AttemptRecord.status == "RESERVED")
                .limit(1)
            )
            if unresolved is not None:
                raise LedgerError("BILLING_UNKNOWN")
            event = {
                "oldModel": row.model,
                "newModel": selected_model,
                "revision": row.model_revision + 1,
                "reason": row.pause_reason,
                "role": row.paused_role,
                "approvedAt": now.isoformat(),
                "tokenHash": token_hash,
            }
            row.model_history = row.model_history + [event]
            row.model = selected_model
            row.model_revision += 1
            row.status = "MODEL_SWITCH_APPROVED"
            row.epoch += 1
            db.add(
                EventRecord(
                    run_id=row.id,
                    kind="model_switch_approved",
                    payload={k: v for k, v in event.items() if k != "tokenHash"},
                )
            )
            return row
