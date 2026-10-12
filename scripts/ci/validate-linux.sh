#!/usr/bin/env bash
set -euo pipefail
# Optional local reproduction. Creates only task-owned disposable containers;
# copies source without local env files, datasets, generated assets or host deps.
# No published host ports; shares the disposable DB network namespace so exact
# 127.0.0.1 origins/ports are available without touching running project servers.
work=$(mktemp -d)
suffix="$$"
db="hypothron-ci-db-$suffix"
runner="hypothron-ci-linux-$suffix"
cleanup() {
  docker rm -f "$runner" "$db" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
image=mcr.microsoft.com/playwright@sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f
postgres=postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24
# Tracked source only: never copy arbitrary untracked user data.
# Commit task files locally before invoking this optional reproduction helper.
git ls-files --error-unmatch .github/workflows/ci.yml scripts/ci/backend.sh >/dev/null
git ls-files -z | python3 -c '
import sys
paths = sys.stdin.buffer.read().split(b"\0")
for p in paths:
    if p and not any(part.startswith(b".env") for part in p.split(b"/")):
        sys.stdout.buffer.write(p + b"\0")
' > "$work/files"
COPYFILE_DISABLE=1 tar --null -T "$work/files" -cf "$work/source.tar"
docker run -d --name "$db" --platform linux/arm64 \
  -e POSTGRES_USER=hypothron_ci -e POSTGRES_PASSWORD=ci-disposable-only \
  -e POSTGRES_DB=hypothron_ci "$postgres" >/dev/null
docker run -d --name "$runner" --platform linux/arm64 --init --shm-size=1g \
  --network "container:$db" -e DATABASE_URL=postgresql+psycopg://hypothron_ci:ci-disposable-only@127.0.0.1:5432/hypothron_ci \
  -e NEXT_TELEMETRY_DISABLED=1 -e CI=true -e UV_PYTHON=3.12.15 \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright "$image" sleep infinity >/dev/null
docker cp "$work/source.tar" "$runner:/tmp/source.tar"
docker exec "$runner" bash -euo pipefail -c '
  apt-get update -qq; apt-get install -y --no-install-recommends xz-utils shellcheck
  mkdir /workspace; cd /workspace; tar -xf /tmp/source.tar
  # Local-only Git snapshot enables generated-contract drift checks. Never copied
  # into or connected to the users repository/remote.
  git init -q; git add .; git -c user.name=CI -c user.email=ci@example.invalid commit -qm input
  curl --fail --location --retry 3 --max-time 120 https://nodejs.org/dist/v22.22.3/node-v22.22.3-linux-arm64.tar.xz -o /tmp/node.tar.xz
  printf "1c4a9933a5e45bc88f54f70b5f91232c127ec49f1a5989d23fb85824c7adf9b7  /tmp/node.tar.xz\n" | sha256sum -c
  tar -xf /tmp/node.tar.xz -C /usr/local --strip-components=1
  curl --fail --location --retry 3 --max-time 120 https://github.com/astral-sh/uv/releases/download/0.13.0/uv-aarch64-unknown-linux-gnu.tar.gz -o /tmp/uv.tar.gz
  printf "3ccfb6af6e242433eb552f7d9676abd5412c6595c497e990d9c8cb7b5bd4d2c3  /tmp/uv.tar.gz\n" | sha256sum -c
  tar -xzf /tmp/uv.tar.gz -C /tmp; install /tmp/uv-aarch64-unknown-linux-gnu/uv /usr/local/bin/uv
  npm install --global pnpm@10.33.0
  node --version; pnpm --version; uv --version; uname -m
  pnpm install --frozen-lockfile
  uv sync --project services/api --frozen
  bash scripts/ci/static.sh
  bash scripts/ci/backend.sh
  bash scripts/ci/frontend.sh
  # Audits are process environments; no refusal is allowed in either suite.
  test ! -e /tmp/hypothron-network-audit
  # Hosted backend/browser jobs each start with an empty service. Reset the
  # strictly validated disposable database to reproduce that boundary locally.
  (
    source scripts/ci/activate-network-guard.sh
    trap "bash /workspace/scripts/ci/check-network-audit.sh" EXIT
    services/api/.venv/bin/python scripts/ci/database.py
    cd services/api; .venv/bin/alembic downgrade base
  )
  pnpm exec playwright install --with-deps chromium
  bash scripts/ci/browser.sh
'
