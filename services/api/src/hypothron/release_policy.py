"""Local release safeguards; deliberately not a distributed public abuse policy."""

from time import monotonic
from urllib.parse import urlsplit

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from hypothron.operations import emit


def app_origin(value: str) -> str:
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError:
        raise ValueError("INVALID_APP_ORIGIN") from None
    if (
        len(value) > 256
        or not parsed.hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.scheme not in {"https", "http"}
        or (parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"})
        or (port is not None and not 1 <= port <= 65535)
        or any(c.isspace() for c in value)
        or "*" in value
    ):
        raise ValueError("INVALID_APP_ORIGIN")
    return value


class ReleasePolicy:
    """Fail-closed bounded session admission and headers on every HTTP response.

    Run Uvicorn with --no-proxy-headers. Peers share the quota behind a proxy.
    This cap resets at process restart and cannot control multiple replicas.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.clients: dict[str, tuple[float, int]] = {}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started_response = False
        finished_response = False

        async def secure(message: Message) -> None:
            nonlocal started_response, finished_response
            if message["type"] == "http.response.start":
                started_response = True
                replaced = {b"cache-control", b"x-content-type-options", b"referrer-policy"}
                headers = [
                    (k, v) for k, v in message.get("headers", []) if k.lower() not in replaced
                ]
                message["headers"] = headers + [
                    (b"cache-control", b"no-store"),
                    (b"x-content-type-options", b"nosniff"),
                    (b"referrer-policy", b"no-referrer"),
                ]
            if message["type"] == "http.response.body" and not message.get("more_body", False):
                finished_response = True
            await send(message)

        if scope["method"] == "POST" and scope["path"] == "/v1/sessions":
            now = monotonic()
            self.clients = {k: v for k, v in self.clients.items() if now - v[0] < 60}
            peer = str((scope.get("client") or ("unknown",))[0])
            started, count = self.clients.get(peer, (now, 0))
            if count >= 20 or (peer not in self.clients and len(self.clients) >= 1024):
                await JSONResponse(
                    status_code=429,
                    content={"error": {"code": "RATE_LIMIT"}},
                    headers={"Retry-After": "60"},
                )(scope, receive, secure)
                return
            self.clients[peer] = (started, count + 1)
        try:
            await self.app(scope, receive, secure)
        except Exception:  # noqa: BLE001 — privacy boundary, no upstream exception text
            # Do not expose exception payloads to Uvicorn's traceback logger. Cancellation
            # is BaseException and propagates. A started SSE response can only be ended.
            emit("segment_failed", category="INTERNAL")
            try:
                if not started_response:
                    await JSONResponse(
                        status_code=500, content={"error": {"code": "INTERNAL_ERROR"}}
                    )(scope, receive, secure)
                elif not finished_response:
                    await secure({"type": "http.response.body", "body": b"", "more_body": False})
            except Exception:  # noqa: BLE001 — no chained private payload may escape
                # Failed transport writes can chain the private original exception.
                # Neither payload escapes; BaseException cancellation still propagates.
                emit("segment_failed", category="INTERNAL")
