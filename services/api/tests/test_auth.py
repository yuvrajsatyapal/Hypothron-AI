import os
from uuid import uuid4

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


@pytest.fixture
async def auth_client():
    from hypothron.auth import mount_auth

    engine = create_async_engine(os.environ["DATABASE_URL"])
    app = FastAPI()
    mount_auth(app, async_sessionmaker(engine, expire_on_commit=False), "http://127.0.0.1:3000")
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        yield client
    await engine.dispose()


async def register(client):
    credentials = {"email": f"{uuid4()}@example.com", "password": "long enough password 123!"}
    response = await client.post("/v1/auth/signup", json=credentials)
    assert response.status_code == 201
    return credentials, response.json()


@pytest.mark.asyncio
async def test_login_uses_stable_owner_and_logout_revokes_only_token(auth_client):
    credentials, signup = await register(auth_client)
    login = (await auth_client.post("/v1/auth/login", json=credentials)).json()
    assert signup["id"] == login["id"]
    assert signup["token"] != login["token"]
    headers = {"Authorization": "Bearer " + signup["token"]}
    assert (await auth_client.get("/v1/auth/me", headers=headers)).json()["email"] == credentials[
        "email"
    ]
    assert (await auth_client.post("/v1/auth/logout", headers=headers)).status_code == 200
    assert (await auth_client.get("/v1/auth/me", headers=headers)).status_code == 401
    assert (
        await auth_client.get("/v1/auth/me", headers={"Authorization": "Bearer " + login["token"]})
    ).status_code == 200


@pytest.mark.asyncio
async def test_auth_rejects_wrong_password_and_cross_origin(auth_client):
    credentials, _ = await register(auth_client)
    response = await auth_client.post(
        "/v1/auth/login", json={**credentials, "password": "wrong password secret"}
    )
    assert response.status_code == 401
    assert "secret" not in response.text
    assert (
        await auth_client.post(
            "/v1/auth/signup", json=credentials, headers={"Origin": "https://evil.example"}
        )
    ).status_code == 403
    assert (await auth_client.post("/v1/auth/signup", json=credentials)).status_code == 409


@pytest.mark.asyncio
async def test_password_hash_and_tokens_are_not_stored_plaintext(auth_client):
    import hashlib

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from hypothron.accounts import AccountRecord, LoginTokenRecord

    credentials, signup = await register(auth_client)
    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with async_sessionmaker(engine)() as db:
        account = await db.scalar(
            select(AccountRecord).where(AccountRecord.email == credentials["email"])
        )
        assert credentials["password"] not in account.password_hash
        token = await db.scalar(
            select(LoginTokenRecord).where(
                LoginTokenRecord.token_hash == hashlib.sha256(signup["token"].encode()).hexdigest()
            )
        )
        assert token is not None
    await engine.dispose()


@pytest.mark.asyncio
async def test_expired_token_rejected(auth_client):
    import hashlib
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import update

    from hypothron.accounts import LoginTokenRecord

    _, signup = await register(auth_client)
    engine = create_async_engine(os.environ["DATABASE_URL"])
    async with async_sessionmaker(engine).begin() as db:
        await db.execute(
            update(LoginTokenRecord)
            .where(
                LoginTokenRecord.token_hash == hashlib.sha256(signup["token"].encode()).hexdigest()
            )
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    assert (
        await auth_client.get("/v1/auth/me", headers={"Authorization": "Bearer " + signup["token"]})
    ).status_code == 401
    await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid", [None, "nonce", "audience", "unverified", "expired", "signature"]
)
async def test_google_pkce_verified_claims_binding_and_replay(monkeypatch, invalid):
    import base64
    import hashlib
    import time
    from urllib.parse import parse_qs, urlsplit

    import jwt
    from cryptography.hazmat.primitives.asymmetric import rsa

    from hypothron.auth import mount_auth

    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "test-secret")
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = private.public_key().public_numbers()

    def encoded(value):
        return (
            base64.urlsafe_b64encode(value.to_bytes((value.bit_length() + 7) // 8, "big"))
            .decode()
            .rstrip("=")
        )

    nonce = ""

    async def transport(request):
        if request.url.path == "/token":
            form = parse_qs(request.content.decode())
            assert form["redirect_uri"] == ["http://127.0.0.1:8000/v1/auth/google/callback"]
            assert (
                base64.urlsafe_b64encode(hashlib.sha256(form["code_verifier"][0].encode()).digest())
                .decode()
                .rstrip("=")
                == challenge
            )
            token = jwt.encode(
                {
                    "iss": "https://accounts.google.com",
                    "aud": "wrong" if invalid == "audience" else "test-client",
                    "sub": str(uuid4()),
                    "email": f"{uuid4()}@example.com",
                    "email_verified": invalid != "unverified",
                    "nonce": "wrong" if invalid == "nonce" else nonce,
                    "iat": int(time.time()),
                    "exp": int(time.time()) - 60 if invalid == "expired" else int(time.time()) + 60,
                },
                rsa.generate_private_key(public_exponent=65537, key_size=2048)
                if invalid == "signature"
                else private,
                algorithm="RS256",
                headers={"kid": "test"},
            )
            return httpx.Response(200, json={"id_token": token})
        return httpx.Response(
            200,
            json={
                "keys": [
                    {
                        "kid": "test",
                        "kty": "RSA",
                        "alg": "RS256",
                        "n": encoded(public.n),
                        "e": encoded(public.e),
                    }
                ]
            },
        )

    engine = create_async_engine(os.environ["DATABASE_URL"])
    app = FastAPI()
    mount_auth(
        app,
        async_sessionmaker(engine, expire_on_commit=False),
        "http://127.0.0.1:3000",
        google_transport=httpx.MockTransport(transport),
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        start = (await client.post("/v1/auth/google/start")).json()
        query = parse_qs(urlsplit(start["url"]).query)
        nonce = query["nonce"][0]
        challenge = query["code_challenge"][0]
        state = query["state"][0]
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://127.0.0.1:8000"
        ) as attacker:
            assert (
                await attacker.get(
                    "/v1/auth/google/callback", params={"state": state, "code": "code"}
                )
            ).status_code == 401
        callback = await client.get(
            "/v1/auth/google/callback", params={"state": state, "code": "code"}
        )
        if invalid:
            assert callback.status_code == 401
            assert (
                await client.get(
                    "/v1/auth/google/callback", params={"state": state, "code": "code"}
                )
            ).status_code == 401
            await engine.dispose()
            return
        assert callback.status_code == 303
        code = urlsplit(callback.headers["location"]).fragment.removeprefix("oauth=")
        result = await client.post("/v1/auth/google/complete", json={"code": code})
        assert result.status_code == 200
        assert (
            await client.get("/v1/auth/google/callback", params={"state": state, "code": "code"})
        ).status_code == 401
        assert (
            await client.post("/v1/auth/google/complete", json={"code": code})
        ).status_code == 401
    await engine.dispose()


async def test_google_json_rejects_oversized_response():
    from hypothron.auth import google_json

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, content=b'{"padding":"' + b"x" * 70000 + b'"}')
        )
    ) as client:
        with pytest.raises(ValueError):
            await google_json(client, "GET", "https://www.googleapis.com/oauth2/v3/certs", 65536)


async def test_password_hash_admission_is_bounded_and_cancellation_keeps_slot(monkeypatch):
    import asyncio
    import threading

    from hypothron import auth

    active_db = 0
    active_hash = 0
    peak = 0
    release = threading.Event()
    entered = threading.Event()

    class DB:
        async def __aenter__(self):
            nonlocal active_db
            active_db += 1
            return self

        async def __aexit__(self, *args):
            nonlocal active_db
            active_db -= 1

        async def scalar(self, query):
            return None

    app = FastAPI()
    auth.mount_auth(app, lambda: DB(), "http://127.0.0.1:3000")

    def blocked_hash(value, salt=None):
        nonlocal active_hash, peak
        assert active_db == 0
        active_hash += 1
        peak = max(peak, active_hash)
        if active_hash == 2:
            entered.set()
        release.wait(timeout=3)
        active_hash -= 1
        return "wrong-password-hash"

    monkeypatch.setattr(auth, "password_hash", blocked_hash)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1:8000",
        headers={"Origin": "http://127.0.0.1:3000"},
    ) as client:
        credentials = {"email": "test@example.com", "password": "long secure password 123!"}
        first = asyncio.create_task(client.post("/v1/auth/login", json=credentials))
        second = asyncio.create_task(client.post("/v1/auth/login", json=credentials))
        assert await asyncio.to_thread(entered.wait, 2)
        first.cancel()
        await asyncio.sleep(0)
        try:
            assert (await client.post("/v1/auth/login", json=credentials)).status_code == 503
        finally:
            release.set()
            await asyncio.gather(first, second, return_exceptions=True)
        assert peak == 2
        assert (await client.post("/v1/auth/login", json=credentials)).status_code == 401


async def test_google_json_refuses_compression_before_reading():
    from hypothron.auth import google_json

    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            raise AssertionError("encoded body must not be read")
            yield b""

    def transport(request):
        assert request.headers["accept-encoding"] == "identity"
        return httpx.Response(200, headers={"Content-Encoding": "gzip"}, stream=Stream())

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        with pytest.raises(ValueError, match="OAUTH_ENCODING_REJECTED"):
            await google_json(client, "GET", "https://www.googleapis.com/oauth2/v3/certs", 65536)
