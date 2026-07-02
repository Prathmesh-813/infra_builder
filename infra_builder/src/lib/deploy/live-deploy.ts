// ─── TechAtlas — Direct Cloud Deploy ─────────────────────────────────────────
// Deploys applications directly from the browser to cloud targets.
// All credentials are stored only in browser memory — never sent to TechAtlas.

// ── Shared types ──────────────────────────────────────────────────────────────

export type LiveTarget = "kubernetes" | "render" | "railway" | "fly" | "ssh";

export interface DeployLogEntry {
  id:      string;
  label:   string;
  status:  "idle" | "running" | "success" | "error" | "skip";
  detail?: string;
}

export type UpdateFn = (id: string, status: DeployLogEntry["status"], detail?: string) => void;

// ── Kubernetes / EKS config ───────────────────────────────────────────────────

export interface K8sConfig {
  apiServer:     string;  // https://XXXX.gr7.us-east-1.eks.amazonaws.com
  token:         string;  // Bearer token (service account token or aws eks get-token)
  namespace:     string;
  appName:       string;
  image:         string;  // registry/repo:tag
  replicas:      number;
  port:          number;
  cpuRequest:    string;
  cpuLimit:      string;
  memRequest:    string;
  memLimit:      string;
  healthPath:    string;
  enableIngress: boolean;
  ingressHost:   string;
  enableHpa:     boolean;
}

// ── Render config ─────────────────────────────────────────────────────────────

export interface RenderConfig {
  mode:       "hook" | "api";
  hookUrl:    string;
  apiKey:     string;
  serviceId:  string;
  clearCache: boolean;
}

// ── Railway config ────────────────────────────────────────────────────────────

export interface RailwayConfig {
  mode:          "hook" | "api";
  hookUrl:       string;
  token:         string;
  serviceId:     string;
  environmentId: string;
}

// ── Fly.io config ─────────────────────────────────────────────────────────────

export interface FlyConfig {
  token:   string;
  appName: string;
}

// ── K8s HTTP helper ───────────────────────────────────────────────────────────

async function k8sFetch(
  base: string,
  token: string,
  method: string,
  path: string,
  body?: object,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

// Apply a resource using server-side apply; falls back to POST → PUT on 404/409.
async function k8sApply(
  base: string,
  token: string,
  collectionPath: string,
  name: string,
  resource: object,
): Promise<void> {
  // Server-side apply (K8s 1.18+): handles create AND update atomically.
  const applyRes = await fetch(
    `${base}${collectionPath}/${name}?fieldManager=infra-studio&force=true`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/apply-patch+yaml",
        "Accept":        "application/json",
      },
      body: JSON.stringify(resource),
    },
  );
  if (applyRes.ok) return;

  // Fallback: POST to create
  const postRes = await fetch(`${base}${collectionPath}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: JSON.stringify(resource),
  });
  if (postRes.ok) return;

  // Already exists (409) → GET resourceVersion then PUT to replace
  if (postRes.status === 409) {
    const existing = await k8sFetch(base, token, "GET", `${collectionPath}/${name}`);
    const rv = ((existing.data.metadata as Record<string, unknown>)?.resourceVersion as string) ?? undefined;
    const withRv = {
      ...resource,
      metadata: {
        ...(resource as Record<string, unknown>).metadata as object,
        ...(rv ? { resourceVersion: rv } : {}),
      },
    };
    const putRes = await fetch(`${base}${collectionPath}/${name}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json",
        "Accept":        "application/json",
      },
      body: JSON.stringify(withRv),
    });
    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(`Apply failed (${putRes.status}): ${(err.message as string) ?? putRes.statusText}`);
    }
    return;
  }

  const err = await postRes.json().catch(() => ({})) as Record<string, unknown>;
  throw new Error(`Apply failed (${postRes.status}): ${(err.message as string) ?? postRes.statusText}`);
}

// ── Kubernetes / EKS deploy ───────────────────────────────────────────────────

export function makeK8sLogs(cfg: K8sConfig): DeployLogEntry[] {
  return [
    { id: "connect",    label: "Connect to cluster",                status: "idle" },
    { id: "namespace",  label: `Namespace "${cfg.namespace}"`,      status: "idle" },
    { id: "configmap",  label: "ConfigMap",                         status: "idle" },
    { id: "deployment", label: "Deployment",                        status: "idle" },
    { id: "service",    label: "Service (ClusterIP)",               status: "idle" },
    { id: "ingress",    label: "Ingress",                           status: "idle" },
    { id: "hpa",        label: "HorizontalPodAutoscaler",           status: "idle" },
    { id: "rollout",    label: "Rollout health check",              status: "idle" },
  ];
}

export async function deployToKubernetes(
  cfg: K8sConfig,
  update: UpdateFn,
): Promise<void> {
  const base = cfg.apiServer.replace(/\/$/, "");
  const { appName: name, namespace: ns } = cfg;

  // 1 ── Connect
  update("connect", "running");
  const ver = await k8sFetch(base, cfg.token, "GET", "/version");
  if (!ver.ok) {
    update("connect", "error",
      ver.status === 401 || ver.status === 403
        ? "Auth failed — check your Bearer token."
        : `Cannot reach cluster (HTTP ${ver.status}). Verify the API server URL.`,
    );
    throw new Error("connect");
  }
  update("connect", "success", `Cluster ${(ver.data.gitVersion as string) ?? "unknown"}`);

  // 2 ── Namespace
  update("namespace", "running");
  const nsCheck = await k8sFetch(base, cfg.token, "GET", `/api/v1/namespaces/${ns}`);
  if (nsCheck.status === 404) {
    const nsCreate = await k8sFetch(base, cfg.token, "POST", "/api/v1/namespaces", {
      apiVersion: "v1", kind: "Namespace",
      metadata: { name: ns, labels: { "managed-by": "infra-studio" } },
    });
    if (!nsCreate.ok) { update("namespace", "error", `Cannot create (${nsCreate.status})`); throw new Error("namespace"); }
    update("namespace", "success", "Created");
  } else if (nsCheck.ok) {
    update("namespace", "success", "Exists");
  } else {
    update("namespace", "error", `Cannot access (${nsCheck.status})`);
    throw new Error("namespace");
  }

  // 3 ── ConfigMap
  update("configmap", "running");
  try {
    await k8sApply(base, cfg.token, `/api/v1/namespaces/${ns}/configmaps`, `${name}-config`, {
      apiVersion: "v1", kind: "ConfigMap",
      metadata: { name: `${name}-config`, namespace: ns, labels: { app: name, "managed-by": "infra-studio" } },
      data: { PORT: String(cfg.port), NODE_ENV: "production" },
    });
    update("configmap", "success");
  } catch (e) { update("configmap", "error", e instanceof Error ? e.message : String(e)); throw e; }

  // 4 ── Deployment
  update("deployment", "running");
  try {
    await k8sApply(base, cfg.token, `/apis/apps/v1/namespaces/${ns}/deployments`, name, {
      apiVersion: "apps/v1", kind: "Deployment",
      metadata: { name, namespace: ns, labels: { app: name, "managed-by": "infra-studio" } },
      spec: {
        replicas: cfg.replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [{
              name,
              image: cfg.image,
              ports: [{ containerPort: cfg.port, name: "http" }],
              envFrom: [{ configMapRef: { name: `${name}-config` } }],
              resources: {
                requests: { cpu: cfg.cpuRequest, memory: cfg.memRequest },
                limits:   { cpu: cfg.cpuLimit,   memory: cfg.memLimit   },
              },
              livenessProbe:  { httpGet: { path: cfg.healthPath, port: cfg.port }, initialDelaySeconds: 15, periodSeconds: 10 },
              readinessProbe: { httpGet: { path: cfg.healthPath, port: cfg.port }, initialDelaySeconds: 5,  periodSeconds: 5  },
            }],
          },
        },
        strategy: { type: "RollingUpdate", rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
      },
    });
    update("deployment", "success", `Image: ${cfg.image}`);
  } catch (e) { update("deployment", "error", e instanceof Error ? e.message : String(e)); throw e; }

  // 5 ── Service
  update("service", "running");
  try {
    await k8sApply(base, cfg.token, `/api/v1/namespaces/${ns}/services`, name, {
      apiVersion: "v1", kind: "Service",
      metadata: { name, namespace: ns, labels: { app: name, "managed-by": "infra-studio" } },
      spec: {
        selector: { app: name },
        ports: [{ port: 80, targetPort: cfg.port, protocol: "TCP", name: "http" }],
        type: "ClusterIP",
      },
    });
    update("service", "success");
  } catch (e) { update("service", "error", e instanceof Error ? e.message : String(e)); throw e; }

  // 6 ── Ingress (optional)
  if (cfg.enableIngress && cfg.ingressHost) {
    update("ingress", "running");
    try {
      await k8sApply(base, cfg.token, `/apis/networking.k8s.io/v1/namespaces/${ns}/ingresses`, name, {
        apiVersion: "networking.k8s.io/v1", kind: "Ingress",
        metadata: { name, namespace: ns, labels: { app: name }, annotations: { "nginx.ingress.kubernetes.io/rewrite-target": "/" } },
        spec: {
          rules: [{
            host: cfg.ingressHost,
            http: { paths: [{ path: "/", pathType: "Prefix", backend: { service: { name, port: { number: 80 } } } }] },
          }],
        },
      });
      update("ingress", "success", cfg.ingressHost);
    } catch (e) { update("ingress", "error", e instanceof Error ? e.message : String(e)); }
  } else {
    update("ingress", "skip", "Disabled");
  }

  // 7 ── HPA (optional)
  if (cfg.enableHpa) {
    update("hpa", "running");
    try {
      await k8sApply(base, cfg.token, `/apis/autoscaling/v2/namespaces/${ns}/horizontalpodautoscalers`, name, {
        apiVersion: "autoscaling/v2", kind: "HorizontalPodAutoscaler",
        metadata: { name, namespace: ns },
        spec: {
          scaleTargetRef: { apiVersion: "apps/v1", kind: "Deployment", name },
          minReplicas: cfg.replicas,
          maxReplicas: cfg.replicas * 3,
          metrics: [{ type: "Resource", resource: { name: "cpu", target: { type: "Utilization", averageUtilization: 70 } } }],
        },
      });
      update("hpa", "success", `min ${cfg.replicas} → max ${cfg.replicas * 3}`);
    } catch (e) { update("hpa", "error", e instanceof Error ? e.message : String(e)); }
  } else {
    update("hpa", "skip", "Disabled");
  }

  // 8 ── Rollout health check
  update("rollout", "running", "Waiting for pods…");
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const dep = await k8sFetch(base, cfg.token, "GET", `/apis/apps/v1/namespaces/${ns}/deployments/${name}`);
    if (dep.ok) {
      const desired = ((dep.data.spec as Record<string, unknown>)?.replicas as number) ?? cfg.replicas;
      const ready   = ((dep.data.status as Record<string, unknown>)?.readyReplicas as number) ?? 0;
      update("rollout", "running", `${ready}/${desired} pods ready`);
      if (ready >= desired) { update("rollout", "success", `All ${desired} pods healthy`); return; }
    }
  }
  update("rollout", "error", "Timed out — pods still not ready. Check events in your cluster.");
}

// ── Render deploy ─────────────────────────────────────────────────────────────

export function makeRenderLogs(): DeployLogEntry[] {
  return [
    { id: "trigger", label: "Trigger deploy",          status: "idle" },
    { id: "status",  label: "Monitor in Render dashboard", status: "idle" },
  ];
}

export async function deployToRender(cfg: RenderConfig, update: UpdateFn): Promise<void> {
  update("trigger", "running");
  try {
    if (cfg.mode === "hook") {
      if (!cfg.hookUrl) throw new Error("Enter a deploy hook URL");
      const res = await fetch(cfg.hookUrl, { method: "GET" });
      if (!res.ok) throw new Error(`Hook responded ${res.status}`);
      update("trigger", "success", "Deploy triggered");
    } else {
      if (!cfg.apiKey || !cfg.serviceId) throw new Error("Enter API key and service ID");
      const res = await fetch(`https://api.render.com/v1/services/${cfg.serviceId}/deploys`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ clearCache: cfg.clearCache ? "clear" : "do_not_clear" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((err.message as string) ?? `API ${res.status}`);
      }
      const data = await res.json() as Record<string, unknown>;
      update("trigger", "success", `Deploy ${(data.id as string) ?? ""} queued`);
    }
    update("status", "success", "Visit render.com/dashboard to track progress");
  } catch (e) {
    update("trigger", "error", e instanceof Error ? e.message : String(e));
    update("status", "skip");
    throw e;
  }
}

// ── Railway deploy ────────────────────────────────────────────────────────────

export function makeRailwayLogs(): DeployLogEntry[] {
  return [
    { id: "trigger", label: "Trigger deploy",             status: "idle" },
    { id: "status",  label: "Monitor in Railway dashboard", status: "idle" },
  ];
}

export async function deployToRailway(cfg: RailwayConfig, update: UpdateFn): Promise<void> {
  update("trigger", "running");
  try {
    if (cfg.mode === "hook") {
      if (!cfg.hookUrl) throw new Error("Enter a deploy hook URL");
      const res = await fetch(cfg.hookUrl, { method: "GET" });
      if (!res.ok) throw new Error(`Hook responded ${res.status}`);
      update("trigger", "success", "Deploy triggered");
    } else {
      if (!cfg.token || !cfg.serviceId || !cfg.environmentId) throw new Error("Enter token, service ID, and environment ID");
      const res = await fetch("https://backboard.railway.app/graphql/v2", {
        method: "POST",
        headers: { "Authorization": `Bearer ${cfg.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation Redeploy($serviceId:String!,$environmentId:String!){
            serviceInstanceRedeploy(serviceId:$serviceId,environmentId:$environmentId)
          }`,
          variables: { serviceId: cfg.serviceId, environmentId: cfg.environmentId },
        }),
      });
      if (!res.ok) throw new Error(`Railway API ${res.status}`);
      const data = await res.json() as Record<string, unknown>;
      const errs = data.errors as Array<Record<string, unknown>> | undefined;
      if (errs?.length) throw new Error((errs[0].message as string) ?? "GraphQL error");
      update("trigger", "success", "Service redeployed");
    }
    update("status", "success", "Visit railway.app to track progress");
  } catch (e) {
    update("trigger", "error", e instanceof Error ? e.message : String(e));
    update("status", "skip");
    throw e;
  }
}

// ── Fly.io deploy ─────────────────────────────────────────────────────────────

export function makeFlyLogs(): DeployLogEntry[] {
  return [
    { id: "connect", label: "Verify app on Fly.io", status: "idle" },
    { id: "deploy",  label: "Trigger deployment",   status: "idle" },
    { id: "status",  label: "Monitor deployment",   status: "idle" },
  ];
}

export async function deployToFly(cfg: FlyConfig, update: UpdateFn): Promise<void> {
  update("connect", "running");
  try {
    const appRes = await fetch(`https://api.fly.io/v1/apps/${cfg.appName}`, {
      headers: { "Authorization": `Bearer ${cfg.token}`, "Accept": "application/json" },
    });
    if (!appRes.ok) {
      const err = await appRes.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(appRes.status === 404
        ? `App "${cfg.appName}" not found. Create it first with \`fly launch\`.`
        : (err.error as string) ?? `API ${appRes.status}`);
    }
    const app = await appRes.json() as Record<string, unknown>;
    const org = ((app.organization as Record<string, unknown>)?.slug as string) ?? "?";
    update("connect", "success", `App "${cfg.appName}" · org: ${org}`);
  } catch (e) {
    update("connect", "error", e instanceof Error ? e.message : String(e));
    update("deploy", "skip"); update("status", "skip");
    throw e;
  }

  update("deploy", "running");
  try {
    const res = await fetch(`https://api.fly.io/v1/apps/${cfg.appName}/releases`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "rolling" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error((err.error as string) ?? `Deploy API ${res.status}`);
    }
    const rel = await res.json() as Record<string, unknown>;
    update("deploy", "success", `Release v${(rel.version as number) ?? "?"}  created`);
    update("status", "success", `fly status --app ${cfg.appName}`);
  } catch (e) {
    update("deploy", "error", e instanceof Error ? e.message : String(e));
    update("status", "skip");
    throw e;
  }
}
