#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to your scoped PostgreSQL 17 database}"
exec services/api/.venv/bin/uvicorn hypothron.api:app_factory --factory \
  --host 127.0.0.1 --port 8000 --workers 1 --no-access-log --no-proxy-headers
