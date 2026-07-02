import type { DetectedApp } from "../types";

export function generateAzureAca(app: DetectedApp): { filename: string; content: string }[] {
  const { repoName, port } = app;
  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  return [
    { filename: "containerapp.yaml", content: containerAppYaml(name, port, app) },
    { filename: "deploy.sh",         content: deployScript(name, port) },
  ];
}

function containerAppYaml(name: string, port: number, app: DetectedApp): string {
  const { language } = app;
  const memory = language === "java" ? "1.0Gi" : "0.5Gi";
  const cpu    = language === "java" ? 0.5 : 0.25;

  return `# Azure Container Apps — ${app.repoName}
# Deploy with: az containerapp create --yaml containerapp.yaml

type: Microsoft.App/containerApps
location: eastus
tags:
  Project: ${name}
  ManagedBy: TechAtlas

identity:
  type: SystemAssigned

properties:
  managedEnvironmentId: /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/${name}-rg/providers/Microsoft.App/managedEnvironments/${name}-env

  configuration:
    activeRevisionsMode: Single

    ingress:
      external: true
      targetPort: ${port}
      transport: http
      traffic:
        - latestRevision: true
          weight: 100
      corsPolicy:
        allowedOrigins:
          - "https://yourdomain.com"
        allowedMethods:
          - GET
          - POST
          - PUT
          - DELETE
        allowCredentials: true

    registries:
      - server: "YOURREGISTRY.azurecr.io"
        identity: system

    secrets:
      - name: database-url
        keyVaultUrl: "https://YOUR_VAULT.vault.azure.net/secrets/${name}-database-url"
        identity: system
      - name: secret-key
        keyVaultUrl: "https://YOUR_VAULT.vault.azure.net/secrets/${name}-secret-key"
        identity: system

  template:
    revisionSuffix: v1

    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-scaler
          http:
            metadata:
              concurrentRequests: "100"

    containers:
      - name: ${name}
        image: "YOURREGISTRY.azurecr.io/${name}:latest"
        resources:
          cpu: ${cpu}
          memory: "${memory}"
        env:
          - name: PORT
            value: "${port}"
          - name: NODE_ENV
            value: production
          - name: DATABASE_URL
            secretRef: database-url
          - name: SECRET_KEY
            secretRef: secret-key
        probes:
          - type: Liveness
            httpGet:
              path: /health
              port: ${port}
            periodSeconds: 30
          - type: Readiness
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 10
`;
}

function deployScript(name: string, port: number): string {
  return `#!/usr/bin/env bash
# Azure Container Apps Deploy Script
set -euo pipefail

SUBSCRIPTION_ID="\${AZURE_SUBSCRIPTION_ID:-YOUR_SUBSCRIPTION_ID}"
RESOURCE_GROUP="${name}-rg"
LOCATION="\${AZURE_LOCATION:-eastus}"
REGISTRY="${name}registry"  # ACR name (must be globally unique, letters+numbers only)
APP_NAME="${name}"
ENV_NAME="${name}-env"
IMAGE_TAG="\${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"

echo "🔐 Logging in to Azure..."
az login --use-device-code
az account set --subscription "\${SUBSCRIPTION_ID}"

echo "📦 Creating resource group..."
az group create --name "\${RESOURCE_GROUP}" --location "\${LOCATION}"

echo "🐳 Creating Azure Container Registry..."
az acr create \\
  --resource-group "\${RESOURCE_GROUP}" \\
  --name "\${REGISTRY}" \\
  --sku Basic \\
  --admin-enabled true 2>/dev/null || true

echo "🏗️  Building image in ACR (no local Docker needed)..."
az acr build \\
  --registry "\${REGISTRY}" \\
  --image "${name}:\${IMAGE_TAG}" \\
  .

echo "🌍 Creating Container Apps Environment..."
az containerapp env create \\
  --name "\${ENV_NAME}" \\
  --resource-group "\${RESOURCE_GROUP}" \\
  --location "\${LOCATION}" 2>/dev/null || true

echo "🚀 Creating/updating Container App..."
az containerapp create \\
  --name "\${APP_NAME}" \\
  --resource-group "\${RESOURCE_GROUP}" \\
  --environment "\${ENV_NAME}" \\
  --image "\${REGISTRY}.azurecr.io/${name}:\${IMAGE_TAG}" \\
  --registry-server "\${REGISTRY}.azurecr.io" \\
  --target-port ${port} \\
  --ingress external \\
  --min-replicas 1 \\
  --max-replicas 10 \\
  --cpu 0.25 \\
  --memory 0.5Gi \\
  --env-vars "NODE_ENV=production" "PORT=${port}"

echo "🎉 Deploy complete!"
az containerapp show \\
  --name "\${APP_NAME}" \\
  --resource-group "\${RESOURCE_GROUP}" \\
  --query "properties.configuration.ingress.fqdn" \\
  --output tsv
`;
}
