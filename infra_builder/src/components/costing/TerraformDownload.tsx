"use client";

import { useState, useMemo } from "react";
import {
  generateTerraform,
  generateTerraformFiles,
  type TfCloud,
} from "@/lib/kubernetes/terraform-generator";
import {
  generateAltTerraform,
  generateAltTerraformFiles,
  generateAltTfvars,
  type AltTfCloud,
} from "@/lib/kubernetes/cloud-terraform-alt";

type AllCloudTab = TfCloud | AltTfCloud;

const MAIN_CLOUD_TABS: { id: TfCloud; label: string; color: string; flag: string }[] = [
  { id: "eks", label: "AWS",   color: "#ea580c", flag: "🟠" },
  { id: "aks", label: "Azure", color: "#0078d4", flag: "🔵" },
  { id: "gke", label: "GCP",   color: "#1a73e8", flag: "🟢" },
];

const ALT_CLOUD_TABS: { id: AltTfCloud; label: string; color: string; flag: string }[] = [
  { id: "ibm",     label: "IBM Cloud", color: "#0f62fe", flag: "🔷" },
  { id: "oci",     label: "Oracle",    color: "#c74634", flag: "🔴" },
  { id: "alibaba", label: "Alibaba",   color: "#ff6a00", flag: "🟠" },
  { id: "do",      label: "DO",        color: "#0080ff", flag: "🌊" },
  { id: "linode",  label: "Linode",    color: "#00b050", flag: "🟢" },
];

const ALL_CLOUD_TABS = [...MAIN_CLOUD_TABS, ...ALT_CLOUD_TABS];

function isAltCloud(c: AllCloudTab): c is AltTfCloud {
  return ["ibm", "oci", "alibaba", "do", "linode"].includes(c);
}

const ENVIRONMENTS = [
  { id: "dev"     as const, label: "Dev",     color: "#16a34a", icon: "🟢", desc: "Single-AZ · minimal sizes · low cost"         },
  { id: "staging" as const, label: "Staging", color: "#f59e0b", icon: "🟡", desc: "Multi-AZ · production-like · moderate cost"   },
  { id: "prod"    as const, label: "Prod",    color: "#dc2626", icon: "🔴", desc: "HA · full replicas · backups · monitoring"     },
] as const;

type Environment = "dev" | "staging" | "prod";

const FILE_ICONS: Record<string, string> = {
  "main.tf":         "⚙",
  "variables.tf":    "📋",
  "locals.tf":       "🔧",
  "networking.tf":   "🌐",
  "compute.tf":      "💻",
  "database.tf":     "🗄",
  "storage.tf":      "💾",
  "security.tf":     "🔐",
  "loadbalancer.tf": "⚖",
  "monitoring.tf":   "📊",
  "dns.tf":          "🔍",
  "messaging.tf":    "📬",
  "backup.tf":       "🗂",
  "outputs.tf":      "📤",
};

function generateTfvars(cloud: TfCloud, env: Environment, region: string, services: string[]): string {
  const has = (id: string) => services.includes(id);
  const isAws   = cloud === "eks";
  const isAzure = cloud === "aks";

  const cfg = {
    dev: {
      env: "dev",
      nodeCount: 1,
      instance: isAws ? "t3.small"      : isAzure ? "Standard_B2s"    : "e2-small",
      dbClass:  isAws ? "db.t3.micro"   : isAzure ? "Standard_D2s_v3" : "db-f1-micro",
      dbReplicas: 0, multiAz: false, storageGb: 20, backups: false, retention: 7,
    },
    staging: {
      env: "staging",
      nodeCount: 2,
      instance: isAws ? "t3.medium"     : isAzure ? "Standard_D2s_v3" : "e2-medium",
      dbClass:  isAws ? "db.t3.small"   : isAzure ? "Standard_D4s_v3" : "db-n1-standard-1",
      dbReplicas: 1, multiAz: false, storageGb: 50, backups: true, retention: 14,
    },
    prod: {
      env: "prod",
      nodeCount: 3,
      instance: isAws ? "t3.large"      : isAzure ? "Standard_D4s_v3" : "e2-standard-4",
      dbClass:  isAws ? "db.r6g.large"  : isAzure ? "Standard_D8s_v3" : "db-n1-standard-4",
      dbReplicas: 2, multiAz: true, storageGb: 100, backups: true, retention: 30,
    },
  }[env];

  const regionKey = isAws ? "aws_region" : isAzure ? "location" : "gcp_region";

  const lines = [
    `# ${"═".repeat(58)}`,
    `# ${cfg.env.toUpperCase()} Environment — terraform.tfvars`,
    `# Apply with: terraform apply -var-file="${cfg.env}.tfvars"`,
    `# ${"═".repeat(58)}`,
    ``,
    `project_name = "myapp"`,
    `environment  = "${cfg.env}"`,
    `${regionKey}   = "${region}"`,
    ``,
    `# ── Compute ${"─".repeat(49)}`,
  ];

  if (has("control-plane") || has("vm-instance") || has("serverless-compute")) {
    lines.push(
      `node_count    = ${cfg.nodeCount}`,
      `instance_type = "${cfg.instance}"`,
      `multi_az      = ${cfg.multiAz}`,
    );
  }

  if (has("managed-database") || has("database")) {
    lines.push(
      ``,
      `# ── Database ${"─".repeat(48)}`,
      `db_instance_class = "${cfg.dbClass}"`,
      `db_replica_count  = ${cfg.dbReplicas}`,
      `enable_backups    = ${cfg.backups}`,
    );
  }

  if (has("block-storage") || has("object-storage") || has("file-storage")) {
    lines.push(
      ``,
      `# ── Storage ${"─".repeat(49)}`,
      `storage_size_gb = ${cfg.storageGb}`,
    );
  }

  lines.push(
    ``,
    `# ── Feature flags ${"─".repeat(42)}`,
    `enable_monitoring = ${env !== "dev"}`,
    `enable_alerts     = ${env === "prod"}`,
    `log_retention_days = ${cfg.retention}`,
  );

  return lines.join("\n");
}

export function TerraformDownload({
  selected,
  cloud,
  region,
}: {
  selected: Set<string>;
  cloud: TfCloud;
  region: string;
}) {
  const [open,      setOpen]      = useState(false);
  const [cloudTab,  setCloudTab]  = useState<AllCloudTab>(cloud);
  const [env,       setEnv]       = useState<Environment>("dev");
  const [fileTab,   setFileTab]   = useState("main.tf");
  const [viewMode,  setViewMode]  = useState<"files" | "combined">("files");
  const [copied,    setCopied]    = useState(false);

  const services    = useMemo(() => Array.from(selected), [selected]);
  const servicesKey = services.join(",");

  const tfFiles = useMemo(() => {
    if (isAltCloud(cloudTab)) return generateAltTerraformFiles(cloudTab, services, region);
    return generateTerraformFiles(cloudTab, services, region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudTab, servicesKey, region]);

  const combined = useMemo(() => {
    if (isAltCloud(cloudTab)) return generateAltTerraform(cloudTab, services, region);
    return generateTerraform(cloudTab, services, region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudTab, servicesKey, region]);

  const tfvars = useMemo(() => {
    if (isAltCloud(cloudTab)) return generateAltTfvars(cloudTab, env, region, services);
    return generateTfvars(cloudTab, env, region, services);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudTab, env, region, servicesKey]);

  const envLabel = `${env}.tfvars`;

  // Merge .tf files + environment tfvars
  const files: Record<string, string> = useMemo(
    () => ({ ...tfFiles, [envLabel]: tfvars }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tfFiles, tfvars, envLabel]
  );

  const fileNames = Object.keys(files);
  const activeFile = fileNames.includes(fileTab) ? fileTab : fileNames[0] ?? "main.tf";
  const activeCode = viewMode === "combined" ? combined : (files[activeFile] ?? "");

  const cloudColor = ALL_CLOUD_TABS.find(t => t.id === cloudTab)?.color ?? "#ea580c";
  const envMeta    = ENVIRONMENTS.find(e => e.id === env)!;

  function handleCopy() {
    navigator.clipboard.writeText(viewMode === "combined" ? combined : files[activeFile] ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadCurrent() {
    if (viewMode === "combined") {
      const prefix = cloudTab === "eks" ? "aws" : cloudTab === "aks" ? "azure" : cloudTab === "gke" ? "gcp" : cloudTab;
      downloadFile(`${prefix}-${env}-infrastructure.tf`, combined);
    } else {
      downloadFile(activeFile, files[activeFile] ?? "");
    }
  }

  function handleDownloadAll() {
    Object.entries(files).forEach(([name, content], i) => {
      setTimeout(() => downloadFile(name, content), i * 120);
    });
  }

  const tfCount = Object.keys(tfFiles).length;

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────── */}
      <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            padding: "0.65rem 1.25rem", borderRadius: "0.6rem",
            border: "2px solid #16a34a", background: "#f0fdf4",
            color: "#15803d", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}
        >
          ⬇ Generate &amp; Download Terraform
        </button>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Generates {tfCount} <code>.tf</code> files + env-specific <code>dev.tfvars</code> / <code>staging.tfvars</code> / <code>prod.tfvars</code> for all 8 clouds — AWS, Azure, GCP, IBM, Oracle, Alibaba, DO &amp; Linode
        </span>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", top: 0, bottom: 0, right: 0,
            left: "var(--sidebar-w)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.6)", padding: "0.75rem",
          }}
        >
          <div style={{
            background: "#0d1117", borderRadius: "0.75rem",
            width: "min(1100px, 100%)", maxHeight: "95vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 30px 60px rgba(0,0,0,0.7)",
          }}>

            {/* ── Modal header ──────────────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.85rem 1.1rem", borderBottom: "1px solid #21262d",
              background: "#161b22",
            }}>
              <div>
                <span style={{ color: "#e6edf3", fontWeight: 700, fontSize: "0.95rem" }}>
                  Terraform Configuration Files
                </span>
                <span style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "#8b949e" }}>
                  {services.length} service{services.length !== 1 ? "s" : ""} · {tfCount} .tf files + 1 .tfvars · run:{" "}
                  <code style={{ color: "#7ee787" }}>terraform init &amp;&amp; terraform apply -var-file="{env}.tfvars"</code>
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", color: "#8b949e",
                fontSize: "1.4rem", cursor: "pointer", lineHeight: 1, padding: "0.2rem",
              }}>✕</button>
            </div>

            {/* ── Cloud tabs ────────────────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid #21262d", background: "#161b22",
              padding: "0 0.5rem", flexWrap: "wrap", gap: "0.25rem",
            }}>
              <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap" }}>
                {/* Main clouds */}
                <span style={{ display: "flex", alignItems: "center", paddingLeft: "0.5rem", fontSize: "0.62rem", color: "#484f58", fontWeight: 600, letterSpacing: "0.05em", userSelect: "none" }}>LIVE</span>
                {MAIN_CLOUD_TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setCloudTab(tab.id); setFileTab("main.tf"); }}
                    style={{
                      padding: "0.55rem 0.85rem", background: "none", border: "none",
                      borderBottom: cloudTab === tab.id ? `2px solid ${tab.color}` : "2px solid transparent",
                      color: cloudTab === tab.id ? tab.color : "#8b949e",
                      fontWeight: cloudTab === tab.id ? 700 : 400,
                      fontSize: "0.83rem", cursor: "pointer",
                    }}
                  >{tab.flag} {tab.label}</button>
                ))}
                {/* Divider */}
                <span style={{ width: "1px", background: "#30363d", margin: "0.35rem 0.35rem", alignSelf: "stretch" }} />
                {/* Alt clouds */}
                <span style={{ display: "flex", alignItems: "center", fontSize: "0.62rem", color: "#484f58", fontWeight: 600, letterSpacing: "0.05em", userSelect: "none" }}>ALT</span>
                {ALT_CLOUD_TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setCloudTab(tab.id); setFileTab("main.tf"); }}
                    style={{
                      padding: "0.55rem 0.85rem", background: "none", border: "none",
                      borderBottom: cloudTab === tab.id ? `2px solid ${tab.color}` : "2px solid transparent",
                      color: cloudTab === tab.id ? tab.color : "#8b949e",
                      fontWeight: cloudTab === tab.id ? 700 : 400,
                      fontSize: "0.83rem", cursor: "pointer",
                    }}
                  >{tab.flag} {tab.label}</button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.5rem" }}>
                <div style={{ display: "flex", border: "1px solid #30363d", borderRadius: "0.35rem", overflow: "hidden" }}>
                  {(["files", "combined"] as const).map(m => (
                    <button key={m} onClick={() => setViewMode(m)} style={{
                      padding: "0.3rem 0.65rem", fontSize: "0.72rem", fontWeight: 600,
                      background: viewMode === m ? "#21262d" : "transparent",
                      color: viewMode === m ? "#e6edf3" : "#8b949e",
                      border: "none", cursor: "pointer",
                    }}>{m === "files" ? "📂 Separate Files" : "📄 Combined"}</button>
                  ))}
                </div>
                <button onClick={handleCopy} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "0.35rem",
                  border: "1px solid #30363d",
                  background: copied ? "#238636" : "#21262d",
                  color: copied ? "#fff" : "#c9d1d9",
                  fontSize: "0.72rem", cursor: "pointer", fontWeight: 600,
                }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
                <button onClick={handleDownloadCurrent} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "0.35rem",
                  border: `1px solid ${cloudColor}`, background: `${cloudColor}18`,
                  color: cloudColor, fontSize: "0.72rem", cursor: "pointer", fontWeight: 600,
                }}>⬇ {viewMode === "files" ? activeFile : `all-${env}.tf`}</button>
                {viewMode === "files" && (
                  <button onClick={handleDownloadAll} style={{
                    padding: "0.3rem 0.7rem", borderRadius: "0.35rem",
                    border: "1px solid #388bfd", background: "#1f2d3d",
                    color: "#58a6ff", fontSize: "0.72rem", cursor: "pointer", fontWeight: 600,
                  }}>⬇ All {fileNames.length} Files</button>
                )}
              </div>
            </div>

            {/* ── Environment selector ──────────────────────────────── */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.6rem 1rem", borderBottom: "1px solid #21262d",
              background: "#0d1117",
            }}>
              <span style={{ fontSize: "0.72rem", color: "#8b949e", fontWeight: 600, marginRight: "0.25rem", whiteSpace: "nowrap" }}>
                ENVIRONMENT
              </span>
              {ENVIRONMENTS.map(e => (
                <button
                  key={e.id}
                  onClick={() => { setEnv(e.id); setFileTab(e.id === env ? fileTab : `${e.id}.tfvars`); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    padding: "0.3rem 0.75rem", borderRadius: "0.4rem",
                    border: `1px solid ${env === e.id ? e.color : "#30363d"}`,
                    background: env === e.id ? `${e.color}18` : "transparent",
                    color: env === e.id ? e.color : "#8b949e",
                    fontSize: "0.75rem", fontWeight: env === e.id ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {e.icon} {e.label}
                </button>
              ))}
              <span style={{ fontSize: "0.7rem", color: "#8b949e", marginLeft: "0.5rem" }}>
                — {envMeta.desc}
              </span>
            </div>

            {/* ── Layout: file sidebar + code panel ────────────────── */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

              {/* Sidebar */}
              {viewMode === "files" && (
                <div style={{
                  width: "185px", flexShrink: 0,
                  borderRight: "1px solid #21262d",
                  background: "#161b22", overflowY: "auto",
                  padding: "0.5rem 0",
                }}>
                  {/* .tf files section */}
                  <div style={{ padding: "0.4rem 0.85rem 0.2rem", fontSize: "0.68rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Infrastructure — {tfCount}
                  </div>
                  {Object.keys(tfFiles).map(fname => (
                    <button key={fname} onClick={() => setFileTab(fname)} style={{
                      width: "100%", textAlign: "left",
                      padding: "0.45rem 0.85rem",
                      background: activeFile === fname ? "#21262d" : "transparent",
                      borderTop: "none", borderRight: "none", borderBottom: "none",
                      borderLeft: activeFile === fname ? `3px solid ${cloudColor}` : "3px solid transparent",
                      color: activeFile === fname ? "#e6edf3" : "#8b949e",
                      fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
                      fontFamily: "monospace",
                    }}>
                      <span style={{ fontSize: "0.8rem" }}>{FILE_ICONS[fname] ?? "📄"}</span>
                      <span style={{ flex: 1 }}>{fname}</span>
                    </button>
                  ))}

                  {/* tfvars section */}
                  <div style={{ padding: "0.6rem 0.85rem 0.2rem", fontSize: "0.68rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, borderTop: "1px solid #21262d", marginTop: "0.4rem" }}>
                    Environments
                  </div>
                  {ENVIRONMENTS.map(e => {
                    const fname = `${e.id}.tfvars`;
                    const isActive = activeFile === fname;
                    return (
                      <button key={fname} onClick={() => { setEnv(e.id); setFileTab(fname); }} style={{
                        width: "100%", textAlign: "left",
                        padding: "0.45rem 0.85rem",
                        background: isActive ? "#21262d" : "transparent",
                        borderTop: "none", borderRight: "none", borderBottom: "none",
                        borderLeft: isActive ? `3px solid ${e.color}` : "3px solid transparent",
                        color: isActive ? e.color : "#8b949e",
                        fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem",
                        fontFamily: "monospace",
                      }}>
                        <span style={{ fontSize: "0.8rem" }}>{e.icon}</span>
                        <span style={{ flex: 1 }}>{fname}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Code panel */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {viewMode === "files" && (
                  <div style={{
                    padding: "0.45rem 1rem 0",
                    borderBottom: "1px solid #21262d",
                    background: "#0d1117", display: "flex", alignItems: "center", gap: "0.5rem",
                  }}>
                    <span style={{ fontSize: "0.8rem" }}>
                      {activeFile.endsWith(".tfvars")
                        ? ENVIRONMENTS.find(e => activeFile.startsWith(e.id))?.icon ?? "🌿"
                        : FILE_ICONS[activeFile] ?? "📄"}
                    </span>
                    <span style={{
                      color: activeFile.endsWith(".tfvars")
                        ? ENVIRONMENTS.find(e => activeFile.startsWith(e.id))?.color ?? envMeta.color
                        : cloudColor,
                      fontWeight: 700, fontSize: "0.82rem", fontFamily: "monospace",
                    }}>
                      {activeFile}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#8b949e", marginLeft: "0.25rem" }}>
                      {(activeCode.match(/\n/g) ?? []).length + 1} lines
                    </span>
                    {activeFile.endsWith(".tfvars") && (
                      <span style={{ fontSize: "0.7rem", color: envMeta.color, marginLeft: "0.5rem", fontWeight: 600 }}>
                        {envMeta.icon} {envMeta.label} — {envMeta.desc}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: "auto" }}>
                  <pre style={{
                    margin: 0,
                    padding: "0.9rem 1.1rem",
                    fontFamily: "'Fira Code','Cascadia Code','Consolas',monospace",
                    fontSize: "0.72rem",
                    lineHeight: 1.65,
                    color: "#e6edf3",
                    background: "#0d1117",
                    whiteSpace: "pre",
                    overflowX: "auto",
                    minHeight: "100%",
                  }}>
                    <code style={{ color: "inherit" }}>{activeCode}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* ── Footer ────────────────────────────────────────────── */}
            <div style={{
              padding: "0.55rem 1.1rem", borderTop: "1px solid #21262d",
              background: "#161b22", fontSize: "0.72rem", color: "#8b949e",
              display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center",
            }}>
              <span>⚠ Replace placeholder passwords/keys before production use.</span>
              <span>💡 Run <code style={{ color: "#7ee787" }}>terraform fmt</code> after editing to auto-format.</span>
              {viewMode === "files" && (
                <span style={{ marginLeft: "auto" }}>
                  Click <strong style={{ color: "#58a6ff" }}>⬇ All {fileNames.length} Files</strong> to download {tfCount} .tf files + {envMeta.label} .tfvars
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
