#!/bin/bash
# Smoke test for the merged product. Assumes the stack is running:
#   ./deploy.sh   (or: docker compose up -d --build)
# Usage: tests/smoke.sh [BASE_URL]
#   BASE_URL defaults to http://localhost:8080 (the gateway).
set -u

BASE="${1:-${BASE:-http://localhost:8080}}"
EMAIL="${OZ_ADMIN_EMAIL:-admin@oz.local}"
PASSWORD="${OZ_ADMIN_PASSWORD:-admin123}"

PASS=0; FAIL=0
ok()   { echo -e "  \033[0;32mPASS\033[0m  $1"; PASS=$((PASS+1)); }
bad()  { echo -e "  \033[0;31mFAIL\033[0m  $1"; FAIL=$((FAIL+1)); }

# code URL [METHOD] [DATA] [CONTENT_TYPE] — assert HTTP status of a request.
expect_code() {
  local want="$1" url="$2" method="${3:-GET}" data="${4:-}" ctype="${5:-application/json}"
  local got
  if [ -n "$data" ]; then
    got=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X "$method" -H "Content-Type: $ctype" -d "$data" "$url")
  else
    got=$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X "$method" "$url")
  fi
  if [ "$got" = "$want" ]; then ok "$method $url -> $got"; else bad "$method $url -> $got (want $want)"; fi
}

echo "== Unified SPA routing & health ($BASE) =="
expect_code 200 "$BASE/"                  GET   # unified product UI
expect_code 200 "$BASE/agents"            GET   # Operations route (SPA fallback)
expect_code 200 "$BASE/servers"           GET   # Operations route (SPA fallback)
expect_code 200 "$BASE/api/health"        GET   # Oz API
expect_code 200 "$BASE/studio-api/health" GET   # InfraStudio API

echo "== InfraStudio API (via /studio-api) =="
expect_code 200 "$BASE/studio-api/pricing/azure/vm" POST '{"vm_size":"Standard_D2s_v3","region":"eastus"}'
AI=$(curl -s -m 20 -X POST -H 'Content-Type: application/json' \
  -d '{"prompt":"web app","provider":"aws","use_llm":false}' "$BASE/studio-api/ai/generate-infra")
if echo "$AI" | grep -q '"nodes"'; then ok "ai/generate-infra returned nodes"; else bad "ai/generate-infra (got: ${AI:0:80})"; fi

echo "== Shared auth (Oz JWT) =="
TOKEN=$(curl -s -m 20 -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "username=$EMAIL" --data-urlencode "password=$PASSWORD" \
  "$BASE/api/auth/token" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
  ok "obtained Oz JWT"
  ME=$(curl -s -m 20 -H "Authorization: Bearer $TOKEN" "$BASE/api/auth/me")
  if echo "$ME" | grep -q "$EMAIL"; then ok "/api/auth/me identifies $EMAIL"; else bad "/api/auth/me (got: ${ME:0:80})"; fi
else
  bad "could not obtain Oz JWT (is the admin user seeded?)"
fi

echo "== Leon assistant (via /leon proxy) =="
LEON=$(curl -s -m 30 -X POST -H 'Content-Type: application/json' -d '{"utterance":"hello"}' "$BASE/leon/api/v1/utterance")
if echo "$LEON" | grep -q '"speeches"\|"success"'; then ok "Leon replied via gateway proxy"; else bad "Leon proxy (got: ${LEON:0:80})"; fi

echo ""
echo "Result: $PASS passed, $FAIL failed."
[ "$FAIL" -eq 0 ]
