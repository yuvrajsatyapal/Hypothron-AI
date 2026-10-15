import asyncio
import hashlib
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import uuid4

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import Error as PsycopgError
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from hypothron.auth import mount_auth
from hypothron.db import SessionRecord
from hypothron.driver import InvestigationDriver
from hypothron.history import mount_history
from hypothron.investigations import mount_routes
from hypothron.ledger import Ledger
from hypothron.limits import BodyLimit
from hypothron.operations import configure
from hypothron.providers.catalogue import CatalogError, ModelCatalog
from hypothron.release_policy import ReleasePolicy, app_origin
from hypothron.retention import purge_expired, purge_loop


class EmptyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


def create_app(
    *,
    database_url: str,
    provider_transport: httpx.AsyncBaseTransport | None = None,
    model_catalog: ModelCatalog | None = None,
    google_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    origin = app_origin(os.getenv("APP_ORIGIN", "http://127.0.0.1:3000"))
    engine = create_async_engine(
        database_url,
        pool_size=3,
        max_overflow=0,
        pool_timeout=5,
        connect_args={
            "connect_timeout": 5,
            "options": "-c statement_timeout=5000 -c lock_timeout=5000",
        },
    )
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        stop = asyncio.Event()
        purge = asyncio.create_task(purge_loop(sessions, stop))
        try:
            yield
        finally:
            stop.set()
            try:
                async with asyncio.timeout(6):
                    await purge
            except TimeoutError:
                purge.cancel()
                await asyncio.gather(purge, return_exceptions=True)
            await engine.dispose()

    app = FastAPI(title="Hypothron AI", lifespan=lifespan)
    app.state.sessions = sessions
    app.add_middleware(BodyLimit)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin],
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=True,
    )
    app.add_middleware(ReleasePolicy)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: object, __: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": {"code": "INVALID_INPUT"}})

    @app.exception_handler(HTTPException)
    async def http_error(_: object, error: HTTPException) -> JSONResponse:
        code = (
            error.detail
            if isinstance(error.detail, str) and error.detail.replace("_", "").isalnum()
            else "REQUEST_REJECTED"
        )
        return JSONResponse(
            status_code=error.status_code, content={"error": {"code": code}}, headers=error.headers
        )

    async def unavailable(_: object, __: Exception) -> JSONResponse:
        return JSONResponse(status_code=503, content={"error": {"code": "DATABASE_UNAVAILABLE"}})

    app.add_exception_handler(SQLAlchemyError, unavailable)
    app.add_exception_handler(PsycopgError, unavailable)

    @app.get("/v1/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/v1/ready")
    async def ready() -> JSONResponse:
        try:
            async with sessions() as db:
                revision = await db.scalar(text("SELECT version_num FROM alembic_version"))
                await db.execute(select(SessionRecord.id).limit(1))
            if revision != "0006_cloud_intents":
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
            await purge_expired(db)
            db.add(session)
        return {"id": session.id, "token": token}

    async def demo_session(
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

    current_session = mount_auth(
        app, sessions, origin, demo_session, google_transport=google_transport
    )
    app.get("/v1/session")(current_session)
    ledger = Ledger(sessions)
    catalogue = model_catalog or ModelCatalog(
        preferred_model=os.getenv("OPENROUTER_MODEL", "auto"),
        fallback_models=tuple(
            v.strip() for v in os.getenv("OPENROUTER_FALLBACK_MODELS", "").split(",") if v.strip()
        ),
        ttl_seconds=int(os.getenv("OPENROUTER_DISCOVERY_TTL_SECONDS", "300")),
    )
    app.state.model_catalog = catalogue

    @app.exception_handler(CatalogError)
    async def catalogue_error(_: object, error: CatalogError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"error": {"code": str(error)}})

    driver = InvestigationDriver(database_url, ledger, catalogue)
    mount_routes(app, ledger, driver, current_session, provider_transport)
    mount_history(app, sessions, current_session, ledger, database_url)
    return app


def app_factory() -> FastAPI:
    configure()
    return create_app(database_url=os.environ["DATABASE_URL"])
