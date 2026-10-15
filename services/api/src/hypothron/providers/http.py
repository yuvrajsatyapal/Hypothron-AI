"""Request-scoped BYOK transport; callers own consent and durable attempt reservation.

No redirects, environmental proxies, automatic retries, provider body logging, key
cache or raw-data upload support. This module is not exposed through an API route.
"""

import asyncio
import json
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal, TypeVar

import httpx
from pydantic import BaseModel, SecretStr, ValidationError

Reply = TypeVar("Reply", bound=BaseModel)
Provider = Literal["openrouter", "gemini"]
TOTAL_TIMEOUT_SECONDS = 20.0


class ProviderError(Exception):
    """Contains only a stable public code, never upstream text or credentials."""


@dataclass(frozen=True)
class Usage:
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    reasoning_tokens: int | None


@dataclass(frozen=True)
class Generated[Reply: BaseModel]:
    reply: Reply
    usage: Usage
    elapsed_ms: int
    provider: Provider
    model: str


def _token(value: Any) -> int | None:
    if value is None:
        return None
    if type(value) is not int or not 0 <= value <= 1_000_000:
        raise ProviderError("PROVIDER_FORMAT")
    return value


def _contains_secret(value: Any, secret: str) -> bool:
    if isinstance(value, str):
        return secret in value
    if isinstance(value, dict):
        return any(
            _contains_secret(k, secret) or _contains_secret(v, secret) for k, v in value.items()
        )
    if isinstance(value, (list, tuple)):
        return any(_contains_secret(item, secret) for item in value)
    return False


def _decode(provider: Provider, raw: bytes) -> tuple[str, Usage]:
    try:
        envelope = json.loads(raw)
        if provider == "openrouter":
            choice = envelope["choices"][0]
            if choice.get("finish_reason") != "stop":
                raise ProviderError("PROVIDER_INCOMPLETE")
            text = choice["message"]["content"]
            usage = envelope.get("usage") or {}
            tokens = Usage(
                _token(usage.get("prompt_tokens")),
                _token(usage.get("completion_tokens")),
                _token(usage.get("total_tokens")),
                _token((usage.get("completion_tokens_details") or {}).get("reasoning_tokens")),
            )
        else:
            candidate = envelope["candidates"][0]
            if candidate.get("finishReason") != "STOP":
                raise ProviderError("PROVIDER_INCOMPLETE")
            parts = candidate["content"]["parts"]
            text = "".join(part["text"] for part in parts if not part.get("thought", False))
            usage = envelope.get("usageMetadata") or {}
            tokens = Usage(
                _token(usage.get("promptTokenCount")),
                _token(usage.get("candidatesTokenCount")),
                _token(usage.get("totalTokenCount")),
                _token(usage.get("thoughtsTokenCount")),
            )
        if not isinstance(text, str) or not text or len(text.encode()) > 32 * 1024:
            raise ProviderError("PROVIDER_FORMAT")
        return text, tokens
    except (ValueError, KeyError, IndexError, TypeError, AttributeError, RecursionError):
        raise ProviderError("PROVIDER_FORMAT") from None


async def generate[Reply: BaseModel](
    *,
    provider: Provider,
    model: str,
    key: SecretStr,
    prompt: str,
    reply_model: type[Reply],
    reserve_attempt: Callable[[], Awaitable[None]],
    transport: httpx.AsyncBaseTransport | None = None,
) -> Generated[Reply]:
    """Send exactly one bounded attempt after the caller atomically reserves it.

    Production callers must supply only disclosed/approved schema and aggregate
    context. A transport double is test dependency injection, never a user URL.
    Pricing/capability consent and schema-repair routing belong to the supervisor.
    """
    if provider not in {"openrouter", "gemini"}:
        raise ProviderError("INVALID_PROVIDER")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}", model):
        raise ProviderError("INVALID_MODEL")
    if provider == "openrouter":
        from hypothron.providers.catalogue import concrete

        if not concrete(model):
            raise ProviderError("INVALID_MODEL")
    if provider == "gemini" and not re.fullmatch(r"gemini-[A-Za-z0-9._-]{1,80}", model):
        raise ProviderError("INVALID_MODEL")
    if not 1 <= len(prompt.encode()) <= 16 * 1024:
        raise ProviderError("INPUT_LIMIT")
    if reply_model.model_config.get("extra") != "forbid":
        raise ProviderError("INVALID_REPLY_SCHEMA")
    if not re.fullmatch(r"[!-~]{8,512}", key.get_secret_value()):
        raise ProviderError("INVALID_KEY")
    schema = reply_model.model_json_schema()
    headers = {"Content-Type": "application/json", "Accept-Encoding": "identity"}
    body: dict[str, Any]
    if provider == "openrouter":
        endpoint = "https://openrouter.ai/api/v1/chat/completions"
        headers["Authorization"] = "Bearer " + key.get_secret_value()
        body = {
            "model": model,
            "provider": {
                "require_parameters": True,
                "allow_fallbacks": False,
                "max_price": {"prompt": 0, "completion": 0, "request": 0},
            },
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
            "temperature": 0,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "hypothron_role", "schema": schema, "strict": True},
            },
        }
    else:
        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        )
        headers["x-goog-api-key"] = key.get_secret_value()
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": 1024,
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
            },
        }
    if _contains_secret(body, key.get_secret_value()):
        headers.clear()
        raise ProviderError("INVALID_PROMPT_SECRET")
    if len(json.dumps(body).encode()) > 64 * 1024:
        headers.clear()
        raise ProviderError("INPUT_LIMIT")
    started = time.monotonic()
    try:
        # Reservation is deliberately outside transport handling: policy denial is not an attempt.
        await reserve_attempt()
        async with (
            asyncio.timeout(TOTAL_TIMEOUT_SECONDS),
            httpx.AsyncClient(
                timeout=httpx.Timeout(20, connect=5),
                trust_env=False,
                follow_redirects=False,
                transport=transport,
            ) as client,
            client.stream("POST", endpoint, json=body, headers=headers) as response,
        ):
            if response.status_code != 200:
                code = {
                    401: "PROVIDER_AUTH",
                    403: "PROVIDER_AUTH",
                    429: "PROVIDER_RATE_LIMIT",
                    404: "PROVIDER_MODEL_UNAVAILABLE"
                    if provider == "openrouter"
                    else "PROVIDER_REJECTED",
                }.get(response.status_code)
                raise ProviderError(
                    code
                    or (
                        "PROVIDER_UNAVAILABLE"
                        if response.status_code >= 500
                        else "PROVIDER_REJECTED"
                    )
                )
            if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
                raise ProviderError("PROVIDER_ENCODING_UNSUPPORTED")
            raw = bytearray()
            if response.is_stream_consumed:
                # Prebuffered transport doubles; live streaming takes the raw path below.
                if len(response.content) > 64 * 1024:
                    raise ProviderError("OUTPUT_LIMIT")
                raw.extend(response.content)
            else:
                async for chunk in response.aiter_raw(chunk_size=8192):
                    if len(raw) + len(chunk) > 64 * 1024:
                        raise ProviderError("OUTPUT_LIMIT")
                    raw.extend(chunk)
        if provider == "openrouter":
            try:
                identity = json.loads(raw).get("model")
            except (ValueError, AttributeError):
                raise ProviderError("PROVIDER_FORMAT") from None
            if identity is not None and identity != model:
                raise ProviderError("PROVIDER_MODEL_MISMATCH")
        text, usage = _decode(provider, bytes(raw))
        if key.get_secret_value() in text:
            raise ProviderError("PROVIDER_SECRET_ECHO")
        try:
            if _contains_secret(json.loads(text), key.get_secret_value()):
                raise ProviderError("PROVIDER_SECRET_ECHO")
            reply = reply_model.model_validate_json(text, strict=True)
        except (ValidationError, ValueError, RecursionError):
            raise ProviderError("PROVIDER_FORMAT") from None
        if _contains_secret(reply.model_dump(mode="json", by_alias=True), key.get_secret_value()):
            raise ProviderError("PROVIDER_SECRET_ECHO")
        return Generated(reply, usage, round((time.monotonic() - started) * 1000), provider, model)
    except (httpx.TimeoutException, TimeoutError):
        raise ProviderError("PROVIDER_TIMEOUT_BILLING_UNKNOWN") from None
    except httpx.TransportError:
        raise ProviderError("PROVIDER_TRANSPORT_BILLING_UNKNOWN") from None
    finally:
        headers.clear()
