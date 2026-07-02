import type { TfCloud } from "./terraform-generator";

export type { TfCloud };
export type CiProvider = "github-actions" | "gitlab-ci" | "azure-devops" | "jenkins" | "circleci" | "bamboo" | "bitbucket" | "travis-ci" | "drone-ci" | "teamcity";

export interface AppProfile {
  appName: string;
  namespace: string;
  runtime: string;
  framework: string;
  appType: string;
  port: number;
  replicas: number;
  cpuRequest: string;
  cpuLimit: string;
  memRequest: string;
  memLimit: string;
  healthPath: string;
  helmEnabled: boolean;
}

export const DEFAULT_APP_PROFILE: AppProfile = {
  appName: "myapp",
  namespace: "production",
  runtime: "nodejs-20",
  framework: "express",
  appType: "rest-api",
  port: 3000,
  replicas: 2,
  cpuRequest: "250m",
  cpuLimit: "500m",
  memRequest: "256Mi",
  memLimit: "512Mi",
  healthPath: "/health",
  helmEnabled: false,
};

export interface DeploymentSvcConfig {
  dbEngine: string;
  dbVersion: string;
  cacheEngine: string;
  cacheNodeType: string;
  objectStorageGb: number;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateDeploymentFiles(
  cloud: TfCloud,
  region: string,
  selected: string[],
  svc: DeploymentSvcConfig,
  app: AppProfile,
): Record<string, string> {
  const files: Record<string, string> = {};
  const sel = new Set(selected);

  const hasLb      = sel.has("app-load-balancer") || sel.has("load-balancer");
  const hasMonitor = sel.has("monitoring-logging");

  const registryUrl = getRegistryUrl(cloud, region, app.appName);
  const clusterName = `${app.appName}-cluster`;

  files["Dockerfile"]        = generateDockerfile(app);
  files[".dockerignore"]     = generateDockerignore(app.runtime);
  files["k8s/namespace.yaml"]  = generateNamespace(app);
  files["k8s/configmap.yaml"]  = generateConfigmap(cloud, region, app, svc, selected);
  files["k8s/secret.yaml"]     = generateSecret(cloud, app, svc, selected);
  files["k8s/deployment.yaml"] = generateDeployment(cloud, registryUrl, app);
  files["k8s/service.yaml"]    = generateService(app);
  if (hasLb)      files["k8s/ingress.yaml"]        = generateIngress(cloud, app);
  if (hasMonitor) files["k8s/hpa.yaml"]            = generateHpa(app);
  if (hasMonitor) files["k8s/servicemonitor.yaml"] = generateServiceMonitor(app);

  // Docker Compose + Podman
  files["docker-compose.yml"]   = generateDockerCompose(app);
  files["podman-compose.yml"]   = generatePodmanCompose(app);
  files["podman-run.sh"]        = generatePodmanRunScript(app);
  files["pod.yaml"]             = generatePodmanKube(app);

  // CI/CD — all providers always generated
  files[".github/workflows/deploy.yml"] = generateGithubActions(cloud, region, registryUrl, clusterName, app);
  files[".gitlab-ci.yml"]               = generateGitlabCI(cloud, region, registryUrl, clusterName, app);
  files["azure-pipelines.yml"]          = generateAzureDevOps(cloud, region, registryUrl, clusterName, app);
  files["Jenkinsfile"]                   = generateJenkins(registryUrl, clusterName, app);
  files[".circleci/config.yml"]          = generateCircleCI(registryUrl, clusterName, app);
  files["bamboo-specs/bamboo.yaml"]      = generateBamboo(registryUrl, clusterName, app);
  files["bitbucket-pipelines.yml"]       = generateBitbucket(cloud, region, registryUrl, clusterName, app);
  files[".travis.yml"]                   = generateTravisCI(registryUrl, clusterName, app);
  files[".drone.yml"]                    = generateDroneCI(registryUrl, clusterName, app);
  files[".teamcity/settings.kts"]        = generateTeamCity(registryUrl, clusterName, app);

  files["deploy.sh"] = generateDeployScript(cloud, region, clusterName, app);

  // EKS deployment commands cheatsheet
  if (cloud === "eks") {
    files["eks-commands.md"] = generateEksCommands(region, registryUrl, clusterName, app);
  }

  if (app.helmEnabled) {
    files["helm/Chart.yaml"]               = generateHelmChart(app);
    files["helm/values.yaml"]              = generateHelmValues(cloud, registryUrl, app, svc, selected);
    files["helm/templates/_helpers.tpl"]   = generateHelmHelpers(app);
    files["helm/templates/deployment.yaml"] = `{{- include "${app.appName}.deployment" . }}\n`;
    files["helm/templates/service.yaml"]   = `{{- include "${app.appName}.service" . }}\n`;
    if (hasLb)      files["helm/templates/ingress.yaml"] = generateHelmIngress(cloud, app);
    if (hasMonitor) files["helm/templates/hpa.yaml"]     = generateHelmHpa(app);
  }

  return files;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

function getRegistryUrl(cloud: TfCloud, region: string, appName: string): string {
  if (cloud === "eks") return `\${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com/${appName}`;
  if (cloud === "aks") return `\${REGISTRY_NAME}.azurecr.io/${appName}`;
  return `${region}-docker.pkg.dev/\${GCP_PROJECT_ID}/${appName}-repo/${appName}`;
}

// ─── Dockerfile ───────────────────────────────────────────────────────────────

function generateDockerfile(app: AppProfile): string {
  switch (app.runtime) {
    case "python-312": return dockerfilePython(app);
    case "java-21":    return dockerfileJava(app);
    case "go-122":     return dockerfileGo(app);
    case "dotnet-8":   return dockerfileDotnet(app);
    case "php-83":     return dockerfilePhp(app);
    case "ruby-33":    return dockerfileRuby(app);
    default:           return dockerfileNode(app);
  }
}

function dockerfileNode(app: AppProfile): string {
  const buildLine = (app.framework === "nextjs" || app.appType === "frontend-spa")
    ? "RUN npm run build\n" : "";
  const copyDist = app.framework === "nextjs"
    ? "COPY --from=builder /app/.next ./.next\nCOPY --from=builder /app/public ./public\n"
    : "COPY --from=builder /app/dist ./dist\n";
  const cmd = app.framework === "nextjs"
    ? `CMD ["node", "server.js"]`
    : `CMD ["node", "dist/index.js"]`;
  return `# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
${buildLine}
# ── Stage 2: Production ────────────────────────────────────────────
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
${copyDist}EXPOSE ${app.port}
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget -qO- http://localhost:${app.port}${app.healthPath} || exit 1
USER app
${cmd}
`;
}

function dockerfilePython(app: AppProfile): string {
  const cmd = app.framework === "fastapi"
    ? `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${app.port}", "--workers", "4"]`
    : app.framework === "django"
    ? `CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:${app.port}", "--workers", "4"]`
    : `CMD ["python", "app.py"]`;
  return `FROM python:3.12-slim
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=app:app . .
EXPOSE ${app.port}
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \\
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${app.port}${app.healthPath}')" || exit 1
USER app
${cmd}
`;
}

function dockerfileJava(app: AppProfile): string {
  return `# ── Stage 1: Build ────────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Production ────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE ${app.port}
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
  CMD wget -qO- http://localhost:${app.port}${app.healthPath} || exit 1
USER app
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
`;
}

function dockerfileGo(app: AppProfile): string {
  return `# ── Stage 1: Build ────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git ca-certificates tzdata
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

# ── Stage 2: Minimal scratch image ────────────────────────────────
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /app/server /server
EXPOSE ${app.port}
ENTRYPOINT ["/server"]
`;
}

function dockerfileDotnet(app: AppProfile): string {
  const proj = app.appName.charAt(0).toUpperCase() + app.appName.slice(1);
  return `# ── Stage 1: Build ────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish --no-restore

# ── Stage 2: Production ────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/publish .
EXPOSE ${app.port}
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \\
  CMD wget -qO- http://localhost:${app.port}${app.healthPath} || exit 1
USER app
ENTRYPOINT ["dotnet", "${proj}.dll"]
`;
}

function dockerfilePhp(app: AppProfile): string {
  return `FROM php:8.3-fpm-alpine
RUN apk add --no-cache nginx supervisor \\
    php83-pdo php83-pdo_pgsql php83-pdo_mysql php83-redis \\
    php83-opcache php83-mbstring php83-json php83-curl
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --chown=app:app . .
RUN composer install --no-dev --optimize-autoloader 2>/dev/null || true
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisord.conf
EXPOSE ${app.port}
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:${app.port}${app.healthPath} || exit 1
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
`;
}

function dockerfileRuby(app: AppProfile): string {
  const cmd = app.framework === "rails"
    ? `CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]`
    : `CMD ["bundle", "exec", "ruby", "app.rb"]`;
  return `FROM ruby:3.3-slim
RUN apt-get update -qq && apt-get install -y build-essential libpq-dev nodejs npm git curl \\
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3 --without development test
COPY --chown=app:app . .
${app.framework === "rails" ? "RUN bundle exec rake assets:precompile RAILS_ENV=production 2>/dev/null || true\n" : ""}EXPOSE ${app.port}
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:${app.port}${app.healthPath} || exit 1
USER app
${cmd}
`;
}

// ─── .dockerignore ────────────────────────────────────────────────────────────

function generateDockerignore(runtime: string): string {
  const common = `.git\n.gitignore\n.env\n.env.*\n*.md\ndocker-compose*.yml\n.DS_Store`;
  const extras: Record<string, string> = {
    "nodejs-20":  `node_modules/\nnpm-debug.log*\ndist/\nbuild/\n.next/\ncoverage/`,
    "python-312": `__pycache__/\n*.pyc\n.venv/\nvenv/\n.pytest_cache/\ndist/\nbuild/`,
    "java-21":    `target/\n*.class\n*.jar\n.gradle/\nbuild/`,
    "go-122":     `bin/\n*.test\nvendor/`,
    "dotnet-8":   `bin/\nobj/\n*.user\n.vs/`,
    "php-83":     `vendor/\nstorage/logs/\nbootstrap/cache/`,
    "ruby-33":    `.bundle/\nlog/\ntmp/\ncoverage/`,
  };
  return `${common}\n${extras[runtime] ?? ""}`;
}

// ─── Kubernetes manifests ─────────────────────────────────────────────────────

function generateNamespace(app: AppProfile): string {
  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${app.namespace}
  labels:
    app: ${app.appName}
`;
}

function generateConfigmap(
  cloud: TfCloud,
  region: string,
  app: AppProfile,
  svc: DeploymentSvcConfig,
  selected: string[],
): string {
  const sel = new Set(selected);
  const lines: string[] = [
    `  APP_NAME: "${app.appName}"`,
    `  APP_ENV: "production"`,
    `  PORT: "${app.port}"`,
    `  LOG_LEVEL: "info"`,
    `  CLOUD_PROVIDER: "${cloud === "eks" ? "aws" : cloud === "aks" ? "azure" : "gcp"}"`,
    `  REGION: "${region}"`,
  ];

  if (sel.has("managed-database")) {
    const host = getDbHost(cloud, app.appName);
    const port = getDbPort(svc.dbEngine);
    lines.push(`  DB_HOST: "${host}"`);
    lines.push(`  DB_PORT: "${port}"`);
    lines.push(`  DB_NAME: "${app.appName}_db"`);
    lines.push(`  DATABASE_URL: "${getDbUrl(cloud, svc.dbEngine, app.appName)}"`);
  }

  if (sel.has("cache")) {
    const host = getCacheHost(cloud, app.appName);
    lines.push(`  REDIS_HOST: "${host}"`);
    lines.push(`  REDIS_PORT: "6379"`);
    lines.push(`  REDIS_URL: "redis://${host}:6379"`);
  }

  if (sel.has("object-storage")) {
    lines.push(`  STORAGE_BUCKET: "${app.appName}-${cloud === "eks" ? "s3" : cloud === "aks" ? "blob" : "gcs"}-bucket"`);
    lines.push(`  STORAGE_REGION: "${region}"`);
  }

  if (sel.has("message-queue")) {
    lines.push(`  QUEUE_URL: "${getQueueUrl(cloud, region, app.appName)}"`);
  }

  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${app.appName}-config
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
data:
${lines.join("\n")}
`;
}

function generateSecret(
  cloud: TfCloud,
  app: AppProfile,
  svc: DeploymentSvcConfig,
  selected: string[],
): string {
  const sel = new Set(selected);
  const lines: string[] = [];

  if (sel.has("managed-database")) {
    lines.push(`  DB_USERNAME: <base64>  # echo -n 'admin' | base64`);
    lines.push(`  DB_PASSWORD: <base64>  # echo -n 'yourpassword' | base64`);
  }

  if (sel.has("cache") && svc.cacheEngine.toLowerCase().includes("redis")) {
    lines.push(`  REDIS_AUTH_TOKEN: <base64>`);
  }

  lines.push(`  JWT_SECRET: <base64>`);
  lines.push(`  API_KEY: <base64>`);

  const credNote = cloud === "eks"
    ? `  # AWS: use IRSA (IAM Roles for Service Accounts) — no static credentials needed`
    : cloud === "aks"
    ? `  # Azure: use Workload Identity / Managed Identity — no static credentials needed`
    : `  # GCP: use Workload Identity Federation — no static credentials needed`;
  lines.push(credNote);

  return `apiVersion: v1
kind: Secret
metadata:
  name: ${app.appName}-secrets
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
type: Opaque
data:
${lines.join("\n")}
# ⚠ Replace all <base64> placeholders before applying.
# Generate: echo -n 'value' | base64
# Recommended: use Sealed Secrets or External Secrets Operator for GitOps.
`;
}

function generateDeployment(
  cloud: TfCloud,
  registryUrl: string,
  app: AppProfile,
): string {
  const saAnnotation = cloud === "eks"
    ? `    eks.amazonaws.com/role-arn: arn:aws:iam::\${AWS_ACCOUNT_ID}:role/${app.appName}-sa-role`
    : cloud === "aks"
    ? `    azure.workload.identity/client-id: \${AZURE_CLIENT_ID}`
    : `    iam.gke.io/gcp-service-account: ${app.appName}-sa@\${GCP_PROJECT_ID}.iam.gserviceaccount.com`;

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${app.appName}
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
spec:
  replicas: ${app.replicas}
  selector:
    matchLabels:
      app: ${app.appName}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: ${app.appName}
    spec:
      serviceAccountName: ${app.appName}-sa
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - name: ${app.appName}
          image: ${registryUrl}:latest
          imagePullPolicy: Always
          ports:
            - containerPort: ${app.port}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: ${app.appName}-config
            - secretRef:
                name: ${app.appName}-secrets
          resources:
            requests:
              cpu: "${app.cpuRequest}"
              memory: "${app.memRequest}"
            limits:
              cpu: "${app.cpuLimit}"
              memory: "${app.memLimit}"
          livenessProbe:
            httpGet:
              path: ${app.healthPath}
              port: ${app.port}
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: ${app.healthPath}
              port: ${app.port}
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 5"]
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: ${app.appName}
                topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${app.appName}-sa
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
  annotations:
${saAnnotation}
`;
}

function generateService(app: AppProfile): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${app.appName}-svc
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
spec:
  type: ClusterIP
  selector:
    app: ${app.appName}
  ports:
    - name: http
      port: 80
      targetPort: ${app.port}
      protocol: TCP
`;
}

function generateIngress(cloud: TfCloud, app: AppProfile): string {
  const cls = cloud === "eks" ? "alb" : cloud === "aks" ? "azure-application-gateway" : "gce";
  const annotations = getIngressAnnotations(cloud, app);
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${app.appName}-ingress
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
  annotations:
${annotations}spec:
  ingressClassName: ${cls}
  rules:
    - host: ${app.appName}.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${app.appName}-svc
                port:
                  number: 80
  tls:
    - hosts:
        - ${app.appName}.yourdomain.com
      secretName: ${app.appName}-tls
`;
}

function generateHpa(app: AppProfile): string {
  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${app.appName}-hpa
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${app.appName}
  minReplicas: ${app.replicas}
  maxReplicas: ${Math.max(app.replicas * 3, 10)}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
`;
}

function generateServiceMonitor(app: AppProfile): string {
  return `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${app.appName}-monitor
  namespace: ${app.namespace}
  labels:
    app: ${app.appName}
    release: prometheus
spec:
  selector:
    matchLabels:
      app: ${app.appName}
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
`;
}

// ─── GitHub Actions ───────────────────────────────────────────────────────────

function generateGithubActions(
  cloud: TfCloud,
  region: string,
  registryUrl: string,
  clusterName: string,
  app: AppProfile,
): string {
  const cloudEnv = cloud === "eks"
    ? `  AWS_REGION: ${region}`
    : cloud === "aks"
    ? `  AKS_RESOURCE_GROUP: ${app.appName}-rg`
    : `  GCP_REGION: ${region}`;

  const loginStep = cloud === "eks" ? `
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${region}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v2` : cloud === "aks" ? `
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Login to ACR
        run: az acr login --name \${{ secrets.REGISTRY_NAME }}` : `
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${registryUrl.split("/")[0]} --quiet`;

  const kubeconfigStep = cloud === "eks" ? `
      - name: Configure kubectl
        run: aws eks update-kubeconfig --region ${region} --name ${clusterName}` : cloud === "aks" ? `
      - name: Configure kubectl
        run: az aks get-credentials --resource-group \${{ env.AKS_RESOURCE_GROUP }} --name ${clusterName}` : `
      - name: Configure kubectl
        uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: ${clusterName}
          location: ${region}`;

  return `name: CI/CD — ${app.appName}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  IMAGE: ${registryUrl}
  NAMESPACE: ${app.namespace}
${cloudEnv}

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: echo "Add your test commands here"

  build-push:
    name: Build & Push
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
${loginStep}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            \${{ env.IMAGE }}:latest
            \${{ env.IMAGE }}:sha-\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: build-push
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
${kubeconfigStep}
      - name: Update image
        run: |
          kubectl set image deployment/${app.appName} \\
            ${app.appName}=\${{ env.IMAGE }}:sha-\${{ github.sha }} \\
            -n \${{ env.NAMESPACE }}
      - name: Verify rollout
        run: kubectl rollout status deployment/${app.appName} -n \${{ env.NAMESPACE }} --timeout=120s
`;
}

// ─── GitLab CI ────────────────────────────────────────────────────────────────

function generateGitlabCI(
  cloud: TfCloud,
  region: string,
  registryUrl: string,
  clusterName: string,
  app: AppProfile,
): string {
  const loginCmd = cloud === "eks"
    ? `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registryUrl.split("/")[0]}`
    : cloud === "aks"
    ? `docker login $REGISTRY_NAME.azurecr.io -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET`
    : `echo $GCP_SA_KEY | docker login -u _json_key --password-stdin https://${registryUrl.split("/")[0]}`;

  const kubeconfigCmd = cloud === "eks"
    ? `aws eks update-kubeconfig --region ${region} --name ${clusterName}`
    : cloud === "aks"
    ? `az aks get-credentials --resource-group $AZURE_RG --name ${clusterName}`
    : `gcloud container clusters get-credentials ${clusterName} --region ${region} --project $GCP_PROJECT_ID`;

  return `stages:
  - test
  - build
  - deploy

variables:
  IMAGE: ${registryUrl}
  NAMESPACE: ${app.namespace}
  DOCKER_BUILDKIT: "1"

test:
  stage: test
  script:
    - echo "Add test commands here"

build:
  stage: build
  image: docker:24
  services: [docker:24-dind]
  script:
    - ${loginCmd}
    - docker build -t $IMAGE:$CI_COMMIT_SHORT_SHA -t $IMAGE:latest .
    - docker push $IMAGE:$CI_COMMIT_SHORT_SHA
    - docker push $IMAGE:latest
  only: [main]

deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - ${kubeconfigCmd}
    - kubectl set image deployment/${app.appName} ${app.appName}=$IMAGE:$CI_COMMIT_SHORT_SHA -n $NAMESPACE
    - kubectl rollout status deployment/${app.appName} -n $NAMESPACE --timeout=120s
  environment:
    name: production
  only: [main]
`;
}

// ─── Azure DevOps ─────────────────────────────────────────────────────────────

function generateAzureDevOps(
  _cloud: TfCloud,
  _region: string,
  _registryUrl: string,
  _clusterName: string,
  app: AppProfile,
): string {
  return `trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

variables:
  APP_NAME: ${app.appName}
  NAMESPACE: ${app.namespace}

stages:
  - stage: Test
    jobs:
      - job: RunTests
        steps:
          - script: echo "Add test commands here"

  - stage: BuildPush
    dependsOn: Test
    jobs:
      - job: Build
        steps:
          - task: Docker@2
            inputs:
              command: buildAndPush
              containerRegistry: $(CONTAINER_REGISTRY_SERVICE_CONNECTION)
              repository: $(APP_NAME)
              dockerfile: Dockerfile
              tags: |
                $(Build.BuildId)
                latest

  - stage: Deploy
    dependsOn: BuildPush
    jobs:
      - deployment: DeployToK8s
        environment: production
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@1
                  inputs:
                    action: deploy
                    kubernetesServiceConnection: $(KUBERNETES_SERVICE_CONNECTION)
                    namespace: $(NAMESPACE)
                    manifests: k8s/*.yaml
                    containers: $(IMAGE):$(Build.BuildId)
`;
}

// ─── deploy.sh ────────────────────────────────────────────────────────────────

function generateDeployScript(
  cloud: TfCloud,
  region: string,
  clusterName: string,
  app: AppProfile,
): string {
  const registryUrl = getRegistryUrl(cloud, region, app.appName);

  const kubeCmd = cloud === "eks"
    ? `aws eks update-kubeconfig --region ${region} --name ${clusterName}`
    : cloud === "aks"
    ? `az aks get-credentials --resource-group ${app.appName}-rg --name ${clusterName} --overwrite-existing`
    : `gcloud container clusters get-credentials ${clusterName} --region ${region} --project "\${GCP_PROJECT_ID}"`;

  const loginCmd = cloud === "eks"
    ? `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin "\${AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com"`
    : cloud === "aks"
    ? `az acr login --name "\${REGISTRY_NAME}"`
    : `gcloud auth configure-docker ${region}-docker.pkg.dev --quiet`;

  const prereq = cloud === "eks" ? "aws" : cloud === "aks" ? "az" : "gcloud";

  return `#!/usr/bin/env bash
# deploy.sh — one-shot deploy for ${app.appName} → ${cloud === "eks" ? "AWS EKS" : cloud === "aks" ? "Azure AKS" : "GCP GKE"}
# Usage: ./deploy.sh [image-tag]
set -euo pipefail

APP="${app.appName}"
NAMESPACE="${app.namespace}"
CLUSTER="${clusterName}"
IMAGE_TAG="\${1:-latest}"
REGISTRY="${registryUrl}"

log() { echo "$(date +%H:%M:%S) [INFO] $*"; }
err() { echo "$(date +%H:%M:%S) [ERROR] $*" >&2; exit 1; }

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
log "Checking prerequisites…"
command -v kubectl >/dev/null || err "kubectl not found — install from https://kubernetes.io/docs/tasks/tools/"
command -v docker  >/dev/null || err "docker not found"
command -v ${prereq}     >/dev/null || err "${prereq} CLI not found"

# ── 2. Configure kubectl ──────────────────────────────────────────────────────
log "Configuring kubectl for: \$CLUSTER"
${kubeCmd}

# ── 3. Build & push ───────────────────────────────────────────────────────────
log "Logging into registry…"
${loginCmd}

log "Building image: \$REGISTRY:\$IMAGE_TAG"
docker build -t "\$REGISTRY:\$IMAGE_TAG" .

log "Pushing image…"
docker push "\$REGISTRY:\$IMAGE_TAG"

# ── 4. Apply manifests ────────────────────────────────────────────────────────
log "Applying Kubernetes manifests…"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
[ -f k8s/ingress.yaml ]        && kubectl apply -f k8s/ingress.yaml
[ -f k8s/hpa.yaml ]            && kubectl apply -f k8s/hpa.yaml
[ -f k8s/servicemonitor.yaml ] && kubectl apply -f k8s/servicemonitor.yaml 2>/dev/null || true

# Secrets: apply only if placeholders are replaced
if grep -q "<base64>" k8s/secret.yaml; then
  log "⚠ k8s/secret.yaml still has <base64> placeholders — skipping. Fill them first!"
else
  kubectl apply -f k8s/secret.yaml
fi

# ── 5. Update image & wait ────────────────────────────────────────────────────
log "Setting image to tag: \$IMAGE_TAG"
kubectl set image deployment/"\$APP" "\$APP=\$REGISTRY:\$IMAGE_TAG" -n "\$NAMESPACE"

log "Waiting for rollout…"
kubectl rollout status deployment/"\$APP" -n "\$NAMESPACE" --timeout=180s

# ── 6. Summary ────────────────────────────────────────────────────────────────
log "Pods:"
kubectl get pods -n "\$NAMESPACE" -l "app=\$APP" --no-headers

ENDPOINT=\$(kubectl get svc "\${APP}-svc" -n "\$NAMESPACE" \\
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")

log "Done ✓  → http://\$ENDPOINT"
`;
}

// ─── Helm ─────────────────────────────────────────────────────────────────────

function generateHelmChart(app: AppProfile): string {
  return `apiVersion: v2
name: ${app.appName}
description: Helm chart for ${app.appName}
type: application
version: 0.1.0
appVersion: "1.0.0"
`;
}

function generateHelmValues(
  cloud: TfCloud,
  registryUrl: string,
  app: AppProfile,
  _svc: DeploymentSvcConfig,
  selected: string[],
): string {
  const sel = new Set(selected);
  const hasLb = sel.has("app-load-balancer") || sel.has("load-balancer");
  const hasMonitor = sel.has("monitoring-logging");
  const cls = cloud === "eks" ? "alb" : cloud === "aks" ? "azure-application-gateway" : "gce";

  return `replicaCount: ${app.replicas}

image:
  repository: ${registryUrl}
  tag: "latest"
  pullPolicy: Always

service:
  type: ClusterIP
  port: 80
  targetPort: ${app.port}

ingress:
  enabled: ${hasLb}
  className: "${cls}"
  host: ${app.appName}.yourdomain.com
  tls: true

resources:
  requests:
    cpu: "${app.cpuRequest}"
    memory: "${app.memRequest}"
  limits:
    cpu: "${app.cpuLimit}"
    memory: "${app.memLimit}"

autoscaling:
  enabled: ${hasMonitor}
  minReplicas: ${app.replicas}
  maxReplicas: ${Math.max(app.replicas * 3, 10)}
  targetCPUUtilizationPercentage: 70

healthCheck:
  path: ${app.healthPath}
  port: ${app.port}

namespace: ${app.namespace}

env:
  APP_ENV: production
  PORT: "${app.port}"
${sel.has("managed-database") ? `  DB_HOST: "${getDbHost(cloud, app.appName)}"\n  DB_NAME: "${app.appName}_db"` : ""}
${sel.has("cache") ? `  REDIS_HOST: "${getCacheHost(cloud, app.appName)}"` : ""}

secrets:
  DB_PASSWORD: ""
  JWT_SECRET: ""
  API_KEY: ""
`;
}

function generateHelmHelpers(app: AppProfile): string {
  const n = app.appName;
  return `{{- define "${n}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "${n}.fullname" -}}
{{- .Values.fullnameOverride | default .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "${n}.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "${n}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "${n}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${n}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "${n}.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${n}.fullname" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "${n}.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "${n}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "${n}.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.targetPort }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: {{ .Values.healthCheck.path }}
              port: {{ .Values.healthCheck.port }}
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet:
              path: {{ .Values.healthCheck.path }}
              port: {{ .Values.healthCheck.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
{{- end }}

{{- define "${n}.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "${n}.fullname" . }}-svc
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "${n}.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
  selector:
    {{- include "${n}.selectorLabels" . | nindent 4 }}
{{- end }}
`;
}

function generateHelmIngress(cloud: TfCloud, app: AppProfile): string {
  const annotations = getIngressAnnotations(cloud, app);
  return `{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "${app.appName}.fullname" . }}-ingress
  namespace: {{ .Values.namespace }}
  annotations:
${annotations}spec:
  ingressClassName: {{ .Values.ingress.className }}
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "${app.appName}.fullname" . }}-svc
                port:
                  number: {{ .Values.service.port }}
  {{- if .Values.ingress.tls }}
  tls:
    - hosts: [{{ .Values.ingress.host }}]
      secretName: {{ include "${app.appName}.fullname" . }}-tls
  {{- end }}
{{- end }}
`;
}

function generateHelmHpa(app: AppProfile): string {
  return `{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "${app.appName}.fullname" . }}-hpa
  namespace: {{ .Values.namespace }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "${app.appName}.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
{{- end }}
`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getDbHost(cloud: TfCloud, appName: string): string {
  if (cloud === "eks") return `${appName}-db.cluster-xxxxxxxx.${appName}.rds.amazonaws.com`;
  if (cloud === "aks") return `${appName}-db.postgres.database.azure.com`;
  return `${appName}-db:5432`;
}

function getDbPort(engine: string): string {
  const e = engine.toLowerCase();
  if (e.includes("mysql") || e.includes("aurora-mysql")) return "3306";
  if (e.includes("mssql") || e.includes("sql server"))  return "1433";
  if (e.includes("oracle"))                              return "1521";
  return "5432";
}

function getDbUrl(cloud: TfCloud, engine: string, appName: string): string {
  const host = getDbHost(cloud, appName);
  const port = getDbPort(engine);
  const e = engine.toLowerCase();
  const proto = (e.includes("mysql") || e.includes("aurora-mysql")) ? "mysql" : "postgresql";
  return `${proto}://$(DB_USERNAME):$(DB_PASSWORD)@${host}:${port}/${appName}_db`;
}

function getCacheHost(cloud: TfCloud, appName: string): string {
  if (cloud === "eks") return `${appName}-cache.xxxxxx.0001.use1.cache.amazonaws.com`;
  if (cloud === "aks") return `${appName}-cache.redis.cache.windows.net`;
  return `${appName}-cache.redis.${appName}.cloudredis.googleapis.com`;
}

function getQueueUrl(cloud: TfCloud, region: string, appName: string): string {
  if (cloud === "eks") return `https://sqs.${region}.amazonaws.com/\${AWS_ACCOUNT_ID}/${appName}-queue`;
  if (cloud === "aks") return `https://\${SERVICE_BUS_NAMESPACE}.servicebus.windows.net/${appName}-queue`;
  return `projects/\${GCP_PROJECT_ID}/subscriptions/${appName}-subscription`;
}

function getIngressAnnotations(cloud: TfCloud, app: AppProfile): string {
  if (cloud === "eks") return `    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443},{"HTTP":80}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/healthcheck-path: ${app.healthPath}
`;
  if (cloud === "aks") return `    kubernetes.io/ingress.class: azure/application-gateway
    appgw.ingress.kubernetes.io/ssl-redirect: "true"
    appgw.ingress.kubernetes.io/health-probe-path: ${app.healthPath}
`;
  return `    kubernetes.io/ingress.class: gce
    kubernetes.io/ingress.global-static-ip-name: ${app.appName}-ip
    networking.gke.io/managed-certificates: ${app.appName}-ssl-cert
`;
}

// ─── Docker Compose ───────────────────────────────────────────────────────────

function generateDockerCompose(app: AppProfile): string {
  const slug = app.appName.replace(/-/g, "_");
  const needsDb = ["nodejs-20","python-312","java-21","ruby-33","php-83"].includes(app.runtime);

  const dbService = needsDb ? `
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${slug}_db
      POSTGRES_USER: ${slug}_user
      POSTGRES_PASSWORD: changeme_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${slug}_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"` : "";

  const dependsOn = needsDb ? `    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy` : "";

  const volumes = needsDb ? `\nvolumes:\n  postgres_data:\n  redis_data:` : "";

  return `# Docker Compose — ${app.appName}
# Usage:
#   docker compose up -d        # start all services
#   docker compose logs -f app  # stream logs
#   docker compose down -v      # stop + remove volumes

version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${app.port}:${app.port}"
    environment:
      NODE_ENV: production
      PORT: "${app.port}"${needsDb ? `
      DATABASE_URL: "postgresql://${slug}_user:changeme_password@postgres:5432/${slug}_db"
      REDIS_URL: "redis://redis:6379"` : ""}
    env_file: [ .env ]
${dependsOn}
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:${app.port}${app.healthPath} || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: ${app.memLimit}
          cpus: "0.5"${dbService}${volumes}

networks:
  default:
    driver: bridge
`;
}

// ─── Podman ───────────────────────────────────────────────────────────────────

function generatePodmanCompose(app: AppProfile): string {
  const slug = app.appName.replace(/-/g, "_");
  const needsDb = ["nodejs-20","python-312","java-21","ruby-33","php-83"].includes(app.runtime);

  const dbService = needsDb ? `
  postgres:
    image: docker.io/postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${slug}_db
      POSTGRES_USER: ${slug}_user
      POSTGRES_PASSWORD: changeme_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: docker.io/redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"` : "";

  const dependsOn = needsDb ? `    depends_on:\n      - postgres\n      - redis` : "";
  const volumes   = needsDb ? `\nvolumes:\n  postgres_data:\n  redis_data:` : "";

  return `# Podman Compose — ${app.appName}
# Requires: podman-compose  (pip install podman-compose)
# Usage:
#   podman-compose up -d
#   podman-compose logs -f app
#   podman-compose down

version: "3.9"

services:
  app:
    image: localhost/${app.appName}:latest
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${app.port}:${app.port}"
    environment:
      NODE_ENV: production
      PORT: "${app.port}"${needsDb ? `
      DATABASE_URL: "postgresql://${slug}_user:changeme_password@localhost:5432/${slug}_db"
      REDIS_URL: "redis://localhost:6379"` : ""}
    env_file: [ .env ]
${dependsOn}
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:${app.port}${app.healthPath} || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s${dbService}${volumes}
`;
}

function generatePodmanKube(app: AppProfile): string {
  const slug = app.appName.replace(/-/g, "_");
  return `# Kubernetes-compatible Pod spec — run with: podman play kube pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: ${app.appName}
  labels:
    app: ${app.appName}
spec:
  restartPolicy: Always
  containers:
    - name: app
      image: localhost/${app.appName}:latest
      imagePullPolicy: Never
      ports:
        - containerPort: ${app.port}
          hostPort: ${app.port}
      env:
        - { name: NODE_ENV,  value: "production" }
        - { name: PORT,      value: "${app.port}" }
        - { name: DB_NAME,   value: "${slug}_db" }
      resources:
        requests: { memory: "${app.memRequest}", cpu: "${app.cpuRequest}" }
        limits:   { memory: "${app.memLimit}",   cpu: "${app.cpuLimit}" }
      readinessProbe:
        httpGet: { path: ${app.healthPath}, port: ${app.port} }
        initialDelaySeconds: 5
        periodSeconds: 5
      livenessProbe:
        httpGet: { path: ${app.healthPath}, port: ${app.port} }
        initialDelaySeconds: 30
        periodSeconds: 10
`;
}

function generatePodmanRunScript(app: AppProfile): string {
  return `#!/usr/bin/env bash
# podman-run.sh — Build and run ${app.appName} with Podman (rootless)
set -euo pipefail

IMAGE="localhost/${app.appName}:latest"
PORT="${app.port}"

podman build --pull --layers --tag "\$IMAGE" .
podman stop "${app.appName}" 2>/dev/null || true
podman rm   "${app.appName}" 2>/dev/null || true

podman run -d \\
  --name "${app.appName}" \\
  --restart unless-stopped \\
  --publish "\$PORT:\$PORT" \\
  --env NODE_ENV=production \\
  --env PORT="\$PORT" \\
  --env-file .env \\
  --memory ${app.memLimit} \\
  "\$IMAGE"

echo "✓ Running at http://localhost:\$PORT"
`;
}

// ─── Jenkins ──────────────────────────────────────────────────────────────────

function generateJenkins(registryUrl: string, clusterName: string, app: AppProfile): string {
  return `// Jenkinsfile — ${app.appName}
pipeline {
  agent { label 'docker' }

  environment {
    IMAGE = "${registryUrl}:\${env.BUILD_NUMBER}"
    NAMESPACE = "${app.namespace}"
    CLUSTER  = "${clusterName}"
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Test') {
      steps { sh 'echo "Add your test commands here"' }
    }

    stage('Build & Push') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-creds',
          usernameVariable: 'DOCKER_USER',
          passwordVariable: 'DOCKER_PASS'
        )]) {
          sh """
            docker login -u \${DOCKER_USER} -p \${DOCKER_PASS} ${registryUrl.split("/")[0]}
            docker build -t \${IMAGE} -t ${registryUrl}:latest .
            docker push \${IMAGE}
            docker push ${registryUrl}:latest
          """
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
          sh """
            kubectl -n \${NAMESPACE} set image deployment/${app.appName} ${app.appName}=\${IMAGE}
            kubectl -n \${NAMESPACE} rollout status deployment/${app.appName} --timeout=120s
          """
        }
      }
    }
  }

  post {
    success { echo "✓ Deployed \${IMAGE} to \${NAMESPACE}" }
    failure { echo "✗ Pipeline failed for ${app.appName}" }
  }
}
`;
}

// ─── CircleCI ─────────────────────────────────────────────────────────────────

function generateCircleCI(registryUrl: string, clusterName: string, app: AppProfile): string {
  return `# .circleci/config.yml — ${app.appName}
version: 2.1

orbs:
  docker: circleci/docker@2.6.0

jobs:
  test:
    docker: [{ image: cimg/node:20.11 }]
    steps:
      - checkout
      - run: echo "Add your test commands here"

  build-push:
    machine: { image: ubuntu-2204:current }
    steps:
      - checkout
      - docker/build: { image: ${registryUrl}, tag: "\$CIRCLE_SHA1" }
      - docker/push:  { image: ${registryUrl}, tag: "\$CIRCLE_SHA1" }
      - run:
          name: Tag latest
          command: |
            docker tag ${registryUrl}:\$CIRCLE_SHA1 ${registryUrl}:latest
            docker push ${registryUrl}:latest

  deploy:
    docker: [{ image: bitnami/kubectl:latest }]
    steps:
      - run:
          name: Configure kubectl
          command: echo "\$KUBECONFIG_DATA" | base64 -d > ~/.kube/config
      - run:
          name: Deploy ${app.appName} to ${clusterName}
          command: |
            kubectl -n ${app.namespace} set image deployment/${app.appName} \\
              ${app.appName}=${registryUrl}:\$CIRCLE_SHA1
            kubectl -n ${app.namespace} rollout status deployment/${app.appName} --timeout=120s

workflows:
  ci-cd:
    jobs:
      - test
      - build-push:
          requires: [test]
          filters: { branches: { only: [main] } }
      - deploy:
          requires: [build-push]
          filters: { branches: { only: [main] } }
`;
}

// ─── Bamboo ───────────────────────────────────────────────────────────────────

function generateBamboo(registryUrl: string, _clusterName: string, app: AppProfile): string {
  const planKey = app.appName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "APP";
  return `# bamboo-specs/bamboo.yaml — ${app.appName}
# Requires Bamboo Specs plugin. Commit this file to enable spec scanning.
---
version: 2

plan:
  project-key: OPS
  key: ${planKey}
  name: ${app.appName} CI/CD

stages:
  - Test:
      jobs:
        - Run Tests:
            key: TEST
            tasks:
              - script: { interpreter: SHELL, scripts: ["echo 'Add test commands here'"] }

  - Build:
      jobs:
        - Docker Build:
            key: BUILD
            tasks:
              - script:
                  interpreter: SHELL
                  scripts:
                    - |
                      docker build \\
                        -t ${registryUrl}:\${bamboo.buildNumber} \\
                        -t ${registryUrl}:latest .
                      docker push ${registryUrl}:\${bamboo.buildNumber}
                      docker push ${registryUrl}:latest

  - Deploy:
      jobs:
        - Deploy to ${app.namespace}:
            key: DEPLOY
            tasks:
              - script:
                  interpreter: SHELL
                  scripts:
                    - |
                      kubectl -n ${app.namespace} \\
                        set image deployment/${app.appName} \\
                        ${app.appName}=${registryUrl}:\${bamboo.buildNumber}
                      kubectl -n ${app.namespace} rollout status deployment/${app.appName}

triggers:
  - polling: { period: "* * * * *" }

branches:
  create: for-pull-request
  delete: { after-deleted-days: 1, after-inactive-days: 30 }

# Bamboo variables to set:
# bamboo.REGISTRY_USER, bamboo.REGISTRY_PASS, bamboo.KUBECONFIG_DATA (base64)
`;
}

// ─── Bitbucket Pipelines ──────────────────────────────────────────────────────

function generateBitbucket(cloud: TfCloud, region: string, registryUrl: string, clusterName: string, app: AppProfile): string {
  const kubeCmd = cloud === "eks"
    ? `aws eks update-kubeconfig --region ${region} --name ${clusterName}`
    : cloud === "aks"
    ? `az aks get-credentials --resource-group ${app.appName}-rg --name ${clusterName}`
    : `gcloud container clusters get-credentials ${clusterName} --region ${region} --project $GCP_PROJECT_ID`;

  return `# bitbucket-pipelines.yml — ${app.appName}
image: atlassian/default-image:4

definitions:
  steps:
    - step: &test
        name: Test
        script: [ echo "Add test commands here" ]

    - step: &build-push
        name: Build & Push
        services: [ docker ]
        script:
          - docker build -t ${registryUrl}:\$BITBUCKET_BUILD_NUMBER .
          - docker push ${registryUrl}:\$BITBUCKET_BUILD_NUMBER
          - docker tag  ${registryUrl}:\$BITBUCKET_BUILD_NUMBER ${registryUrl}:latest
          - docker push ${registryUrl}:latest

    - step: &deploy
        name: Deploy to ${app.namespace}
        script:
          - ${kubeCmd}
          - kubectl -n ${app.namespace} set image deployment/${app.appName}
              ${app.appName}=${registryUrl}:\$BITBUCKET_BUILD_NUMBER
          - kubectl -n ${app.namespace} rollout status deployment/${app.appName} --timeout=120s
        deployment: production

pipelines:
  branches:
    main:
      - step: *test
      - step: *build-push
      - step: *deploy

  pull-requests:
    '**':
      - step: *test

# Repository variables to set:
# DOCKER_USERNAME, DOCKER_PASSWORD, KUBECONFIG_DATA (base64)
`;
}

// ─── Travis CI ────────────────────────────────────────────────────────────────

function generateTravisCI(registryUrl: string, clusterName: string, app: AppProfile): string {
  return `# .travis.yml — ${app.appName}
language: minimal
services: [ docker ]

env:
  global:
    - IMAGE="${registryUrl}"
    - NAMESPACE="${app.namespace}"
    - CLUSTER="${clusterName}"

before_install:
  - echo "\$DOCKER_PASSWORD" | docker login -u "\$DOCKER_USERNAME" --password-stdin

install:
  - echo "Add install/test commands here"

script:
  - docker build -t "\$IMAGE:\$TRAVIS_BUILD_NUMBER" .

after_success:
  - |
    if [ "\$TRAVIS_BRANCH" = "main" ] && [ "\$TRAVIS_PULL_REQUEST" = "false" ]; then
      docker push "\$IMAGE:\$TRAVIS_BUILD_NUMBER"
      docker tag  "\$IMAGE:\$TRAVIS_BUILD_NUMBER" "\$IMAGE:latest"
      docker push "\$IMAGE:latest"

      # Deploy — set KUBECONFIG_DATA (base64) in Travis env vars
      echo "\$KUBECONFIG_DATA" | base64 -d > /tmp/kube.conf
      export KUBECONFIG=/tmp/kube.conf
      kubectl -n "\$NAMESPACE" set image deployment/${app.appName} \\
        ${app.appName}="\$IMAGE:\$TRAVIS_BUILD_NUMBER"
      kubectl -n "\$NAMESPACE" rollout status deployment/${app.appName} --timeout=120s
    fi

branches:
  only: [ main ]
`;
}

// ─── Drone CI ─────────────────────────────────────────────────────────────────

function generateDroneCI(registryUrl: string, clusterName: string, app: AppProfile): string {
  return `# .drone.yml — ${app.appName}
kind: pipeline
type: docker
name: default

trigger:
  branch: [ main ]
  event:   [ push, pull_request ]

steps:
  - name: test
    image: node:20-alpine
    commands: [ echo "Add test commands here" ]

  - name: build-push
    image: plugins/docker
    settings:
      repo: ${registryUrl}
      tags:
        - \${DRONE_BUILD_NUMBER}
        - latest
      username:
        from_secret: docker_username
      password:
        from_secret: docker_password
    when:
      branch: [ main ]
      event:   [ push ]

  - name: deploy
    image: bitnami/kubectl:latest
    environment:
      KUBECONFIG_DATA:
        from_secret: kubeconfig_data
    commands:
      - echo "\$KUBECONFIG_DATA" | base64 -d > /tmp/kube.conf
      - export KUBECONFIG=/tmp/kube.conf
      - kubectl -n ${app.namespace} set image deployment/${app.appName}
          ${app.appName}=${registryUrl}:\${DRONE_BUILD_NUMBER}
      - kubectl -n ${app.namespace} rollout status deployment/${app.appName} --timeout=120s
    when:
      branch: [ main ]
      event:   [ push ]

# Drone secrets: docker_username, docker_password, kubeconfig_data (base64)
# Cluster: ${clusterName}
`;
}

// ─── TeamCity ─────────────────────────────────────────────────────────────────

function generateTeamCity(registryUrl: string, clusterName: string, app: AppProfile): string {
  return `// .teamcity/settings.kts — ${app.appName}
// TeamCity Kotlin DSL config
// Docs: https://www.jetbrains.com/help/teamcity/kotlin-dsl.html

import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildSteps.script
import jetbrains.buildServer.configs.kotlin.triggers.vcs

version = "2024.03"

project {
  buildType(Test)
  buildType(BuildPush)
  buildType(Deploy)
}

object Test : BuildType({
  name = "Test"
  vcs { root(DslContext.settingsRoot) }
  steps {
    script { scriptContent = "echo 'Add test commands here'" }
  }
  triggers { vcs { branchFilter = "+:main" } }
})

object BuildPush : BuildType({
  name = "Build & Push"
  dependencies { snapshot(Test) {} }
  steps {
    script {
      scriptContent = """
        docker build -t ${registryUrl}:%build.number% .
        docker push ${registryUrl}:%build.number%
        docker tag  ${registryUrl}:%build.number% ${registryUrl}:latest
        docker push ${registryUrl}:latest
      """.trimIndent()
    }
  }
})

object Deploy : BuildType({
  name = "Deploy to ${app.namespace}"
  dependencies { snapshot(BuildPush) {} }
  steps {
    script {
      scriptContent = """
        echo "%kubeconfig_data%" | base64 -d > /tmp/kube.conf
        export KUBECONFIG=/tmp/kube.conf
        kubectl -n ${app.namespace} set image deployment/${app.appName} \\
          ${app.appName}=${registryUrl}:%build.number%
        kubectl -n ${app.namespace} rollout status deployment/${app.appName} --timeout=120s
      """.trimIndent()
    }
  }
})
// Parameters: kubeconfig_data (base64), docker.username, docker.password
// Cluster: ${clusterName}, Namespace: ${app.namespace}
`;
}

// ─── EKS Deployment Commands ──────────────────────────────────────────────────

function generateEksCommands(
  region: string,
  registryUrl: string,
  clusterName: string,
  app: AppProfile,
): string {
  return `# ════════════════════════════════════════════════════════════════════════════════
#  EKS Deployment Commands — ${app.appName}
#  Cluster : ${clusterName}   |   Region: ${region}   |   Namespace: ${app.namespace}
#  Run each section in order. Prerequisites: aws-cli v2, eksctl, kubectl, docker
# ════════════════════════════════════════════════════════════════════════════════


# ── SECTION 1 · Prerequisites ─────────────────────────────────────────────────

# Verify tools
aws --version
eksctl version
kubectl version --client
docker version --format '{{.Client.Version}}'

# Configure AWS credentials (if not already done)
aws configure
#   AWS Access Key ID    : <your-key-id>
#   AWS Secret Access Key: <your-secret>
#   Default region       : ${region}
#   Default output format: json

# Verify identity
aws sts get-caller-identity


# ── SECTION 2 · Create EKS Cluster ───────────────────────────────────────────
#  Skip this section if the cluster already exists.

# Option A — Quick one-liner
eksctl create cluster \\
  --name ${clusterName} \\
  --region ${region} \\
  --nodegroup-name workers \\
  --node-type t3.medium \\
  --nodes 3 \\
  --nodes-min 2 \\
  --nodes-max 6 \\
  --managed \\
  --with-oidc

# Option B — From the generated eksctl config file (more control)
eksctl create cluster -f eksctl-cluster.yaml

# Check cluster status
eksctl get cluster --name ${clusterName} --region ${region}


# ── SECTION 3 · Configure kubectl ─────────────────────────────────────────────

aws eks update-kubeconfig \\
  --name ${clusterName} \\
  --region ${region}

# Verify connection
kubectl cluster-info
kubectl get nodes


# ── SECTION 4 · Create ECR Repository ────────────────────────────────────────

export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPO="${registryUrl}"

# Create repo (idempotent)
aws ecr describe-repositories --repository-names ${app.appName} --region ${region} 2>/dev/null || \\
  aws ecr create-repository \\
    --repository-name ${app.appName} \\
    --region ${region} \\
    --image-scanning-configuration scanOnPush=true

echo "ECR repo: $ECR_REPO"


# ── SECTION 5 · Build & Push Docker Image ────────────────────────────────────

export IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
export IMAGE="$ECR_REPO:$IMAGE_TAG"

# Login to ECR
aws ecr get-login-password --region ${region} | \\
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.${region}.amazonaws.com"

# Build
docker build --pull -t "$IMAGE" -t "$ECR_REPO:latest" .

# Scan for vulnerabilities (optional — requires trivy)
# trivy image --severity HIGH,CRITICAL --exit-code 1 "$IMAGE"

# Push
docker push "$IMAGE"
docker push "$ECR_REPO:latest"

echo "Pushed: $IMAGE"


# ── SECTION 6 · Create Namespace & Secrets ───────────────────────────────────

kubectl create namespace ${app.namespace} --dry-run=client -o yaml | kubectl apply -f -

# Apply secrets — replace base64 placeholders in k8s/secret.yaml first
# Generate base64:  echo -n 'your-value' | base64
kubectl apply -f k8s/secret.yaml -n ${app.namespace}


# ── SECTION 7 · Deploy Application ───────────────────────────────────────────

# Apply all K8s manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml -n ${app.namespace}
kubectl apply -f k8s/deployment.yaml -n ${app.namespace}
kubectl apply -f k8s/service.yaml -n ${app.namespace}

# Optional — apply if generated
[ -f k8s/ingress.yaml ]        && kubectl apply -f k8s/ingress.yaml        -n ${app.namespace}
[ -f k8s/hpa.yaml ]            && kubectl apply -f k8s/hpa.yaml            -n ${app.namespace}
[ -f k8s/servicemonitor.yaml ] && kubectl apply -f k8s/servicemonitor.yaml -n ${app.namespace} 2>/dev/null || true

# Set the new image
kubectl -n ${app.namespace} set image deployment/${app.appName} \\
  ${app.appName}="$IMAGE"

# Wait for rollout
kubectl -n ${app.namespace} rollout status deployment/${app.appName} --timeout=5m


# ── SECTION 8 · Verify Deployment ────────────────────────────────────────────

# Pod status
kubectl -n ${app.namespace} get pods -l app=${app.appName} -o wide

# Service & Load Balancer endpoint
kubectl -n ${app.namespace} get svc ${app.appName}-svc

# Fetch LB hostname (takes 2–3 min to provision)
kubectl -n ${app.namespace} get svc ${app.appName}-svc \\
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# Live logs
kubectl -n ${app.namespace} logs -l app=${app.appName} --tail=100 -f

# Describe pod (debug)
kubectl -n ${app.namespace} describe pod -l app=${app.appName}

# Events
kubectl -n ${app.namespace} get events --sort-by='.lastTimestamp' | tail -20


# ── SECTION 9 · Rolling Update (subsequent deploys) ──────────────────────────

export NEW_TAG=$(git rev-parse --short HEAD 2>/dev/null || date +%s)
export NEW_IMAGE="$ECR_REPO:$NEW_TAG"

docker build --pull -t "$NEW_IMAGE" .
docker push "$NEW_IMAGE"

kubectl -n ${app.namespace} set image deployment/${app.appName} ${app.appName}="$NEW_IMAGE"
kubectl -n ${app.namespace} rollout status deployment/${app.appName} --timeout=5m


# ── SECTION 10 · Scaling ─────────────────────────────────────────────────────

# Manual scale
kubectl -n ${app.namespace} scale deployment/${app.appName} --replicas=5

# Auto-scaling (HPA — if hpa.yaml was applied)
kubectl -n ${app.namespace} get hpa ${app.appName}-hpa

# Scale node group
eksctl scale nodegroup \\
  --cluster ${clusterName} \\
  --name workers \\
  --nodes 5 \\
  --nodes-min 3 \\
  --nodes-max 10 \\
  --region ${region}


# ── SECTION 11 · Rollback ─────────────────────────────────────────────────────

# Rollback to previous revision
kubectl -n ${app.namespace} rollout undo deployment/${app.appName}

# Rollback to a specific revision
kubectl -n ${app.namespace} rollout history deployment/${app.appName}
kubectl -n ${app.namespace} rollout undo deployment/${app.appName} --to-revision=2


# ── SECTION 12 · Helm Deploy (if Helm chart was generated) ───────────────────

# First install
helm upgrade --install ${app.appName} ./helm \\
  --namespace ${app.namespace} \\
  --create-namespace \\
  --set image.repository=$ECR_REPO \\
  --set image.tag=$IMAGE_TAG \\
  --wait

# Subsequent updates
helm upgrade ${app.appName} ./helm \\
  --namespace ${app.namespace} \\
  --set image.tag=$NEW_TAG \\
  --wait

# Status & history
helm status ${app.appName} -n ${app.namespace}
helm history ${app.appName} -n ${app.namespace}

# Rollback helm release
helm rollback ${app.appName} 1 -n ${app.namespace}


# ── SECTION 13 · Cleanup ──────────────────────────────────────────────────────

# Delete deployment only (keep cluster)
kubectl delete deployment ${app.appName} -n ${app.namespace}
kubectl delete svc ${app.appName}-svc  -n ${app.namespace}

# Delete namespace (removes everything in it)
kubectl delete namespace ${app.namespace}

# Delete entire EKS cluster (DESTRUCTIVE — removes all workloads)
# eksctl delete cluster --name ${clusterName} --region ${region}
`;
}
