"""Durable graph and metadata ledgers; no raw snapshots or credentials."""

from alembic import op
from langgraph.checkpoint.postgres import PostgresSaver

from hypothron.records import AttemptRecord, EventRecord, JobRecord, RunRecord

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Native saver setup owns its idempotent internal migration ledger and concurrent indexes.
    # Invoke it through the application's migration authority, before business DDL transaction.
    with op.get_context().autocommit_block():
        PostgresSaver(op.get_bind().connection.driver_connection).setup()
    for table in (
        RunRecord.__table__,
        JobRecord.__table__,
        AttemptRecord.__table__,
        EventRecord.__table__,
    ):
        table.create(op.get_bind())


def downgrade() -> None:
    for table in (
        EventRecord.__table__,
        AttemptRecord.__table__,
        JobRecord.__table__,
        RunRecord.__table__,
    ):
        table.drop(op.get_bind())
    # Native checkpoints are sensitive metadata: explicit destructive downgrade removes them.
    for name in ("checkpoint_writes", "checkpoint_blobs", "checkpoints", "checkpoint_migrations"):
        op.execute("DROP TABLE IF EXISTS " + name)
