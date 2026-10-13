import httpx
import pytest
from test_foundation import application


@pytest.mark.asyncio
async def test_unexpected_failure_is_sanitized_without_escaping(caplog):
    app = application()

    @app.get("/canary")
    async def canary():
        raise RuntimeError("private-key-and-aggregate-canary")

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/canary")
    assert response.status_code == 500
    assert response.json() == {"error": {"code": "INTERNAL_ERROR"}}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "private-key-and-aggregate-canary" not in caplog.text


@pytest.mark.asyncio
async def test_security_headers_apply_to_success_validation_and_not_found():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="http://test"
    ) as client:
        for path in ["/v1/health", "/v1/absent"]:
            response = await client.get(path)
            assert response.headers["cache-control"] == "no-store"
            assert response.headers["x-content-type-options"] == "nosniff"
            assert response.headers["referrer-policy"] == "no-referrer"
        response = await client.post("/v1/sessions", json={"private": "canary"})
        assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_session_admission_rejects_excess_without_trusting_forwarded_header():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=application()), base_url="http://test"
    ) as client:
        for i in range(20):
            assert (
                await client.post("/v1/sessions", headers={"X-Forwarded-For": str(i)})
            ).status_code == 201
        response = await client.post("/v1/sessions", headers={"X-Forwarded-For": "new-identity"})
        assert response.status_code == 429
        assert response.json() == {"error": {"code": "RATE_LIMIT"}}
        assert "retry-after" in response.headers
        assert (await client.get("/v1/health")).status_code == 200


@pytest.mark.parametrize(
    "value",
    [
        "*",
        "http://remote.example",
        "https://example.com/path",
        "https://user:secret@example.com",
        "https://example.com?secret=key",
        "https://example.com/#hash",
    ],
)
def test_origin_configuration_refuses_unsafe_or_non_origin_values(monkeypatch, value):
    monkeypatch.setenv("APP_ORIGIN", value)
    with pytest.raises(ValueError, match="INVALID_APP_ORIGIN"):
        application()


def test_origin_configuration_accepts_exact_tls_and_local_origin(monkeypatch):
    for value in ["http://127.0.0.1:3000", "https://app.example.com"]:
        monkeypatch.setenv("APP_ORIGIN", value)
        assert application()


@pytest.mark.asyncio
async def test_started_response_transport_failure_cannot_chain_private_exception():
    from hypothron.release_policy import ReleasePolicy

    async def failing(scope, receive, send):
        await send(
            {"type": "http.response.start", "status": 200, "headers": [(b"content-length", b"100")]}
        )
        raise RuntimeError("private-started-canary")

    async def send(message):
        if message["type"] == "http.response.body":
            raise RuntimeError("transport-canary")

    async def receive():
        return {"type": "http.disconnect"}

    await ReleasePolicy(failing)({"type": "http", "method": "GET", "path": "/"}, receive, send)
