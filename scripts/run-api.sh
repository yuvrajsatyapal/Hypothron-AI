#!/usr/bin/env bash
set -euo pipefail
args=()
if [[ -f ${API_ENV_FILE:-.env} ]]; then args=(--env-file "${API_ENV_FILE:-.env}"); fi
if [[ -z ${DATABASE_URL:-} && ${#args[@]} == 0 ]]; then
  echo "Set DATABASE_URL or a private API_ENV_FILE" >&2; exit 2
fi
exec services/api/.venv/bin/uvicorn hypothron.api:app_factory --factory \
  "${args[@]}" --host 127.0.0.1 --port 8000 --workers 1 --no-access-log --no-proxy-headers
