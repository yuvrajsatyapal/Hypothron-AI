#!/usr/bin/env bash
set -euo pipefail
source scripts/ci/activate-network-guard.sh
trap 'bash scripts/ci/check-network-audit.sh' EXIT
services/api/.venv/bin/python scripts/ci/database.py
(
  cd services/api
  .venv/bin/alembic upgrade head
  # Native saver tables deliberately are not part of SQLAlchemy metadata;
  # migration/model consistency is checked by explicit inspection below.
  .venv/bin/alembic downgrade base
  .venv/bin/alembic upgrade head
  .venv/bin/pytest -q
)
services/api/.venv/bin/python scripts/ci/check-migrations.py
