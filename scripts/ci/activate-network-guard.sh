#!/usr/bin/env bash
# Source from a root-directory gate script after dependency installation.
export HYPOTHRON_CI_NETWORK_GUARD=1
export HYPOTHRON_CI_NETWORK_AUDIT="${RUNNER_TEMP:-/tmp}/hypothron-network-audit"
export PYTHONPATH="$PWD/scripts/ci/python${PYTHONPATH:+:$PYTHONPATH}"
# Each disposable job/container owns this path; never erase mid-suite.
if [[ -e "$HYPOTHRON_CI_NETWORK_AUDIT" ]]; then
  echo 'Existing network audit: refusing to discard evidence' >&2
  exit 1
fi
services/api/.venv/bin/python -c 'import sitecustomize; assert sitecustomize.ENABLED'
