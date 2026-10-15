"""One explicitly invoked, zero-price-capped synthetic request; never used by CI.

No database access, uploaded data, deployment or automatic retry. Catalogue
eligibility is checked immediately; only the fixed production adapter dispatches.
Credentials are read locally and are never printed or passed on the command line.
"""

import argparse
import asyncio
import json
from pathlib import Path
from typing import Literal

from dotenv import dotenv_values
from hypothron.providers.catalogue import CatalogError, ModelCatalog
from hypothron.providers.http import ProviderError, generate
from pydantic import BaseModel, ConfigDict, SecretStr


class ProbeReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ok: Literal[True]


async def main() -> int:
    values = dotenv_values(Path(__file__).resolve().parent.parent / ".env")
    key = values.get("OPENROUTER_API_KEY")
    if not key:
        print(json.dumps({"status": "BLOCKED", "code": "KEY_REQUIRED"}))
        return 1
    attempts = 0

    async def reserve() -> None:
        nonlocal attempts
        if attempts:
            raise ProviderError("SMOKE_ATTEMPT_LIMIT")
        attempts += 1

    try:
        catalog = ModelCatalog()
        model = await catalog.resolve(
            values.get("OPENROUTER_MODEL") or "auto", SecretStr(key)
        )
        result = await generate(
            provider="openrouter",
            model=model.id,
            key=SecretStr(key),
            prompt='Synthetic connection check. Return only JSON {"ok":true}. No user data is included.',
            reply_model=ProbeReply,
            reserve_attempt=reserve,
        )
        print(
            json.dumps(
                {
                    "status": "PASS",
                    "model": result.model,
                    "attempts": attempts,
                    "schemaValidated": result.reply.ok,
                    "totalTokens": result.usage.total_tokens,
                    "scope": "single synthetic connection request; not investigation acceptance",
                }
            )
        )
        return 0
    except (CatalogError, ProviderError) as error:
        print(
            json.dumps({"status": "BLOCKED", "code": str(error), "attempts": attempts})
        )
        return 1
    except Exception:  # noqa: BLE001 — never print credential-bearing exception payloads
        print(
            json.dumps(
                {"status": "BLOCKED", "code": "SMOKE_UNAVAILABLE", "attempts": attempts}
            )
        )
        return 1
    finally:
        values.clear()
        key = ""


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--free-only", required=True, action="store_true")
    parser.parse_args()
    raise SystemExit(asyncio.run(main()))
