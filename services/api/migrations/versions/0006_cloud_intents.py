"""Durable quota reservations fence incomplete object uploads."""

import sqlalchemy as sa
from alembic import op

revision = "0006_cloud_intents"
down_revision = "0005_account_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cloud_artifacts", sa.Column("status", sa.Text(), nullable=False, server_default="PENDING")
    )
    op.create_check_constraint(
        "cloud_artifact_status", "cloud_artifacts", "status IN ('PENDING','READY','FAILED')"
    )


def downgrade() -> None:
    op.drop_constraint("cloud_artifact_status", "cloud_artifacts", type_="check")
    op.drop_column("cloud_artifacts", "status")
