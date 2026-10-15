#!/usr/bin/env bash
# Test images only against the task-owned synthetic fixture, never operator .env files.
set -euo pipefail
api="hypothron-saas-smoke-api-$$"
web="hypothron-saas-smoke-web-$$"
executor="hypothron-saas-smoke-executor-$$"
cleanup() { docker rm -f "$api" "$web" "$executor" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for image in hypothron-saas-api:test hypothron-saas-web:test hypothron-saas-executor:test; do
  uid=$(docker image inspect "$image" --format '{{.Config.User}}')
  [[ -n $uid && $uid != root && $uid != root:* && $uid != 0 && $uid != 0:* ]] || { echo 'ROOT_IMAGE_REJECTED' >&2; exit 1; }
done
docker run -d --name "$api" --read-only --cap-drop ALL --security-opt no-new-privileges \
  --network container:hypothron-saas-test-db --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -e DATABASE_URL=postgresql+psycopg://hypothron:local-development-only@127.0.0.1:5432/hypothron \
  -e APP_ORIGIN=https://app.example.test hypothron-saas-api:test >/dev/null
docker run -d --name "$web" --read-only --cap-drop ALL --security-opt no-new-privileges \
  --network none --tmpfs /tmp:rw,noexec,nosuid,size=64m hypothron-saas-web:test >/dev/null
docker run -d --name "$executor" --read-only --cap-drop ALL --security-opt no-new-privileges \
  --network none --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  -e HYPOTHRON_DEPLOYMENT=1 -e APP_ORIGIN=https://app.example.test -e API_ORIGIN=https://api.example.test \
  -e EXECUTOR_ORIGIN=https://compute.example.net hypothron-saas-executor:test >/dev/null
ready=0
for _ in {1..60}; do
  if docker exec "$api" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/v1/ready', timeout=2)" >/dev/null 2>&1 \
    && docker exec "$web" node -e "Promise.all([fetch('http://127.0.0.1:3000/'),fetch('http://127.0.0.1:3000/fonts/inter.woff2')]).then(rs=>{if(rs.some(r=>!r.ok))process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1 \
    && docker exec "$executor" node -e "fetch('http://127.0.0.1:3001/').then(r=>{if(!r.ok||!r.headers.get('content-security-policy').includes('frame-ancestors https://app.example.test'))process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ $ready == 1 ]] || { echo 'CONTAINER_SMOKE_FAILED' >&2; exit 1; }
echo 'Non-root read-only API/web/executor startup and readiness passed.'
