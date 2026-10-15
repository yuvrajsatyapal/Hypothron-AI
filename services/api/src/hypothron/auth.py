"""Account authentication; credentials stay out of application state and redirect URLs."""

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from urllib.parse import urlencode
from uuid import uuid4

import httpx
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hypothron.accounts import AccountRecord, LoginTokenRecord, OAuthFlowRecord
from hypothron.db import SessionRecord

Auth = Callable[..., Awaitable[dict[str, str]]]
COOKIE = "hypothron_oauth_flow"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    hashed = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return salt + ":" + hashed.hex()


async def google_json(
    client: httpx.AsyncClient, method: str, url: str, limit: int, **kwargs: Any
) -> dict[str, Any]:
    async with client.stream(
        method, url, headers={"Accept-Encoding": "identity"}, **kwargs
    ) as response:
        response.raise_for_status()
        if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
            raise ValueError("OAUTH_ENCODING_REJECTED")
        data = bytearray()
        if response.is_stream_consumed:
            if len(response.content) > limit:
                raise ValueError("OAUTH_RESPONSE_LIMIT")
            data.extend(response.content)
        else:
            async for chunk in response.aiter_raw(chunk_size=4096):
                if len(data) + len(chunk) > limit:
                    raise ValueError("OAUTH_RESPONSE_LIMIT")
                data.extend(chunk)
    result = json.loads(data)
    if not isinstance(result, dict):
        raise TypeError("OAUTH_RESPONSE_INVALID")
    return result


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr = Field(min_length=12, max_length=256)

    @field_validator("email")
    @classmethod
    def email_valid(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(
            r"[a-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}", value
        ):
            raise ValueError("INVALID_EMAIL")
        return value


class Completion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=20, max_length=128)


def mount_auth(
    app: FastAPI,
    sessions: async_sessionmaker[AsyncSession],
    origin: str,
    demo_authenticator: Auth | None = None,
    *,
    google_transport: httpx.AsyncBaseTransport | None = None,
) -> Auth:
    attempts: dict[str, list[float]] = {}
    hash_slots = asyncio.Semaphore(2)

    async def hash_password(value: str, salt: str | None = None) -> str:
        if hash_slots.locked():
            raise HTTPException(503, "AUTH_BUSY")
        await hash_slots.acquire()
        task = asyncio.create_task(asyncio.to_thread(password_hash, value, salt))
        try:
            try:
                return await asyncio.shield(task)
            except asyncio.CancelledError:
                await task
                raise
        finally:
            hash_slots.release()

    dummy_hash = password_hash("dummy-login-password-do-not-use")
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    callback = os.getenv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/v1/auth/google/callback")
    # Redirect destinations are configuration, never request Host or forwarded headers.
    if not callback.endswith("/v1/auth/google/callback") or not (
        callback.startswith("https://")
        or callback == "http://127.0.0.1:8000/v1/auth/google/callback"
    ):
        raise ValueError("INVALID_GOOGLE_CALLBACK")

    def mutation(request: Request) -> None:
        if request.headers.get("origin") != origin:
            raise HTTPException(403, "ORIGIN_REJECTED")
        peer = request.client.host if request.client else "unknown"
        now = time.monotonic()
        old = [stamp for stamp in attempts.get(peer, []) if now - stamp < 60]
        if len(old) >= 12:
            raise HTTPException(429, "AUTH_LIMIT")
        if len(attempts) >= 4096 and peer not in attempts:
            expired = [
                key for key, stamps in attempts.items() if not stamps or now - stamps[-1] >= 60
            ]
            for key in expired:
                del attempts[key]
            if len(attempts) >= 4096:
                raise HTTPException(429, "AUTH_LIMIT")
        attempts[peer] = old + [now]

    async def issue(db: AsyncSession, account: AccountRecord) -> dict[str, str]:
        await db.scalar(
            select(AccountRecord.id).where(AccountRecord.id == account.id).with_for_update()
        )
        await db.execute(
            delete(LoginTokenRecord).where(
                LoginTokenRecord.account_id == account.id,
                LoginTokenRecord.expires_at <= datetime.now(UTC),
            )
        )
        owner = await db.scalar(select(SessionRecord).where(SessionRecord.account_id == account.id))
        if owner is None:
            owner = SessionRecord(
                id=str(uuid4()),
                account_id=account.id,
                token_hash=digest(secrets.token_urlsafe(32)),
                expires_at=datetime(9999, 1, 1, tzinfo=UTC),
            )
            db.add(owner)
            await db.flush()
        token = secrets.token_urlsafe(32)
        db.add(
            LoginTokenRecord(
                token_hash=digest(token),
                account_id=account.id,
                expires_at=datetime.now(UTC) + timedelta(hours=24),
            )
        )
        return {"id": owner.id, "email": account.email, "token": token}

    async def authenticate(authorization: Annotated[str | None, Header()] = None) -> dict[str, str]:
        if not authorization or not authorization.startswith("Bearer ") or len(authorization) > 512:
            raise HTTPException(401, "UNAUTHORIZED")
        async with sessions() as db:
            row = (
                await db.execute(
                    select(SessionRecord.id, AccountRecord.id, AccountRecord.email)
                    .join(AccountRecord, SessionRecord.account_id == AccountRecord.id)
                    .join(LoginTokenRecord, LoginTokenRecord.account_id == AccountRecord.id)
                    .where(
                        LoginTokenRecord.token_hash == digest(authorization[7:]),
                        LoginTokenRecord.expires_at > datetime.now(UTC),
                    )
                )
            ).first()
        if row:
            return {"id": row[0], "accountId": row[1], "email": row[2]}
        if demo_authenticator:
            return await demo_authenticator(authorization)
        raise HTTPException(401, "UNAUTHORIZED")

    @app.post("/v1/auth/signup", status_code=201)
    async def signup(body: Credentials, request: Request, response: Response) -> dict[str, str]:
        mutation(request)
        hashed = await hash_password(body.password.get_secret_value())
        account = AccountRecord(
            id=str(uuid4()), email=body.email, password_hash=hashed, created_at=datetime.now(UTC)
        )
        try:
            async with sessions.begin() as db:
                db.add(account)
                await db.flush()
                result = await issue(db, account)
        except IntegrityError:
            raise HTTPException(409, "ACCOUNT_EXISTS") from None
        response.headers["Cache-Control"] = "no-store"
        return result

    @app.post("/v1/auth/login")
    async def login(body: Credentials, request: Request, response: Response) -> dict[str, str]:
        mutation(request)
        async with sessions() as db:
            account = await db.scalar(
                select(AccountRecord).where(AccountRecord.email == body.email)
            )
            stored = account.password_hash if account and account.password_hash else dummy_hash
            account_id = account.id if account else None
        candidate = await hash_password(body.password.get_secret_value(), stored.split(":")[0])
        if not hmac.compare_digest(candidate, stored) or not account_id:
            raise HTTPException(401, "UNAUTHORIZED")
        async with sessions.begin() as db:
            account = await db.scalar(
                select(AccountRecord).where(AccountRecord.id == account_id).with_for_update()
            )
            if not account or account.password_hash != stored:
                raise HTTPException(401, "UNAUTHORIZED")
            result = await issue(db, account)
        response.headers["Cache-Control"] = "no-store"
        return result

    authenticated = Depends(authenticate)

    @app.get("/v1/auth/me")
    async def me(response: Response, owner: dict[str, str] = authenticated) -> dict[str, str]:
        if "accountId" not in owner:
            raise HTTPException(401, "ACCOUNT_REQUIRED")
        response.headers["Cache-Control"] = "no-store"
        return owner

    @app.post("/v1/auth/logout")
    async def logout(
        request: Request, authorization: Annotated[str | None, Header()] = None
    ) -> Response:
        mutation(request)
        await authenticate(authorization)
        async with sessions.begin() as db:
            await db.execute(
                delete(LoginTokenRecord).where(
                    LoginTokenRecord.token_hash == digest((authorization or "")[7:])
                )
            )
        return Response(
            content='{"status":"LOGGED_OUT"}',
            media_type="application/json",
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/v1/auth/google/start")
    async def google_start(request: Request, response: Response) -> dict[str, str]:
        mutation(request)
        if not client_id or not client_secret:
            raise HTTPException(503, "GOOGLE_NOT_CONFIGURED")
        state, binding, verifier, nonce = [secrets.token_urlsafe(32) for _ in range(4)]
        async with sessions.begin() as db:
            await db.execute(
                delete(OAuthFlowRecord).where(OAuthFlowRecord.expires_at <= datetime.now(UTC))
            )
            db.add(
                OAuthFlowRecord(
                    state_hash=digest(state),
                    binding_hash=digest(binding),
                    verifier=verifier,
                    nonce=nonce,
                    expires_at=datetime.now(UTC) + timedelta(minutes=5),
                )
            )
        response.set_cookie(
            COOKIE,
            binding,
            max_age=300,
            httponly=True,
            secure=callback.startswith("https://"),
            samesite="lax",
            path="/v1/auth",
        )
        response.headers["Cache-Control"] = "no-store"
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
            .decode()
            .rstrip("=")
        )
        return {
            "url": "https://accounts.google.com/o/oauth2/v2/auth?"
            + urlencode(
                {
                    "client_id": client_id,
                    "redirect_uri": callback,
                    "response_type": "code",
                    "scope": "openid email",
                    "state": state,
                    "nonce": nonce,
                    "code_challenge": challenge,
                    "code_challenge_method": "S256",
                }
            )
        }

    @app.get("/v1/auth/google/callback")
    async def google_callback(request: Request, state: str = "", code: str = "") -> Response:
        if len(state) > 128 or not 1 <= len(code) <= 4096:
            raise HTTPException(401, "OAUTH_REJECTED")
        binding = request.cookies.get(COOKIE, "")
        # Consume state before any external call, including rejected/retried callbacks.
        async with sessions.begin() as db:
            flow = await db.scalar(
                select(OAuthFlowRecord)
                .where(OAuthFlowRecord.state_hash == digest(state))
                .with_for_update()
            )
            if (
                not flow
                or flow.completion_hash
                or flow.expires_at <= datetime.now(UTC)
                or not hmac.compare_digest(flow.binding_hash, digest(binding))
            ):
                raise HTTPException(401, "OAUTH_REJECTED")
            verifier, nonce, binding_hash = flow.verifier, flow.nonce, flow.binding_hash
            await db.delete(flow)
        try:
            async with (
                httpx.AsyncClient(
                    transport=google_transport, timeout=10, follow_redirects=False, trust_env=False
                ) as client,
                asyncio.timeout(10),
            ):
                tokens = await google_json(
                    client,
                    "POST",
                    "https://oauth2.googleapis.com/token",
                    32768,
                    data={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "code": code,
                        "redirect_uri": callback,
                        "grant_type": "authorization_code",
                        "code_verifier": verifier,
                    },
                )
                id_token = tokens["id_token"]
                if not isinstance(id_token, str) or len(id_token) > 16384:
                    raise ValueError("invalid token")
                header = jwt.get_unverified_header(id_token)
                keys = (
                    await google_json(
                        client, "GET", "https://www.googleapis.com/oauth2/v3/certs", 65536
                    )
                )["keys"]
                if not isinstance(keys, list) or len(keys) > 32:
                    raise ValueError("OAUTH_RESPONSE_INVALID")
                key = next(
                    key
                    for key in keys
                    if key["kid"] == header.get("kid") and key.get("kty") == "RSA"
                )
                claims: dict[str, Any] = jwt.decode(
                    id_token,
                    jwt.PyJWK.from_dict(key).key,
                    algorithms=["RS256"],
                    audience=client_id,
                    options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce"]},
                )
                if (
                    claims["iss"] not in ("https://accounts.google.com", "accounts.google.com")
                    or claims["nonce"] != nonce
                    or claims.get("azp", client_id) != client_id
                    or claims.get("email_verified") is not True
                    or not isinstance(claims["sub"], str)
                    or not 1 <= len(claims["sub"]) <= 255
                ):
                    raise ValueError("invalid identity")
                if not isinstance(claims.get("email"), str):
                    raise TypeError("invalid identity")
                email = Credentials.email_valid(claims["email"])
        except (
            httpx.HTTPError,
            ValueError,
            KeyError,
            StopIteration,
            jwt.PyJWTError,
            TypeError,
            TimeoutError,
        ):
            raise HTTPException(401, "OAUTH_REJECTED") from None
        completion = secrets.token_urlsafe(32)
        try:
            async with sessions.begin() as db:
                account = await db.scalar(
                    select(AccountRecord)
                    .where(AccountRecord.google_sub == claims["sub"])
                    .with_for_update()
                )
                if account is None:
                    if await db.scalar(
                        select(AccountRecord.id).where(AccountRecord.email == email)
                    ):
                        raise HTTPException(409, "ACCOUNT_LINK_REQUIRED")
                    account = AccountRecord(
                        id=str(uuid4()),
                        email=email,
                        google_sub=claims["sub"],
                        created_at=datetime.now(UTC),
                    )
                    db.add(account)
                    await db.flush()
                db.add(
                    OAuthFlowRecord(
                        state_hash=digest(secrets.token_urlsafe(32)),
                        binding_hash=binding_hash,
                        verifier="",
                        nonce="",
                        expires_at=datetime.now(UTC) + timedelta(minutes=2),
                        completion_hash=digest(completion),
                        account_id=account.id,
                    )
                )
        except IntegrityError:
            raise HTTPException(409, "ACCOUNT_LINK_REQUIRED") from None
        return RedirectResponse(
            origin + "/app#oauth=" + completion,
            status_code=303,
            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
        )

    @app.post("/v1/auth/google/complete")
    async def google_complete(
        body: Completion, request: Request, response: Response
    ) -> dict[str, str]:
        mutation(request)
        async with sessions.begin() as db:
            flow = await db.scalar(
                select(OAuthFlowRecord)
                .where(OAuthFlowRecord.completion_hash == digest(body.code))
                .with_for_update()
            )
            if (
                not flow
                or flow.expires_at <= datetime.now(UTC)
                or not hmac.compare_digest(
                    flow.binding_hash, digest(request.cookies.get(COOKIE, ""))
                )
            ):
                raise HTTPException(401, "OAUTH_REJECTED")
            account = await db.get(AccountRecord, flow.account_id)
            if account is None:
                raise HTTPException(401, "OAUTH_REJECTED")
            result = await issue(db, account)
            await db.delete(flow)
        response.delete_cookie(COOKIE, path="/v1/auth")
        response.headers["Cache-Control"] = "no-store"
        return result

    return authenticate
