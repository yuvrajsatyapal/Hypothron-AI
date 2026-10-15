#!/usr/bin/env bash
# Restore only to a NEW disposable container with no published ports or host credentials.
set -euo pipefail
if [[ $# != 1 || ! -f $1 || -L $1 ]]; then
  echo 'Supply a private custom-format backup file' >&2
  exit 2
fi
name="hypothron-restore-$RANDOM-$$"
image='postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
cleanup() { docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# Trust is restricted to this disposable container; no ports/volumes are shared.
docker run -d --name "$name" --network none -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_USER=hypothron_restore -e POSTGRES_DB=hypothron_restore "$image" >/dev/null
ready=0
for _ in {1..60}; do
  if docker exec "$name" psql -h 127.0.0.1 -U hypothron_restore -d hypothron_restore -v ON_ERROR_STOP=1 -Atc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ $ready == 1 ]] || { echo 'RESTORE_DATABASE_UNAVAILABLE' >&2; exit 1; }
docker exec -i "$name" pg_restore -U hypothron_restore -d hypothron_restore --exit-on-error --no-owner --no-acl < "$1"
# Check schema, relationships and representative data separately before release.
docker exec "$name" psql -U hypothron_restore -d hypothron_restore -v ON_ERROR_STOP=1 \
  -c 'SELECT count(*) AS restored_tables FROM information_schema.tables WHERE table_schema = '\''public'\'';' \
  -c 'SELECT version_num FROM alembic_version;'
echo 'Isolated PostgreSQL restore completed; container removed on exit.'
