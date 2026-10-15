#!/usr/bin/env bash
set -euo pipefail
node --test tests/deployment/*.test.mjs
bash -n scripts/deployment/backup.sh scripts/deployment/restore-drill.sh scripts/deployment/launch.sh
if command -v shellcheck >/dev/null; then shellcheck scripts/deployment/*.sh; fi
# Never run `compose config` unfiltered: it expands runtime secrets.
if command -v docker >/dev/null; then
  env APP_ORIGIN=https://app.example.test API_ORIGIN=https://api.example.test EXECUTOR_ORIGIN=https://compute.example.net \
    API_ENV_FILE=/dev/null MIGRATION_ENV_FILE=/dev/null DATABASE_PASSWORD_FILE=/dev/null \
    docker compose --env-file /dev/null -f compose.production.yaml config --quiet
fi
