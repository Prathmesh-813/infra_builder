# Merge Plan — InfraStudio × Oz

Systematic plan for merging `infra_builder` (**InfraStudio**) and `orchestration`
(**Oz**) into one dockerized, production-oriented product. Captures the decisions,
the work completed in this pass, the test strategy, and what remains for hardening.

---

## 1. Why these two merge well

| | InfraStudio (`infra_builder`) | Oz (`orchestration`) |
|---|---|---|
| Role | **Design** infrastructure | **Deploy & operate** infrastructure |
| Frontend | React 18 + Vite SPA (ReactFlow canvas) | Vanilla-JS dashboard |
| Backend | FastAPI, **stateless** (pricing/AI/stripe/settings) | FastAPI + Postgres + Redis + Celery |
| Auth | localStorage stub | Real JWT + bcrypt + users table |
| Packaging | Vercel (FE), manual uvicorn (BE), **no Docker** | Full docker-compose (8 services), `deploy.sh` |
| Extras | Live AWS/Azure/GCP pricing, Terraform/Ansible/Crossplane codegen, Stripe | Agent runtime (OpenCode/Claude/Codex/Gemini), Leon NLU, Cloudflare edge agents, secrets vault, scheduler |

They are complementary, not overlapping: InfraStudio **produces** IaC; Oz **executes**
work against real infrastructure. The merged thesis is a **design → deploy pipeline**.

## 2. Decisions (locked)

1. **Product vision:** Design → Deploy. InfraStudio is the design layer; Oz is the
   execution backend. A *Deploy to Oz* action hands generated IaC to an Oz agent.
2. **Frontend:** Co-host both UIs behind one nginx gateway (`/` = Oz, `/studio/` =
   InfraStudio) with shared auth. (Future: unify into a single React SPA.)
3. **Backend:** Keep two FastAPI services; the gateway routes `/api/` → Oz and
   `/studio-api/` → InfraStudio. No backend code merge required now.
4. **Scope of this pass:** a runnable merged MVP end-to-end (compose + gateway +
   shared auth + deploy bridge + tests).

## 3. The core collision and how it's resolved

Both apps natively use the `/api/` namespace and both expect to be served from `/`.
Resolution:

- InfraStudio SPA is built with **`base: /studio/`** (Vite) and **router basename
  `/studio`**, so it lives cleanly under `/studio/`.
- InfraStudio's ~6 API call sites are repointed to **`/studio-api`** via a single
  config module (`src/config/api.ts`); the gateway rewrites `/studio-api/` → the
  backend's native `/api/`.
- A hardcoded `http://localhost:8001` in the AI client (which would break in a
  container) was removed in favour of the config base.

## 4. Target architecture

Single gateway (`gateway/`, nginx) is the only published web entrypoint (`:8080`):

```
/            → Oz dashboard static            (orchestration/web)
/studio/     → InfraStudio SPA static         (built into the gateway image)
/api/        → api:8000          (Oz control plane; /api/agents/ws/ upgraded)
/studio-api/ → infrastudio-api:8001  (rewritten to /api/)
```

Backing services (root `docker-compose.yml`): `api`, `worker`, `beat`, `db`
(Postgres 16), `redis`, `leon`, `oz-opencode-server`, `oz-agent` (build-profile
sandbox image), `infrastudio-api`, `gateway`.

## 5. Integration points delivered

- **Shared auth** — InfraStudio `LoginPage` now authenticates against Oz
  `POST /api/auth/token` (and `…/register`); the JWT is stored as `oz_token` and is
  valid across both UIs (same origin). `App.tsx` gates on the real session.
  Files: `src/utils/ozClient.ts`, `src/pages/LoginPage.tsx`, `src/App.tsx`.
- **Design → Deploy bridge** — a global `OzDeployBar` generates the current canvas's
  Terraform/Ansible and POSTs it to `POST /api/agents/launch` with the bearer token,
  launching an Oz agent to validate/apply.
  Files: `src/components/OzDeployBar.tsx`, `src/utils/ozClient.ts`.

## 6. Dockerization delivered

- `infra_builder/backend/Dockerfile` (+ `.dockerignore`) — uvicorn on :8001, health
  probe, credentials kept out of the image and persisted via a volume.
  **Fix found by container test:** added missing `packaging` dep (the GCP pricing
  client imports `google.auth.transport.urllib3`, which needs it) — the container
  crashed on startup without it.
- `gateway/Dockerfile` — multi-stage: builds the InfraStudio SPA (`base=/studio/`,
  `VITE_API_BASE=/studio-api`) and bakes it + the Oz dashboard + the routing config
  into one nginx image. Root `.dockerignore` keeps the build context small (excludes
  `cloudflare-agents`, `node_modules`, `.venv`, etc.).
- Root `docker-compose.yml` — unified manifest (Oz services with root-relative build
  contexts + `infrastudio-api` + `gateway`), env-var driven with safe defaults.
- `deploy.sh` — one-command: build sandbox image, build stack, start, wait for the
  gateway, seed the admin user, print URLs.

## 7. Test strategy

| Layer | Script | What it proves | Needs running stack? |
|---|---|---|---|
| Static | `tests/validate.sh` | compose valid · frontend builds · backend image boots & serves health · gateway `nginx -t` | no |
| Smoke | `tests/smoke.sh` | gateway routing (`/`, `/studio/`, `/studio`→301) · both health endpoints · live Azure pricing · AI codegen · shared-JWT login + `/auth/me` | yes |
| Integration | `tests/integration_deploy.sh` | the deploy bridge: shared login → `agents/launch` → run id | yes (+ agent runtime) |

**Verified in this pass (real containers):**
- InfraStudio frontend builds (`tsc && vite build`) with all repath/auth/deploy edits.
- Built `index.html` references `/studio/assets/...` (base applied).
- `infrastudio-api` image builds, boots, serves `/api/health`, returns **live** Azure
  pricing and a 6-node AI generation.
- `gateway` image builds; `nginx -t` passes; serves Oz at `/` (200), InfraStudio at
  `/studio/` (200), `/studio`→301, and SPA deep-link fallback (200).

## 8. Production-readiness checklist

Done:
- [x] Single gateway origin; rate limiting carried over; WebSocket upgrade for agent logs.
- [x] Health checks (infrastudio-api) and `restart: unless-stopped` on all services.
- [x] Secrets/credentials never baked into images; persisted via named volumes.
- [x] Env-var driven config with `.env.example`.

Before going live (recommended next steps):
- [ ] Set a strong `SECRET_KEY` and rotate the seeded admin password.
- [ ] Parameterize Postgres/Redis credentials (currently `oz/oz`, `oz-dev`) via env.
- [ ] Add TLS termination (gateway behind a real cert / put it behind a load balancer).
- [ ] Pin/expose `infrastudio-api` only through the gateway (already not published).
- [ ] Add Alembic migrations to the deploy flow (Oz uses `init_db` today).
- [ ] CI: run `tests/validate.sh` on PRs (extend `orchestration/.github/workflows`).

## 9. Future (phase 2) — deeper merge

- Unify the two UIs into the React SPA (port Oz's agents/servers/secrets/schedules
  screens), retire the vanilla dashboard.
- Fold InfraStudio's stateless routes into the Oz FastAPI app and move credential
  storage into Oz's encrypted vault (removes the second service).
- Richer deploy handoff: map a design's target cloud/region to a registered Oz server
  and pass `server_id` so the agent gets injected credentials automatically.
