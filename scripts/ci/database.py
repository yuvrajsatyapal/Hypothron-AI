"""Fail closed before migrations: CI must never use an unrelated database."""

import os
import time
from urllib.parse import urlsplit

import psycopg

url = os.environ["DATABASE_URL"]
parsed = urlsplit(url)
if (
    parsed.scheme != "postgresql+psycopg"
    or parsed.hostname != "127.0.0.1"
    or parsed.path != "/hypothron_ci"
    or parsed.username != "hypothron_ci"
    or parsed.password != "ci-disposable-only"
    or parsed.query
    or parsed.fragment
):
    raise SystemExit("CI_DATABASE_TARGET_REFUSED")
for attempt in range(60):
    try:
        with psycopg.connect(
            url.replace("postgresql+psycopg:", "postgresql:"), connect_timeout=2
        ) as connection:
            version = connection.execute("SHOW server_version_num").fetchone()[0]
            if not 170000 <= int(version) < 180000:
                raise SystemExit("CI_POSTGRES_VERSION_REFUSED")
        print("Isolated PostgreSQL 17 ready")
        break
    except psycopg.OperationalError:
        if attempt == 59:
            raise SystemExit("CI_POSTGRES_NOT_READY") from None
        time.sleep(1)
