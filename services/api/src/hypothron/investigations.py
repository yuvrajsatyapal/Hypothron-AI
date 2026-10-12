"""Authenticated metadata-only investigation routes and finite reconnectable SSE."""

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Annotated, Any, Literal

from fastapi import Depends, FastAPI, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, SecretStr

from hypothron.agents.models import EvidenceInput, RunInput, StrictModel
from hypothron.agents.workflow import Role, build_workflow, initial_state
from hypothron.driver import InvestigationDriver
from hypothron.ledger import TERMINAL, Ledger, LedgerError
from hypothron.providers.http import _contains_secret


class StartRequest(StrictModel):
    request_id: Annotated[
        str, Field(pattern=r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
    ] = Field(alias="requestId")
    request: RunInput
    provider: Literal["gemini", "openrouter"]
    model: Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$")]
    key: Annotated[SecretStr, Field(min_length=8, max_length=512)]
    consent: Literal[True]


class AdvanceRequest(StrictModel):
    key: Annotated[SecretStr, Field(min_length=8, max_length=512)]
    answer: Annotated[str, Field(min_length=1, max_length=1000)] | None = None


def public_state(state: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in state.items() if not k.startswith("__")}


def mount_routes(
    app: FastAPI,
    ledger: Ledger,
    driver: InvestigationDriver,
    authenticate: Callable[..., Awaitable[dict[str, str]]],
    transport: Any = None,
) -> None:
    authenticated = Depends(authenticate)

    @app.exception_handler(LedgerError)
    async def ledger_error(_: Request, error: LedgerError) -> JSONResponse:
        code = str(error)
        status = (
            404
            if code == "NOT_FOUND"
            else (422 if code in {"INVALID_JOB", "SECRET_IN_INPUT", "INVALID_EVIDENCE"} else 409)
        )
        return JSONResponse(status_code=status, content={"error": {"code": code}})

    @app.post("/v1/investigations", status_code=201)
    async def start(body: StartRequest, owner: dict[str, str] = authenticated) -> dict[str, Any]:
        request = body.request.model_dump(mode="json", by_alias=True)
        if _contains_secret(
            {
                "request": request,
                "model": body.model,
                "provider": body.provider,
                "requestId": body.request_id,
            },
            body.key.get_secret_value(),
        ):
            raise LedgerError("SECRET_IN_INPUT")
        run = await ledger.create(
            owner["id"], request, body.provider, body.model, request_id=body.request_id
        )
        return {"id": run.id, "state": dict(initial_state(run.request), status=run.status)}

    @app.post("/v1/investigations/{run_id}/advance")
    async def advance(
        run_id: str, body: AdvanceRequest, owner: dict[str, str] = authenticated
    ) -> dict[str, Any]:
        state = await driver.advance(
            owner["id"], run_id, body.key, answer=body.answer, transport=transport
        )
        return {"id": run_id, "state": public_state(state)}

    @app.post("/v1/investigations/{run_id}/results")
    async def result(
        run_id: str, body: EvidenceInput, owner: dict[str, str] = authenticated
    ) -> dict[str, Any]:
        return await ledger.submit(owner["id"], run_id, body)

    @app.post("/v1/investigations/{run_id}/cancel")
    async def cancel(run_id: str, owner: dict[str, str] = authenticated) -> dict[str, str]:
        await ledger.cancel(owner["id"], run_id)
        return {"status": "CANCELLED"}

    async def inspect(run_id: str, owner: dict[str, str] = authenticated) -> dict[str, Any]:
        # Scope authenticated before touching native tables. Read-only inspection has no
        # credential, provider call or write lease, and exposes only this exact run.
        row = await ledger.get(owner["id"], run_id)

        async def forbidden_provider(
            role: Role, context: dict[str, Any], schema: type[BaseModel]
        ) -> dict[str, Any]:
            raise RuntimeError("Read-only inspection cannot invoke inference")

        serde = JsonPlusSerializer(
            pickle_fallback=False, allowed_json_modules=[], allowed_msgpack_modules=[]
        )
        conninfo = driver.database_url.replace("postgresql+psycopg://", "postgresql://", 1)
        async with await AsyncConnection.connect(
            conninfo,
            autocommit=True,
            prepare_threshold=0,
            row_factory=dict_row,
            connect_timeout=5,
            options="-c statement_timeout=5000 -c lock_timeout=5000",
        ) as connection:
            saver = AsyncPostgresSaver(connection, serde=serde)
            snapshot = await build_workflow(forbidden_provider, saver).aget_state(
                {"configurable": {"thread_id": run_id}}
            )
        state = public_state(dict(snapshot.values))
        state["status"] = row.status
        return {
            "id": run_id,
            "attempts": row.attempts,
            "state": state,
            "measurements": await ledger.measurements(owner["id"], run_id),
        }

    @app.get("/v1/investigations/{run_id}")
    async def read(run_id: str, owner: dict[str, str] = authenticated) -> dict[str, Any]:
        try:
            async with asyncio.timeout(5):
                return await inspect(run_id, owner)
        except TimeoutError:
            raise LedgerError("READ_TIMEOUT") from None

    @app.get("/v1/investigations/{run_id}/events")
    async def events(
        run_id: str,
        request: Request,
        after: Annotated[int, Query(ge=0)] = 0,
        owner: dict[str, str] = authenticated,
    ) -> StreamingResponse:
        await ledger.get(owner["id"], run_id)

        async def stream() -> AsyncIterator[str]:
            cursor = after
            # Finite stream releases connections; client reconnects with the last ID.
            for _ in range(20):
                if await request.is_disconnected():
                    return
                rows = await ledger.events(owner["id"], run_id, cursor)
                for event in rows:
                    cursor = event["id"]
                    yield f"id: {cursor}\nevent: {event['kind']}\ndata: {json.dumps(event['payload'], separators=(',', ':'))}\n\n"
                row = await ledger.get(owner["id"], run_id)
                if row.status in TERMINAL:
                    return
                yield ": heartbeat\n\n"
                await asyncio.sleep(0.5)

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )
