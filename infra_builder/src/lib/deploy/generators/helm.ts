import type { DetectedApp } from "../types";

export function generateHelmChart(app: DetectedApp): { filename: string; content: string }[] {
  const { repoName, port } = app;
  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  return [
    { filename: "Chart.yaml",                 content: chartYaml(name, app) },
    { filename: "values.yaml",                content: valuesYaml(name, port, app) },
    { filename: "templates/_helpers.tpl",     content: helpersTpl(name) },
    { filename: "templates/deployment.yaml",  content: deploymentTmpl() },
    { filename: "templates/service.yaml",     content: serviceTmpl() },
    { filename: "templates/ingress.yaml",     content: ingressTmpl() },
    { filename: "templates/hpa.yaml",         content: hpaTmpl() },
    { filename: "templates/configmap.yaml",   content: configmapTmpl(app) },
    { filename: "templates/serviceaccount.yaml", content: serviceaccountTmpl() },
  ];
}

function chartYaml(name: string, app: DetectedApp): string {
  return `apiVersion: v2
name: ${name}
description: Helm chart for ${app.repoName} (${app.language}/${app.framework})
type: application
version: 0.1.0
appVersion: "1.0.0"
keywords:
  - ${app.language}
  - ${app.framework !== "none" ? app.framework : app.language}
maintainers:
  - name: Your Team
    email: team@yourdomain.com
`;
}

function valuesYaml(name: string, port: number, app: DetectedApp): string {
  const { language, framework } = app;

  let extraEnv = "";
  if (language === "nodejs" && framework === "nextjs") {
    extraEnv = `
  NEXT_TELEMETRY_DISABLED: "1"
  NEXTAUTH_URL: "https://{{ .Values.ingress.host }}"`;
  } else if (language === "java") {
    extraEnv = `
  SPRING_PROFILES_ACTIVE: "prod"
  JAVA_OPTS: "-Xmx512m -Xms256m"`;
  } else if (language === "python") {
    extraEnv = `
  PYTHONUNBUFFERED: "1"`;
  }

  return `# Default values for ${name}
# Override with: helm install ${name} . -f custom-values.yaml

replicaCount: 2

image:
  repository: your-registry/${name}
  pullPolicy: IfNotPresent
  tag: "latest"  # override with --set image.tag=<sha>

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "${port}"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

service:
  type: ClusterIP
  port: 80
  targetPort: ${port}

ingress:
  enabled: true
  className: nginx
  host: ${name}.yourdomain.com
  tls:
    enabled: true
    secretName: ${name}-tls
    certIssuer: letsencrypt-prod
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/limit-rps: "100"

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

env:
  PORT: "${port}"
  NODE_ENV: "production"${extraEnv}

# Secrets — store sensitive values in a secrets manager
# and reference them here or via ExternalSecret CRD
secrets: {}
# DATABASE_URL: "postgresql://..."
# SECRET_KEY: "..."

livenessProbe:
  httpGet:
    path: /health
    port: ${port}
  initialDelaySeconds: 30
  periodSeconds: 15

readinessProbe:
  httpGet:
    path: /health
    port: ${port}
  initialDelaySeconds: 10
  periodSeconds: 10

nodeSelector: {}
tolerations: []
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - ${name}
          topologyKey: kubernetes.io/hostname
`;
}

function helpersTpl(name: string): string {
  return `{{/*
Expand the name of the chart.
*/}}
{{- define "${name}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "${name}.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "${name}.labels" -}}
helm.sh/chart: {{ include "${name}.chart" . }}
{{ include "${name}.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "${name}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${name}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Chart name and version
*/}}
{{- define "${name}.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Service account name
*/}}
{{- define "${name}.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "${name}.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
`;
}

function deploymentTmpl(): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "{{ .Chart.Name }}.fullname" . }}
  labels:
    {{- include "{{ .Chart.Name }}.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "{{ .Chart.Name }}.selectorLabels" . | nindent 6 }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      annotations:
        rollme: {{ randAlphaNum 5 | quote }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "{{ .Chart.Name }}.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "{{ .Chart.Name }}.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          envFrom:
            - configMapRef:
                name: {{ include "{{ .Chart.Name }}.fullname" . }}-config
            {{- if .Values.secrets }}
            - secretRef:
                name: {{ include "{{ .Chart.Name }}.fullname" . }}-secrets
            {{- end }}
          livenessProbe:
            {{- toYaml .Values.livenessProbe | nindent 12 }}
          readinessProbe:
            {{- toYaml .Values.readinessProbe | nindent 12 }}
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      terminationGracePeriodSeconds: 60
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
`;
}

function serviceTmpl(): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: {{ include "{{ .Chart.Name }}.fullname" . }}
  labels:
    {{- include "{{ .Chart.Name }}.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
      protocol: TCP
      name: http
  selector:
    {{- include "{{ .Chart.Name }}.selectorLabels" . | nindent 4 }}
`;
}

function ingressTmpl(): string {
  return `{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "{{ .Chart.Name }}.fullname" . }}
  labels:
    {{- include "{{ .Chart.Name }}.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls.enabled }}
  tls:
    - hosts:
        - {{ .Values.ingress.host }}
      secretName: {{ .Values.ingress.tls.secretName }}
  {{- end }}
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "{{ .Chart.Name }}.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
`;
}

function hpaTmpl(): string {
  return `{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "{{ .Chart.Name }}.fullname" . }}
  labels:
    {{- include "{{ .Chart.Name }}.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "{{ .Chart.Name }}.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    {{- if .Values.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
    {{- end }}
    {{- if .Values.autoscaling.targetMemoryUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetMemoryUtilizationPercentage }}
    {{- end }}
{{- end }}
`;
}

function configmapTmpl(_app: DetectedApp): string {
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "{{ .Chart.Name }}.fullname" . }}-config
  labels:
    {{- include "{{ .Chart.Name }}.labels" . | nindent 4 }}
data:
  {{- range $key, $val := .Values.env }}
  {{ $key }}: {{ $val | quote }}
  {{- end }}
`;
}

function serviceaccountTmpl(): string {
  return `{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "{{ .Chart.Name }}.serviceAccountName" . }}
  labels:
    {{- include "{{ .Chart.Name }}.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}
`;
}
