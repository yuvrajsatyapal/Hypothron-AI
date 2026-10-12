#!/usr/bin/env bash
set -euo pipefail
node scripts/bootstrap-assets.mjs
pnpm test
pnpm typecheck
pnpm format:check
pnpm exec prettier --check playwright.config.ts 'tests/e2e/**/*.ts' 'tests/ci/**/*.ts'
pnpm build
git diff --exit-code -- pnpm-lock.yaml services/api/uv.lock packages/contracts
