# InfraStudio — Unified Infrastructure Suite

**One product, one UI, three modules** behind a single gateway and one shared login:

- **Design** (InfraStudio) — visual drag-and-drop canvas, live multi-cloud pricing,
  Terraform / Ansible / Crossplane generation.
- **Operations** (Oz) — launch, schedule, and observe AI agents against real servers,
  Docker, and Proxmox, with an encrypted secrets vault. Native React screens:
  Agents · Servers · Secrets · Schedules.
- **Assistant** (Leon) — a natural-language chat panel, available on every page.

It's a single SPA: design infrastructure, hit **Deploy to Oz** to hand the generated
IaC to an agent, and manage everything (including via Leon) without leaving the app.

## Quick start

```bash
./setup.sh                  # interactive: prompts for ALL env, writes .env, builds & deploys
```

`setup.sh` is the centralized, portable one-command deployer — run it on any fresh
Linux server. It auto-generates a `SECRET_KEY`, detects busy host ports and picks
free ones, masks secret input, and re-uses any existing `.env` values as defaults
on re-runs. Useful flags:

```bash
./setup.sh -y          # non-interactive (use existing .env / defaults)
./setup.sh --env-only  # only (re)generate .env, don't deploy
./setup.sh --no-build  # deploy without rebuilding images
./setup.sh --down      # stop the stack
```

Prefer a hands-off path? `cp .env.example .env`, edit it, then `./deploy.sh`.

| Surface | URL | What |
|---|---|---|
| Unified UI | http://localhost:8080/ | The whole product — Design, Operations, Assistant |
| Oz API docs | http://localhost:8000/docs | FastAPI / Swagger |

Default login (seeded): `admin@oz.local` / `admin123`.
(Host ports are configurable; `setup.sh` remaps any that are busy — e.g. the API to 18000.)

## Architecture (single suite)

```
                    ┌──────────────────── gateway (nginx :8080) ───────────────────┐
  browser ─────────▶  /            → InfraStudio SPA  (the ONE unified product UI)  │
                    │  /api/        → Oz API            (api:8000)                   │
                    │  /studio-api/ → InfraStudio API   (infrastudio-api:8001)       │
                    │  /leon/       → Leon assistant    (leon:5366, key injected)    │
                    └──────┬─────────────────────┬──────────────────────┬───────────┘
                           │                     │                       │
              ┌────────────▼────────┐  ┌─────────▼──────────┐   ┌────────▼────────┐
              │ Oz API (FastAPI)    │  │ InfraStudio API    │   │ Leon (Node)     │
              │ auth · agents ·     │  │ pricing · ai ·     │   │ NLU · assistant │
              │ servers · secrets · │  │ stripe · settings  │   └─────────────────┘
              │ schedules           │  └────────────────────┘
              └──┬───────┬──────────┘
            Postgres   Redis ── worker/beat (Celery) · oz-agent sandbox
```

The single React SPA renders all three modules (one nav, one theme, one auth):
- **Design** — existing InfraStudio screens (canvas, Terraform, cost, etc.).
- **Operations** — native React pages (`src/pages/ops/`) calling the Oz API.
- **Assistant** — `src/components/AssistantPanel.tsx`, a slide-over Leon chat on every page.

**Design → Deploy bridge:** *Deploy to Oz* generates the canvas's IaC and POSTs it to
`/api/agents/launch` using the shared JWT (`src/utils/ozClient.ts`, `src/components/OzDeployBar.tsx`).

**Shared auth:** login authenticates against Oz's `/api/auth/token`; one JWT powers the
whole suite (Design, Operations, and the deploy bridge) from a single origin.

## Tests

```bash
tests/validate.sh    # static: compose valid, frontend builds, backend boots, nginx ok (no running stack)
tests/smoke.sh       # against a running stack: routing, health, pricing, ai, shared auth
tests/integration_deploy.sh   # exercises the design→deploy agent-launch bridge
```

## Layout

- `docker-compose.yml` — single authoritative deployment manifest for the merged product.
- `gateway/` — unified nginx image (bakes both SPAs, proxies both APIs).
- `infra_builder/` — InfraStudio (React SPA + FastAPI pricing/AI backend).
- `orchestration/` — Oz (FastAPI control plane, Celery, Leon, Cloudflare agents, agent sandbox).
- `MERGE_PLAN.md` — the systematic merge plan and rationale.

> Note: the per-project files under `orchestration/docker/` and `infra_builder/vercel.json`
> remain for standalone use; the **root `docker-compose.yml` is the merged deployment**.
