#!/usr/bin/env bash
set -euo pipefail
command -v shellcheck >/dev/null
bash scripts/ci/install-actionlint.sh
"${RUNNER_TEMP:-/tmp}/hypothron-actionlint" -color
shellcheck scripts/ci/*.sh scripts/deployment/*.sh scripts/run-api.sh
bash scripts/deployment/validate.sh
services/api/.venv/bin/ruff check services/api/src services/api/tests services/api/migrations scripts/ci
services/api/.venv/bin/ruff format --check services/api/src services/api/tests services/api/migrations scripts/ci
services/api/.venv/bin/mypy --config-file services/api/pyproject.toml services/api/src
services/api/.venv/bin/python scripts/export-api-contracts.py --check
services/api/.venv/bin/python scripts/ci/test_network_guard.py
