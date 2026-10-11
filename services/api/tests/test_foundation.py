import os

import httpx
import pytest


def application():
    from hypothron.api import create_app

    return create_app(database_url=os.environ["DATABASE_URL"])


@pytest.mark.asyncio
async def test_readiness_requires_migrated_postgres():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="http://test"
    ) as client:
        response = await client.get("/v1/ready")
    assert response.status_code == 200
    assert response.json()["database"] == "ready"


@pytest.mark.asyncio
async def test_session_capability_is_hashed_and_owner_scoped():
    from sqlalchemy import select

    from hypothron.db import SessionRecord

    app = application()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        first = (await client.post("/v1/sessions")).json()
        second = (await client.post("/v1/sessions")).json()
        token = first["token"]
        assert (
            await client.get("/v1/session", headers={"Authorization": f"Bearer {token}"})
        ).json()["id"] == first["id"]
        assert (
            await client.get("/v1/session", headers={"Authorization": "Bearer wrong"})
        ).status_code == 401
        assert first["id"] != second["id"]
    async with app.state.sessions() as db:
        stored = (
            await db.execute(select(SessionRecord).where(SessionRecord.id == first["id"]))
        ).scalar_one()
        assert token not in stored.token_hash
        assert len(stored.token_hash) == 64


@pytest.mark.asyncio
async def test_raw_dataset_and_unrecognized_inputs_are_rejected_without_echo():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="http://test"
    ) as client:
        response = await client.post("/v1/sessions", json={"api_key": "canary-do-not-echo"})
        assert response.status_code == 422
        assert "canary-do-not-echo" not in response.text
        assert (await client.post("/v1/datasets", content=b"private,row")).status_code == 404


@pytest.mark.asyncio
async def test_metadata_request_body_limit_rejects_before_parsing():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="http://test"
    ) as client:
        response = await client.post("/v1/sessions", content=b"x" * (16 * 1024 + 1))
        assert response.status_code == 413
        assert response.json() == {"error": {"code": "INPUT_LIMIT"}}

        async def chunks():
            yield b"x" * 8192
            yield b"x" * 8193

        response = await client.post("/v1/sessions", content=chunks())
        assert response.status_code == 413


@pytest.mark.asyncio
async def test_expired_capability_is_denied_and_lazily_purged():
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import select

    from hypothron.db import SessionRecord

    app = application()
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        session = (await client.post("/v1/sessions")).json()
        async with app.state.sessions.begin() as db:
            record = await db.get(SessionRecord, session["id"])
            record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        assert (
            await client.get("/v1/session", headers={"Authorization": "Bearer " + session["token"]})
        ).status_code == 401
        await client.post("/v1/sessions")
        async with app.state.sessions() as db:
            assert (
                await db.scalar(select(SessionRecord.id).where(SessionRecord.id == session["id"]))
                is None
            )
