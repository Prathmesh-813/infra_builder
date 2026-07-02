#!/bin/bash
# Static validation — no running stack required. Safe to run in CI before deploy.
# Checks: compose file is valid, gateway nginx config parses, frontend builds,
# and the InfraStudio backend image boots and serves /api/health.
set -u
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PASS=0; FAIL=0
ok()  { echo -e "  \033[0;32mPASS\033[0m  $1"; PASS=$((PASS+1)); }
bad() { echo -e "  \033[0;31mFAIL\033[0m  $1"; FAIL=$((FAIL+1)); }

echo "== docker compose config =="
if docker compose config -q; then ok "docker-compose.yml is valid"; else bad "docker-compose.yml invalid"; fi

echo "== InfraStudio frontend build =="
if ( cd infra_builder && npm ci >/dev/null 2>&1 && npm run build >/dev/null 2>&1 ); then
  ok "frontend tsc + vite build"
else
  bad "frontend build failed (cd infra_builder && npm run build)"
fi

echo "== InfraStudio backend image boots =="
docker rm -f istest_validate >/dev/null 2>&1
if docker compose build infrastudio-api >/dev/null 2>&1 \
   && docker run -d --name istest_validate -p 18099:8001 aitsharktank-infrastudio-api >/dev/null 2>&1; then
  READY=""
  for _ in $(seq 1 25); do
    [ -n "$(curl -s -m 3 http://localhost:18099/api/health 2>/dev/null)" ] && { READY=1; break; }
    sleep 1
  done
  if [ -n "$READY" ]; then ok "infrastudio-api serves /api/health"; else bad "infrastudio-api did not become healthy"; fi
  docker rm -f istest_validate >/dev/null 2>&1
else
  bad "could not build/run infrastudio-api"
fi

echo "== gateway nginx config syntax =="
if docker compose build gateway >/dev/null 2>&1 \
   && docker run --rm --entrypoint nginx aitsharktank-gateway -t >/dev/null 2>&1; then
  ok "gateway nginx -t"
else
  bad "gateway nginx config test failed"
fi

echo ""
echo "Result: $PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ]
