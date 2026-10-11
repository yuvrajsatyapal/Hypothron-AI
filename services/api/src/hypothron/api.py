import hashlib
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from hypothron.db import SessionRecord
from hypothron.limits import BodyLimit


class EmptyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


def create_app(*, database_url: str) -> FastAPI:
    engine = create_async_engine(database_url, pool_size=3, max_overflow=0)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        await engine.dispose()

    app = FastAPI(title="Hypothron AI", lifespan=lifespan)
    app.state.sessions = sessions
    app.add_middleware(BodyLimit)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[os.getenv("APP_ORIGIN", "http://127.0.0.1:3000")],
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: object, __: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": {"code": "INVALID_INPUT"}})

    @app.get("/v1/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/ready")
    async def ready() -> JSONResponse:
        try:
            async with sessions() as db:
                revision = await db.scalar(text("SELECT version_num FROM alembic_version"))
                await db.execute(select(SessionRecord.id).limit(1))
            if revision != "0001":
                raise ValueError("migration mismatch")
        except (SQLAlchemyError, ValueError):
            return JSONResponse(status_code=503, content={"database": "unavailable"})
        return JSONResponse(content={"database": "ready", "migration": revision})

    @app.post("/v1/sessions", status_code=201)
    async def create_session(body: EmptyRequest | None = None) -> dict[str, str]:
        token = secrets.token_urlsafe(32)
        session = SessionRecord(
            id=str(uuid4()),
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        async with sessions.begin() as db:
            await db.execute(
                delete(SessionRecord).where(SessionRecord.expires_at < datetime.now(UTC))
            )
            db.add(session)
        return {"id": session.id, "token": token}

    @app.get("/v1/session")
    async def current_session(
        authorization: Annotated[str | None, Header()] = None,
    ) -> dict[str, str]:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, detail="UNAUTHORIZED")
        token_hash = hashlib.sha256(authorization[7:].encode()).hexdigest()
        async with sessions() as db:
            row = await db.scalar(
                select(SessionRecord).where(
                    SessionRecord.token_hash == token_hash,
                    SessionRecord.expires_at > datetime.now(UTC),
                )
            )
        if row is None:
            raise HTTPException(401, detail="UNAUTHORIZED")
        return {"id": row.id}

    return app


def app_factory() -> FastAPI:
    return create_app(database_url=os.environ["DATABASE_URL"])
