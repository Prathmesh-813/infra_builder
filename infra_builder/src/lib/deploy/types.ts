// ─── TechAtlas Deploy Wizard — Type Definitions ──────────────────────────────

export type Language =
  | "nodejs" | "python" | "go" | "java" | "rust"
  | "ruby" | "php" | "csharp" | "dart" | "unknown";

export type Framework =
  | "nextjs" | "react" | "nestjs" | "express" | "fastify" | "hono" | "vite"
  | "fastapi" | "django" | "flask" | "gunicorn"
  | "gin" | "echo" | "fiber"
  | "spring" | "quarkus"
  | "actix" | "axum"
  | "rails" | "sinatra"
  | "laravel" | "symfony"
  | "dotnet" | "aspnet"
  | "flutter"
  | "none";

export type PackageManager =
  | "npm" | "yarn" | "pnpm" | "bun"
  | "pip" | "poetry" | "uv"
  | "maven" | "gradle"
  | "cargo" | "go"
  | "bundler" | "composer"
  | "dotnet" | "pub"
  | null;

// ── Repository Credentials ───────────────────────────────────────────────────

export type RepoPlatform = "github" | "gitlab" | "bitbucket";

export interface RepoCredentials {
  platform: RepoPlatform;
  repoUrl: string;
  token: string;          // PAT — stored only in memory, never persisted
  branch: string;
  username?: string;      // Bitbucket requires username + app-password
}

// ── Detected Application ─────────────────────────────────────────────────────

export interface DetectedApp {
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  description: string;
  defaultBranch: string;
  platform: RepoPlatform;

  language: Language;
  framework: Framework;
  languageVersion: string;

  port: number;
  buildCmd: string;
  startCmd: string;
  packageManager: PackageManager;

  hasDockerfile: boolean;
  hasDotEnv: boolean;
  envVarExamples: string[];

  confidence: number;
  signals: string[];
}

// ── Security Scanning ────────────────────────────────────────────────────────

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface ScanFinding {
  id: string;
  severity: Severity;
  title: string;
  category: string;       // "Hardcoded Secret" | "SQL Injection" | "XSS" | …
  file: string;
  line: number;
  snippet: string;        // the vulnerable code line
  description: string;
  fix: string;            // description of the fix
  fixCode?: string;       // corrected code snippet (if short enough)
  cwe?: string;           // e.g. "CWE-89"
}

export interface ScanResult {
  findings: ScanFinding[];
  score: number;          // 0–100 security score
  filesScanned: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}

// ── Generated Files & Bundles ────────────────────────────────────────────────

export interface GeneratedFile {
  filename: string;
  filepath: string;
  content: string;
  lang: string;
}

export type DeployTarget =
  | "dockerfile"
  | "docker-compose"
  | "podman"
  | "kubernetes"
  | "helm"
  | "eks"
  | "ecs-fargate"
  | "cloud-run"
  | "azure-aca";

export type CicdTarget =
  | "github-actions"
  | "gitlab-ci"
  | "jenkins"
  | "circleci"
  | "azure-devops"
  | "bitbucket-pipelines"
  | "bamboo"
  | "travis-ci"
  | "drone-ci"
  | "teamcity";

export type ScriptTarget = "bash" | "powershell" | "python" | "makefile";

export interface DeployBundle {
  category: "deploy" | "cicd" | "script";
  target: DeployTarget | CicdTarget | ScriptTarget;
  label: string;
  icon: string;
  color: string;
  description: string;
  files: GeneratedFile[];
}

export interface AnalyzeResult {
  ok: boolean;
  app?: DetectedApp;
  error?: string;
}
