"""Bounded transactional expiry sweep, including native checkpoint payloads."""

import asyncio
from datetime import UTC, datetime

from psycopg import Error as PsycopgError
from sqlalchemy import bindparam, delete, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hypothron.db import SessionRecord
from hypothron.operations import emit
from hypothron.records import RunRecord


async def purge_loop(
    sessions: async_sessionmaker[AsyncSession], stop: asyncio.Event, *, interval: float = 60
) -> None:
    """One bounded transaction per tick; failure rolls back and never prints its payload."""
    if not 0 < interval <= 3600:
        raise ValueError("INVALID_PURGE_INTERVAL")
    while not stop.is_set():
        try:
            async with sessions.begin() as db:
                await purge_expired(db)
            emit("purge_completed")
        except (SQLAlchemyError, PsycopgError):
            emit("purge_failed", category="DATABASE")
        except Exception:  # noqa: BLE001 — background errors must not leak to lifespan logger
            emit("purge_failed", category="INTERNAL")
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            pass


async def purge_expired(db: AsyncSession) -> None:
    now = datetime.now(UTC)
    # Lock parents first: no fenced saver can append while these rows are removed.
    ids = list(
        await db.scalars(
            select(RunRecord.id)
            .join(SessionRecord, RunRecord.owner == SessionRecord.id)
            .where((RunRecord.expires_at <= now) | (SessionRecord.expires_at <= now))
            .limit(100)
            .with_for_update(of=RunRecord)
        )
    )
    # Also clean legacy orphan checkpoints; all current writers require an existing run fence.
    orphans = list(
        await db.scalars(
            text(
                "SELECT DISTINCT thread_id FROM checkpoints c WHERE NOT EXISTS "
                "(SELECT 1 FROM runs r WHERE r.id=c.thread_id) LIMIT 100"
            )
        )
    )
    targets = list(set(ids + orphans))
    if targets:
        for table in ("checkpoint_writes", "checkpoint_blobs", "checkpoints"):
            statement = text(f"DELETE FROM {table} WHERE thread_id IN :ids").bindparams(
                bindparam("ids", expanding=True)
            )
            await db.execute(statement, {"ids": targets})
    if ids:
        await db.execute(delete(RunRecord).where(RunRecord.id.in_(ids)))
    # Do not cascade-delete runs not yet swept; bounded sweeps preserve cleanup ordering.
    await db.execute(
        delete(SessionRecord).where(
            SessionRecord.expires_at <= now,
            ~select(RunRecord.id).where(RunRecord.owner == SessionRecord.id).exists(),
        )
    )
