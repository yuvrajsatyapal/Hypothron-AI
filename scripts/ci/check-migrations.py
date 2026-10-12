"""Check sole Alembic head and required application/native saver tables."""

import os
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from hypothron import records  # noqa: F401
from hypothron.db import Base
from sqlalchemy import create_engine, inspect, text

config = Config("services/api/alembic.ini")
config.set_main_option(
    "script_location", str(Path("services/api/migrations").resolve())
)
heads = ScriptDirectory.from_config(config).get_heads()
assert len(heads) == 1, "CI_MULTIPLE_MIGRATION_HEADS"
engine = create_engine(os.environ["DATABASE_URL"])
with engine.connect() as connection:
    assert (
        connection.execute(text("select version_num from alembic_version"))
        .scalars()
        .all()
        == heads
    )
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    assert (
        set(Base.metadata.tables)
        | {
            "checkpoints",
            "checkpoint_blobs",
            "checkpoint_writes",
            "checkpoint_migrations",
        }
        <= tables
    )
    for name, table in Base.metadata.tables.items():
        actual = {column["name"]: column for column in inspector.get_columns(name)}
        assert set(actual) == set(table.columns.keys()), "CI_COLUMN_DRIFT"
        for column in table.columns:
            assert actual[column.name]["nullable"] == column.nullable, (
                "CI_NULLABILITY_DRIFT"
            )
print("Single migration head and application/native saver schema match")
