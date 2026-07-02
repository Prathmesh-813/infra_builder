#!/bin/bash
# One-command deploy for the merged product (InfraStudio + Oz) from the repo root.
#   ./deploy.sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE=(docker compose -f "$ROOT_DIR/docker-compose.yml")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ADMIN_EMAIL="${OZ_ADMIN_EMAIL:-admin@oz.local}"
ADMIN_PASSWORD="${OZ_ADMIN_PASSWORD:-admin123}"

install_docker() {
    if command -v docker &>/dev/null; then
        info "Docker present: $(docker --version)"
    else
        info "Installing Docker..."
        curl -fsSL https://get.docker.com | sh
    fi
}

check_env() {
    if [ ! -f "$ROOT_DIR/.env" ]; then
        warn ".env not found — creating from .env.example (edit it for production)."
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    fi
    # Load admin creds from .env if present.
    [ -f "$ROOT_DIR/.env" ] && set -a && . "$ROOT_DIR/.env" && set +a || true
    ADMIN_EMAIL="${OZ_ADMIN_EMAIL:-admin@oz.local}"
    ADMIN_PASSWORD="${OZ_ADMIN_PASSWORD:-admin123}"
    info ".env ready."
}

build_images() {
    info "Building the on-demand agent sandbox image (oz-agent)..."
    "${COMPOSE[@]}" --profile build build oz-agent
    info "Building application images (this can take several minutes)..."
    "${COMPOSE[@]}" build
    info "Build complete."
}

start_services() {
    info "Starting the stack..."
    "${COMPOSE[@]}" up -d
    info "Waiting for the Oz API to import cleanly..."
    for _ in $(seq 1 30); do
        if "${COMPOSE[@]}" exec -T api python3 -c "import app.main" &>/dev/null; then break; fi
        sleep 2
    done
    sleep 5
    info "Waiting for the gateway to answer..."
    for _ in $(seq 1 30); do
        if curl -sf --max-time 2 http://localhost:8080/studio-api/health &>/dev/null; then break; fi
        sleep 2
    done
}

create_admin() {
    info "Seeding admin user ($ADMIN_EMAIL)..."
    "${COMPOSE[@]}" exec -T \
        -e SEED_EMAIL="$ADMIN_EMAIL" -e SEED_PASSWORD="$ADMIN_PASSWORD" \
        api python3 << 'PYEOF'
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
        result = await db.execute(select(User).where(User.email == email))
        if not result.scalar_one_or_none():
            db.add(User(email=email, hashed_password=hash_password(password),
                        full_name='Admin', role='admin'))
            await db.commit()
            print(f'Admin user created ({email})')
        else:
            print('Admin user already exists')

asyncio.run(main())
PYEOF
}

show_status() {
    echo ""
    info "Deployment complete. Containers:"
    "${COMPOSE[@]}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "localhost")
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Unified UI   → http://${PUBLIC_IP}:8080/         (Oz dashboard)"
    echo -e "  InfraStudio  → http://${PUBLIC_IP}:8080/studio/  (visual IaC designer)"
    echo -e "  Oz API docs  → http://${PUBLIC_IP}:8000/docs"
    echo -e "  Leon chat    → http://${PUBLIC_IP}:5366"
    echo -e "  Login        → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

main() {
    echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   InfraStudio + Oz — Unified Deployer    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    install_docker
    check_env
    build_images
    start_services
    create_admin
    show_status
}

main "$@"
