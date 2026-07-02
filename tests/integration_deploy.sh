#!/bin/bash
# Integration test for the Design -> Deploy bridge: log in with the shared Oz JWT
# and launch an agent with a generated IaC artifact (exactly what the InfraStudio
# "Deploy to Oz" button does). This actually creates an agent run, so it needs the
# Oz agent runtime available. Heavier than smoke.sh — run after the stack is warm.
#
# Usage: tests/integration_deploy.sh [BASE_URL]
set -u

BASE="${1:-${BASE:-http://localhost:8080}}"
EMAIL="${OZ_ADMIN_EMAIL:-admin@oz.local}"
PASSWORD="${OZ_ADMIN_PASSWORD:-admin123}"

echo "[1/3] Authenticating against Oz ($BASE)..."
TOKEN=$(curl -s -m 20 -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "username=$EMAIL" --data-urlencode "password=$PASSWORD" \
  "$BASE/api/auth/token" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] || { echo "FAIL: no token"; exit 1; }
echo "      ok"

echo "[2/3] Launching an agent with a sample Terraform artifact..."
read -r -d '' BODY <<'JSON'
{
  "agent_type": "opencode",
  "prompt": "Deploying InfraStudio design 'smoke-test'. Terraform follows:\n```hcl\nresource \"null_resource\" \"hello\" {}\n```\nWrite it to main.tf and run terraform validate only. Do not apply.",
  "max_runtime": 300
}
JSON
RESP=$(curl -s -m 30 -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "$BODY" "$BASE/api/agents/launch")
echo "      response: ${RESP:0:160}"

echo "[3/3] Verifying the run was created..."
ID=$(echo "$RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "$ID" ]; then
  echo "PASS: agent run #$ID launched via the deploy bridge."
  exit 0
else
  echo "FAIL: no agent id in response."
  exit 1
fi
