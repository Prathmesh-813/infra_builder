// ─── TechAtlas Deploy Wizard — Deploy Script Generators ─────────────────────
// Generates Bash, PowerShell, Python, and Makefile deploy scripts.

import type { DetectedApp } from "../types";

// ── Bash (deploy.sh) ─────────────────────────────────────────────────────────

export function generateBashScript(app: DetectedApp): string {
  return `#!/usr/bin/env bash
# deploy.sh — Deploy ${app.repoName} to Kubernetes
set -euo pipefail

REGISTRY="\${REGISTRY:-your-registry.example.com}"
TAG="\${TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
IMAGE="\${REGISTRY}/${app.repoOwner}/${app.repoName}:\${TAG}"
NAMESPACE="\${NAMESPACE:-${app.repoName}}"
KUBE_CONTEXT="\${KUBE_CONTEXT:-$(kubectl config current-context 2>/dev/null || echo default)}"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }
step() { log "── $*"; }

# ── Pre-flight ─────────────────────────────────────────────────────────────────
step "Checking dependencies…"
command -v docker   >/dev/null || die "docker is not installed"
command -v kubectl  >/dev/null || die "kubectl is not installed"

step "Using image : \$IMAGE"
step "Namespace   : \$NAMESPACE"
step "Kube context: \$KUBE_CONTEXT"

# ── Build ──────────────────────────────────────────────────────────────────────
step "Building Docker image…"
docker build --pull --no-cache \\
  -t "\$IMAGE" \\
  -t "\${REGISTRY}/${app.repoOwner}/${app.repoName}:latest" \\
  .

# ── Push ───────────────────────────────────────────────────────────────────────
step "Pushing image to registry…"
docker push "\$IMAGE"
docker push "\${REGISTRY}/${app.repoOwner}/${app.repoName}:latest"

# ── Deploy ─────────────────────────────────────────────────────────────────────
step "Deploying to Kubernetes (context: \$KUBE_CONTEXT)…"
kubectl --context="\$KUBE_CONTEXT" -n "\$NAMESPACE" \\
  set image deployment/${app.repoName} app="\$IMAGE"

step "Waiting for rollout…"
kubectl --context="\$KUBE_CONTEXT" -n "\$NAMESPACE" \\
  rollout status deployment/${app.repoName} --timeout=5m

step "Verifying pods…"
kubectl --context="\$KUBE_CONTEXT" -n "\$NAMESPACE" \\
  get pods -l app=${app.repoName}

log "Deployment complete ✓ — \$IMAGE"
`;
}

// ── PowerShell (deploy.ps1) ───────────────────────────────────────────────────

export function generatePowerShellScript(app: DetectedApp): string {
  return `# deploy.ps1 — Deploy ${app.repoName} to Kubernetes
# Requires: Docker Desktop, kubectl, PowerShell 7+
#Requires -Version 7

param(
  [string] $Registry  = $env:REGISTRY  ?? 'your-registry.example.com',
  [string] $Tag       = $env:TAG       ?? (git rev-parse --short HEAD 2>$null) ?? 'latest',
  [string] $Namespace = $env:NAMESPACE ?? '${app.repoName}',
  [string] $Context   = $env:KUBE_CONTEXT ?? (kubectl config current-context 2>$null) ?? 'default',
  [switch] $SkipBuild,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
$Image  = "$Registry/${app.repoOwner}/${app.repoName}:$Tag"
$Latest = "$Registry/${app.repoOwner}/${app.repoName}:latest"

function Log  { param($Msg) Write-Host "[$([datetime]::Now.ToString('HH:mm:ss'))] $Msg" -ForegroundColor Cyan }
function Step { param($Msg) Write-Host "── $Msg" -ForegroundColor Yellow }
function Ok   { param($Msg) Write-Host "✓ $Msg" -ForegroundColor Green }
function Fail { param($Msg) Write-Error $Msg }

# ── Pre-flight ────────────────────────────────────────────────────────────────
Step "Pre-flight checks…"
if (-not (Get-Command docker   -ErrorAction SilentlyContinue)) { Fail "docker is not installed" }
if (-not (Get-Command kubectl  -ErrorAction SilentlyContinue)) { Fail "kubectl is not installed" }
Log "Image     : $Image"
Log "Namespace : $Namespace"
Log "Context   : $Context"

if ($DryRun) {
  Log "DRY RUN mode — no changes will be made"
}

# ── Build ─────────────────────────────────────────────────────────────────────
if (-not $SkipBuild) {
  Step "Building Docker image…"
  if (-not $DryRun) {
    docker build --pull --no-cache -t $Image -t $Latest .
    if ($LASTEXITCODE -ne 0) { Fail "docker build failed" }
    Ok "Build successful"
  } else {
    Log "SKIP (dry run): docker build -t $Image ."
  }

  # ── Push ───────────────────────────────────────────────────────────────────
  Step "Pushing image to registry…"
  if (-not $DryRun) {
    docker push $Image
    docker push $Latest
    if ($LASTEXITCODE -ne 0) { Fail "docker push failed" }
    Ok "Push successful"
  }
}

# ── Deploy ────────────────────────────────────────────────────────────────────
Step "Deploying to Kubernetes…"
if (-not $DryRun) {
  kubectl --context=$Context -n $Namespace \`
    set image deployment/${app.repoName} app=$Image
  if ($LASTEXITCODE -ne 0) { Fail "kubectl set image failed" }

  Step "Waiting for rollout…"
  kubectl --context=$Context -n $Namespace \`
    rollout status deployment/${app.repoName} --timeout=5m
  if ($LASTEXITCODE -ne 0) { Fail "Rollout failed or timed out" }

  Step "Pod status:"
  kubectl --context=$Context -n $Namespace \`
    get pods -l app=${app.repoName}
} else {
  Log "SKIP (dry run): kubectl set image deployment/${app.repoName} app=$Image"
}

Ok "Deployment complete — $Image"
`;
}

// ── Python (deploy.py) ────────────────────────────────────────────────────────

export function generatePythonScript(app: DetectedApp): string {
  return `#!/usr/bin/env python3
"""deploy.py — Deploy ${app.repoName} to Kubernetes.

Usage:
    python deploy.py [--tag TAG] [--registry REGISTRY] [--namespace NS]
                     [--context CTX] [--skip-build] [--dry-run]

Requirements:
    pip install colorama  # optional, for coloured output
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import os
from datetime import datetime
from pathlib import Path


# ── Helpers ──────────────────────────────────────────────────────────────────

def run(cmd: list[str], *, dry_run: bool = False, capture: bool = False) -> str:
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] $ {' '.join(cmd)}")
    if dry_run:
        print("  (dry run — skipped)")
        return ""
    result = subprocess.run(cmd, check=True, capture_output=capture, text=True)
    return result.stdout.strip() if capture else ""


def git_sha() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True
        ).strip()
    except Exception:
        return "latest"


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy ${app.repoName}")
    parser.add_argument("--registry",   default=os.environ.get("REGISTRY", "your-registry.example.com"))
    parser.add_argument("--tag",        default=os.environ.get("TAG", git_sha()))
    parser.add_argument("--namespace",  default=os.environ.get("NAMESPACE", "${app.repoName}"))
    parser.add_argument("--context",    default=os.environ.get("KUBE_CONTEXT", ""))
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--dry-run",    action="store_true")
    args = parser.parse_args()

    dry   = args.dry_run
    image = f"{args.registry}/${app.repoOwner}/${app.repoName}:{args.tag}"
    latest = f"{args.registry}/${app.repoOwner}/${app.repoName}:latest"
    ctx   = ["--context", args.context] if args.context else []

    print(f"\\n{'─' * 60}")
    print(f"  Deploying : ${app.repoName}")
    print(f"  Image     : {image}")
    print(f"  Namespace : {args.namespace}")
    print(f"  Dry run   : {dry}")
    print(f"{'─' * 60}\\n")

    # ── Build & Push ─────────────────────────────────────────────────────────
    if not args.skip_build:
        print("── Building Docker image…")
        run(["docker", "build", "--pull", "--no-cache", "-t", image, "-t", latest, "."], dry_run=dry)

        print("── Pushing image to registry…")
        run(["docker", "push", image], dry_run=dry)
        run(["docker", "push", latest], dry_run=dry)

    # ── Deploy ───────────────────────────────────────────────────────────────
    print("── Deploying to Kubernetes…")
    run([
        "kubectl", *ctx, "-n", args.namespace,
        "set", "image", "deployment/${app.repoName}", f"app={image}",
    ], dry_run=dry)

    print("── Waiting for rollout…")
    run([
        "kubectl", *ctx, "-n", args.namespace,
        "rollout", "status", "deployment/${app.repoName}", "--timeout=5m",
    ], dry_run=dry)

    print("── Pod status:")
    run(["kubectl", *ctx, "-n", args.namespace, "get", "pods", "-l", "app=${app.repoName}"], dry_run=dry)

    print(f"\\n✓ Deployment complete — {image}")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\\nERROR: command failed with exit code {e.returncode}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\\nAborted.")
        sys.exit(130)
`;
}

// ── Makefile ─────────────────────────────────────────────────────────────────

export function generateMakefile(app: DetectedApp): string {
  return `.PHONY: help build push deploy rollback logs status clean

# ── Configuration ─────────────────────────────────────────────────────────────
REGISTRY   ?= your-registry.example.com
OWNER      ?= ${app.repoOwner}
APP        ?= ${app.repoName}
TAG        ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)
NAMESPACE  ?= ${app.repoName}
CONTEXT    ?= $(shell kubectl config current-context 2>/dev/null)
IMAGE      := $(REGISTRY)/$(OWNER)/$(APP):$(TAG)
LATEST     := $(REGISTRY)/$(OWNER)/$(APP):latest

# Colours
RED    := \\033[0;31m
GREEN  := \\033[0;32m
YELLOW := \\033[0;33m
CYAN   := \\033[0;36m
RESET  := \\033[0m

# ── Default target ────────────────────────────────────────────────────────────
help: ## Show this help message
	@echo ""
	@echo "  $(CYAN)${app.repoName} — Deployment Makefile$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \\
	  awk 'BEGIN {FS = ":.*##"}; {printf "  $(YELLOW)%-14s$(RESET) %s\\n", $$1, $$2}'
	@echo ""
	@echo "  $(CYAN)Variables:$(RESET)"
	@echo "    REGISTRY=$(REGISTRY)  TAG=$(TAG)  NAMESPACE=$(NAMESPACE)"
	@echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build the Docker image
	@echo "$(CYAN)── Building $(IMAGE)…$(RESET)"
	docker build --pull --no-cache -t $(IMAGE) -t $(LATEST) .
	@echo "$(GREEN)✓ Build complete$(RESET)"

# ── Push ──────────────────────────────────────────────────────────────────────
push: build ## Push image to registry
	@echo "$(CYAN)── Pushing $(IMAGE)…$(RESET)"
	docker push $(IMAGE)
	docker push $(LATEST)
	@echo "$(GREEN)✓ Push complete$(RESET)"

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy: push ## Build, push, and deploy to Kubernetes
	@echo "$(CYAN)── Deploying to namespace=$(NAMESPACE) context=$(CONTEXT)…$(RESET)"
	kubectl --context=$(CONTEXT) -n $(NAMESPACE) \\
	  set image deployment/$(APP) app=$(IMAGE)
	@echo "$(CYAN)── Waiting for rollout…$(RESET)"
	kubectl --context=$(CONTEXT) -n $(NAMESPACE) \\
	  rollout status deployment/$(APP) --timeout=5m
	@$(MAKE) status
	@echo "$(GREEN)✓ Deployment complete — $(IMAGE)$(RESET)"

# ── Rollback ──────────────────────────────────────────────────────────────────
rollback: ## Roll back to the previous deployment revision
	@echo "$(YELLOW)── Rolling back deployment/$(APP)…$(RESET)"
	kubectl --context=$(CONTEXT) -n $(NAMESPACE) \\
	  rollout undo deployment/$(APP)
	kubectl --context=$(CONTEXT) -n $(NAMESPACE) \\
	  rollout status deployment/$(APP) --timeout=5m
	@echo "$(GREEN)✓ Rollback complete$(RESET)"

# ── Status ────────────────────────────────────────────────────────────────────
status: ## Show current pod status
	kubectl --context=$(CONTEXT) -n $(NAMESPACE) \\
	  get pods -l app=$(APP) -o wide

# ── Logs ──────────────────────────────────────────────────────────────────────
logs: ## Tail logs from running pods
	kubectl --context=$(CONTEXT) -n $(NAMESPACE) \\
	  logs -l app=$(APP) --tail=100 -f

# ── Clean ─────────────────────────────────────────────────────────────────────
clean: ## Remove local Docker images for this app
	@echo "$(YELLOW)── Removing local images…$(RESET)"
	-docker rmi $(IMAGE) 2>/dev/null || true
	-docker rmi $(LATEST) 2>/dev/null || true
	@echo "$(GREEN)✓ Clean complete$(RESET)"
`;
}
