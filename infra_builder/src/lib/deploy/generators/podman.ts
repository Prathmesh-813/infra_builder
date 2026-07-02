import type { DetectedApp } from "../types";

// ── podman-compose.yml ────────────────────────────────────────────────────────

export function generatePodmanCompose(app: DetectedApp): string {
  const { repoName, port, language, framework } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const envSlug = slug.replace(/-/g, "_");

  const needsDb = ["nodejs","python","java","ruby","php"].includes(language);

  const dbService = needsDb ? `
  postgres:
    image: docker.io/postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${envSlug}_db
      POSTGRES_USER: ${envSlug}_user
      POSTGRES_PASSWORD: changeme_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${envSlug}_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: docker.io/redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"` : "";

  const dependsOn = needsDb ? `    depends_on:
      - postgres
      - redis` : "";

  const nginxService = ["nextjs","react","vite"].includes(framework) ? `
  nginx:
    image: docker.io/nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app` : "";

  const volumes = needsDb ? `\nvolumes:\n  postgres_data:\n  redis_data:` : "";

  return `# Podman Compose — ${repoName}
# Requires: podman-compose (pip install podman-compose)
#
# Usage:
#   podman-compose up -d          # start all services in a shared pod
#   podman-compose logs -f app    # stream app logs
#   podman-compose down           # stop all services
#   podman-compose down -v        # stop + remove volumes
#
# Note: podman-compose creates a pod named '${slug}_default'.
# All images use fully-qualified names (docker.io/) to avoid ambiguity.

version: "3.9"

services:
  app:
    image: localhost/${slug}:latest
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${port}:${port}"
    env_file:
      - .env
    environment:
      NODE_ENV: production
      PORT: "${port}"${needsDb ? `
      DATABASE_URL: "postgresql://${envSlug}_user:changeme_password@localhost:5432/${envSlug}_db"
      REDIS_URL: "redis://localhost:6379"` : ""}
${dependsOn}
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:${port}/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s${dbService}${nginxService}${volumes}
`;
}

// ── Kubernetes pod spec (podman play kube) ────────────────────────────────────

export function generatePodmanKube(app: DetectedApp): string {
  const { repoName, port } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const envSlug = slug.replace(/-/g, "_");

  return `# Kubernetes-compatible Pod spec for Podman
# Run with:  podman play kube pod.yaml
# Stop with: podman play kube --down pod.yaml
#
# Podman reads this file natively — no cluster needed.

apiVersion: v1
kind: Pod
metadata:
  name: ${slug}
  labels:
    app: ${slug}
spec:
  restartPolicy: Always

  containers:
    # ── Application ──────────────────────────────────────────────────────────
    - name: app
      image: localhost/${slug}:latest
      imagePullPolicy: Never
      ports:
        - containerPort: ${port}
          hostPort: ${port}
          protocol: TCP
      env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "${port}"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ${slug}-secrets
              key: database-url
              optional: true
      resources:
        requests:
          memory: "128Mi"
          cpu: "100m"
        limits:
          memory: "512Mi"
          cpu: "500m"
      livenessProbe:
        httpGet:
          path: /health
          port: ${port}
        initialDelaySeconds: 30
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /health
          port: ${port}
        initialDelaySeconds: 5
        periodSeconds: 5

    # ── Postgres sidecar ─────────────────────────────────────────────────────
    - name: postgres
      image: docker.io/postgres:16-alpine
      ports:
        - containerPort: 5432
          hostPort: 5432
      env:
        - name: POSTGRES_DB
          value: "${envSlug}_db"
        - name: POSTGRES_USER
          value: "${envSlug}_user"
        - name: POSTGRES_PASSWORD
          value: "changeme_password"
      volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data

  volumes:
    - name: postgres-data
      persistentVolumeClaim:
        claimName: ${slug}-postgres-pvc

---
apiVersion: v1
kind: Secret
metadata:
  name: ${slug}-secrets
type: Opaque
stringData:
  database-url: "postgresql://${envSlug}_user:changeme_password@localhost:5432/${envSlug}_db"
`;
}

// ── Quadlet systemd unit (rootless, auto-start on boot) ───────────────────────

export function generatePodmanQuadlet(app: DetectedApp): string {
  const { repoName, port } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return `# Podman Quadlet — ${repoName}
# Systemd unit that manages the container as a user service.
#
# Install:
#   mkdir -p ~/.config/containers/systemd/
#   cp ${slug}.container ~/.config/containers/systemd/
#   systemctl --user daemon-reload
#   systemctl --user start ${slug}
#   systemctl --user enable ${slug}   # auto-start on login / boot
#
# Logs:
#   journalctl --user -u ${slug} -f

[Unit]
Description=${repoName} application container
After=local-fs.target network-online.target
Wants=network-online.target

[Container]
Image=localhost/${slug}:latest
ContainerName=${slug}
PublishPort=${port}:${port}

# Mount the .env file from the same directory
EnvironmentFile=%h/.config/containers/${slug}.env

# Health check
HealthCmd=curl -sf http://localhost:${port}/health
HealthInterval=30s
HealthTimeout=10s
HealthRetries=3
HealthStartPeriod=40s

# Restart policy
AutoUpdate=registry

[Service]
Restart=always
RestartSec=5s
TimeoutStartSec=90s

[Install]
WantedBy=default.target
`;
}

// ── podman-run.sh ─────────────────────────────────────────────────────────────

export function generatePodmanRunScript(app: DetectedApp): string {
  const { repoName, port } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return `#!/usr/bin/env bash
# podman-run.sh — Build and run ${repoName} with Podman (rootless)
set -euo pipefail

IMAGE="localhost/${slug}:latest"
CONTAINER="${slug}"
PORT="${port}"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
step() { log "── $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }

command -v podman >/dev/null || die "Podman is not installed — https://podman.io/getting-started/installation"

# ── Build ──────────────────────────────────────────────────────────────────────
step "Building image: \$IMAGE"
podman build --pull --layers --tag "\$IMAGE" .

# ── Stop & remove old container ───────────────────────────────────────────────
if podman container exists "\$CONTAINER" 2>/dev/null; then
  step "Stopping existing container: \$CONTAINER"
  podman stop "\$CONTAINER" || true
  podman rm   "\$CONTAINER" || true
fi

# ── Run ────────────────────────────────────────────────────────────────────────
step "Starting container on port \$PORT"
podman run -d \\
  --name "\$CONTAINER" \\
  --restart unless-stopped \\
  --publish "\$PORT:\$PORT" \\
  --env NODE_ENV=production \\
  --env PORT="\$PORT" \\
  --env-file .env \\
  --memory 512m \\
  --cpus 0.5 \\
  "\$IMAGE"

step "Waiting for health check…"
for i in \$(seq 1 12); do
  if podman healthcheck run "\$CONTAINER" &>/dev/null; then
    log "Container is healthy ✓"
    break
  fi
  sleep 5
  [ "\$i" -eq 12 ] && die "Container did not become healthy in time"
done

# ── Status ─────────────────────────────────────────────────────────────────────
podman ps --filter "name=\$CONTAINER" --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
log "Done — http://localhost:\$PORT"
`;
}
