#!/usr/bin/env bash
set -euo pipefail
if [[ -s "${HYPOTHRON_CI_NETWORK_AUDIT:?}" ]]; then
  echo 'CI_NETWORK_DENIED: unexpected non-loopback Python network attempt' >&2
  exit 1
fi
