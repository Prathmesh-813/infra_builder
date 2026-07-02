"use client";

import type { AppProfile } from "@/lib/kubernetes/deployment-generator";

const RUNTIMES: { id: string; label: string; icon: string; defaultPort: number }[] = [
  { id: "nodejs-20",  label: "Node.js 20", icon: "⬡", defaultPort: 3000 },
  { id: "python-312", label: "Python 3.12", icon: "🐍", defaultPort: 8000 },
  { id: "java-21",    label: "Java 21",    icon: "☕", defaultPort: 8080 },
  { id: "go-122",     label: "Go 1.22",    icon: "🐹", defaultPort: 8080 },
  { id: "dotnet-8",   label: ".NET 8",     icon: "🟣", defaultPort: 5000 },
  { id: "php-83",     label: "PHP 8.3",    icon: "🐘", defaultPort: 80   },
  { id: "ruby-33",    label: "Ruby 3.3",   icon: "💎", defaultPort: 4567 },
];

const FRAMEWORKS: Record<string, { id: string; label: string }[]> = {
  "nodejs-20":  [
    { id: "express", label: "Express.js" },
    { id: "nextjs",  label: "Next.js" },
    { id: "nestjs",  label: "NestJS" },
    { id: "fastify", label: "Fastify" },
    { id: "none",    label: "Vanilla Node" },
  ],
  "python-312": [
    { id: "fastapi", label: "FastAPI" },
    { id: "django",  label: "Django" },
    { id: "flask",   label: "Flask" },
    { id: "none",    label: "Plain Python" },
  ],
  "java-21": [
    { id: "spring-boot", label: "Spring Boot" },
    { id: "quarkus",     label: "Quarkus" },
    { id: "none",        label: "Plain Java" },
  ],
  "go-122": [
    { id: "gin",   label: "Gin" },
    { id: "fiber", label: "Fiber" },
    { id: "echo",  label: "Echo" },
    { id: "none",  label: "Standard Library" },
  ],
  "dotnet-8": [
    { id: "aspnet",  label: "ASP.NET Core" },
    { id: "blazor",  label: "Blazor" },
    { id: "none",    label: "Console App" },
  ],
  "php-83": [
    { id: "laravel",  label: "Laravel" },
    { id: "symfony",  label: "Symfony" },
    { id: "none",     label: "Plain PHP" },
  ],
  "ruby-33": [
    { id: "rails",   label: "Ruby on Rails" },
    { id: "sinatra", label: "Sinatra" },
    { id: "none",    label: "Plain Ruby" },
  ],
};

const APP_TYPES = [
  { id: "rest-api",     label: "REST API",       desc: "JSON HTTP service" },
  { id: "frontend-spa", label: "Frontend / SPA", desc: "Web app / SSR" },
  { id: "fullstack",    label: "Full-stack",      desc: "API + UI combined" },
  { id: "worker",       label: "Worker",          desc: "Background job processor" },
];

const CPU_OPTIONS = ["100m", "250m", "500m", "1000m", "2000m"];
const MEM_OPTIONS = ["128Mi", "256Mi", "512Mi", "1Gi", "2Gi", "4Gi"];

const inp: React.CSSProperties = {
  padding: "0.35rem 0.55rem", borderRadius: "0.4rem",
  border: "1px solid #30363d", background: "#0d1117",
  color: "#e6edf3", fontSize: "0.82rem", width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "0.3rem",
  fontSize: "0.75rem", fontWeight: 600, color: "#8b949e",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "0.7rem", fontWeight: 700, color: "#7ee787",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginBottom: "0.5rem", marginTop: "1rem",
};

export function AppConfigurator({
  profile,
  onChange,
}: {
  profile: AppProfile;
  onChange: <K extends keyof AppProfile>(key: K, value: AppProfile[K]) => void;
}) {
  const frameworks = FRAMEWORKS[profile.runtime] ?? FRAMEWORKS["nodejs-20"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>

      {/* App identity */}
      <div style={sectionTitle}>Application</div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        <label style={{ ...labelStyle, flex: "1 1 150px" }}>
          Name
          <input
            type="text"
            value={profile.appName}
            onChange={e => onChange("appName", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "myapp")}
            placeholder="myapp"
            style={inp}
          />
          <span style={{ fontSize: "0.68rem", color: "#6e7681" }}>lowercase, hyphens — used in K8s resource names</span>
        </label>
        <label style={{ ...labelStyle, flex: "1 1 120px" }}>
          Namespace
          <input
            type="text"
            value={profile.namespace}
            onChange={e => onChange("namespace", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "production")}
            placeholder="production"
            style={inp}
          />
        </label>
        <label style={{ ...labelStyle, flex: "0 0 80px" }}>
          Port
          <input
            type="number" min={1} max={65535}
            value={profile.port}
            onChange={e => onChange("port", parseInt(e.target.value, 10) || 3000)}
            style={{ ...inp, width: "5rem" }}
          />
        </label>
      </div>

      {/* Runtime */}
      <div style={sectionTitle}>Runtime</div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        {RUNTIMES.map(r => (
          <button
            key={r.id}
            onClick={() => {
              onChange("runtime", r.id);
              onChange("framework", FRAMEWORKS[r.id]?.[0]?.id ?? "none");
              onChange("port", r.defaultPort);
            }}
            style={{
              padding: "0.35rem 0.65rem", borderRadius: "0.4rem",
              border: `1.5px solid ${profile.runtime === r.id ? "#7c3aed" : "#30363d"}`,
              background: profile.runtime === r.id ? "#2d1b6920" : "transparent",
              color: profile.runtime === r.id ? "#a78bfa" : "#8b949e",
              fontWeight: profile.runtime === r.id ? 700 : 400,
              fontSize: "0.78rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "0.3rem",
            }}
          >
            <span>{r.icon}</span>{r.label}
          </button>
        ))}
      </div>

      {/* Framework + App type */}
      <div style={sectionTitle}>Stack</div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        <label style={{ ...labelStyle, flex: "1 1 150px" }}>
          Framework
          <select value={profile.framework} onChange={e => onChange("framework", e.target.value)} style={inp}>
            {frameworks.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, flex: "1 1 180px" }}>
          App Type
          <select value={profile.appType} onChange={e => onChange("appType", e.target.value)} style={inp}>
            {APP_TYPES.map(t => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
          </select>
        </label>
        <label style={{ ...labelStyle, flex: "0 0 70px" }}>
          Replicas
          <input
            type="number" min={1} max={20}
            value={profile.replicas}
            onChange={e => onChange("replicas", parseInt(e.target.value, 10) || 2)}
            style={{ ...inp, width: "4.5rem" }}
          />
        </label>
      </div>

      {/* Resources */}
      <div style={sectionTitle}>Resources</div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        {(["cpuRequest", "cpuLimit"] as const).map(k => (
          <label key={k} style={{ ...labelStyle, flex: "1 1 90px" }}>
            {k === "cpuRequest" ? "CPU Request" : "CPU Limit"}
            <select value={profile[k]} onChange={e => onChange(k, e.target.value)} style={inp}>
              {CPU_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ))}
        {(["memRequest", "memLimit"] as const).map(k => (
          <label key={k} style={{ ...labelStyle, flex: "1 1 90px" }}>
            {k === "memRequest" ? "Mem Request" : "Mem Limit"}
            <select value={profile[k]} onChange={e => onChange(k, e.target.value)} style={inp}>
              {MEM_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        ))}
      </div>

      {/* Health check */}
      <div style={sectionTitle}>Health &amp; Probes</div>
      <div style={{ marginBottom: "0.85rem" }}>
        <label style={{ ...labelStyle, maxWidth: "220px" }}>
          Health Check Path
          <input
            type="text"
            value={profile.healthPath}
            onChange={e => onChange("healthPath", e.target.value)}
            placeholder="/health"
            style={inp}
          />
        </label>
      </div>

      {/* CI/CD info */}
      <div style={sectionTitle}>CI/CD Pipelines</div>
      <div style={{ fontSize: "0.75rem", color: "#7ee787", marginBottom: "0.85rem", lineHeight: 1.6 }}>
        All 10 pipelines generated automatically:<br />
        GitHub Actions · GitLab CI · Azure DevOps · Jenkins · CircleCI · Bamboo · Bitbucket · Travis CI · Drone CI · TeamCity
      </div>

      {/* Helm toggle */}
      <div style={sectionTitle}>Helm Chart</div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.5rem" }}>
        <input
          type="checkbox"
          checked={profile.helmEnabled}
          onChange={e => onChange("helmEnabled", e.target.checked)}
          style={{ width: "1rem", height: "1rem", cursor: "pointer", accentColor: "#7c3aed" }}
        />
        <span style={{ fontSize: "0.8rem", color: "#e6edf3" }}>
          Generate Helm chart <span style={{ color: "#8b949e" }}>(adds <code style={{ color: "#7ee787" }}>helm/</code> directory)</span>
        </span>
      </label>
    </div>
  );
}
