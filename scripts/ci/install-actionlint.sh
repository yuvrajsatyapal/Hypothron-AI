#!/usr/bin/env bash
set -euo pipefail
# Official release archive, digest independently checked at implementation time.
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) platform=linux_amd64; digest=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 ;;
  Linux-aarch64) platform=linux_arm64; digest=325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6 ;;
  Darwin-arm64) platform=darwin_arm64; digest=aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f ;;
  *) echo 'Unsupported actionlint install target' >&2; exit 1 ;;
esac
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
curl --fail --location --retry 3 --max-time 120 \
  "https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_${platform}.tar.gz" \
  --output "$work/actionlint.tgz"
python3 - "$work/actionlint.tgz" "$digest" <<'PYCODE'
import hashlib, pathlib, sys
assert hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest() == sys.argv[2], "ACTIONLINT_CHECKSUM_MISMATCH"
PYCODE
tar -xzf "$work/actionlint.tgz" -C "$work" actionlint
install -m 755 "$work/actionlint" "${RUNNER_TEMP:-/tmp}/hypothron-actionlint"
