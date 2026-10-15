"""Durable accounts, revocable hashed capabilities and one-time OAuth flow records."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from hypothron.db import Base


class AccountRecord(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    password_hash: Mapped[str | None] = mapped_column(String)
    google_sub: Mapped[str | None] = mapped_column(String, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LoginTokenRecord(Base):
    __tablename__ = "login_tokens"
    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OAuthFlowRecord(Base):
    __tablename__ = "oauth_flows"
    state_hash: Mapped[str] = mapped_column(String, primary_key=True)
    binding_hash: Mapped[str] = mapped_column(String)
    verifier: Mapped[str] = mapped_column(String)
    nonce: Mapped[str] = mapped_column(String)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completion_hash: Mapped[str | None] = mapped_column(String, unique=True)
    account_id: Mapped[str | None] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
