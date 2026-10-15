"""Durable concrete model lineage and known provider rejection records."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003_openrouter_selection"
down_revision = "0002"
branch_labels = None
depends_on = None


def add_column(table: str, column: sa.Column) -> None:
    if column.name not in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}:
        op.add_column(table, column)


def upgrade() -> None:
    add_column("runs", sa.Column("original_model", sa.Text(), nullable=True))
    op.execute("UPDATE runs SET original_model = model")
    op.alter_column("runs", "original_model", nullable=False)
    add_column(
        "runs", sa.Column("model_revision", sa.Integer(), nullable=False, server_default="0")
    )
    add_column("runs", sa.Column("model_history", JSONB(), nullable=False, server_default="[]"))
    add_column("runs", sa.Column("paused_role", sa.Text(), nullable=True))
    add_column("runs", sa.Column("pause_reason", sa.Text(), nullable=True))
    op.create_check_constraint(
        "runs_model_revision_nonnegative", "runs", "model_revision >= 0 AND model_revision <= 12"
    )
    add_column("attempts", sa.Column("model", sa.Text(), nullable=True))
    op.execute("UPDATE attempts SET model = runs.model FROM runs WHERE runs.id = attempts.run_id")
    op.alter_column("attempts", "model", nullable=False)
    add_column(
        "attempts", sa.Column("model_revision", sa.Integer(), nullable=False, server_default="0")
    )
    add_column("attempts", sa.Column("failure_code", sa.Text(), nullable=True))


def downgrade() -> None:
    for column in ("failure_code", "model_revision", "model"):
        op.drop_column("attempts", column)
    op.drop_constraint("runs_model_revision_nonnegative", "runs")
    for column in (
        "pause_reason",
        "paused_role",
        "model_history",
        "model_revision",
        "original_model",
    ):
        op.drop_column("runs", column)
