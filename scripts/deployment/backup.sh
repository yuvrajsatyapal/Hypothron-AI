#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ $# != 1 || ! -d $1 || -L $1 ]]; then
  echo 'Supply an existing private backup directory' >&2
  exit 2
fi
if [[ $(stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1") != 700 ]]; then
  echo 'Backup directory must have mode 0700' >&2
  exit 2
fi
: "${DEPLOYMENT_ENV_FILE:?Set DEPLOYMENT_ENV_FILE to the non-secret Compose settings file}"
out=$(mktemp "$1/hypothron-XXXXXXXX.dump")
trap 'rm -f "$out"' ERR
# Credentials stay inside the DB service. Never echo env/config/connection URLs.
docker compose --env-file "$DEPLOYMENT_ENV_FILE" -f compose.production.yaml exec -T database \
  pg_dump -U hypothron_admin -d hypothron --format=custom --no-owner --no-acl > "$out"
[[ -s $out ]]
chmod 600 "$out"
printf 'Backup created: %s\n' "$out"
