"use client";

import { useState, useMemo } from "react";
import {
  generateDeploymentFiles,
  DEFAULT_APP_PROFILE,
  type AppProfile,
  type DeploymentSvcConfig,
  type TfCloud,
} from "@/lib/kubernetes/deployment-generator";
import { AppConfigurator } from "./AppConfigurator";

// ─── File grouping ────────────────────────────────────────────────────────────

interface FileGroup { label: string; match: (f: string) => boolean; icon: string }

const FILE_GROUPS: FileGroup[] = [
  { label: "Container",    icon: "🐳", match: f => f === "Dockerfile" || f === ".dockerignore" },
  { label: "Compose",      icon: "📦", match: f => f === "docker-compose.yml" },
  { label: "Podman",       icon: "🦭", match: f => f === "podman-compose.yml" || f === "pod.yaml" || f === "podman-run.sh" },
  { label: "Kubernetes",   icon: "⚓", match: f => f.startsWith("k8s/") },
  { label: "Helm",         icon: "⛵", match: f => f.startsWith("helm/") },
  { label: "CI/CD",        icon: "🔄", match: f =>
      f.startsWith(".github/") || f === ".gitlab-ci.yml" || f === "azure-pipelines.yml" ||
      f === "Jenkinsfile"     || f.startsWith(".circleci/") || f.startsWith("bamboo-specs/") ||
      f === "bitbucket-pipelines.yml" || f === ".travis.yml" || f === ".drone.yml" ||
      f.startsWith(".teamcity/") },
  { label: "Commands",     icon: "💻", match: f => f === "eks-commands.md" },
  { label: "Deploy",       icon: "⚡", match: f => f === "deploy.sh" },
];

const FILE_ICONS: Record<string, string> = {
  "Dockerfile":                      "🐳",
  ".dockerignore":                   "🚫",
  "docker-compose.yml":              "📦",
  "podman-compose.yml":              "🦭",
  "pod.yaml":                        "🫛",
  "podman-run.sh":                   "▶",
  "k8s/namespace.yaml":              "🗂",
  "k8s/configmap.yaml":              "⚙",
  "k8s/secret.yaml":                 "🔐",
  "k8s/deployment.yaml":             "🚀",
  "k8s/service.yaml":                "🌐",
  "k8s/ingress.yaml":                "↗",
  "k8s/hpa.yaml":                    "📈",
  "k8s/servicemonitor.yaml":         "📊",
  ".github/workflows/deploy.yml":    "⬛",
  ".gitlab-ci.yml":                  "🦊",
  "azure-pipelines.yml":             "🔵",
  "Jenkinsfile":                     "🔧",
  ".circleci/config.yml":            "⭕",
  "bamboo-specs/bamboo.yaml":        "🎋",
  "bitbucket-pipelines.yml":         "🪣",
  ".travis.yml":                     "🚀",
  ".drone.yml":                      "🛸",
  ".teamcity/settings.kts":          "🏗️",
  "eks-commands.md":                 "💻",
  "deploy.sh":                       "⚡",
  "helm/Chart.yaml":                 "⛵",
  "helm/values.yaml":                "🎛",
  "helm/templates/_helpers.tpl":     "🔧",
  "helm/templates/deployment.yaml":  "🚀",
  "helm/templates/service.yaml":     "🌐",
  "helm/templates/ingress.yaml":     "↗",
  "helm/templates/hpa.yaml":         "📈",
};

function fileIcon(name: string) { return FILE_ICONS[name] ?? "📄"; }
function shortName(name: string) { return name.split("/").pop() ?? name; }

// ─── Component ────────────────────────────────────────────────────────────────

export function DeploymentDownload({
  selected,
  cloud,
  region,
  svc,
}: {
  selected: Set<string>;
  cloud: TfCloud;
  region: string;
  svc: DeploymentSvcConfig;
}) {
  const [open, setOpen] = useState(false);
  const [appProfile, setAppProfile] = useState<AppProfile>(DEFAULT_APP_PROFILE);
  const [activeGroup, setActiveGroup] = useState("Container");
  const [activeFile, setActiveFile] = useState("Dockerfile");
  const [copied, setCopied] = useState(false);

  function setField<K extends keyof AppProfile>(key: K, value: AppProfile[K]) {
    setAppProfile(prev => ({ ...prev, [key]: value }));
  }

  const services = useMemo(() => Array.from(selected), [selected]);
  const servicesKey = services.join(",");

  const files = useMemo(
    () => generateDeploymentFiles(cloud, region, services, svc, appProfile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloud, region, servicesKey, svc, appProfile]
  );

  const allFileNames = Object.keys(files);

  const groupFiles = (g: FileGroup) => allFileNames.filter(g.match);
  const activeGroupDef = FILE_GROUPS.find(g => g.label === activeGroup) ?? FILE_GROUPS[0];
  const visibleFiles = groupFiles(activeGroupDef);
  const safeFile = visibleFiles.includes(activeFile) ? activeFile : (visibleFiles[0] ?? allFileNames[0] ?? "Dockerfile");
  const activeCode = files[safeFile] ?? "";

  function handleCopy() {
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadOne(name: string, content: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = shortName(name);
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadAll() {
    Object.entries(files).forEach(([name, content], i) => {
      setTimeout(() => downloadOne(name, content), i * 120);
    });
  }

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
            border: "2px solid #7c3aed", background: "#f5f3ff",
            color: "#6d28d9", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}
        >
          🚀 Configure &amp; Generate Deployment Files
        </button>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Dockerfile · K8s manifests · CI/CD pipeline · Helm chart · deploy.sh
        </span>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", top: 0, bottom: 0, right: 0,
            left: "var(--sidebar-w)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.65)", padding: "0.75rem",
          }}
        >
          <div style={{
            background: "#0d1117", borderRadius: "0.75rem",
            width: "min(1240px, 100%)", maxHeight: "95vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 30px 60px rgba(0,0,0,0.7)",
          }}>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.85rem 1.1rem", borderBottom: "1px solid #21262d", background: "#161b22",
            }}>
              <div>
                <span style={{ color: "#e6edf3", fontWeight: 700, fontSize: "0.95rem" }}>
                  🚀 Application Deployment Files
                </span>
                <span style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "#8b949e" }}>
                  {allFileNames.length} files · deploys to{" "}
                  <span style={{ color: cloud === "eks" ? "#ea580c" : cloud === "aks" ? "#0078d4" : "#16a34a", fontWeight: 600 }}>
                    {cloud === "eks" ? "AWS EKS" : cloud === "aks" ? "Azure AKS" : "GCP GKE"}
                  </span>
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", color: "#8b949e",
                fontSize: "1.4rem", cursor: "pointer", lineHeight: 1, padding: "0.2rem",
              }}>✕</button>
            </div>

            {/* Body: left config panel + right file viewer */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

              {/* Left: App configurator */}
              <div style={{
                width: "340px", flexShrink: 0,
                borderRight: "1px solid #21262d",
                overflowY: "auto", padding: "1rem",
              }}>
                <AppConfigurator profile={appProfile} onChange={setField} />
              </div>

              {/* Right: File viewer */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

                {/* Group tab bar + action buttons */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: "1px solid #21262d", background: "#161b22",
                  padding: "0 0.5rem", flexWrap: "wrap",
                }}>
                  <div style={{ display: "flex" }}>
                    {FILE_GROUPS.map(g => {
                      const gf = groupFiles(g);
                      if (gf.length === 0) return null;
                      return (
                        <button
                          key={g.label}
                          onClick={() => { setActiveGroup(g.label); setActiveFile(gf[0]); }}
                          style={{
                            padding: "0.55rem 0.8rem", background: "none", border: "none",
                            borderBottom: activeGroup === g.label ? "2px solid #7c3aed" : "2px solid transparent",
                            color: activeGroup === g.label ? "#a78bfa" : "#8b949e",
                            fontWeight: activeGroup === g.label ? 700 : 400,
                            fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {g.icon} {g.label} <span style={{ fontSize: "0.7rem" }}>({gf.length})</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem", padding: "0.4rem 0.25rem" }}>
                    <button onClick={handleCopy} style={{
                      padding: "0.28rem 0.65rem", borderRadius: "0.35rem",
                      border: "1px solid #30363d",
                      background: copied ? "#238636" : "#21262d",
                      color: copied ? "#fff" : "#c9d1d9",
                      fontSize: "0.7rem", cursor: "pointer", fontWeight: 600,
                    }}>{copied ? "✓ Copied" : "📋 Copy"}</button>

                    <button onClick={() => downloadOne(safeFile, activeCode)} style={{
                      padding: "0.28rem 0.65rem", borderRadius: "0.35rem",
                      border: "1px solid #7c3aed", background: "#1e0d3a",
                      color: "#a78bfa", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600,
                    }}>⬇ {shortName(safeFile)}</button>

                    <button onClick={handleDownloadAll} style={{
                      padding: "0.28rem 0.65rem", borderRadius: "0.35rem",
                      border: "1px solid #388bfd", background: "#1f2d3d",
                      color: "#58a6ff", fontSize: "0.7rem", cursor: "pointer", fontWeight: 600,
                    }}>⬇ All {allFileNames.length} Files</button>
                  </div>
                </div>

                {/* File sub-tabs for active group */}
                <div style={{
                  display: "flex", borderBottom: "1px solid #21262d",
                  background: "#0d1117", overflowX: "auto", flexShrink: 0,
                }}>
                  {visibleFiles.map(fname => (
                    <button
                      key={fname}
                      onClick={() => setActiveFile(fname)}
                      style={{
                        padding: "0.38rem 0.8rem", background: "none", border: "none",
                        borderBottom: safeFile === fname ? "2px solid #a78bfa" : "2px solid transparent",
                        color: safeFile === fname ? "#e6edf3" : "#8b949e",
                        fontSize: "0.72rem", cursor: "pointer", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: "0.3rem",
                        fontFamily: "monospace",
                      }}
                    >
                      {fileIcon(fname)} {shortName(fname)}
                    </button>
                  ))}
                </div>

                {/* Active file path + line count */}
                <div style={{
                  padding: "0.35rem 1rem", background: "#0d1117",
                  borderBottom: "1px solid #161b22",
                  display: "flex", alignItems: "center", gap: "0.5rem",
                }}>
                  <span style={{ fontSize: "0.8rem" }}>{fileIcon(safeFile)}</span>
                  <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem", fontFamily: "monospace" }}>{safeFile}</span>
                  <span style={{ fontSize: "0.7rem", color: "#6e7681" }}>
                    {(activeCode.match(/\n/g) ?? []).length + 1} lines
                  </span>
                </div>

                {/* Code panel */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <pre style={{
                    margin: 0, padding: "0.9rem 1.1rem",
                    fontFamily: "'Fira Code','Cascadia Code','Consolas',monospace",
                    fontSize: "0.72rem", lineHeight: 1.65,
                    color: "#e6edf3", background: "#0d1117",
                    whiteSpace: "pre", overflowX: "auto", minHeight: "100%",
                  }}>
                    <code>{activeCode}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "0.5rem 1.1rem", borderTop: "1px solid #21262d",
              background: "#161b22", fontSize: "0.7rem", color: "#8b949e",
              display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center",
            }}>
              <span>⚠ Fill <code style={{ color: "#f85149" }}>k8s/secret.yaml</code> with real base64 values before <code>kubectl apply</code>.</span>
              <span>⚡ One-shot deploy: <code style={{ color: "#7ee787" }}>chmod +x deploy.sh &amp;&amp; ./deploy.sh</code></span>
              {appProfile.helmEnabled && (
                <span>
                  ⛵ Helm: <code style={{ color: "#7ee787" }}>
                    helm upgrade --install {appProfile.appName} ./helm -n {appProfile.namespace} --create-namespace
                  </code>
                </span>
              )}
              {cloud === "eks" && (
                <span>☸️ EKS: see <code style={{ color: "#7ee787" }}>Commands</code> tab for step-by-step cluster &amp; ECR deployment guide.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
