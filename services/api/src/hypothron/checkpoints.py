"""Native PostgreSQL checkpoints fenced by the investigation's live lease.

The row lock spans the saver write. Cancellation and lease replacement therefore
serialize against checkpoint writes. Credentials never belong in saver config.
"""

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    ChannelVersions,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from psycopg import AsyncConnection
from psycopg.rows import dict_row

from hypothron.ledger import Lease, Ledger, LedgerError


class FencedPostgresSaver(AsyncPostgresSaver):
    def __init__(self, connection: AsyncConnection[Any], ledger: Ledger, lease: Lease) -> None:
        super().__init__(
            connection,
            serde=JsonPlusSerializer(
                pickle_fallback=False, allowed_json_modules=[], allowed_msgpack_modules=[]
            ),
        )
        self.ledger = ledger
        self.lease = lease

    def check_scope(self, config: RunnableConfig) -> None:
        if config.get("configurable", {}).get("thread_id") != self.lease.run_id:
            raise LedgerError("NOT_FOUND")

    async def aget_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        self.check_scope(config)
        async with self.ledger.fence(self.lease):
            return await super().aget_tuple(config)

    async def alist(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> AsyncIterator[CheckpointTuple]:
        if config is None:
            raise LedgerError("NOT_FOUND")
        self.check_scope(config)
        if before is not None:
            self.check_scope(before)
        async with self.ledger.fence(self.lease):
            async for item in super().alist(
                config, filter=filter, before=before, limit=min(limit or 100, 100)
            ):
                yield item

    async def adelete_thread(self, thread_id: str) -> None:
        # Deletion belongs to the authorized expiry/purge transaction, never a graph segment.
        raise LedgerError("NOT_FOUND")

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        self.check_scope(config)
        async with self.ledger.fence(self.lease):
            return await super().aput(config, checkpoint, metadata, new_versions)

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        self.check_scope(config)
        async with self.ledger.fence(self.lease):
            await super().aput_writes(config, writes, task_id, task_path)


@asynccontextmanager
async def checkpoint_store(
    database_url: str,
    ledger: Ledger,
    lease: Lease,
) -> AsyncIterator[FencedPostgresSaver]:
    # A separate native connection is needed while the SQLAlchemy fence holds
    # its transaction. One active segment uses one saver connection.
    conninfo = database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    async with await AsyncConnection.connect(
        conninfo,
        autocommit=True,
        prepare_threshold=0,
        row_factory=dict_row,
        connect_timeout=5,
        options="-c statement_timeout=5000 -c lock_timeout=5000",
    ) as connection:
        yield FencedPostgresSaver(connection, ledger, lease)
