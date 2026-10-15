"""Explicit durable account Save and separately consented cloud bundles."""

import asyncio
import hashlib
import json
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import Mapped, mapped_column

from hypothron.accounts import AccountRecord
from hypothron.agents.workflow import Role, build_workflow
from hypothron.auth import Auth
from hypothron.cloud import (
    MAX_ACCOUNT_BYTES,
    MAX_ARTIFACT_BYTES,
    CloudUnavailable,
    PrivateObjectStore,
)
from hypothron.db import Base
from hypothron.ledger import Ledger, LedgerError


class SavedHistoryRecord(Base):
    __tablename__ = "account_history"
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    run_id: Mapped[str] = mapped_column(Text, primary_key=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)


class CloudArtifactRecord(Base):
    __tablename__ = "cloud_artifacts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    object_key: Mapped[str] = mapped_column(String, unique=True)
    byte_length: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="PENDING")
    sha256: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SaveConsent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    consent: Literal[True]


def mount_history(
    app: FastAPI,
    sessions: async_sessionmaker[AsyncSession],
    authenticate: Auth,
    ledger: Ledger,
    database_url: str,
    *,
    store: PrivateObjectStore | None = None,
) -> None:
    upload_slots = asyncio.Semaphore(2)
    authenticated = Depends(authenticate)
    store = store or PrivateObjectStore()

    def account(owner: dict[str, str]) -> str:
        if "accountId" not in owner:
            raise HTTPException(401, "ACCOUNT_REQUIRED")
        return owner["accountId"]

    @app.exception_handler(CloudUnavailable)
    async def unavailable(_: Request, __: CloudUnavailable) -> Response:
        from fastapi.responses import JSONResponse

        return JSONResponse({"error": {"code": "CLOUD_UNAVAILABLE"}}, status_code=503)

    @app.get("/v1/account/history")
    async def history(owner: dict[str, str] = authenticated) -> dict[str, Any]:
        async with sessions() as db:
            rows = await db.scalars(
                select(SavedHistoryRecord)
                .where(SavedHistoryRecord.account_id == account(owner))
                .order_by(SavedHistoryRecord.saved_at.desc())
                .limit(100)
            )
            return {
                "items": [
                    {
                        "id": row.run_id,
                        "savedAt": row.saved_at.isoformat(),
                        "question": row.payload["request"]["question"],
                        "status": row.payload["status"],
                        "provider": row.payload["provider"],
                        "model": row.payload["model"],
                    }
                    for row in rows
                ]
            }

    @app.get("/v1/account/history/{run_id}")
    async def saved(run_id: str, owner: dict[str, str] = authenticated) -> dict[str, Any]:
        async with sessions() as db:
            row = await db.get(SavedHistoryRecord, (account(owner), run_id))
            if row is None:
                raise HTTPException(404, "NOT_FOUND")
            return {"id": row.run_id, "savedAt": row.saved_at.isoformat(), "payload": row.payload}

    @app.post("/v1/account/history/{run_id}")
    async def save(
        run_id: str, body: SaveConsent, owner: dict[str, str] = authenticated
    ) -> dict[str, str]:
        account_id = account(owner)
        try:
            row = await ledger.get(owner["id"], run_id)
        except LedgerError:
            raise HTTPException(404, "NOT_FOUND") from None

        async def forbidden(
            role: Role, context: dict[str, Any], schema: type[BaseModel]
        ) -> dict[str, Any]:
            raise RuntimeError("History cannot invoke inference")

        conninfo = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
        async with await AsyncConnection.connect(
            conninfo,
            autocommit=True,
            prepare_threshold=0,
            row_factory=dict_row,
            connect_timeout=5,
            options="-c statement_timeout=5000 -c lock_timeout=5000",
        ) as connection:
            saver = AsyncPostgresSaver(
                connection,
                serde=JsonPlusSerializer(
                    pickle_fallback=False, allowed_json_modules=[], allowed_msgpack_modules=[]
                ),
            )
            snapshot = await build_workflow(forbidden, saver).aget_state(
                {"configurable": {"thread_id": run_id}}
            )
        state = dict(snapshot.values)
        payload = {
            "request": row.request,
            "status": row.status,
            "provider": row.provider,
            "model": row.model,
            "modelHistory": row.model_history,
            "hypotheses": state.get("hypotheses", []),
            "jobs": state.get("jobs", []),
            "evidence": state.get("evidence", []),
            "report": state.get("report", {}),
            "measurements": await ledger.measurements(owner["id"], run_id),
        }
        if len(json.dumps(payload).encode()) > 512 * 1024:
            raise HTTPException(413, "HISTORY_LIMIT")
        async with sessions.begin() as db:
            await db.scalar(
                select(AccountRecord).where(AccountRecord.id == account_id).with_for_update()
            )
            previous = await db.get(SavedHistoryRecord, (account_id, run_id))
            if previous is None:
                count = await db.scalar(
                    select(func.count())
                    .select_from(SavedHistoryRecord)
                    .where(SavedHistoryRecord.account_id == account_id)
                )
                if count is not None and count >= 100:
                    raise HTTPException(409, "HISTORY_LIMIT")
                db.add(
                    SavedHistoryRecord(
                        account_id=account_id,
                        run_id=run_id,
                        saved_at=datetime.now(UTC),
                        payload=payload,
                    )
                )
            else:
                previous.payload = payload
                previous.saved_at = datetime.now(UTC)
        return {"id": run_id, "status": "SAVED"}

    @app.post("/v1/account/history/{run_id}/delete", status_code=204)
    async def delete_history(run_id: str, owner: dict[str, str] = authenticated) -> Response:
        async with sessions.begin() as db:
            row = await db.get(SavedHistoryRecord, (account(owner), run_id))
            if row is None:
                raise HTTPException(404, "NOT_FOUND")
            await db.delete(row)
        return Response(status_code=204)

    @app.get("/v1/account/artifacts")
    async def artifact_list(owner: dict[str, str] = authenticated) -> dict[str, Any]:
        async with sessions() as db:
            rows = await db.scalars(
                select(CloudArtifactRecord)
                .where(CloudArtifactRecord.account_id == account(owner))
                .order_by(CloudArtifactRecord.created_at.desc())
                .limit(100)
            )
            return {
                "items": [
                    {
                        "id": row.id,
                        "createdAt": row.created_at.isoformat(),
                        "status": row.status,
                        "byteLength": row.byte_length,
                        "sha256": row.sha256,
                    }
                    for row in rows
                ]
            }

    async def upload_inner(
        request: Request, consent: bool, owner: dict[str, str]
    ) -> dict[str, Any]:
        account_id = account(owner)
        if consent is not True:
            raise HTTPException(422, "CONSENT_REQUIRED")
        if not store.enabled:
            raise CloudUnavailable()
        if request.headers.get("content-type", "").split(";")[0] != "application/zip":
            raise HTTPException(422, "BUNDLE_REQUIRED")
        data = bytearray()
        try:
            async with asyncio.timeout(20):
                async for chunk in request.stream():
                    if len(data) + len(chunk) > MAX_ARTIFACT_BYTES:
                        raise HTTPException(413, "ARTIFACT_LIMIT")
                    data.extend(chunk)
        except TimeoutError:
            raise HTTPException(408, "UPLOAD_TIMEOUT") from None
        if not data.startswith(b"PK\x03\x04"):
            raise HTTPException(422, "BUNDLE_REQUIRED")
        artifact_id = str(uuid4())
        key = f"accounts/{account_id}/{artifact_id}.zip"
        checksum = hashlib.sha256(data).hexdigest()
        async with sessions.begin() as db:
            await db.scalar(
                select(AccountRecord).where(AccountRecord.id == account_id).with_for_update()
            )
            total = await db.scalar(
                select(func.coalesce(func.sum(CloudArtifactRecord.byte_length), 0)).where(
                    CloudArtifactRecord.account_id == account_id
                )
            )
            count = await db.scalar(
                select(func.count())
                .select_from(CloudArtifactRecord)
                .where(CloudArtifactRecord.account_id == account_id)
            )
            if (total or 0) + len(data) > MAX_ACCOUNT_BYTES or (count or 0) >= 100:
                raise HTTPException(409, "ARTIFACT_LIMIT")
            db.add(
                CloudArtifactRecord(
                    id=artifact_id,
                    account_id=account_id,
                    object_key=key,
                    byte_length=len(data),
                    sha256=checksum,
                    created_at=datetime.now(UTC),
                    status="PENDING",
                )
            )
        # The committed reservation counts toward quota even if upload or process fails.
        # Failed or canceled replies do not prove that S3 rejected the write.
        # Keep PENDING quota until an operator reconciles with upload workers stopped.
        await store.put(key, bytes(data))
        async with sessions.begin() as db:
            staged = await owned_artifact(db, owner, artifact_id, lock=True)
            staged.status = "READY"
        return {"id": artifact_id, "sha256": checksum, "byteLength": len(data)}

    @app.post("/v1/account/artifacts", status_code=201)
    async def upload(
        request: Request, consent: bool = Query(), owner: dict[str, str] = authenticated
    ) -> dict[str, Any]:
        if upload_slots.locked():
            raise HTTPException(503, "UPLOAD_BUSY")
        await upload_slots.acquire()
        try:
            return await upload_inner(request, consent, owner)
        finally:
            upload_slots.release()

    async def owned_artifact(
        db: AsyncSession, owner: dict[str, str], artifact_id: str, *, lock: bool = False
    ) -> CloudArtifactRecord:
        query = select(CloudArtifactRecord).where(
            CloudArtifactRecord.id == artifact_id, CloudArtifactRecord.account_id == account(owner)
        )
        if lock:
            query = query.with_for_update()
        row = await db.scalar(query)
        if row is None:
            raise HTTPException(404, "NOT_FOUND")
        return row

    @app.get("/v1/account/artifacts/{artifact_id}")
    async def download(artifact_id: str, owner: dict[str, str] = authenticated) -> Response:
        async with sessions() as db:
            row = await owned_artifact(db, owner, artifact_id)
        if row.status != "READY":
            raise HTTPException(409, "ARTIFACT_PENDING")
        data = await store.get(row.object_key)
        if len(data) != row.byte_length or hashlib.sha256(data).hexdigest() != row.sha256:
            raise CloudUnavailable()
        return Response(
            data,
            media_type="application/zip",
            headers={
                "Cache-Control": "no-store",
                "Content-Disposition": 'attachment; filename="investigation.zip"',
                "X-Content-Type-Options": "nosniff",
            },
        )

    @app.post("/v1/account/artifacts/{artifact_id}/delete", status_code=204)
    async def delete_artifact(artifact_id: str, owner: dict[str, str] = authenticated) -> Response:
        async with sessions.begin() as db:
            row = await owned_artifact(db, owner, artifact_id, lock=True)
            if row.status == "PENDING":
                raise HTTPException(409, "ARTIFACT_PENDING")
            await store.delete(row.object_key)
            await db.delete(row)
        return Response(status_code=204)
