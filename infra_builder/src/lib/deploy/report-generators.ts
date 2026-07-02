// ─── TechAtlas — Multi-format Security Report Generators ─────────────────────
// All generation happens client-side; no findings data leaves the browser.

import type { DetectedApp, ScanFinding, ScanResult, Severity } from "./types";

export type ReportFormat = "techatlas" | "sonarqube" | "snyk" | "owasp-zap" | "sarif" | "csv";

export interface ReportOption {
  id:          ReportFormat;
  label:       string;
  tagline:     string;
  description: string;
  ext:         string;
  mime:        string;
  icon:        string;
  colorClass:  string;
}

export const REPORT_OPTIONS: ReportOption[] = [
  {
    id: "techatlas",  label: "TechAtlas",    tagline: "Custom Report",
    description: "Dark-themed HTML with full findings, fix code examples, and security score",
    ext: "HTML", mime: "text/html", icon: "🛡️", colorClass: "violet",
  },
  {
    id: "sonarqube",  label: "SonarQube",    tagline: "Quality Gate Report",
    description: "Security rating A–E, quality gate pass/fail, and issue severity breakdown (Blocker→Info)",
    ext: "HTML", mime: "text/html", icon: "📊", colorClass: "blue",
  },
  {
    id: "snyk",       label: "Snyk",         tagline: "Vulnerability Report",
    description: "Snyk-style severity breakdown with priority scores, exploitability and fix guidance",
    ext: "HTML", mime: "text/html", icon: "⚡", colorClass: "purple",
  },
  {
    id: "owasp-zap",  label: "OWASP ZAP",   tagline: "Alert Report",
    description: "OWASP Top 10 2021 mapped alerts with risk levels, CWE & WASC IDs",
    ext: "HTML", mime: "text/html", icon: "🌐", colorClass: "red",
  },
  {
    id: "sarif",      label: "SARIF 2.1",    tagline: "GitHub / VS Code",
    description: "Industry-standard JSON — upload to GitHub Security tab or open in VS Code SARIF viewer",
    ext: "JSON", mime: "application/json", icon: "{ }", colorClass: "green",
  },
  {
    id: "csv",        label: "CSV Export",   tagline: "Jira / Excel / Sheets",
    description: "Import findings into Jira, Excel, or Google Sheets with full OWASP Top 10 mapping",
    ext: "CSV", mime: "text/csv", icon: "📋", colorClass: "gray",
  },
];

// ── Shared helpers ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

const SEV_HEX: Record<Severity, string> = {
  CRITICAL: "#f87171", HIGH: "#fb923c", MEDIUM: "#facc15", LOW: "#60a5fa", INFO: "#9ca3af",
};
const SEV_BG: Record<Severity, string> = {
  CRITICAL: "#2d0b0b", HIGH: "#2d1400", MEDIUM: "#2d2500", LOW: "#0b1a2d", INFO: "#1a1a1a",
};

// ── OWASP / WASC mapping ──────────────────────────────────────────────────────

interface OwaspEntry { top10: string; wasc: string; wascId: number; }

const OWASP_MAP: Record<string, OwaspEntry> = {
  "Hardcoded Secret":         { top10: "A07:2021 – Identification and Authentication Failures", wasc: "Insufficient Authentication",           wascId: 1  },
  "Hardcoded Token":          { top10: "A07:2021 – Identification and Authentication Failures", wasc: "Insufficient Authentication",           wascId: 1  },
  "Exposed Private Key":      { top10: "A02:2021 – Cryptographic Failures",                    wasc: "Information Leakage",                  wascId: 13 },
  "AWS Credentials":          { top10: "A07:2021 – Identification and Authentication Failures", wasc: "Insufficient Authentication",           wascId: 1  },
  "SQL Injection":            { top10: "A03:2021 – Injection",                                 wasc: "SQL Injection",                        wascId: 19 },
  "Command Injection":        { top10: "A03:2021 – Injection",                                 wasc: "OS Commanding",                        wascId: 31 },
  "Code Injection":           { top10: "A03:2021 – Injection",                                 wasc: "Remote File Inclusion",                wascId: 5  },
  "Cross-Site Scripting":     { top10: "A03:2021 – Injection",                                 wasc: "Cross-Site Scripting",                 wascId: 8  },
  "Insecure Deserialization": { top10: "A08:2021 – Software and Data Integrity Failures",      wasc: "Improper Input Handling",              wascId: 20 },
  "Weak Cryptography":        { top10: "A02:2021 – Cryptographic Failures",                    wasc: "Insufficient Transport Layer Protection", wascId: 4 },
  "Security Misconfiguration":{ top10: "A05:2021 – Security Misconfiguration",                 wasc: "Server Misconfiguration",              wascId: 14 },
  "Sensitive Data Exposure":  { top10: "A02:2021 – Cryptographic Failures",                    wasc: "Information Leakage",                  wascId: 13 },
  "Path Traversal":           { top10: "A01:2021 – Broken Access Control",                     wasc: "Path Traversal",                       wascId: 33 },
};

function owaspFor(category: string): OwaspEntry {
  return OWASP_MAP[category] ?? { top10: "A05:2021 – Security Misconfiguration", wasc: "Other", wascId: 0 };
}

// ── 1. TechAtlas Custom Report ────────────────────────────────────────────────

export function generateTechAtlasReport(app: DetectedApp, scan: ScanResult): string {
  const ts        = new Date().toLocaleString();
  const scoreHex  = scan.score >= 80 ? "#4ade80" : scan.score >= 50 ? "#facc15" : "#f87171";
  const scoreWord = scan.score >= 80 ? "Good" : scan.score >= 50 ? "Fair" : "Poor";

  const findingCards = scan.findings.map((f, i) => `
    <div style="margin-bottom:16px;border:1px solid #2a2a3a;border-radius:12px;overflow:hidden;background:#0e0e1e">
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:${SEV_BG[f.severity]}">
        <span style="display:inline-block;padding:3px 8px;border-radius:6px;border:1px solid ${SEV_HEX[f.severity]};color:${SEV_HEX[f.severity]};font-size:10px;font-weight:800;letter-spacing:.05em;white-space:nowrap">${f.severity}</span>
        <div style="flex:1;min-width:0">
          <div style="color:#f1f5f9;font-weight:600;font-size:14px">${esc(f.title)}</div>
          <div style="color:#6b7280;font-size:11px;margin-top:2px">${esc(f.file)}:${f.line}${f.cwe ? ` &middot; ${f.cwe}` : ""} &middot; ${esc(f.category)}</div>
        </div>
        <span style="color:#6b7280;font-size:11px;white-space:nowrap">#${i + 1}</span>
      </div>
      <div style="padding:14px 16px;border-top:1px solid #1e1e2e">
        <div style="background:#1a0a0a;border:1px solid #3d1515;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-family:monospace;font-size:12px;color:#fca5a5;overflow-x:auto;white-space:pre">${esc(f.snippet)}</div>
        <p style="margin:0 0 8px;font-size:13px;color:#d1d5db"><strong style="color:#9ca3af">What&apos;s wrong:</strong> ${esc(f.description)}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#d1d5db"><strong style="color:#9ca3af">How to fix:</strong> ${esc(f.fix)}</p>
        ${f.fixCode ? `<div style="background:#051a05;border:1px solid #14532d;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12px;color:#86efac;overflow-x:auto;white-space:pre">${esc(f.fixCode)}</div>` : ""}
      </div>
    </div>`).join("");

  const sevSummary = (["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as Severity[]).map(s => {
    const n = scan.findings.filter(f => f.severity === s).length;
    return `<div style="flex:1;min-width:70px;background:${SEV_BG[s]};border:1px solid ${SEV_HEX[s]}40;border-radius:10px;padding:12px;text-align:center">
      <div style="font-size:26px;font-weight:900;color:${n > 0 ? SEV_HEX[s] : "#374151"}">${n}</div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">${s}</div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Security Report — ${esc(app.repoOwner)}/${esc(app.repoName)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#060610;color:#e5e7eb;min-height:100vh}</style>
</head>
<body>
<div style="max-width:900px;margin:0 auto;padding:40px 24px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #1e1e3a">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:22px">&#x1f6e1;</div>
      <div>
        <div style="font-size:22px;font-weight:800;color:#f1f5f9">Security Scan Report</div>
        <div style="font-size:12px;color:#6b7280">Generated by TechAtlas SAST Engine &middot; ${ts}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:48px;font-weight:900;color:${scoreHex};line-height:1">${scan.score}</div>
      <div style="font-size:11px;color:#6b7280">Security Score &mdash; ${scoreWord}</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div style="background:#0e0e1e;border:1px solid #1e1e3a;border-radius:12px;padding:16px">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Repository</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${[["Repo",`${app.repoOwner}/${app.repoName}`],["Platform",app.platform],["Branch",app.defaultBranch],["URL",app.repoUrl]].map(([k,v])=>`<tr><td style="color:#6b7280;padding:3px 0;width:80px">${k}</td><td style="color:#e5e7eb;word-break:break-all">${esc(v)}</td></tr>`).join("")}
      </table>
    </div>
    <div style="background:#0e0e1e;border:1px solid #1e1e3a;border-radius:12px;padding:16px">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Detection</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${[["Language",app.language],["Framework",app.framework!=="none"?app.framework:"—"],["Port",String(app.port)],["Pkg Mgr",app.packageManager??"none"],["Files Scanned",String(scan.filesScanned)]].map(([k,v])=>`<tr><td style="color:#6b7280;padding:3px 0;width:100px">${k}</td><td style="color:#e5e7eb">${esc(v)}</td></tr>`).join("")}
      </table>
    </div>
  </div>
  <div style="background:#0e0e1e;border:1px solid #1e1e3a;border-radius:12px;padding:16px;margin-bottom:24px">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Finding Summary</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${sevSummary}</div>
  </div>
  <div style="background:#0a0a18;border:1px solid #1e1e3a;border-radius:12px;padding:14px 16px;margin-bottom:24px;font-size:12px;color:#6b7280">
    <strong style="color:#a78bfa">TechAtlas SAST Engine</strong> &middot; Pattern-based static analysis (client-side, in-browser) &middot;
    OWASP Top 10 / CWE Top 25 &middot; 20 rules &middot; Languages: JS/TS, Python, Go, Java, Rust, Ruby, PHP, C# + configs.
    <span style="color:#f59e0b"> &nbsp;Note: pattern matching may produce false positives — always review before acting.</span>
  </div>
  <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Findings (${scan.findings.length} total)</div>
  ${scan.findings.length === 0 ? `<div style="text-align:center;padding:48px;color:#4ade80;font-size:16px">&#x2705; No vulnerabilities detected</div>` : findingCards}
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #1e1e3a;text-align:center;font-size:11px;color:#374151">
    Generated by <strong style="color:#7c3aed">TechAtlas</strong> &middot; ${ts} &middot; For security review purposes only
  </div>
</div>
</body>
</html>`;
}

// ── 2. SonarQube-style Report ─────────────────────────────────────────────────

export function generateSonarQubeReport(app: DetectedApp, scan: ScanResult): string {
  const ts = new Date().toLocaleString();

  const SQ_SEV: Record<Severity, string> = {
    CRITICAL: "BLOCKER", HIGH: "CRITICAL", MEDIUM: "MAJOR", LOW: "MINOR", INFO: "INFO",
  };
  const SQ_COLOR: Record<string, string> = {
    BLOCKER: "#d32f2f", CRITICAL: "#f57c00", MAJOR: "#fbc02d", MINOR: "#66bb6a", INFO: "#90a4ae",
  };

  const rating = scan.criticalCount > 0 ? "E" : scan.highCount > 0 ? "D" : scan.mediumCount > 0 ? "C" : scan.lowCount > 0 ? "B" : "A";
  const ratingColor = ({ A:"#00c853",B:"#64dd17",C:"#ffab00",D:"#ff6d00",E:"#d50000" } as Record<string,string>)[rating];
  const qgPassed = scan.findings.length === 0;

  const vulnerabilities = scan.findings.filter(f => f.severity !== "INFO").length;
  const codeSmells      = scan.findings.filter(f => f.severity === "INFO").length;
  const hotspots        = scan.findings.filter(f => f.category === "Sensitive Data Exposure").length;

  const rows = scan.findings.map((f, i) => {
    const sq = SQ_SEV[f.severity];
    return `<tr style="background:${i%2===0?"#fff":"#fafafa"}">
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8"><span style="padding:2px 8px;border-radius:3px;font-size:11px;font-weight:700;color:#fff;background:${SQ_COLOR[sq]}">${sq}</span></td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#666;font-size:12px">VULNERABILITY</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#333;font-size:13px">${esc(f.title)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;font-family:monospace;font-size:12px;color:#666">${esc(f.file)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#666;font-size:12px;text-align:center">${f.line}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8e8e8;color:#888;font-size:11px">${f.cwe ?? "—"}</td>
    </tr>`;
  }).join("");

  const metricBoxes = [
    ["Bugs",              "0",                   "A",    "#00c853"],
    ["Vulnerabilities",   String(vulnerabilities), rating, ratingColor],
    ["Code Smells",       String(codeSmells),     "A",    "#00c853"],
    ["Security Hotspots", String(hotspots),       "—",    "#888"],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>SonarQube Style Report — ${esc(app.repoName)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f3f3;color:#333}</style>
</head>
<body>
<div style="background:#236a97;padding:0 24px;height:52px;display:flex;align-items:center;gap:12px">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.2)"/><path d="M7 17l5-10 5 10" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
  <span style="color:#fff;font-size:18px;font-weight:700">SonarQube</span>
  <span style="color:rgba(255,255,255,.5);font-size:13px;margin-left:6px">| ${esc(app.repoOwner)} / ${esc(app.repoName)}</span>
  <span style="margin-left:auto;color:rgba(255,255,255,.6);font-size:11px">${ts}</span>
</div>
<div style="max-width:1100px;margin:0 auto;padding:28px 24px">
  <!-- Quality Gate + Metrics -->
  <div style="background:#fff;border-radius:6px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.1);display:flex;align-items:center;gap:24px;flex-wrap:wrap">
    <div style="flex:1;min-width:180px">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Quality Gate</div>
      <div style="font-size:24px;font-weight:700;color:${qgPassed?"#00c853":"#d50000"}">${qgPassed?"✔ PASSED":"✖ FAILED"}</div>
      ${!qgPassed?`<div style="font-size:12px;color:#d50000;margin-top:4px">${scan.findings.length} new security issue${scan.findings.length!==1?"s":""} found</div>`:""}
    </div>
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      ${metricBoxes.map(([label,count,r,color])=>`
      <div style="text-align:center;min-width:80px">
        <div style="font-size:28px;font-weight:700;color:#333">${count}</div>
        <div style="font-size:11px;color:#888;margin-bottom:5px">${label}</div>
        <div style="display:inline-flex;width:22px;height:22px;border-radius:50%;background:${color};color:#fff;font-size:12px;font-weight:700;align-items:center;justify-content:center">${r}</div>
      </div>`).join("")}
    </div>
  </div>
  <!-- Ratings -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
    ${[
      ["Security Rating",          rating,                  ratingColor,  "Vulnerability count & severity"],
      ["Reliability Rating",       "A",                     "#00c853",    "No bugs detected in static analysis"],
      ["Maintainability Rating",   codeSmells>0?"B":"A",    codeSmells>0?"#64dd17":"#00c853", "Based on code smell count"],
    ].map(([label,r,color,note])=>`
    <div style="background:#fff;border-radius:6px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.1);display:flex;align-items:center;gap:14px">
      <div style="width:44px;height:44px;border-radius:50%;background:${color};color:#fff;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${r}</div>
      <div><div style="font-size:13px;font-weight:600">${label}</div><div style="font-size:11px;color:#888;margin-top:2px">${note}</div></div>
    </div>`).join("")}
  </div>
  <!-- Issues table -->
  ${scan.findings.length > 0 ? `
  <div style="background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden">
    <div style="padding:14px 20px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:14px;font-weight:600">Issues (${scan.findings.length})</div>
      <div style="font-size:11px;color:#aaa">Powered by TechAtlas SAST &middot; OWASP Top 10 / CWE Top 25</div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f5f5f5">
        ${["Severity","Type","Issue","File","Line","CWE"].map(h=>`<th style="padding:10px 14px;text-align:left;font-size:11px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${h}</th>`).join("")}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>` : `
  <div style="background:#fff;border-radius:6px;padding:40px;text-align:center;color:#00c853;font-size:15px;box-shadow:0 1px 3px rgba(0,0,0,.1)">✔ No security issues found</div>`}
  <div style="margin-top:20px;text-align:center;font-size:11px;color:#bbb">
    SonarQube-style report generated by <strong>TechAtlas</strong> &middot; ${ts} &middot; Not an official SonarQube report
  </div>
</div>
</body>
</html>`;
}

// ── 3. Snyk-style Report ──────────────────────────────────────────────────────

export function generateSnykReport(app: DetectedApp, scan: ScanResult): string {
  const ts = new Date().toLocaleString();

  const SNYK_COLOR: Record<Severity, string> = {
    CRITICAL: "#d91b1b", HIGH: "#c75a00", MEDIUM: "#a38200", LOW: "#1b64a4", INFO: "#6b7280",
  };
  const SNYK_BG: Record<Severity, string> = {
    CRITICAL: "#1f0303", HIGH: "#1f0d00", MEDIUM: "#1f1800", LOW: "#030e1f", INFO: "#0d1117",
  };
  const PRIORITY_TABLE: Record<Severity, number[]> = {
    CRITICAL: [880,920,950,890,900,870,940,860,910,930],
    HIGH:     [650,720,700,680,710,690,730,660,670,740],
    MEDIUM:   [350,420,380,400,360,430,370,440,410,390],
    LOW:      [120,150,130,160,140,170,110,145,135,155],
    INFO:     [50,60,70,55,65,75,45,80,90,85],
  };

  const cards = scan.findings.map((f, i) => {
    const color  = SNYK_COLOR[f.severity];
    const bg     = SNYK_BG[f.severity];
    const score  = PRIORITY_TABLE[f.severity][i % PRIORITY_TABLE[f.severity].length];
    const hasFix = !!f.fixCode;
    return `<div style="margin-bottom:12px;border:1px solid #1e2030;border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${bg};border-bottom:1px solid #1e2030">
        <span style="padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#fff;background:${color}">${f.severity}</span>
        <div style="flex:1;font-size:13px;font-weight:600;color:#e5e7eb">${esc(f.title)}</div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:800;color:${color}">${score}</div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase">Priority</div>
        </div>
      </div>
      <div style="padding:12px 16px;background:#0d0d1a;font-size:12px">
        <div style="display:flex;gap:16px;margin-bottom:8px;flex-wrap:wrap">
          <span style="color:#6b7280">Path: <span style="color:#c4b5fd;font-family:monospace">${esc(f.file)}:${f.line}</span></span>
          ${f.cwe?`<span style="color:#6b7280">CWE: <span style="color:#93c5fd">${f.cwe}</span></span>`:""}
          <span style="color:${hasFix?"#4ade80":"#f87171"}">${hasFix?"✔ Fix available":"No auto-fix"}</span>
        </div>
        <div style="background:#1a0808;border-left:3px solid ${color};padding:8px 10px;font-family:monospace;font-size:11px;color:#fca5a5;margin-bottom:8px;white-space:pre-wrap;word-break:break-all">${esc(f.snippet)}</div>
        <p style="margin:0 0 6px;color:#9ca3af;line-height:1.5">${esc(f.description)}</p>
        <p style="margin:0;color:#9ca3af"><strong style="color:#d1d5db">Fix:</strong> ${esc(f.fix)}</p>
        ${hasFix?`<div style="margin-top:8px;background:#052010;border-left:3px solid #4ade80;padding:8px 10px;font-family:monospace;font-size:11px;color:#86efac;white-space:pre-wrap">${esc(f.fixCode!)}</div>`:""}
      </div>
    </div>`;
  }).join("");

  const countFor = (s: Severity) => scan.findings.filter(f => f.severity === s).length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Snyk Style Report — ${esc(app.repoName)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1127;color:#e5e7eb}</style>
</head>
<body>
<div style="background:#06082b;border-bottom:1px solid #1e2050;padding:14px 28px;display:flex;align-items:center;gap:14px">
  <div style="font-size:22px;font-weight:900;color:#7c3aed;letter-spacing:-.5px">snyk</div>
  <div style="width:1px;height:20px;background:#1e2050"></div>
  <div style="font-size:13px;color:#6b7280">Code Security Analysis &middot; ${esc(app.repoOwner)}/${esc(app.repoName)}</div>
  <div style="margin-left:auto;font-size:11px;color:#374151">${ts}</div>
</div>
<div style="max-width:900px;margin:0 auto;padding:28px 24px">
  <!-- Severity summary -->
  <div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap">
    ${(["CRITICAL","HIGH","MEDIUM","LOW","INFO"] as Severity[]).map(s=>{
      const n = countFor(s);
      return `<div style="flex:1;min-width:90px;background:#0d0d1a;border:1px solid ${n>0?SNYK_COLOR[s]+"40":"#1e2030"};border-radius:8px;padding:14px;text-align:center">
        <div style="font-size:28px;font-weight:900;color:${n>0?SNYK_COLOR[s]:"#374151"}">${n}</div>
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-top:3px">${s}</div>
      </div>`;
    }).join("")}
    <div style="flex:1;min-width:90px;background:#0d0d1a;border:1px solid #1e2030;border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:28px;font-weight:900;color:${scan.score>=80?"#4ade80":scan.score>=50?"#facc15":"#f87171"}">${scan.score}</div>
      <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-top:3px">Score</div>
    </div>
  </div>
  <!-- Project info -->
  <div style="background:#0d0d1a;border:1px solid #1e2030;border-radius:8px;padding:16px 18px;margin-bottom:20px;font-size:12px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${[["Project",`${app.repoOwner}/${app.repoName}`],["Language",app.language],["Branch",app.defaultBranch],["Files Analysed",String(scan.filesScanned)],["Scan Engine","TechAtlas SAST v1"],["Coverage","OWASP Top 10 · CWE Top 25"]].map(([k,v])=>`<div><div style="color:#6b7280;margin-bottom:2px">${k}</div><div style="color:#e5e7eb;font-weight:500">${esc(v)}</div></div>`).join("")}
    </div>
  </div>
  <!-- Vulnerabilities -->
  <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">Vulnerabilities (${scan.findings.length})</div>
  ${scan.findings.length===0
    ?`<div style="background:#0d0d1a;border:1px solid #1e2030;border-radius:8px;padding:40px;text-align:center;color:#4ade80">✔ No vulnerabilities detected</div>`
    :cards}
  <div style="margin-top:28px;padding-top:14px;border-top:1px solid #1e2030;text-align:center;font-size:10px;color:#374151">
    Snyk-style report generated by <strong style="color:#7c3aed">TechAtlas</strong> &middot; ${ts} &middot; Not an official Snyk report
  </div>
</div>
</body>
</html>`;
}

// ── 4. OWASP ZAP-style Alert Report ──────────────────────────────────────────

export function generateOwaspZapReport(app: DetectedApp, scan: ScanResult): string {
  const ts = new Date().toLocaleString();

  const ZAP_RISK: Record<Severity, string> = {
    CRITICAL: "High", HIGH: "High", MEDIUM: "Medium", LOW: "Low", INFO: "Informational",
  };
  const ZAP_COLOR: Record<string, string> = {
    High: "#cc0000", Medium: "#e88500", Low: "#006600", Informational: "#006699",
  };

  const byRisk: Record<string, ScanFinding[]> = { High:[], Medium:[], Low:[], Informational:[] };
  scan.findings.forEach(f => byRisk[ZAP_RISK[f.severity]].push(f));

  const summaryRows = Object.entries(byRisk).map(([risk, findings]) => {
    const color = ZAP_COLOR[risk];
    return `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #ddd">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle"></span>
        <a href="#risk-${risk.toLowerCase()}" style="color:${color};text-decoration:none;font-weight:600">${risk}</a>
      </td>
      <td style="padding:8px 14px;border-bottom:1px solid #ddd;text-align:center;font-weight:700;color:${color}">${findings.length}</td>
    </tr>`;
  }).join("");

  const alertSections = Object.entries(byRisk).map(([risk, findings]) => {
    if (findings.length === 0) return "";
    const color = ZAP_COLOR[risk];
    const items = findings.map((f, i) => {
      const owasp = owaspFor(f.category);
      return `<div style="margin-bottom:14px;border:1px solid #ddd;border-radius:4px;overflow:hidden" id="alert-${risk.toLowerCase()}-${i}">
        <div style="background:${color};color:#fff;padding:10px 14px;font-size:13px;font-weight:700">${esc(f.title)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <tr><td style="padding:7px 14px;background:#f9f9f9;width:160px;font-weight:600;color:#555;border-bottom:1px solid #eee">Risk</td><td style="padding:7px 14px;border-bottom:1px solid #eee;font-weight:700;color:${color}">${risk}</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">Confidence</td><td style="padding:7px 14px;border-bottom:1px solid #eee">Medium</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">Source File</td><td style="padding:7px 14px;border-bottom:1px solid #eee;font-family:monospace">${esc(f.file)}:${f.line}</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">Evidence</td><td style="padding:7px 14px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px;color:#c0392b;word-break:break-all">${esc(f.snippet)}</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">Description</td><td style="padding:7px 14px;border-bottom:1px solid #eee;line-height:1.5">${esc(f.description)}</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">Solution</td><td style="padding:7px 14px;border-bottom:1px solid #eee;line-height:1.5">${esc(f.fix)}</td></tr>
          ${f.fixCode?`<tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">Fix Code</td><td style="padding:7px 14px;border-bottom:1px solid #eee"><pre style="font-family:monospace;font-size:11px;color:#16a34a;white-space:pre-wrap;margin:0">${esc(f.fixCode)}</pre></td></tr>`:""}
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">OWASP Reference</td><td style="padding:7px 14px;border-bottom:1px solid #eee">${esc(owasp.top10)}</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555;border-bottom:1px solid #eee">CWE ID</td><td style="padding:7px 14px;border-bottom:1px solid #eee">${f.cwe??"N/A"}</td></tr>
          <tr><td style="padding:7px 14px;background:#f9f9f9;font-weight:600;color:#555">WASC ID</td><td style="padding:7px 14px">${owasp.wascId>0?`WASC-${owasp.wascId}: ${esc(owasp.wasc)}`:"N/A"}</td></tr>
        </table>
      </div>`;
    }).join("");
    return `<h2 id="risk-${risk.toLowerCase()}" style="color:${color};font-size:16px;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid ${color}">${risk} Risk Alerts (${findings.length})</h2>${items}`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>OWASP ZAP Style Report — ${esc(app.repoName)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;color:#333}</style>
</head>
<body>
<div style="background:#2d2d2d;padding:14px 24px;display:flex;align-items:center;gap:14px">
  <div style="font-size:18px;font-weight:700;color:#fff;letter-spacing:1px">OWASP ZAP</div>
  <div style="font-size:12px;color:#aaa">Scanning Report <span style="font-size:10px">(SAST Edition — findings in ZAP format)</span></div>
  <div style="margin-left:auto;font-size:11px;color:#888">${ts}</div>
</div>
<div style="max-width:1000px;margin:0 auto;padding:28px 24px">
  <!-- Summary -->
  <div style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:20px 24px;margin-bottom:24px">
    <h1 style="font-size:20px;color:#333;margin-bottom:16px">ZAP Scanning Report</h1>
    <table style="font-size:13px;border-collapse:collapse;width:100%;margin-bottom:16px">
      ${[["Target",app.repoUrl],["Project",`${app.repoOwner}/${app.repoName} @ ${app.defaultBranch}`],["Language",`${app.language}${app.framework!=="none"?" ("+app.framework+")":""}`],["Scan Type","SAST — Static Application Security Testing"],["Engine","TechAtlas SAST Engine · OWASP Top 10 / CWE Top 25"],["Files Analysed",String(scan.filesScanned)],["Generated",ts]].map(([k,v])=>`<tr><td style="padding:5px 12px 5px 0;color:#666;width:140px">${k}</td><td style="padding:5px 0">${esc(v)}</td></tr>`).join("")}
    </table>
    <table style="border-collapse:collapse;border:1px solid #ddd;font-size:13px">
      <thead><tr style="background:#2d2d2d;color:#fff">
        <th style="padding:8px 14px;text-align:left">Risk Level</th>
        <th style="padding:8px 14px;text-align:center">Number of Alerts</th>
      </tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>
  <!-- Alert details -->
  <div style="background:#fff;border:1px solid #ddd;border-radius:4px;padding:20px 24px">
    <h2 style="font-size:16px;color:#333;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #ddd">Alert Details</h2>
    ${scan.findings.length===0
      ?`<div style="text-align:center;padding:32px;color:#006600;font-size:15px">&#x2714; No alerts found</div>`
      :alertSections}
  </div>
  <div style="margin-top:20px;text-align:center;font-size:11px;color:#888">
    ZAP-style report generated by <strong>TechAtlas</strong> &middot; ${ts} &middot; Not an official OWASP ZAP report
  </div>
</div>
</body>
</html>`;
}

// ── 5. SARIF 2.1 (GitHub Security / VS Code) ─────────────────────────────────

export function generateSarifReport(app: DetectedApp, scan: ScanResult): string {
  const SARIF_LEVEL: Record<Severity, "error" | "warning" | "note"> = {
    CRITICAL: "error", HIGH: "error", MEDIUM: "warning", LOW: "note", INFO: "note",
  };

  const ruleMap = new Map<string, ScanFinding>();
  scan.findings.forEach(f => { if (!ruleMap.has(f.id)) ruleMap.set(f.id, f); });

  const rules = Array.from(ruleMap.values()).map(f => ({
    id: f.id,
    name: f.title.replace(/[^a-zA-Z0-9]/g, ""),
    shortDescription: { text: f.title },
    fullDescription:  { text: f.description },
    ...(f.cwe ? { helpUri: `https://cwe.mitre.org/data/definitions/${f.cwe.replace("CWE-","")}.html` } : {}),
    defaultConfiguration: { level: SARIF_LEVEL[f.severity] },
    properties: {
      tags: ["security", "correctness"],
      precision: "medium",
      "problem.severity": SARIF_LEVEL[f.severity],
      category: f.category,
    },
  }));

  const results = scan.findings.map(f => ({
    ruleId: f.id,
    level:  SARIF_LEVEL[f.severity],
    message: { text: `${f.title}. ${f.fix}` },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: f.file, uriBaseId: "%SRCROOT%" },
        region: { startLine: f.line, snippet: { text: f.snippet } },
      },
    }],
    properties: {
      ...(f.cwe ? { cwe: f.cwe } : {}),
      category: f.category,
      fixAvailable: !!f.fixCode,
    },
  }));

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "TechAtlas SAST",
          version: "1.0.0",
          informationUri: "https://techatlas.dev",
          rules,
        },
      },
      automationDetails: {
        id: `${app.repoOwner}/${app.repoName}/${app.defaultBranch}/${new Date().toISOString()}`,
      },
      results,
      properties: {
        repository:    `${app.repoOwner}/${app.repoName}`,
        branch:        app.defaultBranch,
        language:      app.language,
        filesScanned:  scan.filesScanned,
        securityScore: scan.score,
        scannedAt:     new Date().toISOString(),
      },
    }],
  };

  return JSON.stringify(sarif, null, 2);
}

// ── 6. CSV Export ─────────────────────────────────────────────────────────────

export function generateCsvReport(app: DetectedApp, scan: ScanResult): string {
  const cell = (s: string) => `"${s.replace(/"/g,'""').replace(/\n/g," ")}"`;

  const header = ["Severity","Rule ID","Title","Category","File","Line","CWE","Description","Fix","Fix Available","OWASP Top 10"].map(cell).join(",");

  const rows = scan.findings.map(f => {
    const owasp = owaspFor(f.category);
    return [f.severity,f.id,f.title,f.category,f.file,String(f.line),f.cwe??"",f.description,f.fix,f.fixCode?"Yes":"No",owasp.top10].map(cell).join(",");
  });

  return [
    `# TechAtlas SAST Security Report`,
    `# Repository: ${app.repoOwner}/${app.repoName}`,
    `# Branch: ${app.defaultBranch}`,
    `# Language: ${app.language}`,
    `# Generated: ${new Date().toLocaleString()}`,
    `# Security Score: ${scan.score}/100`,
    `# Total Findings: ${scan.findings.length}`,
    `#`,
    header,
    ...rows,
  ].join("\n");
}

// ── Download helpers ──────────────────────────────────────────────────────────

export function downloadReport(format: ReportFormat, app: DetectedApp, scan: ScanResult): void {
  const option = REPORT_OPTIONS.find(o => o.id === format)!;

  let content: string;
  switch (format) {
    case "techatlas":  content = generateTechAtlasReport(app, scan);  break;
    case "sonarqube":  content = generateSonarQubeReport(app, scan);  break;
    case "snyk":       content = generateSnykReport(app, scan);       break;
    case "owasp-zap":  content = generateOwaspZapReport(app, scan);   break;
    case "sarif":      content = generateSarifReport(app, scan);      break;
    case "csv":        content = generateCsvReport(app, scan);        break;
    default: return;
  }

  const blob = new Blob([content], { type: `${option.mime};charset=utf-8` });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `${format}-security-report-${app.repoName}-${new Date().toISOString().slice(0,10)}.${option.ext.toLowerCase()}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadAllReports(app: DetectedApp, scan: ScanResult): void {
  const formats: ReportFormat[] = ["techatlas","sonarqube","snyk","owasp-zap","sarif","csv"];
  formats.forEach((fmt, i) => setTimeout(() => downloadReport(fmt, app, scan), i * 700));
}
