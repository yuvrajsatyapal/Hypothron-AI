import asyncio
import hashlib
import json
import logging
import os
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text, update
from sqlalchemy.exc import SQLAlchemyError
from test_ledger import setup

from hypothron.db import SessionRecord


def test_operational_events_refuse_unbounded_or_sensitive_fields(caplog):
    from hypothron.operations import emit

    caplog.set_level(logging.INFO, logger="hypothron.operations")
    emit(
        "provider_dispatch",
        run_id="12345678-1234-1234-1234-123456789012",
        role="planner",
        attempt=1,
    )
    payload = json.loads(caplog.records[-1].message)
    assert payload == {
        "event": "provider_dispatch",
        "runDigest": hashlib.sha256(b"12345678-1234-1234-1234-123456789012").hexdigest(),
        "role": "planner",
        "attempt": 1,
    }
    for kwargs in [
        {"key": "private-secret"},
        {"elapsed_ms": float("nan")},
        {"role": "private-row"},
        {"run_id": "secret"},
        {"attempt": True},
    ]:
        with pytest.raises(ValueError, match="INVALID_DIAGNOSTIC"):
            emit("provider_dispatch", **kwargs)
    with pytest.raises(ValueError, match="INVALID_DIAGNOSTIC"):
        emit("raw-secret")
    assert len(caplog.records) == 1
    assert "private-secret" not in caplog.text


@pytest.mark.asyncio
async def test_periodic_purge_removes_expired_metadata_without_new_request():
    from hypothron.retention import purge_loop

    app, _ledger, owner, run = await setup()
    async with app.state.sessions.begin() as db:
        await db.execute(
            update(SessionRecord)
            .where(SessionRecord.id == owner)
            .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
        )
    stop = asyncio.Event()
    task = asyncio.create_task(purge_loop(app.state.sessions, stop, interval=0.01))
    try:
        async with asyncio.timeout(3):
            while True:
                async with app.state.sessions() as db:
                    exists = await db.scalar(
                        text("SELECT count(*) FROM runs WHERE id=:id"), {"id": run.id}
                    )
                    parent = await db.scalar(
                        select(SessionRecord.id).where(SessionRecord.id == owner)
                    )
                if exists == 0 and parent is None:
                    break
                await asyncio.sleep(0.01)
    finally:
        stop.set()
        await task
        await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_purge_errors_are_sanitized_and_shutdown_is_cooperative(caplog):
    from hypothron.retention import purge_loop

    class Broken:
        def begin(self):
            raise SQLAlchemyError("database-password-and-private-row")

    caplog.set_level(logging.INFO, logger="hypothron.operations")
    stop = asyncio.Event()
    task = asyncio.create_task(purge_loop(Broken(), stop, interval=0.01))
    await asyncio.sleep(0.025)
    stop.set()
    await asyncio.wait_for(task, 1)
    assert "purge_failed" in caplog.text
    assert "database-password" not in caplog.text


@pytest.mark.asyncio
async def test_actual_graph_diagnostics_contain_nodes_without_questions_or_values(caplog):
    from pydantic import SecretStr

    from hypothron.driver import InvestigationDriver

    app, ledger, owner, run = await setup()
    caplog.set_level(logging.INFO, logger="hypothron.operations")

    async def provider(role, context, schema):
        return {"clarification": "sensitive-question-canary", "hypotheses": []}

    state = await InvestigationDriver(os.environ["DATABASE_URL"], ledger).advance(
        owner, run.id, SecretStr("byok-secret-canary"), provider=provider
    )
    assert state["status"] == "CLARIFYING"
    events = [json.loads(r.message) for r in caplog.records if r.name == "hypothron.operations"]
    assert any(e["event"] == "node_started" and e["node"] == "planner" for e in events)
    assert any(e["event"] == "provider_completed" for e in events)
    assert "sensitive-question-canary" not in caplog.text
    assert "byok-secret-canary" not in caplog.text
    expected = hashlib.sha256(run.id.encode()).hexdigest()
    assert all(e.get("runDigest", expected) == expected for e in events)
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_uuid_shaped_key_collision_is_not_recorded_as_correlation(caplog):
    from pydantic import SecretStr

    from hypothron.driver import InvestigationDriver
    from hypothron.ledger import LedgerError

    app, ledger, owner, run = await setup()
    caplog.set_level(logging.INFO, logger="hypothron.operations")
    canary = "12345678-1234-1234-1234-123456789012"
    driver = InvestigationDriver(os.environ["DATABASE_URL"], ledger)
    with pytest.raises(LedgerError, match="NOT_FOUND"):
        await driver.advance(owner, canary, SecretStr(canary))
    assert canary not in caplog.text

    async def provider(role, context, schema):
        return {"clarification": "Which period?", "hypotheses": []}

    await driver.advance(owner, run.id, SecretStr(run.id), provider=provider)
    assert run.id not in caplog.text
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_untrusted_run_identifier_keeps_ownership_error_and_is_not_logged(caplog):
    from pydantic import SecretStr

    from hypothron.driver import InvestigationDriver
    from hypothron.ledger import LedgerError

    app, ledger, owner, _run = await setup()
    caplog.set_level(logging.INFO, logger="hypothron.operations")
    with pytest.raises(LedgerError, match="NOT_FOUND"):
        await InvestigationDriver(os.environ["DATABASE_URL"], ledger).advance(
            owner, "untrusted-private-path", SecretStr("private-key")
        )
    assert "untrusted-private-path" not in caplog.text
    await app.state.sessions.kw["bind"].dispose()


@pytest.mark.asyncio
async def test_unexpected_provider_failure_never_enters_native_checkpoint(caplog):
    from pydantic import SecretStr

    from hypothron.driver import InvestigationDriver

    app, ledger, owner, run = await setup()

    async def provider(role, context, schema):
        raise RuntimeError("private-key-checkpoint-canary")

    try:
        with pytest.raises(RuntimeError):
            await InvestigationDriver(os.environ["DATABASE_URL"], ledger).advance(
                owner, run.id, SecretStr("private-key-checkpoint-canary"), provider=provider
            )
        async with app.state.sessions() as db:
            values = (
                (
                    await db.execute(
                        text(
                            "SELECT encode(blob, 'escape') FROM checkpoint_writes WHERE thread_id=:id"
                        ),
                        {"id": run.id},
                    )
                )
                .scalars()
                .all()
            )
        assert values
        assert "private-key-checkpoint-canary" not in str(values)
        assert "private-key-checkpoint-canary" not in caplog.text
    finally:
        await app.state.sessions.kw["bind"].dispose()
