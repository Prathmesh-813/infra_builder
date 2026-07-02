import type { DetectedApp } from "../types";

export function generateCloudRun(app: DetectedApp): { filename: string; content: string }[] {
  const { repoName, port } = app;
  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  return [
    { filename: "service.yaml", content: serviceYaml(name, port, app) },
    { filename: "deploy.sh",    content: deployScript(name, port) },
  ];
}

function serviceYaml(name: string, port: number, app: DetectedApp): string {
  const { language } = app;
  const memory = language === "java" ? "1Gi" : "512Mi";
  const cpu    = language === "java" ? "1000m" : "500m";

  return `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${name}
  namespace: "YOUR_PROJECT_ID"
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/launch-stage: GA
    run.googleapis.com/description: "${app.repoName} deployed via TechAtlas"
spec:
  template:
    metadata:
      annotations:
        # Scale to zero when no traffic
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        # Use 2nd gen execution environment for better cold starts
        run.googleapis.com/execution-environment: gen2
        # CPU is always allocated (better for consistent latency)
        run.googleapis.com/cpu-throttling: "false"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      serviceAccountName: ${name}-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
      containers:
        - image: us-central1-docker.pkg.dev/YOUR_PROJECT_ID/${name}/${name}:latest
          ports:
            - containerPort: ${port}
              name: http1
          resources:
            limits:
              cpu: "${cpu}"
              memory: "${memory}"
          env:
            - name: PORT
              value: "${port}"
            - name: NODE_ENV
              value: production
          # Mount secrets from Secret Manager
          envFrom: []
          # Or reference individual secrets:
          # - name: DATABASE_URL
          #   valueFrom:
          #     secretKeyRef:
          #       key: latest
          #       name: ${name}-database-url
          startupProbe:
            httpGet:
              path: /health
              port: ${port}
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 12
          livenessProbe:
            httpGet:
              path: /health
              port: ${port}
            periodSeconds: 30
  traffic:
    - percent: 100
      latestRevision: true
`;
}

function deployScript(name: string, port: number): string {
  return `#!/usr/bin/env bash
# Google Cloud Run Deploy Script
set -euo pipefail

PROJECT_ID="\${GCP_PROJECT_ID:-YOUR_PROJECT_ID}"
REGION="\${GCP_REGION:-us-central1}"
IMAGE_TAG="\${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
SERVICE_NAME="${name}"

AR_REPO="\${REGION}-docker.pkg.dev/\${PROJECT_ID}/\${SERVICE_NAME}"
IMAGE="\${AR_REPO}/\${SERVICE_NAME}:\${IMAGE_TAG}"

echo "🔐 Authenticating with Google Cloud..."
gcloud auth configure-docker "\${REGION}-docker.pkg.dev" --quiet

echo "📦 Creating Artifact Registry repository (safe to run if it already exists)..."
gcloud artifacts repositories create "\${SERVICE_NAME}" \\
  --repository-format=docker \\
  --location="\${REGION}" \\
  --project="\${PROJECT_ID}" 2>/dev/null || true

echo "🐳 Building and pushing Docker image..."
docker buildx build \\
  --platform linux/amd64 \\
  --tag "\${IMAGE}" \\
  --tag "\${AR_REPO}/\${SERVICE_NAME}:latest" \\
  --push \\
  .

echo "🚀 Deploying to Cloud Run..."
gcloud run services replace service.yaml \\
  --region="\${REGION}" \\
  --project="\${PROJECT_ID}"

# Or use gcloud run deploy:
# gcloud run deploy "\${SERVICE_NAME}" \\
#   --image="\${IMAGE}" \\
#   --region="\${REGION}" \\
#   --project="\${PROJECT_ID}" \\
#   --platform=managed \\
#   --allow-unauthenticated \\
#   --port=${port} \\
#   --memory=512Mi \\
#   --cpu=1 \\
#   --min-instances=1 \\
#   --max-instances=10 \\
#   --set-env-vars="NODE_ENV=production,PORT=${port}"

echo "🎉 Deployment complete!"
echo "URL: \$(gcloud run services describe \${SERVICE_NAME} --region=\${REGION} --project=\${PROJECT_ID} --format='value(status.url)')"
`;
}
