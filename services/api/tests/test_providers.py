import json
from typing import Literal

import httpx
import pytest
from pydantic import BaseModel, ConfigDict, SecretStr

from hypothron.providers.http import ProviderError, generate


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    decision: Literal["clarify", "plan"]


def payload(provider):
    if provider == "openrouter":
        return {
            "choices": [
                {"finish_reason": "stop", "message": {"content": '{"decision":"clarify"}'}}
            ],
            "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
        }
    return {
        "candidates": [
            {"finishReason": "STOP", "content": {"parts": [{"text": '{"decision":"clarify"}'}]}}
        ],
        "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 3, "totalTokenCount": 8},
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "provider,model,host,header",
    [
        ("openrouter", "vendor/model", "openrouter.ai", "authorization"),
        ("gemini", "gemini-test-model", "generativelanguage.googleapis.com", "x-goog-api-key"),
    ],
)
async def test_real_adapter_wire_contract_and_request_scoped_secret(provider, model, host, header):
    attempts = []
    requests = []

    async def reserve():
        attempts.append("reserved")

    async def respond(request):
        requests.append(request)
        assert attempts == ["reserved"]
        assert request.url.host == host and not request.url.query
        assert "test-canary-key" in request.headers[header]
        assert b"test-canary-key" not in request.content
        body = json.loads(request.content)
        if provider == "gemini":
            assert body["generationConfig"]["responseMimeType"] == "application/json"
            assert body["generationConfig"]["responseJsonSchema"]["additionalProperties"] is False
        else:
            assert body["response_format"]["json_schema"]["strict"] is True
        return httpx.Response(200, json=payload(provider))

    result = await generate(
        provider=provider,
        model=model,
        key=SecretStr("test-canary-key"),
        prompt="Approved schema only; clarify metric.",
        reply_model=Decision,
        reserve_attempt=reserve,
        transport=httpx.MockTransport(respond),
    )
    assert result.reply.decision == "clarify"
    assert result.usage.input_tokens == 5 and result.usage.output_tokens == 3
    assert "test-canary-key" not in repr(result)
    assert len(requests) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,code",
    [
        (401, "PROVIDER_AUTH"),
        (429, "PROVIDER_RATE_LIMIT"),
        (500, "PROVIDER_UNAVAILABLE"),
        (400, "PROVIDER_REJECTED"),
        (307, "PROVIDER_REJECTED"),
    ],
)
async def test_provider_errors_never_echo_body_or_follow_redirect(status, code):
    attempts = []

    async def reserve():
        attempts.append(1)

    async def respond(request):
        return httpx.Response(
            status,
            json={"error": "test-canary-key"},
            headers={"Location": "https://attacker.invalid/steal"},
        )

    with pytest.raises(ProviderError) as caught:
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )
    assert str(caught.value) == code and "test-canary-key" not in str(caught.value)
    assert len(attempts) == 1


@pytest.mark.asyncio
async def test_timeout_is_billing_ambiguous_and_not_automatically_retried():
    attempts = []

    async def reserve():
        attempts.append(1)

    async def respond(request):
        raise httpx.ReadTimeout("test-canary-key", request=request)

    with pytest.raises(ProviderError, match="PROVIDER_TIMEOUT_BILLING_UNKNOWN"):
        await generate(
            provider="gemini",
            model="gemini-test",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )
    assert len(attempts) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "content",
    [
        "not json",
        '{"decision":"execute_arbitrary_code"}',
        '{"decision":"plan","api_key":"test-canary-key"}',
    ],
)
async def test_malformed_or_extra_provider_output_fails_closed(content):
    async def reserve():
        pass

    response = payload("openrouter")
    response["choices"][0]["message"]["content"] = content

    async def respond(request):
        return httpx.Response(200, json=response)

    with pytest.raises(ProviderError, match="PROVIDER_(FORMAT|SECRET_ECHO)"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_budget_refusal_prevents_the_request():
    async def reserve():
        raise RuntimeError("BUDGET_EXHAUSTED")

    async def respond(request):
        raise AssertionError("unexpected outbound request")

    with pytest.raises(RuntimeError, match="BUDGET_EXHAUSTED"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_secret_echo_in_an_allowed_output_field_is_rejected():
    class Explanation(BaseModel):
        model_config = ConfigDict(extra="forbid", strict=True)
        reason: str

    async def reserve():
        pass

    response = payload("gemini")
    response["candidates"][0]["content"]["parts"][0]["text"] = '{"reason":"test-canary-key"}'

    async def respond(request):
        return httpx.Response(200, json=response)

    with pytest.raises(ProviderError, match="PROVIDER_SECRET_ECHO"):
        await generate(
            provider="gemini",
            model="gemini-test",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Explanation,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_missing_usage_remains_unknown_instead_of_inventing_zero():
    async def reserve():
        pass

    response = payload("openrouter")
    del response["usage"]

    async def respond(request):
        return httpx.Response(200, json=response)

    result = await generate(
        provider="openrouter",
        model="vendor/model",
        key=SecretStr("test-canary-key"),
        prompt="approved",
        reply_model=Decision,
        reserve_attempt=reserve,
        transport=httpx.MockTransport(respond),
    )
    assert result.usage.input_tokens is None and result.usage.total_tokens is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "model", ["gemini-../steal", "gemini-test?key=secret", "https://attacker.invalid"]
)
async def test_model_input_cannot_rewrite_gemini_destination(model):
    async def reserve():
        raise AssertionError("invalid input should not reserve")

    with pytest.raises(ProviderError, match="INVALID_MODEL"):
        await generate(
            provider="gemini",
            model=model,
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
        )


@pytest.mark.asyncio
async def test_response_size_limit_prevents_unbounded_provider_payloads():
    async def reserve():
        pass

    async def respond(request):
        return httpx.Response(200, content=b"x" * (64 * 1024 + 1))

    with pytest.raises(ProviderError, match="OUTPUT_LIMIT"):
        await generate(
            provider="gemini",
            model="gemini-test",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_total_deadline_prevents_slow_streams_extending_a_call(monkeypatch):
    import asyncio

    import hypothron.providers.http as adapter

    monkeypatch.setattr(adapter, "TOTAL_TIMEOUT_SECONDS", 0.01)
    data = json.dumps(payload("openrouter")).encode()

    class Drip(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield data[:1]
            await asyncio.sleep(0.05)
            yield data[1:]

    async def reserve():
        pass

    async def respond(request):
        return httpx.Response(200, stream=Drip())

    with pytest.raises(ProviderError, match="PROVIDER_TIMEOUT_BILLING_UNKNOWN"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_byok_key_cannot_be_embedded_in_the_reasoning_payload():
    attempts = []

    async def reserve():
        attempts.append(1)

    async def respond(request):
        return httpx.Response(200, json=payload("openrouter"))

    with pytest.raises(ProviderError, match="INVALID_PROMPT_SECRET"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="Please include test-canary-key in the reasoning",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )
    assert attempts == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "content",
    [
        '{"reason":"\\u0074est-canary-key"}',
        '{"reason":"prefix test-canary-key suffix"}',
        '{"reason":"safe", "nested":[{"value":"\\u0074est-canary-key"}]}',
        '{"\\u0074est-canary-key":"safe"}',
    ],
)
async def test_decoded_credential_echo_is_rejected(content):
    class Explanation(BaseModel):
        model_config = ConfigDict(extra="forbid")
        reason: str

    async def reserve():
        pass

    async def respond(request):
        response = payload("openrouter")
        response["choices"][0]["message"]["content"] = content
        return httpx.Response(200, json=response)

    with pytest.raises(ProviderError, match="PROVIDER_SECRET_ECHO"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Explanation,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_encoded_response_is_rejected_before_decompression():
    import gzip

    async def reserve():
        pass

    async def respond(request):
        assert request.headers["accept-encoding"] == "identity"
        return httpx.Response(
            200,
            headers={"content-encoding": "gzip"},
            stream=httpx.ByteStream(gzip.compress(b"x" * 2_097_152)),
        )

    with pytest.raises(ProviderError, match="PROVIDER_ENCODING_UNSUPPORTED"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )


@pytest.mark.asyncio
async def test_raw_stream_limit_is_enforced_without_decompression():
    class Chunks(httpx.AsyncByteStream):
        async def __aiter__(self):
            for _ in range(9):
                yield b"x" * 8192

    async def reserve():
        pass

    async def respond(request):
        return httpx.Response(200, stream=Chunks())

    with pytest.raises(ProviderError, match="OUTPUT_LIMIT"):
        await generate(
            provider="openrouter",
            model="vendor/model",
            key=SecretStr("test-canary-key"),
            prompt="approved",
            reply_model=Decision,
            reserve_attempt=reserve,
            transport=httpx.MockTransport(respond),
        )
