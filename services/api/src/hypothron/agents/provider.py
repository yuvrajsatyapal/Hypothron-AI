"""Ephemeral role transport, never included in LangGraph state or configuration."""

import json
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from pydantic import BaseModel, SecretStr

from hypothron.agents.workflow import Role
from hypothron.providers.http import Provider, Usage, generate

INSTRUCTIONS: dict[Role, str] = {
    "planner": "Generate up to six prioritized falsifiable hypotheses using only approved dataset hashes. If the question is ambiguous, return one clarification and no hypotheses. Never propose source code or request raw rows.",
    "analyst": "Choose an existing hypothesis to execute against its exact approved contract, or finish when evidence suffices. Read verification states. Follow up only when evidence warrants it; do not treat disputed/inconclusive results as established facts. No arbitrary SQL/Python or contract changes.",
    "report": "Summarize supported findings with existing job citations. Explicitly describe disputed/inconclusive evidence and client-reported provenance. Avoid unsupported causal or numerical claims. No invented citations.",
}


class RequestRoleProvider:
    def __init__(
        self,
        *,
        provider: Provider,
        model: str,
        key: SecretStr,
        reserve: Callable[[Role], Awaitable[None]],
        observe: Callable[[Role, Usage, int], Awaitable[None]],
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._provider = provider
        self._model = model
        self._key = key
        self._reserve = reserve
        self._observe = observe
        self._transport = transport

    async def __call__(
        self, role: Role, context: dict[str, Any], schema: type[BaseModel]
    ) -> dict[str, Any]:
        async def reserve() -> None:
            await self._reserve(role)

        result = await generate(
            provider=self._provider,
            model=self._model,
            key=self._key,
            prompt=INSTRUCTIONS[role]
            + "\nApproved context: "
            + json.dumps(context, separators=(",", ":")),
            reply_model=schema,
            reserve_attempt=reserve,
            transport=self._transport,
        )
        await self._observe(role, result.usage, result.elapsed_ms)
        return result.reply.model_dump(mode="json", by_alias=True)
