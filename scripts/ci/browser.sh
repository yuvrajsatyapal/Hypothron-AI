#!/usr/bin/env bash
set -euo pipefail
export HYPOTHRON_CI=1
source scripts/ci/activate-network-guard.sh
trap 'bash scripts/ci/check-network-audit.sh' EXIT
services/api/.venv/bin/python scripts/ci/database.py
(cd services/api && .venv/bin/alembic upgrade head)
node scripts/ci/check-ports.mjs
# Each browser job boots and verifies its own assets. No generated-file caches.
node scripts/bootstrap-assets.mjs
pnpm build
node --input-type=module -e 'import {chromium} from "@playwright/test"; const b=await chromium.launch(); console.log("Linux CI",process.platform,process.arch,"Chromium",b.version()); await b.close()'
node scripts/ci/probe-browser-guard.mjs
pnpm e2e
git diff --exit-code -- pnpm-lock.yaml services/api/uv.lock packages/contracts
