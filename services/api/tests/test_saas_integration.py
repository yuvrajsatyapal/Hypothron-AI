import os

import httpx
import pytest

from hypothron.api import create_app


@pytest.mark.asyncio
async def test_account_routes_mount_on_real_application_and_revoke_tokens():
    from uuid import uuid4

    app = create_app(database_url=os.environ["DATABASE_URL"])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        headers = {"Origin": "http://127.0.0.1:3000"}
        response = await client.post(
            "/v1/auth/signup",
            headers=headers,
            json={"email": f"{uuid4()}@example.com", "password": "long-test-password-2026"},
        )
        assert response.status_code == 201
        account = response.json()
        headers["Authorization"] = "Bearer " + account["token"]
        current = await client.get("/v1/session", headers=headers)
        assert current.status_code == 200
        assert current.json()["id"] == account["id"]
        assert (await client.post("/v1/auth/logout", headers=headers, json={})).status_code == 200
        assert (await client.get("/v1/session", headers=headers)).status_code == 401
    await app.state.sessions.kw["bind"].dispose()
