import os
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest.mark.asyncio
async def test_history_account_required_unknown_and_cloud_disabled():
    from hypothron.auth import mount_auth
    from hypothron.history import mount_history
    from hypothron.ledger import Ledger

    engine = create_async_engine(os.environ["DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    app = FastAPI()
    authenticate = mount_auth(app, sessions, "http://127.0.0.1:3000")
    mount_history(app, sessions, authenticate, Ledger(sessions), os.environ["DATABASE_URL"])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        assert (await client.get("/v1/account/history")).status_code == 401
        response = await client.post(
            "/v1/auth/signup",
            json={"email": f"{uuid4()}@example.com", "password": "long secure password 123!"},
        )
        client.headers["Authorization"] = "Bearer " + response.json()["token"]
        assert (await client.get("/v1/account/history")).json() == {"items": []}
        assert (await client.get("/v1/account/history/" + str(uuid4()))).status_code == 404
        assert (
            await client.post(
                "/v1/account/artifacts", params={"consent": "true"}, content=b"private csv data"
            )
        ).status_code == 503
    await engine.dispose()


@pytest.mark.asyncio
async def test_saved_metadata_survives_run_deletion_login_and_cross_owner():
    from sqlalchemy import delete
    from test_workflow import request

    from hypothron.auth import mount_auth
    from hypothron.history import mount_history
    from hypothron.ledger import Ledger
    from hypothron.records import RunRecord

    engine = create_async_engine(os.environ["DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    ledger = Ledger(sessions)
    app = FastAPI()
    authenticate = mount_auth(app, sessions, "http://127.0.0.1:3000")
    mount_history(app, sessions, authenticate, ledger, os.environ["DATABASE_URL"])
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        credentials = {"email": f"{uuid4()}@example.com", "password": "long secure password 123!"}
        owner = (await client.post("/v1/auth/signup", json=credentials)).json()
        client.headers["Authorization"] = "Bearer " + owner["token"]
        run = await ledger.create(owner["id"], request(), "gemini", "gemini-test")
        path = "/v1/account/history/" + run.id
        assert (await client.post(path, json={"consent": False})).status_code == 422
        assert (await client.post(path, json={"consent": True})).status_code == 200
        assert (await client.get(path)).json()["payload"]["request"] == request()
        other = (
            await client.post(
                "/v1/auth/signup", json={**credentials, "email": f"{uuid4()}@example.com"}
            )
        ).json()
        assert (
            await client.get(path, headers={"Authorization": "Bearer " + other["token"]})
        ).status_code == 404
        assert (
            await client.post(
                path + "/delete", headers={"Authorization": "Bearer " + other["token"]}
            )
        ).status_code == 404
        async with sessions.begin() as db:
            await db.execute(delete(RunRecord).where(RunRecord.id == run.id))
        assert (await client.post("/v1/auth/logout")).status_code == 200
        login = (await client.post("/v1/auth/login", json=credentials)).json()
        client.headers["Authorization"] = "Bearer " + login["token"]
        assert (await client.get(path)).status_code == 200
        assert len((await client.get("/v1/account/history")).json()["items"]) == 1
        assert (await client.post(path + "/delete")).status_code == 204
        assert (await client.get(path)).status_code == 404
    await engine.dispose()


@pytest.mark.asyncio
async def test_cloud_consent_integrity_ownership_and_delete():
    from hypothron.auth import mount_auth
    from hypothron.cloud import PrivateObjectStore
    from hypothron.history import mount_history
    from hypothron.ledger import Ledger

    class Store(PrivateObjectStore):
        def __init__(self):
            self.enabled = True
            self.values = {}
            self.fail = False

        async def put(self, key, data):
            if self.fail:
                from hypothron.cloud import CloudUnavailable

                raise CloudUnavailable()
            self.values[key] = data

        async def get(self, key):
            return self.values[key]

        async def delete(self, key):
            self.values.pop(key, None)

    store = Store()
    engine = create_async_engine(os.environ["DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    app = FastAPI()
    authenticate = mount_auth(app, sessions, "http://127.0.0.1:3000")
    mount_history(
        app, sessions, authenticate, Ledger(sessions), os.environ["DATABASE_URL"], store=store
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        credentials = {"email": f"{uuid4()}@example.com", "password": "long secure password 123!"}
        first = (await client.post("/v1/auth/signup", json=credentials)).json()
        client.headers["Authorization"] = "Bearer " + first["token"]
        assert (
            await client.post(
                "/v1/account/artifacts",
                params={"consent": "false"},
                content=b"PK\x03\x04bytes",
                headers={"Content-Type": "application/zip"},
            )
        ).status_code == 422
        result = await client.post(
            "/v1/account/artifacts",
            params={"consent": "true"},
            content=b"PK\x03\x04bytes",
            headers={"Content-Type": "application/zip"},
        )
        assert result.status_code == 201
        artifact = result.json()["id"]
        assert (await client.get("/v1/account/artifacts/" + artifact)).content == b"PK\x03\x04bytes"
        second = (
            await client.post(
                "/v1/auth/signup", json={**credentials, "email": f"{uuid4()}@example.com"}
            )
        ).json()
        assert (
            await client.get(
                "/v1/account/artifacts/" + artifact,
                headers={"Authorization": "Bearer " + second["token"]},
            )
        ).status_code == 404
        assert (
            await client.post("/v1/account/artifacts/" + artifact + "/delete")
        ).status_code == 204
        assert store.values == {}
        store.fail = True
        failed = await client.post(
            "/v1/account/artifacts",
            params={"consent": "true"},
            content=b"PK\x03\x04bytes",
            headers={"Content-Type": "application/zip"},
        )
        assert failed.status_code == 503
        failed_item = (await client.get("/v1/account/artifacts")).json()["items"][0]
        assert failed_item["status"] == "PENDING"
        assert failed_item["byteLength"] == 9
        assert (await client.get("/v1/account/artifacts/" + failed_item["id"])).status_code == 409
        assert (
            await client.post("/v1/account/artifacts/" + failed_item["id"] + "/delete")
        ).status_code == 409
    await engine.dispose()


async def test_s3_rejects_public_bucket_and_requires_encryption(monkeypatch):
    from botocore.stub import Stubber

    from hypothron.cloud import CloudUnavailable, PrivateObjectStore

    monkeypatch.setenv("CLOUD_STORAGE_ENABLED", "true")
    monkeypatch.setenv("S3_BUCKET", "test-private-bucket")
    monkeypatch.setenv("S3_ENDPOINT_URL", "https://s3.example.com")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-access")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret")
    store = PrivateObjectStore()
    client = store.client()
    stub = Stubber(client)
    policy = {
        "BlockPublicAcls": True,
        "IgnorePublicAcls": True,
        "BlockPublicPolicy": True,
        "RestrictPublicBuckets": True,
    }
    stub.add_response(
        "get_public_access_block",
        {"PublicAccessBlockConfiguration": policy},
        {"Bucket": "test-private-bucket"},
    )
    stub.add_response(
        "put_object",
        {},
        {
            "Bucket": "test-private-bucket",
            "Key": "accounts/a/x.zip",
            "Body": b"bytes",
            "ContentType": "application/zip",
            "ServerSideEncryption": "AES256",
        },
    )
    stub.add_response(
        "get_public_access_block",
        {"PublicAccessBlockConfiguration": {**policy, "BlockPublicPolicy": False}},
        {"Bucket": "test-private-bucket"},
    )
    stub.activate()
    monkeypatch.setattr(store, "client", lambda: client)
    await store.put("accounts/a/x.zip", b"bytes")
    with pytest.raises(CloudUnavailable):
        await store.put("accounts/a/x.zip", b"bytes")
    stub.assert_no_pending_responses()


async def test_pending_upload_reserves_quota_and_cancellation_requires_owned_cleanup(monkeypatch):
    import asyncio
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import update

    from hypothron import history
    from hypothron.auth import mount_auth
    from hypothron.cloud import PrivateObjectStore
    from hypothron.ledger import Ledger

    started = asyncio.Event()
    finish = asyncio.Event()

    class Store(PrivateObjectStore):
        def __init__(self):
            self.enabled = True

        async def put(self, key, data):
            started.set()
            await finish.wait()

        async def delete(self, key):
            pass

    engine = create_async_engine(os.environ["DATABASE_URL"])
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    app = FastAPI()
    authenticate = mount_auth(app, sessions, "http://127.0.0.1:3000")
    history.mount_history(
        app, sessions, authenticate, Ledger(sessions), os.environ["DATABASE_URL"], store=Store()
    )
    monkeypatch.setattr(history, "MAX_ACCOUNT_BYTES", 9)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        first = (
            await client.post(
                "/v1/auth/signup",
                json={"email": f"{uuid4()}@example.com", "password": "long secure password 123!"},
            )
        ).json()
        client.headers["Authorization"] = "Bearer " + first["token"]
        upload = asyncio.create_task(
            client.post(
                "/v1/account/artifacts",
                params={"consent": "true"},
                content=b"PK\x03\x04bytes",
                headers={"Content-Type": "application/zip"},
            )
        )
        await asyncio.wait_for(started.wait(), 2)
        item = (await client.get("/v1/account/artifacts")).json()["items"][0]
        assert item["status"] == "PENDING"
        path = "/v1/account/artifacts/" + item["id"]
        assert (await client.get(path)).status_code == 409
        assert (await client.post(path + "/delete")).status_code == 409
        assert (
            await client.post(
                "/v1/account/artifacts",
                params={"consent": "true"},
                content=b"PK\x03\x04bytes",
                headers={"Content-Type": "application/zip"},
            )
        ).status_code == 409
        upload.cancel()
        await asyncio.gather(upload, return_exceptions=True)
        assert (await client.get("/v1/account/artifacts")).json()["items"][0]["status"] == "PENDING"
        async with sessions.begin() as db:
            await db.execute(
                update(history.CloudArtifactRecord)
                .where(history.CloudArtifactRecord.id == item["id"])
                .values(created_at=datetime.now(UTC) - timedelta(minutes=3))
            )
        assert (await client.post(path + "/delete")).status_code == 409
    await engine.dispose()


async def test_upload_admission_bounds_streams_before_reading_third_body():
    import asyncio

    from hypothron.history import mount_history

    entered = 0
    third_read = False
    started = asyncio.Event()
    release = asyncio.Event()

    async def owner():
        return {"id": "owner", "accountId": "account"}

    class Store:
        enabled = True

    app = FastAPI()
    mount_history(app, None, owner, None, "unused", store=Store())

    async def slow():
        nonlocal entered
        entered += 1
        if entered == 2:
            started.set()
        await release.wait()
        yield b"not a zip"

    async def third():
        nonlocal third_read
        third_read = True
        yield b"private-data"

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8000"
    ) as client:
        first = asyncio.create_task(
            client.post(
                "/v1/account/artifacts",
                params={"consent": "true"},
                headers={"Content-Type": "application/zip"},
                content=slow(),
            )
        )
        second = asyncio.create_task(
            client.post(
                "/v1/account/artifacts",
                params={"consent": "true"},
                headers={"Content-Type": "application/zip"},
                content=slow(),
            )
        )
        await asyncio.wait_for(started.wait(), 2)
        try:
            assert (
                await client.post(
                    "/v1/account/artifacts",
                    params={"consent": "true"},
                    headers={"Content-Type": "application/zip"},
                    content=third(),
                )
            ).status_code == 503
            assert not third_read
            assert entered == 2
        finally:
            first.cancel()
            second.cancel()
            await asyncio.gather(first, second, return_exceptions=True)
        assert (
            await client.post(
                "/v1/account/artifacts",
                params={"consent": "true"},
                headers={"Content-Type": "application/zip"},
                content=b"not a zip",
            )
        ).status_code == 422
