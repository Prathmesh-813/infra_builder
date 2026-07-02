"use client";

import { useState } from "react";
import {
  ChevronLeft, Shield, Eye, EyeOff, CheckCircle2, XCircle,
  Loader2, Rocket, AlertTriangle, SkipForward, Server,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DetectedApp } from "@/lib/deploy/types";
import {
  type LiveTarget, type DeployLogEntry, type K8sConfig,
  type RenderConfig, type RailwayConfig, type FlyConfig,
  makeK8sLogs, makeRenderLogs, makeRailwayLogs, makeFlyLogs,
  deployToKubernetes, deployToRender, deployToRailway, deployToFly,
} from "@/lib/deploy/live-deploy";

// ── Styled input ──────────────────────────────────────────────────────────────

function Field({
  label, hint, children,
}: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-600 leading-tight">{hint}</span>}
    </label>
  );
}

const inp = "w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all";
const inpSm = inp + " text-xs";

// ── Token input with show/hide ────────────────────────────────────────────────

function TokenInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "paste token here"}
        className={inp + " pr-10"}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Deploy log / progress panel ───────────────────────────────────────────────

function DeployLog({ entries }: { entries: DeployLogEntry[] }) {
  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
        <Server className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs text-gray-400 font-medium">Deployment Progress</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="shrink-0">
              {entry.status === "running" && <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />}
              {entry.status === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
              {entry.status === "error"   && <XCircle className="h-3.5 w-3.5 text-red-400" />}
              {entry.status === "skip"    && <SkipForward className="h-3.5 w-3.5 text-gray-600" />}
              {entry.status === "idle"    && <div className="h-3.5 w-3.5 rounded-full border border-white/20" />}
            </span>
            <span className={cn(
              "text-xs flex-1",
              entry.status === "running" ? "text-white"     :
              entry.status === "success" ? "text-gray-300"  :
              entry.status === "error"   ? "text-red-300"   :
              "text-gray-600",
            )}>
              {entry.label}
            </span>
            {entry.detail && (
              <span className={cn(
                "text-[11px] font-mono truncate max-w-[200px]",
                entry.status === "error" ? "text-red-400" :
                entry.status === "skip"  ? "text-gray-600" :
                "text-gray-500",
              )}>
                {entry.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Target selector tab ───────────────────────────────────────────────────────

const TARGETS: { id: LiveTarget; label: string; icon: string; color: string }[] = [
  { id: "kubernetes", label: "Kubernetes / EKS",  icon: "☸️",  color: "violet" },
  { id: "render",     label: "Render",             icon: "⬛",  color: "green"  },
  { id: "railway",    label: "Railway",            icon: "🚂",  color: "purple" },
  { id: "fly",        label: "Fly.io",             icon: "🪂",  color: "blue"   },
  { id: "ssh",        label: "SSH / VPS",          icon: "🖥️",  color: "gray"   },
];

// ── Kubernetes form ───────────────────────────────────────────────────────────

function KubernetesForm({
  cfg, setCfg, logs, deploying, done, onDeploy, onReset,
}: {
  cfg: K8sConfig;
  setCfg: React.Dispatch<React.SetStateAction<K8sConfig>>;
  logs: DeployLogEntry[];
  deploying: boolean;
  done: boolean;
  onDeploy: () => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<K8sConfig>) => setCfg(p => ({ ...p, ...patch }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        <Field label="Cluster API Server URL" hint="EKS example: https://ABCD1234.gr7.us-east-1.eks.amazonaws.com">
          <input className={inp} value={cfg.apiServer} onChange={e => set({ apiServer: e.target.value })} placeholder="https://your-cluster-endpoint" />
        </Field>

        <Field label="Bearer Token" hint="Service account token — or output of: aws eks get-token --cluster-name <name> | jq -r .status.token">
          <TokenInput value={cfg.token} onChange={v => set({ token: v })} placeholder="eyJhbGciOiJSUz..." />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Container Image" hint="Include registry host and tag">
            <input className={inp} value={cfg.image} onChange={e => set({ image: e.target.value })} placeholder="123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:latest" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Namespace">
              <input className={inpSm} value={cfg.namespace} onChange={e => set({ namespace: e.target.value })} placeholder="production" />
            </Field>
            <Field label="Replicas">
              <input type="number" min={1} max={20} className={inpSm} value={cfg.replicas} onChange={e => set({ replicas: +e.target.value || 2 })} />
            </Field>
          </div>
        </div>

        {/* Resources */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Resources</p>
          <div className="grid grid-cols-4 gap-3">
            {(["cpuRequest","cpuLimit","memRequest","memLimit"] as const).map(k => (
              <Field key={k} label={k === "cpuRequest" ? "CPU Req" : k === "cpuLimit" ? "CPU Lim" : k === "memRequest" ? "Mem Req" : "Mem Lim"}>
                <input className={inpSm} value={cfg[k]} onChange={e => set({ [k]: e.target.value })} placeholder={k.startsWith("cpu") ? "250m" : "256Mi"} />
              </Field>
            ))}
          </div>
        </div>

        {/* Advanced toggles */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl border border-white/[0.08] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cfg.enableIngress} onChange={e => set({ enableIngress: e.target.checked })} className="w-3.5 h-3.5 accent-violet-500" />
              <span className="text-xs text-gray-300 font-medium">Enable Ingress</span>
            </label>
            {cfg.enableIngress && (
              <input className={inpSm} value={cfg.ingressHost} onChange={e => set({ ingressHost: e.target.value })} placeholder="app.yourdomain.com" />
            )}
          </div>
          <div className="p-3 rounded-xl border border-white/[0.08] space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={cfg.enableHpa} onChange={e => set({ enableHpa: e.target.checked })} className="w-3.5 h-3.5 accent-violet-500" />
              <span className="text-xs text-gray-300 font-medium">Enable HPA (auto-scale)</span>
            </label>
            {cfg.enableHpa && (
              <p className="text-[11px] text-gray-600">Scales {cfg.replicas}–{cfg.replicas * 3} replicas at 70% CPU</p>
            )}
          </div>
        </div>
      </div>

      <DeployButton deploying={deploying} done={done} onDeploy={onDeploy} onReset={onReset}
        label="Deploy to Kubernetes" icon="☸️" />

      {logs.some(l => l.status !== "idle") && <DeployLog entries={logs} />}
    </div>
  );
}

// ── Render form ───────────────────────────────────────────────────────────────

function RenderForm({
  cfg, setCfg, logs, deploying, done, onDeploy, onReset,
}: {
  cfg: RenderConfig;
  setCfg: React.Dispatch<React.SetStateAction<RenderConfig>>;
  logs: DeployLogEntry[];
  deploying: boolean;
  done: boolean;
  onDeploy: () => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<RenderConfig>) => setCfg(p => ({ ...p, ...patch }));
  return (
    <div className="space-y-5">
      <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
        {(["hook","api"] as const).map(m => (
          <button key={m} onClick={() => set({ mode: m })} className={cn(
            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
            cfg.mode === m ? "bg-green-600 text-white" : "text-gray-400 hover:text-white",
          )}>
            {m === "hook" ? "Deploy Hook URL" : "API Key + Service ID"}
          </button>
        ))}
      </div>

      {cfg.mode === "hook" ? (
        <Field label="Deploy Hook URL" hint="Settings → Deploy Hooks → Copy URL. Triggers a redeploy of your latest build.">
          <input className={inp} value={cfg.hookUrl} onChange={e => set({ hookUrl: e.target.value })} placeholder="https://api.render.com/deploy/srv-xxx?key=xxx" />
        </Field>
      ) : (
        <>
          <Field label="Render API Key" hint="Account Settings → API Keys → Create API key">
            <TokenInput value={cfg.apiKey} onChange={v => set({ apiKey: v })} placeholder="rnd_..." />
          </Field>
          <Field label="Service ID" hint="From your service URL: render.com/service/srv-xxx">
            <input className={inp} value={cfg.serviceId} onChange={e => set({ serviceId: e.target.value })} placeholder="srv-xxxxxxxxxxxx" />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cfg.clearCache} onChange={e => set({ clearCache: e.target.checked })} className="w-3.5 h-3.5 accent-green-500" />
            <span className="text-xs text-gray-300">Clear build cache</span>
          </label>
        </>
      )}

      <DeployButton deploying={deploying} done={done} onDeploy={onDeploy} onReset={onReset}
        label="Deploy on Render" icon="⬛" />

      {logs.some(l => l.status !== "idle") && <DeployLog entries={logs} />}
    </div>
  );
}

// ── Railway form ──────────────────────────────────────────────────────────────

function RailwayForm({
  cfg, setCfg, logs, deploying, done, onDeploy, onReset,
}: {
  cfg: RailwayConfig;
  setCfg: React.Dispatch<React.SetStateAction<RailwayConfig>>;
  logs: DeployLogEntry[];
  deploying: boolean;
  done: boolean;
  onDeploy: () => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<RailwayConfig>) => setCfg(p => ({ ...p, ...patch }));
  return (
    <div className="space-y-5">
      <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
        {(["hook","api"] as const).map(m => (
          <button key={m} onClick={() => set({ mode: m })} className={cn(
            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
            cfg.mode === m ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white",
          )}>
            {m === "hook" ? "Deploy Hook URL" : "API Token + Service ID"}
          </button>
        ))}
      </div>

      {cfg.mode === "hook" ? (
        <Field label="Deploy Hook URL" hint="Railway dashboard → Service → Settings → Deploy Trigger → Copy URL">
          <input className={inp} value={cfg.hookUrl} onChange={e => set({ hookUrl: e.target.value })} placeholder="https://backboard.railway.app/v1/webhook/xxx" />
        </Field>
      ) : (
        <>
          <Field label="Railway Token" hint="Account Settings → Tokens → New Token">
            <TokenInput value={cfg.token} onChange={v => set({ token: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Service ID" hint="From the Railway URL or API">
              <input className={inpSm} value={cfg.serviceId} onChange={e => set({ serviceId: e.target.value })} placeholder="service UUID" />
            </Field>
            <Field label="Environment ID">
              <input className={inpSm} value={cfg.environmentId} onChange={e => set({ environmentId: e.target.value })} placeholder="environment UUID" />
            </Field>
          </div>
        </>
      )}

      <DeployButton deploying={deploying} done={done} onDeploy={onDeploy} onReset={onReset}
        label="Deploy on Railway" icon="🚂" />

      {logs.some(l => l.status !== "idle") && <DeployLog entries={logs} />}
    </div>
  );
}

// ── Fly.io form ───────────────────────────────────────────────────────────────

function FlyForm({
  cfg, setCfg, logs, deploying, done, onDeploy, onReset,
}: {
  cfg: FlyConfig;
  setCfg: React.Dispatch<React.SetStateAction<FlyConfig>>;
  logs: DeployLogEntry[];
  deploying: boolean;
  done: boolean;
  onDeploy: () => void;
  onReset: () => void;
}) {
  const set = (patch: Partial<FlyConfig>) => setCfg(p => ({ ...p, ...patch }));
  return (
    <div className="space-y-5">
      <Field label="Fly.io API Token" hint="fly auth token  — or Fly.io dashboard → Access Tokens">
        <TokenInput value={cfg.token} onChange={v => set({ token: v })} placeholder="FlyV1 ..." />
      </Field>
      <Field label="App Name" hint="The name you used in fly.toml or fly launch">
        <input className={inp} value={cfg.appName} onChange={e => set({ appName: e.target.value })} placeholder="my-app-name" />
      </Field>

      <DeployButton deploying={deploying} done={done} onDeploy={onDeploy} onReset={onReset}
        label="Deploy on Fly.io" icon="🪂" />

      {logs.some(l => l.status !== "idle") && <DeployLog entries={logs} />}
    </div>
  );
}

// ── SSH / VPS info panel ──────────────────────────────────────────────────────

function SshPanel({ app }: { app: DetectedApp }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-300/80 leading-relaxed">
          Browser-based SSH is not supported. Use the generated <code className="text-amber-300">deploy.sh</code> script
          to deploy to your server from a terminal.
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-[#0d1117] overflow-hidden">
        <div className="px-4 py-2 border-b border-white/[0.06]">
          <span className="text-xs text-gray-400 font-medium">Quick deploy to VPS / bare metal</span>
        </div>
        <pre className="p-4 text-xs text-green-300 font-mono leading-relaxed overflow-x-auto">
{`# 1. Copy the deploy.sh from the Files step to your server
scp deploy.sh user@your-server.com:/app/

# 2. SSH into your server
ssh user@your-server.com

# 3. Run the generated deploy script
chmod +x /app/deploy.sh
APP_NAME=${app.repoName} IMAGE_TAG=latest /app/deploy.sh

# 4. Check status
docker ps        # Docker
kubectl get pods # Kubernetes`}
        </pre>
      </div>
    </div>
  );
}

// ── Shared deploy button ──────────────────────────────────────────────────────

function DeployButton({
  deploying, done, onDeploy, onReset, label, icon,
}: {
  deploying: boolean; done: boolean;
  onDeploy: () => void; onReset: () => void;
  label: string; icon: string;
}) {
  if (done) {
    return (
      <button onClick={onReset} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-all border border-white/[0.08]">
        <RefreshCw className="h-4 w-4" /> Deploy again
      </button>
    );
  }
  return (
    <button
      onClick={onDeploy}
      disabled={deploying}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
    >
      {deploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>{icon}</span>}
      {deploying ? "Deploying…" : label}
    </button>
  );
}

// ── Security badge ────────────────────────────────────────────────────────────

function SecurityNote() {
  return (
    <div className="flex items-start gap-2.5 p-3 bg-violet-500/5 border border-violet-500/20 rounded-xl">
      <Shield className="h-3.5 w-3.5 text-violet-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-gray-400 leading-relaxed">
        All credentials are stored only in browser memory for this session and used solely to call the cloud provider API directly from your browser — never sent to TechAtlas servers.
      </p>
    </div>
  );
}

// ── Main DirectDeployStep component ──────────────────────────────────────────

export function DirectDeployStep({
  app,
  onBack,
}: {
  app: DetectedApp;
  onBack: () => void;
}) {
  const [target, setTarget] = useState<LiveTarget>("kubernetes");

  // Per-target config
  const [k8sCfg, setK8sCfg] = useState<K8sConfig>({
    apiServer: "", token: "", namespace: "production",
    appName: app.repoName ?? "myapp", image: "",
    replicas: 2, port: app.port ?? 3000,
    cpuRequest: "250m", cpuLimit: "500m",
    memRequest: "256Mi", memLimit: "512Mi",
    healthPath: "/health",
    enableIngress: false, ingressHost: "",
    enableHpa: false,
  });
  const [renderCfg, setRenderCfg] = useState<RenderConfig>({ mode: "hook", hookUrl: "", apiKey: "", serviceId: "", clearCache: false });
  const [railwayCfg, setRailwayCfg] = useState<RailwayConfig>({ mode: "hook", hookUrl: "", token: "", serviceId: "", environmentId: "" });
  const [flyCfg, setFlyCfg] = useState<FlyConfig>({ token: "", appName: app.repoName ?? "" });

  // Per-target log state
  const [k8sLogs,     setK8sLogs]     = useState<DeployLogEntry[]>(makeK8sLogs(k8sCfg));
  const [renderLogs,  setRenderLogs]  = useState<DeployLogEntry[]>(makeRenderLogs());
  const [railwayLogs, setRailwayLogs] = useState<DeployLogEntry[]>(makeRailwayLogs());
  const [flyLogs,     setFlyLogs]     = useState<DeployLogEntry[]>(makeFlyLogs());

  const [deploying, setDeploying] = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  function updateLog(
    setter: React.Dispatch<React.SetStateAction<DeployLogEntry[]>>,
  ) {
    return (id: string, status: DeployLogEntry["status"], detail?: string) => {
      setter(prev => prev.map(l => l.id === id ? { ...l, status, detail } : l));
    };
  }

  function resetState(target: LiveTarget) {
    setDone(false); setError(null);
    if (target === "kubernetes") setK8sLogs(makeK8sLogs(k8sCfg));
    if (target === "render")     setRenderLogs(makeRenderLogs());
    if (target === "railway")    setRailwayLogs(makeRailwayLogs());
    if (target === "fly")        setFlyLogs(makeFlyLogs());
  }

  async function handleDeploy() {
    setDeploying(true);
    setError(null);
    setDone(false);
    try {
      if (target === "kubernetes") {
        setK8sLogs(makeK8sLogs(k8sCfg));
        await deployToKubernetes(k8sCfg, updateLog(setK8sLogs));
      } else if (target === "render") {
        setRenderLogs(makeRenderLogs());
        await deployToRender(renderCfg, updateLog(setRenderLogs));
      } else if (target === "railway") {
        setRailwayLogs(makeRailwayLogs());
        await deployToRailway(railwayCfg, updateLog(setRailwayLogs));
      } else if (target === "fly") {
        setFlyLogs(makeFlyLogs());
        await deployToFly(flyCfg, updateLog(setFlyLogs));
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  const deployProps = {
    deploying,
    done,
    onDeploy: handleDeploy,
    onReset: () => resetState(target),
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Rocket className="h-6 w-6 text-violet-400" /> Direct Deploy
          </h2>
          <p className="text-gray-400 text-sm">
            Deploy <span className="text-violet-300 font-medium">{app.repoName}</span> directly from your browser to your cloud target.
          </p>
        </div>
        <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5 rounded-xl text-xs transition-all">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>

      {/* Target selector */}
      <div className="flex flex-wrap gap-2">
        {TARGETS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTarget(t.id); resetState(t.id); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all",
              target === t.id
                ? "bg-violet-500/15 border-violet-500/50 text-violet-300"
                : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <SecurityNote />

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl">
          <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Per-target form */}
      <div className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        {target === "kubernetes" && (
          <KubernetesForm cfg={k8sCfg} setCfg={setK8sCfg} logs={k8sLogs} {...deployProps} />
        )}
        {target === "render" && (
          <RenderForm cfg={renderCfg} setCfg={setRenderCfg} logs={renderLogs} {...deployProps} />
        )}
        {target === "railway" && (
          <RailwayForm cfg={railwayCfg} setCfg={setRailwayCfg} logs={railwayLogs} {...deployProps} />
        )}
        {target === "fly" && (
          <FlyForm cfg={flyCfg} setCfg={setFlyCfg} logs={flyLogs} {...deployProps} />
        )}
        {target === "ssh" && <SshPanel app={app} />}
      </div>
    </div>
  );
}
