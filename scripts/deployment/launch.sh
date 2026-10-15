#!/usr/bin/env bash
set -euo pipefail
: "${DEPLOYMENT_ENV_FILE:?Set DEPLOYMENT_ENV_FILE to non-secret Compose settings}"
# Operator command; validation/CI never invokes this or deploys automatically.
docker compose --env-file "$DEPLOYMENT_ENV_FILE" -f compose.production.yaml config --quiet
docker compose --env-file "$DEPLOYMENT_ENV_FILE" -f compose.production.yaml up -d --build --wait
