"use client";

import { useState, useCallback } from "react";
import {
  Link2, ChevronRight, ChevronLeft,
  Eye, EyeOff, Shield, AlertTriangle, CheckCircle2,
  XCircle, Info, Copy, Download, RefreshCw, Loader2,
  Lock, Globe, GitBranch, Search, FileCode,
  Terminal, Package, Server, Zap, ArrowRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  RepoPlatform, RepoCredentials, DetectedApp, ScanResult,
  Severity, DeployBundle, CicdTarget, ScriptTarget, DeployTarget,
} from "@/lib/deploy/types";
import { analyzeRepoWithCredentials, analyzeFromZipClient } from "@/lib/deploy/analyzer";
import { DirectDeployStep } from "@/components/deploy/DirectDeployStep";
import { scanRepository }             from "@/lib/deploy/scanner";
import { RepoClient, parseRepoUrl }   from "@/lib/deploy/repo-client";
import { ZipClient }                  from "@/lib/deploy/zip-client";
import { generateAllBundles }         from "@/lib/deploy/generators";
import {
  REPORT_OPTIONS, type ReportFormat,
  downloadReport, downloadAllReports,
} from "@/lib/deploy/report-generators";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

interface Selection {
  deploy:  Set<DeployTarget>;
  cicd:    Set<CicdTarget>;
  scripts: Set<ScriptTarget>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  MEDIUM:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW:      "text-blue-400 bg-blue-500/10 border-blue-500/30",
  INFO:     "text-gray-400 bg-white/5 border-white/10",
};

const SEVERITY_ICON: Record<Severity, typeof XCircle> = {
  CRITICAL: XCircle,
  HIGH:     AlertTriangle,
  MEDIUM:   AlertTriangle,
  LOW:      Info,
  INFO:     Info,
};

// ── Report Download Modal ─────────────────────────────────────────────────────

function ReportModal({
  app, scan, open, onClose,
}: {
  app:     DetectedApp;
  scan:    ScanResult;
  open:    boolean;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState<ReportFormat | "all" | null>(null);

  function handleDownload(format: ReportFormat) {
    setDownloading(format);
    setTimeout(() => {
      downloadReport(format, app, scan);
      setDownloading(null);
    }, 80);
  }

  function handleDownloadAll() {
    setDownloading("all");
    downloadAllReports(app, scan);
    setTimeout(() => setDownloading(null), REPORT_OPTIONS.length * 700 + 600);
  }

  if (!open) return null;

  const borderFor: Record<string, string> = {
    violet: "border-violet-500/30 hover:border-violet-400/50 hover:bg-violet-500/10",
    blue:   "border-blue-500/30   hover:border-blue-400/50   hover:bg-blue-500/10",
    purple: "border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-500/10",
    red:    "border-red-500/30    hover:border-red-400/50    hover:bg-red-500/10",
    green:  "border-green-500/30  hover:border-green-400/50  hover:bg-green-500/10",
    gray:   "border-white/[0.12]  hover:border-white/20      hover:bg-white/[0.04]",
  };
  const btnFor: Record<string, string> = {
    violet: "bg-violet-600 hover:bg-violet-500",
    blue:   "bg-blue-600   hover:bg-blue-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    red:    "bg-red-700    hover:bg-red-600",
    green:  "bg-green-600  hover:bg-green-500",
    gray:   "bg-gray-600   hover:bg-gray-500",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a1c] border border-white/[0.1] rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] sticky top-0 bg-[#0a0a1c] z-10">
          <div>
            <h3 className="text-base font-bold text-white">Download Security Report</h3>
            <p className="text-xs text-gray-500 mt-0.5">Choose a format — all reports are generated locally in your browser</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1.5 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5">
          {REPORT_OPTIONS.map(opt => {
            const isLoading = downloading === opt.id;
            const anyLoading = downloading !== null;
            return (
              <div
                key={opt.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-white/[0.02] p-3.5 transition-all",
                  borderFor[opt.colorClass],
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xl leading-none">{opt.icon}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/10 text-gray-400 rounded tracking-wide">
                    .{opt.ext.toLowerCase()}
                  </span>
                </div>
                <div className="font-semibold text-white text-sm mb-0.5">{opt.label}</div>
                <div className="text-[10px] text-gray-500 mb-1">{opt.tagline}</div>
                <div className="text-[10px] text-gray-600 leading-relaxed flex-1 mb-3">
                  {opt.description}
                </div>
                <button
                  onClick={() => handleDownload(opt.id)}
                  disabled={anyLoading}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-white text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                    btnFor[opt.colorClass],
                  )}
                >
                  {isLoading
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                    : <><Download className="h-3 w-3" /> Download</>
                  }
                </button>
              </div>
            );
          })}
        </div>

        {/* Download All */}
        <div className="px-5 pb-5">
          <button
            onClick={handleDownloadAll}
            disabled={downloading !== null}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading === "all"
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Downloading all 6 formats…</>
              : <><Download className="h-4 w-4" /> Download All 6 Formats</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────

function CodeBlock({ content, filename }: { content: string; lang: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = filename.split("/").pop()!;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#080818] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="text-xs font-mono text-gray-400">{filename}</span>
        <div className="flex gap-2">
          <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">
            <Copy className="h-3 w-3" /> {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={download} className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">
            <Download className="h-3 w-3" /> Download
          </button>
        </div>
      </div>
      <pre className="overflow-auto p-4 text-xs text-gray-300 max-h-[520px] font-mono leading-relaxed">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function StepIndicator({
  current, maxReached, onNavigate,
}: {
  current: Step;
  maxReached: Step;
  onNavigate: (s: Step) => void;
}) {
  const steps = [
    { n: 1 as const, label: "Connect" },
    { n: 2 as const, label: "Scan" },
    { n: 3 as const, label: "Configure" },
    { n: 4 as const, label: "Files" },
    { n: 5 as const, label: "Deploy" },
  ];

  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((s, i) => {
        const isCompleted  = current > s.n;
        const isCurrent    = current === s.n;
        const isClickable  = s.n <= maxReached && s.n !== current;
        return (
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => isClickable && onNavigate(s.n)}
                disabled={!isClickable}
                title={isClickable ? `Go to ${s.label}` : undefined}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-all",
                  isCurrent    ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/30"
                  : isCompleted ? "bg-violet-500/20 border-violet-500/50 text-violet-400 hover:bg-violet-500/30 hover:border-violet-400 cursor-pointer"
                  : "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed",
                )}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : s.n}
              </button>
              <span className={cn(
                "text-xs hidden sm:block transition-all",
                isCurrent    ? "text-violet-300 font-medium"
                : isCompleted ? "text-gray-300 cursor-pointer hover:text-violet-300"
                : "text-gray-600",
              )}
                onClick={() => isClickable && onNavigate(s.n)}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "h-px w-16 sm:w-24 mx-2 mb-5 transition-all",
                current > s.n ? "bg-gradient-to-r from-violet-500/60 to-violet-500/30" : "bg-white/10",
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SeverityBadge({ s }: { s: Severity }) {
  const Icon = SEVERITY_ICON[s];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider shrink-0", SEVERITY_COLOR[s])}>
      <Icon className="h-2.5 w-2.5" /> {s}
    </span>
  );
}

// ── Step 1 — Connect ──────────────────────────────────────────────────────────

function ConnectStep({
  creds, setCreds, onNext, loading, error,
}: {
  creds: RepoCredentials;
  setCreds: (c: RepoCredentials) => void;
  onNext: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [showToken, setShowToken] = useState(false);
  const set = (patch: Partial<RepoCredentials>) => setCreds({ ...creds, ...patch });

  const PLATFORMS: { id: RepoPlatform; label: string; placeholder: string }[] = [
    { id: "github",    label: "GitHub",    placeholder: "https://github.com/owner/repo" },
    { id: "gitlab",    label: "GitLab",    placeholder: "https://gitlab.com/group/repo" },
    { id: "bitbucket", label: "Bitbucket", placeholder: "https://bitbucket.org/workspace/repo" },
  ];

  const platform = PLATFORMS.find(p => p.id === creds.platform)!;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Connect Repository</h2>
        <p className="text-gray-400 text-sm">Enter your repository details. Credentials are used only in this browser session and never sent to TechAtlas servers.</p>
      </div>

      {/* Platform selector */}
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Platform</label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              onClick={() => set({ platform: p.id })}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all",
                creds.platform === p.id
                  ? "bg-violet-500/15 border-violet-500/50 text-violet-300"
                  : "bg-white/5 border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-white"
              )}
            >
              <Link2 className="h-4 w-4" /> {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Repo URL */}
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Repository URL</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="url"
            value={creds.repoUrl}
            onChange={e => set({ repoUrl: e.target.value })}
            placeholder={platform.placeholder}
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Branch */}
      <div>
        <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Branch</label>
        <div className="relative">
          <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={creds.branch}
            onChange={e => set({ branch: e.target.value })}
            placeholder="main"
            className="w-full pl-9 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Bitbucket username */}
      {creds.platform === "bitbucket" && (
        <div>
          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Bitbucket Username</label>
          <input
            type="text"
            value={creds.username ?? ""}
            onChange={e => set({ username: e.target.value })}
            placeholder="your-username"
            className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500/50 transition-all"
          />
        </div>
      )}

      {/* PAT */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider">
            {creds.platform === "github"    ? "GitHub Personal Access Token"
            : creds.platform === "gitlab"   ? "GitLab Personal Access Token"
            : "Bitbucket App Password"}
          </label>
          <span className="text-xs text-gray-600">Required for private repos &amp; scanning</span>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type={showToken ? "text" : "password"}
            value={creds.token}
            onChange={e => set({ token: e.target.value })}
            placeholder={creds.platform === "github" ? "ghp_…" : creds.platform === "gitlab" ? "glpat-…" : "App password"}
            className="w-full pl-9 pr-10 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
          />
          <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-3.5 bg-violet-500/5 border border-violet-500/20 rounded-xl">
        <Shield className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-400 leading-relaxed">
          Your token is stored only in browser memory for this session. It is used solely to call the {platform.label} API directly from your browser — it is never transmitted to TechAtlas servers or logged anywhere.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl">
          <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <button
        onClick={onNext}
        disabled={loading || !creds.repoUrl.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm transition-all"
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting &amp; Scanning…</>
          : <><Search className="h-4 w-4" /> Connect &amp; Scan</>}
      </button>
    </div>
  );
}

// ── Step 2 — Scan Results ─────────────────────────────────────────────────────

function ScanStep({
  app, scan, onNext, onBack,
}: {
  app: DetectedApp;
  scan: ScanResult;
  onNext: () => void;
  onBack: () => void;
}) {
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [filterSev,       setFilterSev]       = useState<Severity | "ALL">("ALL");
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const scoreColor =
    scan.score >= 80 ? "text-green-400" : scan.score >= 50 ? "text-yellow-400" : "text-red-400";
  const scoreLabel =
    scan.score >= 80 ? "Good" : scan.score >= 50 ? "Fair" : "Poor";

  const filtered =
    filterSev === "ALL" ? scan.findings : scan.findings.filter(f => f.severity === filterSev);

  const langColors: Record<string, string> = {
    nodejs: "text-green-400", python: "text-yellow-400", go: "text-cyan-400",
    java: "text-orange-400", rust: "text-orange-300", ruby: "text-red-400",
    php: "text-violet-400", csharp: "text-blue-400", unknown: "text-gray-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Scan Results</h2>
          <p className="text-gray-400 text-sm">Code analysis for <span className="text-violet-300 font-medium">{app.repoOwner}/{app.repoName}</span></p>
        </div>
        <div className="text-right">
          <div className={cn("text-4xl font-black", scoreColor)}>{scan.score}</div>
          <div className="text-xs text-gray-500">Security Score — {scoreLabel}</div>
        </div>
      </div>

      {/* Scanner info banner */}
      <div className="flex flex-wrap items-start gap-4 p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25">
            <Shield className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">TechAtlas SAST Engine</div>
            <div className="text-[10px] text-gray-500">Static Application Security Testing</div>
          </div>
        </div>
        <div className="h-px sm:h-auto sm:w-px bg-white/[0.06] self-stretch" />
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-gray-400 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            <span><span className="text-gray-300 font-medium">Engine:</span> Pattern-based regex SAST (client-side, in-browser)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            <span><span className="text-gray-300 font-medium">Coverage:</span> OWASP Top 10 · CWE Top 25</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            <span><span className="text-gray-300 font-medium">Rules:</span> 20 patterns — Secrets, SQLi, XSS, Command Injection, IDOR, Weak Crypto, CORS, Path Traversal, Insecure Deserialisation, Debug Flags</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            <span><span className="text-gray-300 font-medium">Languages:</span> JS/TS, Python, Go, Java, Rust, Ruby, PHP, C# + config files</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
            <span><span className="text-gray-300 font-medium">Files scanned:</span> {scan.filesScanned} source files (up to 60 per repo, 120 KB per file)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-amber-400/80">Note: pattern matching may produce false positives. Always review findings before acting.</span>
          </span>
        </div>
      </div>

      {/* Detection summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Language",    value: app.language,    color: langColors[app.language] },
          { label: "Framework",   value: app.framework !== "none" ? app.framework : "—" },
          { label: "Port",        value: String(app.port) },
          { label: "Package Mgr", value: app.packageManager ?? "none" },
        ].map(card => (
          <div key={card.label} className="p-3.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
            <div className="text-xs text-gray-500 mb-1">{card.label}</div>
            <div className={cn("text-sm font-semibold text-white", card.color)}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Severity summary pills */}
      <div className="grid grid-cols-5 gap-2">
        {(["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as Severity[]).map(s => {
          const count = scan.findings.filter(f => f.severity === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterSev(filterSev === s ? "ALL" : s)}
              className={cn(
                "p-2.5 rounded-xl border text-center transition-all",
                filterSev === s ? SEVERITY_COLOR[s] : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]",
              )}
            >
              <div className={cn("text-lg font-black", count > 0 ? SEVERITY_COLOR[s].split(" ")[0] : "text-gray-600")}>{count}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">{s}</div>
            </button>
          );
        })}
      </div>

      {/* Findings */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
            <CheckCircle2 className="h-5 w-5 text-green-500" /> No findings for this severity level
          </div>
        ) : (
          filtered.map(f => {
            const key    = f.id + f.file + f.line;
            const isOpen = expanded === key;
            return (
              <div key={key} className="border border-white/[0.06] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-start gap-3 p-3.5 text-left hover:bg-white/[0.03] transition-all"
                >
                  <SeverityBadge s={f.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{f.title}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{f.file}:{f.line}</div>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 text-gray-600 shrink-0 mt-0.5 transition-transform", isOpen && "rotate-90")} />
                </button>
                {isOpen && (
                  <div className="border-t border-white/[0.06] p-4 space-y-3 bg-white/[0.01]">
                    <pre className="text-xs font-mono text-red-300 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2 overflow-x-auto">{f.snippet}</pre>
                    <div>
                      <div className="text-xs text-gray-500 font-medium mb-1">What&apos;s wrong</div>
                      <p className="text-sm text-gray-300">{f.description}</p>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-medium mb-1">How to fix</div>
                      <p className="text-sm text-gray-300">{f.fix}</p>
                    </div>
                    {f.fixCode && (
                      <pre className="text-xs font-mono text-green-300 bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2 overflow-x-auto">{f.fixCode}</pre>
                    )}
                    {f.cwe && <div className="text-xs text-gray-600">{f.cwe}</div>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => setReportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 border border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20 hover:text-green-200 rounded-xl text-sm font-medium transition-all"
        >
          <Download className="h-4 w-4" /> Download Report
        </button>
        <button onClick={onNext} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-semibold text-sm transition-all">
          Configure Output <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <ReportModal app={app} scan={scan} open={reportModalOpen} onClose={() => setReportModalOpen(false)} />
    </div>
  );
}

// ── Step 3 — Configure ────────────────────────────────────────────────────────

function ConfigureStep({
  selection, setSelection, onNext, onBack,
}: {
  selection: Selection;
  setSelection: (s: Selection) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const toggle = <T extends string>(set: Set<T>, key: T): Set<T> => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  };

  const DEPLOY_OPTIONS: { id: DeployTarget; label: string; icon: string; desc: string }[] = [
    { id: "dockerfile",    label: "Dockerfile",           icon: "🐳", desc: "Multi-stage image" },
    { id: "docker-compose", label: "Docker Compose",      icon: "📦", desc: "Local full stack" },
    { id: "podman",        label: "Podman",               icon: "🦭", desc: "Rootless containers" },
    { id: "kubernetes",    label: "Kubernetes",           icon: "☸️", desc: "K8s manifests" },
    { id: "helm",          label: "Helm Chart",           icon: "⛵", desc: "Parameterised chart" },
    { id: "eks",           label: "AWS EKS",              icon: "☸️", desc: "EKS + eksctl + ECR" },
    { id: "ecs-fargate",   label: "AWS ECS Fargate",      icon: "🟠", desc: "Serverless AWS" },
    { id: "cloud-run",     label: "Google Cloud Run",     icon: "🔵", desc: "Serverless GCP" },
    { id: "azure-aca",     label: "Azure Container Apps", icon: "🔷", desc: "Serverless Azure" },
  ];

  const CICD_OPTIONS: { id: CicdTarget; label: string; icon: string }[] = [
    { id: "github-actions",      label: "GitHub Actions",      icon: "⚙️" },
    { id: "gitlab-ci",           label: "GitLab CI",           icon: "🦊" },
    { id: "jenkins",             label: "Jenkins",             icon: "🔧" },
    { id: "circleci",            label: "CircleCI",            icon: "🔵" },
    { id: "azure-devops",        label: "Azure DevOps",        icon: "☁️" },
    { id: "bitbucket-pipelines", label: "Bitbucket Pipelines", icon: "🪣" },
    { id: "bamboo",              label: "Bamboo",              icon: "🎋" },
    { id: "travis-ci",           label: "Travis CI",           icon: "🚀" },
    { id: "drone-ci",            label: "Drone CI",            icon: "🛸" },
    { id: "teamcity",            label: "TeamCity",            icon: "🏗️" },
  ];

  const SCRIPT_OPTIONS: { id: ScriptTarget; label: string; icon: string; desc: string }[] = [
    { id: "bash",       label: "Bash",       icon: "💻", desc: "Linux / macOS" },
    { id: "powershell", label: "PowerShell", icon: "🔵", desc: "Windows (PS7)" },
    { id: "python",     label: "Python",     icon: "🐍", desc: "Cross-platform" },
    { id: "makefile",   label: "Makefile",   icon: "⚙️", desc: "GNU Make" },
  ];

  const total = selection.deploy.size + selection.cicd.size + selection.scripts.size;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Configure Output</h2>
        <p className="text-gray-400 text-sm">Select the deployment targets, CI/CD pipelines, and scripts to generate.</p>
      </div>

      {/* Deploy targets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Server className="h-4 w-4 text-violet-400" /> Deploy Targets
          </h3>
          <span className="text-xs text-gray-600">{selection.deploy.size} selected</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {DEPLOY_OPTIONS.map(o => (
            <button
              key={o.id}
              onClick={() => setSelection({ ...selection, deploy: toggle(selection.deploy, o.id) })}
              className={cn(
                "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all",
                selection.deploy.has(o.id)
                  ? "bg-violet-500/15 border-violet-500/40"
                  : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
              )}
            >
              <span className="text-lg leading-none">{o.icon}</span>
              <div>
                <div className={cn("text-xs font-medium", selection.deploy.has(o.id) ? "text-violet-200" : "text-gray-300")}>{o.label}</div>
                <div className="text-[10px] text-gray-600">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CI/CD */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" /> CI/CD Pipelines
          </h3>
          <span className="text-xs text-gray-600">{selection.cicd.size} selected</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {CICD_OPTIONS.map(o => (
            <button
              key={o.id}
              onClick={() => setSelection({ ...selection, cicd: toggle(selection.cicd, o.id) })}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all",
                selection.cicd.has(o.id)
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
                  : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
              )}
            >
              <span className="text-base leading-none">{o.icon}</span>
              <span className="text-xs font-medium">{o.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Scripts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-green-400" /> Deploy Scripts
          </h3>
          <span className="text-xs text-gray-600">{selection.scripts.size} selected</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCRIPT_OPTIONS.map(o => (
            <button
              key={o.id}
              onClick={() => setSelection({ ...selection, scripts: toggle(selection.scripts, o.id) })}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                selection.scripts.has(o.id)
                  ? "bg-green-500/10 border-green-500/30 text-green-200"
                  : "bg-white/[0.03] border-white/[0.06] text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
              )}
            >
              <span className="text-base leading-none">{o.icon}</span>
              <div>
                <div className="text-xs font-medium">{o.label}</div>
                <div className="text-[10px] text-gray-600">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5 rounded-xl text-sm transition-all">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={total === 0}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm transition-all"
        >
          Generate {total > 0 ? `${total} bundle${total !== 1 ? "s" : ""}` : "files"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 4 — Files ────────────────────────────────────────────────────────────

function FilesStep({
  app, bundles, scan, selection, onBack, onReset, onDeploy,
}: {
  app:       DetectedApp;
  bundles:   DeployBundle[];
  scan:      ScanResult;
  selection: Selection;
  onBack:    () => void;
  onReset:   () => void;
  onDeploy:  () => void;
}) {
  type Tab = "deploy" | "cicd" | "script" | "security";
  const [tab,             setTab]             = useState<Tab>("deploy");
  const [bundleIdx,       setBundleIdx]       = useState(0);
  const [fileIdx,         setFileIdx]         = useState(0);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const filtered = bundles.filter(b =>
    (b.category === "deploy"  && selection.deploy.has(b.target  as DeployTarget))  ||
    (b.category === "cicd"    && selection.cicd.has(b.target    as CicdTarget))    ||
    (b.category === "script"  && selection.scripts.has(b.target as ScriptTarget))
  );

  const byCategory = {
    deploy:  filtered.filter(b => b.category === "deploy"),
    cicd:    filtered.filter(b => b.category === "cicd"),
    script:  filtered.filter(b => b.category === "script"),
  };

  const currentBundles = tab === "security" ? [] : (byCategory[tab as keyof typeof byCategory] ?? []);
  const currentBundle  = currentBundles[bundleIdx];

  function switchTab(t: Tab) { setTab(t); setBundleIdx(0); setFileIdx(0); }
  function switchBundle(i: number) { setBundleIdx(i); setFileIdx(0); }

  const TABS: { id: Tab; label: string; count: number; Icon: typeof Server }[] = [
    { id: "deploy",   label: "Deploy",   count: byCategory.deploy.length,  Icon: Server },
    { id: "cicd",     label: "CI/CD",    count: byCategory.cicd.length,    Icon: Zap },
    { id: "script",   label: "Scripts",  count: byCategory.script.length,  Icon: Terminal },
    { id: "security", label: "Security", count: scan.findings.length,      Icon: Shield },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Generated Files</h2>
          <p className="text-gray-400 text-sm">{filtered.length} bundle{filtered.length !== 1 ? "s" : ""} ready</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="flex items-center gap-1.5 px-3 py-2 border border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/5 rounded-xl text-xs transition-all">
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs transition-all">
            <RefreshCw className="h-3.5 w-3.5" /> Reset
          </button>
          <button onClick={onDeploy} className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-violet-500/20">
            <Zap className="h-3.5 w-3.5" /> Deploy Now
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
              tab === t.id ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
            {t.count > 0 && (
              <span className={cn("px-1.5 py-0.5 rounded-md text-[10px]", tab === t.id ? "bg-white/20" : "bg-white/10 text-gray-500")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Security report tab */}
      {tab === "security" && (
        <div className="space-y-3">
          {/* Download row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-gray-500">
              {scan.findings.length} finding{scan.findings.length !== 1 ? "s" : ""} &middot; score&nbsp;
              <span className={cn(
                "font-semibold",
                scan.score >= 80 ? "text-green-400" : scan.score >= 50 ? "text-yellow-400" : "text-red-400"
              )}>{scan.score}/100</span>
            </span>
            <button
              onClick={() => setReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 hover:text-green-200 rounded-xl text-xs font-medium transition-all"
            >
              <Download className="h-3.5 w-3.5" /> Download Report
            </button>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {scan.findings.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
                <CheckCircle2 className="h-5 w-5 text-green-500" /> No vulnerabilities found
              </div>
            ) : (
              scan.findings.map((f, i) => (
                <div key={i} className={cn("p-4 rounded-xl border space-y-2", SEVERITY_COLOR[f.severity])}>
                  <div className="flex items-start gap-3">
                    <SeverityBadge s={f.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white">{f.title}</div>
                      <div className="text-xs opacity-70 truncate">{f.file}:{f.line}{f.cwe ? ` · ${f.cwe}` : ""}</div>
                    </div>
                  </div>
                  <pre className="text-xs font-mono opacity-80 bg-black/20 px-3 py-1.5 rounded-lg overflow-x-auto">{f.snippet}</pre>
                  <p className="text-xs opacity-80">{f.description}</p>
                  <div className="text-xs font-medium opacity-90">Fix: {f.fix}</div>
                  {f.fixCode && (
                    <pre className="text-xs font-mono text-green-300 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg overflow-x-auto">{f.fixCode}</pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* File bundles */}
      {tab !== "security" && (
        <>
          {currentBundles.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              No files in this category
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Bundle list */}
              <div className="lg:col-span-1 space-y-1">
                {currentBundles.map((b, i) => (
                  <button
                    key={b.target}
                    onClick={() => switchBundle(i)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all",
                      bundleIdx === i
                        ? "bg-violet-500/15 border border-violet-500/30 text-violet-200"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                    )}
                  >
                    <span className="text-base">{b.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{b.label}</div>
                      <div className="text-[10px] text-gray-600">{b.files.length} file{b.files.length !== 1 ? "s" : ""}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* File viewer */}
              <div className="lg:col-span-3 space-y-3">
                {currentBundle && (
                  <>
                    {currentBundle.files.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentBundle.files.map((f, i) => (
                          <button
                            key={i}
                            onClick={() => setFileIdx(i)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all",
                              fileIdx === i
                                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                : "bg-white/5 text-gray-500 hover:text-gray-300"
                            )}
                          >
                            <FileCode className="h-3 w-3" />
                            {f.filename.split("/").pop()}
                          </button>
                        ))}
                      </div>
                    )}
                    {currentBundle.files[fileIdx] && (
                      <CodeBlock
                        content={currentBundle.files[fileIdx].content}
                        lang={currentBundle.files[fileIdx].lang}
                        filename={currentBundle.files[fileIdx].filepath}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
      <ReportModal app={app} scan={scan} open={reportModalOpen} onClose={() => setReportModalOpen(false)} />
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function DeployPage() {
  const [step,         setStep]         = useState<Step>(1);
  const [maxReached,   setMaxReached]   = useState<Step>(1);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState("");

  function goToStep(s: Step) {
    setStep(s);
    if (s > maxReached) setMaxReached(s);
  }

  const [creds, setCreds] = useState<RepoCredentials>({
    platform: "github",
    repoUrl:  "",
    token:    "",
    branch:   "main",
    username: "",
  });

  const [app,     setApp]     = useState<DetectedApp | null>(null);
  const [scan,    setScan]    = useState<ScanResult   | null>(null);
  const [bundles, setBundles] = useState<DeployBundle[]>([]);

  const [selection, setSelection] = useState<Selection>({
    deploy:  new Set<DeployTarget>(["dockerfile","docker-compose","podman","kubernetes","helm","eks","ecs-fargate","cloud-run","azure-aca"]),
    cicd:    new Set<CicdTarget>(["github-actions","gitlab-ci","jenkins","circleci","azure-devops","bitbucket-pipelines","bamboo","travis-ci","drone-ci","teamcity"]),
    scripts: new Set<ScriptTarget>(["bash","powershell","python","makefile"]),
  });

  const handleConnect = useCallback(async () => {
    if (!creds.repoUrl.trim()) return;
    setLoading(true);
    setError(null);
    setScanProgress("Connecting to repository…");

    try {
      const parsed         = parseRepoUrl(creds.repoUrl);
      const useZip         = parsed?.platform === "github" && !creds.token.trim();
      const branch         = creds.branch.trim() || "main";

      if (useZip) {
        // Public GitHub repo — download ZIP archive; no API calls, no rate limits
        let zipClient: ZipClient;
        try {
          zipClient = await ZipClient.download(
            parsed!.owner, parsed!.repo, branch,
            msg => setScanProgress(msg),
          );
        } catch (zipErr) {
          const msg = zipErr instanceof Error ? zipErr.message : String(zipErr);
          if (msg.includes("zip-not-found")) {
            setError("Repository not found. Check the URL — or add a token if this is a private repo.");
          } else {
            // ZIP failed; fall through to API path which will surface the real error
            const result = await analyzeRepoWithCredentials(creds);
            if (!result.ok || !result.app) { setError(result.error ?? "Analysis failed"); return; }
            setApp(result.app);
            const client = new RepoClient(creds);
            setScan(await scanRepository(client, creds.branch || result.app.defaultBranch, msg => setScanProgress(msg)));
            goToStep(2);
          }
          return;
        }

        const result = await analyzeFromZipClient(zipClient, { ...creds, branch });
        if (!result.ok || !result.app) { setError(result.error ?? "Analysis failed"); return; }
        setApp(result.app);
        setScan(await scanRepository(zipClient, branch, msg => setScanProgress(msg)));
        goToStep(2);
        return;
      }

      // Private repo or non-GitHub — use authenticated API
      const result = await analyzeRepoWithCredentials(creds);
      if (!result.ok || !result.app) { setError(result.error ?? "Analysis failed"); return; }
      setApp(result.app);
      const client = new RepoClient(creds);
      const ref    = creds.branch || result.app.defaultBranch;
      setScan(await scanRepository(client, ref, msg => setScanProgress(msg)));
      goToStep(2);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
      setScanProgress("");
    }
  }, [creds]);

  function handleGenerateFiles() {
    if (!app) return;
    setBundles(generateAllBundles(app));
    goToStep(4);
  }

  function reset() {
    setStep(1); setMaxReached(1); setApp(null); setScan(null); setBundles([]); setError(null);
  }

  return (
    <div className="h-full overflow-y-auto bg-[#060610] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="w-full px-6 lg:px-10 py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white">Deploy Ready</h1>
              <p className="text-gray-500 text-sm">Connect a repository — get Dockerfiles, K8s manifests, CI/CD pipelines, deploy scripts, and a security scan.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-10 py-10">
        <StepIndicator current={step} maxReached={maxReached} onNavigate={goToStep} />

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-[#060610]/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#0c0c20] border border-white/[0.08] rounded-2xl p-8 flex flex-col items-center gap-4 max-w-xs text-center">
              <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
              <div>
                <div className="text-white font-semibold mb-1">Analysing &amp; Scanning</div>
                <div className="text-xs text-gray-500 min-h-[1rem]">{scanProgress}</div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <ConnectStep
            creds={creds} setCreds={setCreds}
            onNext={handleConnect} loading={loading} error={error}
          />
        )}

        {step === 2 && app && scan && (
          <ScanStep
            app={app} scan={scan}
            onNext={() => goToStep(3)} onBack={() => goToStep(1)}
          />
        )}

        {step === 3 && (
          <ConfigureStep
            selection={selection} setSelection={setSelection}
            onNext={handleGenerateFiles} onBack={() => goToStep(2)}
          />
        )}

        {step === 4 && bundles.length > 0 && scan && app && (
          <FilesStep
            app={app} bundles={bundles} scan={scan} selection={selection}
            onBack={() => goToStep(3)} onReset={reset}
            onDeploy={() => goToStep(5)}
          />
        )}

        {step === 5 && app && (
          <DirectDeployStep app={app} onBack={() => goToStep(4)} />
        )}
      </div>
    </div>
  );
}
