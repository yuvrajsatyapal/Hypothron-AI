"""Request-scoped durable investigation segments. No background key retention."""

import asyncio
from dataclasses import asdict
from typing import Any

import httpx
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command
from langsmith import tracing_context
from pydantic import BaseModel, SecretStr

from hypothron.agents.provider import RequestRoleProvider
from hypothron.agents.workflow import Role, RoleProvider, build_workflow, initial_state
from hypothron.checkpoints import checkpoint_store
from hypothron.ledger import Ledger, LedgerError, digest
from hypothron.providers.http import ProviderError, Usage, _contains_secret

SEGMENT_TIMEOUT_SECONDS = 60.0


class InvestigationDriver:
    def __init__(self, database_url: str, ledger: Ledger) -> None:
        self.database_url = database_url
        self.ledger = ledger
        self.slots = asyncio.Semaphore(2)

    async def advance(
        self,
        owner: str,
        run_id: str,
        key: SecretStr,
        *,
        answer: str | None = None,
        provider: RoleProvider | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> dict[str, Any]:
        try:
            with tracing_context(enabled=False):
                async with asyncio.timeout(SEGMENT_TIMEOUT_SECONDS):
                    return await self._advance(
                        owner, run_id, key, answer=answer, provider=provider, transport=transport
                    )
        except TimeoutError:
            raise LedgerError("SEGMENT_TIMEOUT") from None

    async def _advance(
        self,
        owner: str,
        run_id: str,
        key: SecretStr,
        *,
        answer: str | None = None,
        provider: RoleProvider | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> dict[str, Any]:
        # The public route never exposes provider injection; it is a deterministic test seam.
        row = await self.ledger.get(owner, run_id)
        if row.provider not in {"gemini", "openrouter"}:
            raise LedgerError("INVALID_PROVIDER")
        if _contains_secret(
            {"request": row.request, "model": row.model}, key.get_secret_value()
        ) or (answer is not None and key.get_secret_value() in answer):
            raise LedgerError("SECRET_IN_INPUT")
        if self.slots.locked():
            raise LedgerError("SERVER_BUSY")
        async with self.slots:
            lease = await self.ledger.claim(owner, run_id)
            try:
                async with checkpoint_store(self.database_url, self.ledger, lease) as saver:

                    async def durable_provider(
                        role: Role,
                        context: dict[str, Any],
                        schema: type[BaseModel],
                    ) -> dict[str, Any]:
                        ordinal = context["callOrdinal"]
                        if type(ordinal) is not int:
                            raise ProviderError("INVALID_ATTEMPT")
                        try:
                            cached = await self.ledger.reserve(
                                lease, ordinal, role, digest(context)
                            )
                        except LedgerError as error:
                            raise ProviderError(str(error)) from None
                        if cached is not None:
                            return cached
                        usage: dict[str, Any] | None = None
                        elapsed: int | None = None

                        async def reserved(_: Role) -> None:
                            # Committed above before any HTTP request. No second reservation.
                            return None

                        async def observe(_: Role, value: Usage, milliseconds: int) -> None:
                            nonlocal usage, elapsed
                            usage, elapsed = asdict(value), milliseconds

                        adapter = provider or RequestRoleProvider(
                            provider="gemini" if row.provider == "gemini" else "openrouter",
                            model=row.model,
                            key=key,
                            reserve=reserved,
                            observe=observe,
                            transport=transport,
                        )
                        response = await adapter(role, context, schema)
                        if _contains_secret(response, key.get_secret_value()):
                            raise ProviderError("SECRET_IN_OUTPUT")
                        try:
                            await self.ledger.complete_attempt(
                                lease, ordinal, response, usage, elapsed
                            )
                        except LedgerError as error:
                            raise ProviderError(str(error)) from None
                        return response

                    graph = build_workflow(durable_provider, saver)
                    config: RunnableConfig = {
                        "configurable": {"thread_id": run_id},
                        "recursion_limit": 48,
                    }
                    snapshot = await graph.aget_state(config)
                    input_value: Any = initial_state(row.request) if not snapshot.values else None
                    if snapshot.values and snapshot.next:
                        if snapshot.values.get("status") == "CLARIFYING":
                            if answer is not None:
                                input_value = Command(resume={"answer": answer})
                            else:
                                return dict(snapshot.values)
                        elif snapshot.values.get("pending"):
                            job = snapshot.values["pending"]
                            # Recover crash after checkpoint issuance but before ledger insert.
                            await self.ledger.issue(lease, job)
                            record = await self.ledger.job(owner, run_id, job["id"])
                            if record.result is None:
                                await self.ledger.status(lease, "WAITING_RESULT")
                                return dict(snapshot.values)
                            input_value = Command(resume=record.result)
                    with tracing_context(enabled=False):
                        async with asyncio.timeout(SEGMENT_TIMEOUT_SECONDS):
                            result = await graph.ainvoke(input_value, config)
                    if result.get("pending"):
                        await self.ledger.issue(lease, result["pending"])
                    await self.ledger.status(lease, result["status"])
                    return dict(result)
            except TimeoutError:
                # Reservations remain durable. A later resume cannot repeat ambiguous billing.
                raise LedgerError("SEGMENT_TIMEOUT") from None
            finally:
                async with asyncio.timeout(5):
                    await self.ledger.release(lease)
