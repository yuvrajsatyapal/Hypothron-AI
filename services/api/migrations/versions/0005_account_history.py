"""Explicit durable metadata saves and optional private cloud object references."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005_account_history"
down_revision = "0004_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_history",
        sa.Column(
            "account_id",
            sa.Text(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("run_id", sa.Text(), primary_key=True),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
    )
    op.create_table(
        "cloud_artifacts",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Text(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("object_key", sa.Text(), nullable=False, unique=True),
        sa.Column("byte_length", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("byte_length > 0 AND byte_length <= 20971520"),
    )
    op.create_index("cloud_artifact_account", "cloud_artifacts", ["account_id"])


def downgrade() -> None:
    op.drop_table("cloud_artifacts")
    op.drop_table("account_history")
