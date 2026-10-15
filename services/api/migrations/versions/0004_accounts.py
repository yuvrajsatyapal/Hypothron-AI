"""Stable account owners and separately revocable short-lived login capabilities."""

import sqlalchemy as sa
from alembic import op

revision = "0004_accounts"
down_revision = "0003_openrouter_selection"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text()),
        sa.Column("google_sub", sa.Text(), unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column("sessions", sa.Column("account_id", sa.Text(), nullable=True))
    op.create_foreign_key("sessions_account_fk", "sessions", "accounts", ["account_id"], ["id"])
    op.create_unique_constraint("sessions_account_unique", "sessions", ["account_id"])
    op.create_table(
        "login_tokens",
        sa.Column("token_hash", sa.Text(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Text(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("login_tokens_expiry", "login_tokens", ["expires_at"])
    op.create_table(
        "oauth_flows",
        sa.Column("state_hash", sa.Text(), primary_key=True),
        sa.Column("binding_hash", sa.Text(), nullable=False),
        sa.Column("verifier", sa.Text(), nullable=False),
        sa.Column("nonce", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completion_hash", sa.Text(), unique=True),
        sa.Column("account_id", sa.Text(), sa.ForeignKey("accounts.id", ondelete="CASCADE")),
    )


def downgrade() -> None:
    op.drop_table("oauth_flows")
    op.drop_table("login_tokens")
    op.drop_constraint("sessions_account_unique", "sessions")
    op.drop_constraint("sessions_account_fk", "sessions", type_="foreignkey")
    op.drop_column("sessions", "account_id")
    op.drop_table("accounts")
