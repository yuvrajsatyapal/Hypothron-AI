"""Bounded public metadata discovery. Eligibility is not account entitlement or quality.

The 32768 context floor conservatively reserves 16384 prompt bytes, 8192 schema
bytes, 1024 output tokens and framing. It is a policy estimate, not a tokenizer
proof; transport enforces the existing independent prompt/body ceilings.
"""

import asyncio
import json
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from time import monotonic
from typing import Any

import httpx
from pydantic import SecretStr

MAX_BYTES = 4 * 1024 * 1024
MAX_ENTRIES = 5000
REQUIRED_PARAMETERS = {"structured_outputs", "response_format", "temperature", "max_tokens"}


class CatalogError(Exception):
    """Sanitized catalogue policy error."""


def concrete(model: object) -> bool:
    return (
        isinstance(model, str)
        and bool(
            re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._:-]{0,100}", model)
        )
        and not model.startswith(("openrouter/", "@"))
    )


@dataclass(frozen=True)
class CatalogModel:
    id: str
    name: str
    context_length: int
    max_completion_tokens: int
    advertised_free: bool = True


def normalize(value: Any) -> CatalogModel | None:
    try:
        if not isinstance(value, dict) or not concrete(value.get("id")):
            return None
        price = value["pricing"]
        for field in ("prompt", "completion"):
            amount = Decimal(str(price[field]))
            if not amount.is_finite() or amount != 0:
                return None
        # Non-text fees are inapplicable because this adapter only sends text.
        for field, raw in price.items():
            if field in {"image", "audio", "video", "input_audio_cache"}:
                continue
            amount = Decimal(str(raw))
            if not amount.is_finite() or amount != 0:
                return None
        architecture = value["architecture"]
        if (
            "text" not in architecture["input_modalities"]
            or "text" not in architecture["output_modalities"]
        ):
            return None
        if not REQUIRED_PARAMETERS.issubset(value["supported_parameters"]):
            return None
        context = value["context_length"]
        output = value["top_provider"]["max_completion_tokens"]
        if type(context) is not int or not 32768 <= context <= 100_000_000:
            return None
        if type(output) is not int or not 1024 <= output <= 100_000_000:
            return None
        expiration = value.get("expiration_date")
        if expiration is not None:
            expires = datetime.fromisoformat(expiration)
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires <= datetime.now(UTC):
                return None
        if value.get("deprecated") is True:
            return None
        name = value.get("name", value["id"])
        if not isinstance(name, str) or len(name) > 200:
            return None
        return CatalogModel(value["id"], name, context, output)
    except (KeyError, TypeError, ValueError, AttributeError, InvalidOperation):
        return None


class ModelCatalog:
    def __init__(
        self,
        *,
        preferred_model: str = "auto",
        fallback_models: tuple[str, ...] = (),
        ttl_seconds: int = 300,
        transport: httpx.AsyncBaseTransport | None = None,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        if (
            type(ttl_seconds) is not int
            or not 30 <= ttl_seconds <= 600
            or (preferred_model != "auto" and not concrete(preferred_model))
            or len(fallback_models) > 10
            or any(not concrete(m) for m in fallback_models)
            or len(set(fallback_models)) != len(fallback_models)
        ):
            raise CatalogError("INVALID_CATALOG_CONFIG")
        self.preferred_model = preferred_model
        self.fallback_models = fallback_models
        self.ttl_seconds = ttl_seconds
        self._transport = transport
        self._clock = clock
        self._lock = asyncio.Lock()
        self._models: tuple[CatalogModel, ...] = ()
        self._expires = 0.0
        self._backoff = 0.0

    async def list(self, key: SecretStr | None = None) -> tuple[CatalogModel, ...]:
        try:
            return await self._list(key)
        except TimeoutError:
            raise CatalogError("CATALOG_UNAVAILABLE") from None

    async def _list(self, key: SecretStr | None = None) -> tuple[CatalogModel, ...]:
        # Waiters share the refresh; no per-key cache or key stored in this object.
        async with asyncio.timeout(12):
            async with self._lock:
                now = self._clock()
                if now < self._expires:
                    return self._models
                if now < self._backoff:
                    raise CatalogError("CATALOG_UNAVAILABLE")
                headers = {"Accept-Encoding": "identity"}
                if key is not None:
                    if not re.fullmatch(r"[!-~]{8,512}", key.get_secret_value()):
                        raise CatalogError("INVALID_KEY")
                    headers["Authorization"] = "Bearer " + key.get_secret_value()
                try:
                    async with (
                        asyncio.timeout(10),
                        httpx.AsyncClient(
                            timeout=httpx.Timeout(10, connect=3),
                            trust_env=False,
                            follow_redirects=False,
                            transport=self._transport,
                        ) as client,
                        client.stream(
                            "GET", "https://openrouter.ai/api/v1/models", headers=headers
                        ) as response,
                    ):
                        if (
                            response.status_code != 200
                            or response.headers.get("content-encoding", "identity") != "identity"
                        ):
                            raise CatalogError("CATALOG_UNAVAILABLE")
                        raw = bytearray()
                        if response.is_stream_consumed:
                            raw.extend(response.content)
                        else:
                            async for chunk in response.aiter_raw(chunk_size=8192):
                                raw.extend(chunk)
                                if len(raw) > MAX_BYTES:
                                    raise CatalogError("CATALOG_LIMIT")
                        if len(raw) > MAX_BYTES:
                            raise CatalogError("CATALOG_LIMIT")
                        envelope = json.loads(raw)
                        entries = envelope["data"]
                        if (
                            not isinstance(entries, list)
                            or len(entries) > MAX_ENTRIES
                            or envelope.get("next_page")
                            or envelope.get("next_cursor")
                        ):
                            raise CatalogError("CATALOG_LIMIT")
                        models = [m for item in entries if (m := normalize(item)) is not None]
                        if len({m.id for m in models}) != len(models):
                            raise CatalogError("CATALOG_FORMAT")
                        if key is not None and key.get_secret_value() in str(models):
                            raise CatalogError("CATALOG_FORMAT")
                        self._models = tuple(
                            sorted(models, key=lambda m: (-m.context_length, m.id))
                        )
                        ttl: float = self.ttl_seconds
                        eligible = {m.id for m in self._models}
                        for entry in entries:
                            if (
                                isinstance(entry, dict)
                                and entry.get("id") in eligible
                                and entry.get("expiration_date")
                            ):
                                expires = datetime.fromisoformat(entry["expiration_date"])
                                if expires.tzinfo is None:
                                    expires = expires.replace(tzinfo=UTC)
                                ttl = min(
                                    ttl, max(0, (expires - datetime.now(UTC)).total_seconds())
                                )
                        self._expires = self._clock() + ttl
                        return self._models
                except (
                    httpx.HTTPError,
                    TimeoutError,
                    ValueError,
                    KeyError,
                    TypeError,
                    RecursionError,
                    CatalogError,
                ):
                    self._backoff = self._clock() + 5
                    raise CatalogError("CATALOG_UNAVAILABLE") from None
                finally:
                    headers.clear()

    async def validate(self, model: str, key: SecretStr | None = None) -> CatalogModel:
        models = await self.list(key)
        for candidate in models:
            if candidate.id == model:
                return candidate
        raise CatalogError("MODEL_INELIGIBLE")

    async def resolve(self, selection: str = "auto", key: SecretStr | None = None) -> CatalogModel:
        if selection != "auto":
            return await self.validate(selection, key)
        if self.preferred_model != "auto":
            return await self.validate(self.preferred_model, key)
        models = await self.list(key)
        by_id = {m.id: m for m in models}
        for model in self.fallback_models:
            if model in by_id:
                return by_id[model]
        if not models:
            raise CatalogError("NO_COMPATIBLE_FREE_MODEL")
        return models[0]
