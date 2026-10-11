import json
import os

import httpx
import pytest
from test_workflow import HASH, request

from hypothron.api import create_app


@pytest.mark.asyncio
async def test_authenticated_byok_investigation_result_resume_and_secret_nonpersistence():
    calls = []
    key = "api-canary-never-persist-123"

    def wire(req):
        assert req.headers["x-goog-api-key"] == key
        prompt = json.loads(req.content)["contents"][0]["parts"][0]["text"]
        assert key not in prompt
        context = json.loads(prompt.split("Approved context: ")[1])
        role = context["role"]
        calls.append(role)
        if role == "planner":
            reply = {
                "clarification": None,
                "hypotheses": [
                    {"id": "h1", "statement": "Test revenue", "datasetHash": HASH, "priority": 1}
                ],
            }
        elif role == "analyst":
            reply = {
                "action": "finish" if context["evidence"] else "execute",
                "hypothesisId": None if context["evidence"] else "h1",
                "reason": "Inspect evidence",
            }
        else:
            reply = {
                "conclusion": "Local evidence agrees.",
                "citations": [context["evidence"][0]["jobId"]],
            }
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(reply)}]}}
                ]
            },
        )

    app = create_app(
        database_url=os.environ["DATABASE_URL"], provider_transport=httpx.MockTransport(wire)
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        session = (await client.post("/v1/sessions")).json()
        auth = {"Authorization": "Bearer " + session["token"]}
        body = {
            "request": request(),
            "provider": "gemini",
            "model": "gemini-test",
            "key": key,
            "consent": True,
        }
        assert (await client.post("/v1/investigations", json=body)).status_code == 401
        started = await client.post("/v1/investigations", headers=auth, json=body)
        assert started.status_code == 201, started.text
        result = started.json()
        run_id, job = result["id"], result["state"]["pending"]
        assert (await client.get(f"/v1/investigations/{run_id}")).status_code == 401
        outsider = (await client.post("/v1/sessions")).json()
        assert (
            await client.get(
                f"/v1/investigations/{run_id}",
                headers={"Authorization": "Bearer " + outsider["token"]},
            )
        ).status_code == 404
        evidence = {
            "jobId": job["id"],
            "datasetHash": HASH,
            "sql": {"minorUnits": "3033", "count": 3},
            "python": {"minorUnits": "3033", "count": 3},
        }
        posted = await client.post(
            f"/v1/investigations/{run_id}/results", headers=auth, json=evidence
        )
        assert posted.status_code == 200
        assert (
            await client.post(f"/v1/investigations/{run_id}/results", headers=auth, json=evidence)
        ).json()["duplicate"]
        resumed = await client.post(
            f"/v1/investigations/{run_id}/advance", headers=auth, json={"key": key}
        )
        assert resumed.json()["state"]["status"] == "COMPLETE", resumed.text
        viewed = await client.get(f"/v1/investigations/{run_id}", headers=auth)
        assert viewed.json()["state"]["status"] == "COMPLETE"
        assert key not in viewed.text
        assert calls == ["planner", "analyst", "analyst", "report"]
    from sqlalchemy import text

    async with app.state.sessions() as db:
        for table in ["runs", "jobs", "attempts", "events"]:
            rows = await db.scalars(text(f"SELECT row_to_json(t)::text FROM {table} t"))
            assert all(key not in row for row in rows)


@pytest.mark.asyncio
async def test_consent_secret_extra_rows_and_provider_rejection_before_storage():
    from sqlalchemy import func, select

    from hypothron.records import RunRecord

    key = "secret-canary-12345"
    app = create_app(database_url=os.environ["DATABASE_URL"])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        session = (await client.post("/v1/sessions")).json()
        auth = {"Authorization": "Bearer " + session["token"]}
        base = {
            "request": request(),
            "provider": "gemini",
            "model": "gemini-test",
            "key": key,
            "consent": True,
        }
        cases = [
            (dict(base, consent=False), 422),
            (dict(base, provider="arbitrary-proxy"), 422),
            (dict(base, model=key), 422),
            (dict(base, request={**request(), "question": key}), 422),
            (dict(base, request={**request(), "rows": [{"secret": "private"}]}), 422),
        ]
        for body, expected in cases:
            response = await client.post("/v1/investigations", headers=auth, json=body)
            assert response.status_code == expected, response.text
            assert key not in response.text
    async with app.state.sessions() as db:
        assert (
            await db.scalar(
                select(func.count()).select_from(RunRecord).where(RunRecord.owner == session["id"])
            )
            == 0
        )


@pytest.mark.asyncio
async def test_terminal_sse_reconnect_cursor_and_cross_owner_rejection():
    from hypothron.ledger import Ledger

    app = create_app(database_url=os.environ["DATABASE_URL"])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        session = (await client.post("/v1/sessions")).json()
        auth = {"Authorization": "Bearer " + session["token"]}
        ledger = Ledger(app.state.sessions)
        run = await ledger.create(session["id"], request(), "gemini", "gemini-test")
        await ledger.cancel(session["id"], run.id)
        assert (await client.get(f"/v1/investigations/{run.id}/events")).status_code == 401
        response = await client.get(f"/v1/investigations/{run.id}/events", headers=auth)
        assert response.status_code == 200
        assert "event: cancelled" in response.text
        cursor = max(
            int(line[4:]) for line in response.text.splitlines() if line.startswith("id: ")
        )
        assert (
            await client.get(f"/v1/investigations/{run.id}/events?after={cursor}", headers=auth)
        ).text == ""
