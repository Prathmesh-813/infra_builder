#!/usr/bin/env bash
# =============================================================================
#  setup.sh — Centralized, portable, one-command deployer for the merged
#             InfraStudio × Oz platform.
#
#  Interactively collects EVERY environment variable, writes .env, then builds
#  and starts the full stack. Re-runnable (existing .env values become the
#  defaults) and portable (run it on any fresh Linux server with Docker).
#
#  Usage:
#     ./setup.sh                 # interactive: prompt for all env, then deploy
#     ./setup.sh -y              # non-interactive: use existing .env / defaults
#     ./setup.sh --env-only      # only (re)generate .env, do not deploy
#     ./setup.sh --no-build      # deploy without rebuilding images
#     ./setup.sh --down          # stop the stack
#     ./setup.sh -h              # help
# =============================================================================
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"
COMPOSE=(docker compose -f "$ROOT_DIR/docker-compose.yml")

# ── pretty output ────────────────────────────────────────────────────────────
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; NC=$'\033[0m'
info()  { echo "${GREEN}[+]${NC} $1"; }
warn()  { echo "${YELLOW}[!]${NC} $1"; }
err()   { echo "${RED}[✗]${NC} $1" >&2; }
die()   { err "$1"; exit 1; }
hr()    { echo "${BLUE}────────────────────────────────────────────────────────${NC}"; }
section() { echo; echo "${BOLD}${BLUE}== $1 ==${NC}"; }

# ── flags ────────────────────────────────────────────────────────────────────
INTERACTIVE=true; ENV_ONLY=false; DO_BUILD=true; ACTION=deploy
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes|--non-interactive) INTERACTIVE=false ;;
    --env-only)                 ENV_ONLY=true ;;
    --no-build)                 DO_BUILD=false ;;
    --down)                     ACTION=down ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed -E 's/^# ?//'; exit 0 ;;
    *) die "Unknown option: $1 (use -h for help)" ;;
  esac
  shift
done

[ "$ACTION" = "down" ] && { info "Stopping the stack..."; "${COMPOSE[@]}" down; exit $?; }

# ── load existing .env so its values become the defaults ─────────────────────
if [ -f "$ENV_FILE" ]; then
  info "Found existing .env — its values will be offered as defaults."
  set -a; # shellcheck disable=SC1090
  . "$ENV_FILE"; set +a
fi

# ── helpers ──────────────────────────────────────────────────────────────────
declare -A VAL

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32
  else head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

mask() {
  local v="${1:-}"
  if [ -z "$v" ]; then echo "(empty)";
  elif [ ${#v} -le 6 ]; then echo "••••";
  else echo "${v:0:4}••••${v: -2}"; fi
}

# ask KEY "Description" "default" [text|secret|password|choice:a/b]
ask() {
  local key="$1" desc="$2" def="$3" kind="${4:-text}"
  local cur="${!key:-$def}"                       # existing env (.env) wins over default
  if ! $INTERACTIVE; then VAL[$key]="$cur"; return; fi

  local shown input
  case "$kind" in
    secret|password) shown="$(mask "$cur")" ;;
    *)               shown="${cur:-(empty)}" ;;
  esac

  if [ "$kind" = "password" ] || [ "$kind" = "secret" ]; then
    read -rsp "  ${desc} [${shown}]: " input; echo
  else
    read -rp  "  ${desc} [${shown}]: " input
  fi
  VAL[$key]="${input:-$cur}"

  # validate choice:a/b/c
  if [[ "$kind" == choice:* ]]; then
    local opts="${kind#choice:}"
    if [[ -n "${VAL[$key]}" ]] && [[ ! "/$opts/" == *"/${VAL[$key]}/"* ]]; then
      warn "Expected one of: ${opts//\// }. Keeping '${VAL[$key]}' anyway."
    fi
  fi
}

# ── port conflict detection ──────────────────────────────────────────────────
port_in_use() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}\$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/${p}") >/dev/null 2>&1 && { exec 3>&- 2>/dev/null; return 0; } || return 1
  fi
}
free_port() { local p="$1"; while port_in_use "$p"; do p=$((p+10000)); done; echo "$p"; }
default_port() {  # default_port DESIRED -> DESIRED if free, else a free alternative
  local p="$1"
  if port_in_use "$p"; then local alt; alt="$(free_port "$p")"; warn "Port $p is in use — defaulting to $alt." >&2; echo "$alt"; else echo "$p"; fi
}

# =============================================================================
#  Collect configuration
# =============================================================================
echo
echo "${BOLD}╔════════════════════════════════════════════════╗${NC}"
echo "${BOLD}║   InfraStudio × Oz — Unified Setup & Deploy    ║${NC}"
echo "${BOLD}╚════════════════════════════════════════════════╝${NC}"
$INTERACTIVE && echo "Press Enter to keep the [default]. Secrets are masked." || info "Non-interactive mode: using existing .env / defaults."

section "1. Security"
ask SECRET_KEY        "JWT signing key (blank = auto-generate)" "${SECRET_KEY:-}" secret
[ -z "${VAL[SECRET_KEY]}" ] && { VAL[SECRET_KEY]="$(gen_secret)"; info "Generated a random SECRET_KEY."; }
ask OZ_ADMIN_EMAIL    "Admin email"    "admin@oz.local"
ask OZ_ADMIN_PASSWORD "Admin password" "admin123" password

section "2. Published host ports (override to avoid clashes)"
ask GATEWAY_PORT  "Gateway / unified UI port" "$(default_port "${GATEWAY_PORT:-8080}")"
ask OZ_API_PORT   "Oz API port"               "$(default_port "${OZ_API_PORT:-8000}")"
ask LEON_PORT_HOST "Leon chat port"           "$(default_port "${LEON_PORT_HOST:-5366}")"
ask OPENCODE_PORT "OpenCode warm-server port" "$(default_port "${OPENCODE_PORT:-4096}")"

section "3. Oz agent runtime"
ask OZ_RUNNER        "Agent runner (docker|local)"     "docker" "choice:docker/local"
ask OZ_AGENT_NETWORK "Agent network (host|bridge)"     "host"   "choice:host/bridge"
ask OZ_OPENCODE_MODEL "Default agent model"            "openai/gpt-4o-mini"
ask OZ_GITHUB_TOKEN  "GitHub token (optional)"         "" secret

section "4. LLM / AI provider keys (all optional — features degrade gracefully)"
ask OPENROUTER_API_KEY      "OpenRouter API key (OpenCode + Leon)" "" secret
ask GROQ_API_KEY            "Groq API key (Leon fast NLU)"         "" secret
ask OPENAI_API_KEY          "OpenAI API key (InfraStudio AI gen)"  "" secret
ask NVIDIA_API_KEY          "NVIDIA API key"                       "" secret
ask LEON_COMMANDCODE_API_KEY "Command Code API key"                "" secret
ask LEON_HTTP_API_KEY       "Leon HTTP API key"                    "dev-key-123" secret

section "5. Cloudflare edge agents (optional)"
ask CLOUDFLARE_API_TOKEN         "Cloudflare API token"        "" secret
ask CLOUDFLARE_ACCOUNT_ID        "Cloudflare account id"       "" secret
ask CF_DOCKER_AGENT_URL          "Docker agent worker URL"     ""
ask CF_SERVER_HEALTH_AGENT_URL   "Server-health worker URL"    ""
ask CF_PROXMOX_AGENT_URL         "Proxmox worker URL"          ""

section "6. InfraStudio Stripe billing (optional — dev mode if blank)"
ask STRIPE_SECRET_KEY               "Stripe secret key"            "" secret
ask STRIPE_WEBHOOK_SECRET           "Stripe webhook secret"        "" secret
ask STRIPE_PRICE_PRO_MONTHLY        "Price id: Pro monthly"        ""
ask STRIPE_PRICE_PRO_ANNUAL         "Price id: Pro annual"         ""
ask STRIPE_PRICE_ENTERPRISE_MONTHLY "Price id: Enterprise monthly" ""
ask STRIPE_PRICE_ENTERPRISE_ANNUAL  "Price id: Enterprise annual"  ""

# =============================================================================
#  Write .env
# =============================================================================
write_env() {
  local f="$ENV_FILE"
  [ -f "$f" ] && cp "$f" "$f.bak.$(date +%s 2>/dev/null || echo prev)" 2>/dev/null && info "Backed up previous .env"
  {
    echo "# Generated by setup.sh — $(date 2>/dev/null || echo)"
    echo
    echo "# ── Security ──"
    echo "SECRET_KEY=${VAL[SECRET_KEY]}"
    echo "OZ_ADMIN_EMAIL=${VAL[OZ_ADMIN_EMAIL]}"
    echo "OZ_ADMIN_PASSWORD=${VAL[OZ_ADMIN_PASSWORD]}"
    echo
    echo "# ── Published host ports ──"
    echo "GATEWAY_PORT=${VAL[GATEWAY_PORT]}"
    echo "OZ_API_PORT=${VAL[OZ_API_PORT]}"
    echo "LEON_PORT_HOST=${VAL[LEON_PORT_HOST]}"
    echo "OPENCODE_PORT=${VAL[OPENCODE_PORT]}"
    echo
    echo "# ── Oz agent runtime ──"
    echo "OZ_RUNNER=${VAL[OZ_RUNNER]}"
    echo "OZ_AGENT_NETWORK=${VAL[OZ_AGENT_NETWORK]}"
    echo "OZ_OPENCODE_MODEL=${VAL[OZ_OPENCODE_MODEL]}"
    echo "OZ_GITHUB_TOKEN=${VAL[OZ_GITHUB_TOKEN]}"
    echo
    echo "# ── LLM / AI keys ──"
    echo "OPENROUTER_API_KEY=${VAL[OPENROUTER_API_KEY]}"
    echo "GROQ_API_KEY=${VAL[GROQ_API_KEY]}"
    echo "OPENAI_API_KEY=${VAL[OPENAI_API_KEY]}"
    echo "NVIDIA_API_KEY=${VAL[NVIDIA_API_KEY]}"
    echo "LEON_COMMANDCODE_API_KEY=${VAL[LEON_COMMANDCODE_API_KEY]}"
    echo "LEON_HTTP_API_KEY=${VAL[LEON_HTTP_API_KEY]}"
    echo
    echo "# ── Cloudflare edge agents ──"
    echo "CLOUDFLARE_API_TOKEN=${VAL[CLOUDFLARE_API_TOKEN]}"
    echo "CLOUDFLARE_ACCOUNT_ID=${VAL[CLOUDFLARE_ACCOUNT_ID]}"
    echo "CF_DOCKER_AGENT_URL=${VAL[CF_DOCKER_AGENT_URL]}"
    echo "CF_SERVER_HEALTH_AGENT_URL=${VAL[CF_SERVER_HEALTH_AGENT_URL]}"
    echo "CF_PROXMOX_AGENT_URL=${VAL[CF_PROXMOX_AGENT_URL]}"
    echo
    echo "# ── Stripe billing ──"
    echo "STRIPE_SECRET_KEY=${VAL[STRIPE_SECRET_KEY]}"
    echo "STRIPE_WEBHOOK_SECRET=${VAL[STRIPE_WEBHOOK_SECRET]}"
    echo "STRIPE_PRICE_PRO_MONTHLY=${VAL[STRIPE_PRICE_PRO_MONTHLY]}"
    echo "STRIPE_PRICE_PRO_ANNUAL=${VAL[STRIPE_PRICE_PRO_ANNUAL]}"
    echo "STRIPE_PRICE_ENTERPRISE_MONTHLY=${VAL[STRIPE_PRICE_ENTERPRISE_MONTHLY]}"
    echo "STRIPE_PRICE_ENTERPRISE_ANNUAL=${VAL[STRIPE_PRICE_ENTERPRISE_ANNUAL]}"
  } > "$f"
  chmod 600 "$f" 2>/dev/null || true
  info "Wrote $f (chmod 600)."
}

section "Configuration summary"
hr
printf "  %-22s %s\n" "Gateway / UI port"  "${VAL[GATEWAY_PORT]}"
printf "  %-22s %s\n" "Oz API port"        "${VAL[OZ_API_PORT]}"
printf "  %-22s %s\n" "Admin email"        "${VAL[OZ_ADMIN_EMAIL]}"
printf "  %-22s %s\n" "Agent runner"       "${VAL[OZ_RUNNER]}"
printf "  %-22s %s\n" "SECRET_KEY"         "$(mask "${VAL[SECRET_KEY]}")"
printf "  %-22s %s\n" "OpenRouter key"     "$(mask "${VAL[OPENROUTER_API_KEY]}")"
printf "  %-22s %s\n" "Stripe key"         "$(mask "${VAL[STRIPE_SECRET_KEY]}")"
hr
if $INTERACTIVE; then
  read -rp "Write this configuration to .env? [Y/n]: " ok
  [[ "${ok:-Y}" =~ ^[Nn] ]] && die "Aborted — .env not modified."
fi
write_env

if $ENV_ONLY; then info "--env-only: .env generated. Skipping deploy."; exit 0; fi

# =============================================================================
#  Deploy
# =============================================================================
section "Deploying"

# Docker present?
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found."
  if $INTERACTIVE; then
    read -rp "Install Docker now via get.docker.com? [y/N]: " yn
    [[ "${yn:-N}" =~ ^[Yy] ]] && curl -fsSL https://get.docker.com | sh || die "Docker is required."
  else
    curl -fsSL https://get.docker.com | sh || die "Docker install failed."
  fi
fi
docker compose version >/dev/null 2>&1 || die "'docker compose' (v2) is required."

if $DO_BUILD; then
  info "Building the on-demand agent sandbox image (oz-agent)…"
  "${COMPOSE[@]}" --profile build build oz-agent || die "Failed to build oz-agent."
  info "Building application images (first run can take several minutes)…"
  "${COMPOSE[@]}" build || die "Image build failed."
fi

info "Starting the full stack…"
"${COMPOSE[@]}" up -d || die "docker compose up failed."

info "Waiting for the Oz API to import…"
for _ in $(seq 1 45); do
  "${COMPOSE[@]}" exec -T api python3 -c "import app.main" >/dev/null 2>&1 && break
  sleep 2
done
sleep 4

info "Waiting for the gateway to answer…"
for _ in $(seq 1 30); do
  curl -sf --max-time 2 "http://localhost:${VAL[GATEWAY_PORT]}/studio-api/health" >/dev/null 2>&1 && break
  sleep 2
done

info "Seeding admin user (${VAL[OZ_ADMIN_EMAIL]})…"
"${COMPOSE[@]}" exec -T -e SEED_EMAIL="${VAL[OZ_ADMIN_EMAIL]}" -e SEED_PASSWORD="${VAL[OZ_ADMIN_PASSWORD]}" \
  api python3 <<'PYEOF'
import asyncio, os
from app.core.database import async_session, init_db
from app.models.user import User
from app.core.auth import hash_password
from sqlalchemy import select
email = os.environ.get("SEED_EMAIL", "admin@oz.local")
password = os.environ.get("SEED_PASSWORD", "admin123")
async def main():
    await init_db()
    async with async_session() as db:
        r = await db.execute(select(User).where(User.email == email))
        if not r.scalar_one_or_none():
            db.add(User(email=email, hashed_password=hash_password(password), full_name='Admin', role='admin'))
            await db.commit(); print(f'Admin user created ({email})')
        else:
            print('Admin user already exists')
asyncio.run(main())
PYEOF

section "Done"
"${COMPOSE[@]}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || "${COMPOSE[@]}" ps
IP="$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo localhost)"
echo
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "  Unified UI   → http://${IP}:${VAL[GATEWAY_PORT]}/"
echo "  InfraStudio  → http://${IP}:${VAL[GATEWAY_PORT]}/studio/"
echo "  Oz API docs  → http://${IP}:${VAL[OZ_API_PORT]}/docs"
echo "  Leon chat    → http://${IP}:${VAL[LEON_PORT_HOST]}"
echo "  Login        → ${VAL[OZ_ADMIN_EMAIL]} / ${VAL[OZ_ADMIN_PASSWORD]}"
echo "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
info "Smoke test:  BASE=http://localhost:${VAL[GATEWAY_PORT]} tests/smoke.sh"
