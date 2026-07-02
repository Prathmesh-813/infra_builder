import type { DetectedApp } from "../types";

export function generateKubernetesManifests(app: DetectedApp): { filename: string; content: string }[] {
  const { repoName, port } = app;
  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const image = `your-registry/${name}:latest`;

  return [
    { filename: "namespace.yaml",  content: namespace(name) },
    { filename: "configmap.yaml",  content: configmap(name, app) },
    { filename: "secret.yaml",     content: secret(name, app) },
    { filename: "deployment.yaml", content: deployment(name, image, port, app) },
    { filename: "service.yaml",    content: service(name, port) },
    { filename: "ingress.yaml",    content: ingress(name, port) },
    { filename: "hpa.yaml",        content: hpa(name) },
  ];
}

function namespace(name: string): string {
  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${name}
  labels:
    app: ${name}
    managed-by: techatlas
`;
}

function configmap(name: string, app: DetectedApp): string {
  const { language, framework, port } = app;
  let data = `  PORT: "${port}"\n`;

  if (language === "nodejs") {
    data += `  NODE_ENV: "production"\n`;
    if (framework === "nextjs") data += `  NEXT_TELEMETRY_DISABLED: "1"\n`;
  }
  if (language === "python") data += `  PYTHONUNBUFFERED: "1"\n  PYTHON_ENV: "production"\n`;
  if (language === "java")   data += `  SPRING_PROFILES_ACTIVE: "prod"\n  JAVA_OPTS: "-Xmx512m -Xms256m"\n`;
  if (language === "go")     data += `  GIN_MODE: "release"\n`;

  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}-config
  namespace: ${name}
  labels:
    app: ${name}
data:
${data}`;
}

function secret(name: string, app: DetectedApp): string {
  const examples = app.envVarExamples
    .filter(v => v.toLowerCase().includes("secret") || v.toLowerCase().includes("key") || v.toLowerCase().includes("url") || v.toLowerCase().includes("password"))
    .slice(0, 4);

  const data = examples.length > 0
    ? examples.map(v => `  ${v}: ""  # base64-encoded value`).join("\n")
    : `  DATABASE_URL: ""  # base64: echo -n "postgresql://..." | base64\n  SECRET_KEY: ""   # base64: echo -n "your-secret" | base64`;

  return `# WARNING: Never commit real secrets! Use a secrets manager (AWS Secrets Manager,
# HashiCorp Vault, Sealed Secrets, External Secrets Operator) in production.
apiVersion: v1
kind: Secret
metadata:
  name: ${name}-secrets
  namespace: ${name}
  labels:
    app: ${name}
type: Opaque
data:
  # Encode values: echo -n "value" | base64
${data}
`;
}

function deployment(name: string, image: string, port: number, app: DetectedApp): string {
  const { language } = app;

  const livenessPath  = language === "python" ? "/health" : language === "java" ? "/actuator/health" : "/";
  const readinessPath = language === "java" ? "/actuator/health/readiness" : livenessPath;

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${name}
  labels:
    app: ${name}
    version: "1.0.0"
  annotations:
    kubernetes.io/change-cause: "Initial deployment"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${name}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: ${name}
        version: "1.0.0"
    spec:
      # Spread across nodes for HA
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: ${name}

      containers:
        - name: ${name}
          image: ${image}
          imagePullPolicy: Always
          ports:
            - containerPort: ${port}
              protocol: TCP
              name: http

          # Load from ConfigMap
          envFrom:
            - configMapRef:
                name: ${name}-config
            - secretRef:
                name: ${name}-secrets

          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"

          livenessProbe:
            httpGet:
              path: ${livenessPath}
              port: ${port}
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3

          readinessProbe:
            httpGet:
              path: ${readinessPath}
              port: ${port}
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3

          # Security hardening
          securityContext:
            runAsNonRoot: true
            runAsUser: 1001
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL

          volumeMounts:
            - name: tmp
              mountPath: /tmp

      volumes:
        - name: tmp
          emptyDir: {}

      # Grace period for zero-downtime deploys
      terminationGracePeriodSeconds: 60
`;
}

function service(name: string, port: number): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${name}
  labels:
    app: ${name}
spec:
  type: ClusterIP
  selector:
    app: ${name}
  ports:
    - name: http
      port: 80
      targetPort: ${port}
      protocol: TCP
`;
}

function ingress(name: string, _port: number): string {
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${name}
  annotations:
    # Nginx Ingress Controller
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    # TLS cert-manager — issue a Let's Encrypt certificate
    cert-manager.io/cluster-issuer: letsencrypt-prod
    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rps: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - ${name}.yourdomain.com
      secretName: ${name}-tls
  rules:
    - host: ${name}.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${name}
                port:
                  number: 80
`;
}

function hpa(name: string): string {
  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${name}-hpa
  namespace: ${name}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${name}
  minReplicas: 2
  maxReplicas: 10
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
    scaleDown:
      stabilizationWindowSeconds: 300   # Wait 5 min before scaling down
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
`;
}
