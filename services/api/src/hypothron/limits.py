from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodyLimit:
    """Bound accepted metadata bodies before JSON/Pydantic parsing, including chunks."""

    def __init__(self, app: ASGIApp, maximum: int = 16 * 1024) -> None:
        self.app = app
        self.maximum = maximum

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Cloud uploads authenticate first inside their route, then enforce a streamed
        # 20 MiB bound. Do not prebuffer their raw bytes in metadata middleware.
        if (
            scope["type"] == "http"
            and scope["method"] == "POST"
            and scope["path"] == "/v1/account/artifacts"
        ):
            await self.app(scope, receive, send)
            return
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return
        messages: list[Message] = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > self.maximum:
                await JSONResponse(status_code=413, content={"error": {"code": "INPUT_LIMIT"}})(
                    scope, receive, send
                )
                return
            messages.append(message)
            if not message.get("more_body", False):
                break

        async def replay() -> Message:
            return messages.pop(0) if messages else await receive()

        await self.app(scope, replay, send)
