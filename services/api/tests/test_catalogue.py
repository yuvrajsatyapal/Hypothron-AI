import asyncio

import httpx
import pytest

from hypothron.providers.catalogue import CatalogError, ModelCatalog, normalize


def entry(model="vendor/free", context=65536):
    return {
        "id": model,
        "name": model,
        "context_length": context,
        "architecture": {"input_modalities": ["text"], "output_modalities": ["text"]},
        "pricing": {"prompt": "0", "completion": "0", "request": "0"},
        "supported_parameters": [
            "structured_outputs",
            "response_format",
            "temperature",
            "max_tokens",
        ],
        "top_provider": {"max_completion_tokens": 2048},
    }


@pytest.mark.parametrize(
    "change",
    [
        {"pricing": {"prompt": "0"}},
        {"pricing": {"prompt": "NaN", "completion": "0"}},
        {"pricing": {"prompt": "0", "completion": "0", "request": "0.01"}},
        {"id": "openrouter/free"},
        {"id": "auto"},
        {"supported_parameters": ["response_format"]},
        {"context_length": 2048},
        {"top_provider": {"max_completion_tokens": 512}},
        {"expiration_date": "2020-01-01"},
        {"architecture": {"input_modalities": ["image"], "output_modalities": ["text"]}},
    ],
)
def test_ineligible_models_fail_closed(change):
    assert normalize(entry() | change) is None


async def test_catalogue_single_refresh_deterministic_policy_and_manual_validation():
    calls = []

    async def respond(request):
        calls.append(request)
        await asyncio.sleep(0.01)
        return httpx.Response(
            200, json={"data": [entry("vendor/z"), entry("vendor/a"), entry("vendor/small", 32768)]}
        )

    catalog = ModelCatalog(transport=httpx.MockTransport(respond))
    values = await asyncio.gather(*[catalog.resolve("auto") for _ in range(8)])
    assert {m.id for m in values} == {"vendor/a"} and len(calls) == 1
    assert (await catalog.validate("vendor/z")).id == "vendor/z"
    with pytest.raises(CatalogError, match="MODEL_INELIGIBLE"):
        await catalog.validate("openrouter/free")
    preferred = ModelCatalog(fallback_models=("vendor/z",), transport=httpx.MockTransport(respond))
    assert (await preferred.resolve("auto")).id == "vendor/z"


async def test_failure_is_sanitized_backed_off_and_never_returns_stale_catalogue():
    now = [0.0]
    calls = []

    async def respond(request):
        calls.append(1)
        return (
            httpx.Response(200, json={"data": [entry()]})
            if len(calls) == 1
            else httpx.Response(500, text="secret")
        )

    catalog = ModelCatalog(
        transport=httpx.MockTransport(respond), clock=lambda: now[0], ttl_seconds=30
    )
    await catalog.list()
    now[0] = 31
    for _ in range(2):
        with pytest.raises(CatalogError, match="CATALOG_UNAVAILABLE"):
            await catalog.list()
    assert len(calls) == 2


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(307, headers={"Location": "https://attacker.invalid"}, text="key"),
        httpx.Response(200, json={"data": "invalid"}),
        httpx.Response(200, json={"data": [entry(), entry()]}),
        httpx.Response(200, content=b"x" * (4 * 1024 * 1024 + 1)),
        httpx.Response(200, json={"data": [entry()]}, headers={"Content-Encoding": "unsupported"}),
    ],
)
async def test_upstream_malformed_payload_redirect_and_bounds(response):
    requests = []

    def respond(request):
        requests.append(request)
        return response

    catalog = ModelCatalog(transport=httpx.MockTransport(respond))
    with pytest.raises(CatalogError, match="CATALOG_UNAVAILABLE"):
        await catalog.list()
    assert len(requests) == 1


@pytest.mark.parametrize(
    "kwargs",
    [
        {"ttl_seconds": 1},
        {"ttl_seconds": 601},
        {"preferred_model": "openrouter/free"},
        {"fallback_models": ("auto",)},
        {"fallback_models": ("v/m", "v/m")},
    ],
)
def test_invalid_configuration_fails_sanitized(kwargs):
    with pytest.raises(CatalogError, match="INVALID_CATALOG_CONFIG"):
        ModelCatalog(**kwargs)


async def test_expiration_shortens_cache_even_within_configured_ttl(monkeypatch):
    from datetime import UTC, datetime, timedelta

    import hypothron.providers.catalogue as module

    now = [datetime(2026, 10, 14, tzinfo=UTC)]
    clock = [1.0]

    class FixedDate(datetime):
        @classmethod
        def now(cls, tz=None):
            return now[0]

    monkeypatch.setattr(module, "datetime", FixedDate)
    model = entry() | {"expiration_date": (now[0] + timedelta(seconds=1)).isoformat()}
    catalog = ModelCatalog(
        clock=lambda: clock[0],
        transport=httpx.MockTransport(lambda req: httpx.Response(200, json={"data": [model]})),
    )
    assert len(await catalog.list()) == 1
    now[0] += timedelta(seconds=2)
    clock[0] += 2
    assert await catalog.list() == ()
