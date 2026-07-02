// ─── TechAtlas Deploy Wizard — Repository Analyzer ───────────────────────────
// Detects language, framework, port, build/start commands, and package manager
// from repository manifest files. Supports GitHub, GitLab, and Bitbucket
// via RepoClient (authenticated), plus a public-GitHub fast path.

import type {
  AnalyzeResult, DetectedApp, Framework, Language, PackageManager, RepoCredentials,
} from "./types";
import type { IRepoClient } from "./repo-client";
import { RepoClient, parseRepoUrl } from "./repo-client";

// ── Confidence-scored detection signals ──────────────────────────────────────

interface Hints {
  language: Language;
  framework: Framework;
  languageVersion: string;
  port: number;
  buildCmd: string;
  startCmd: string;
  packageManager: PackageManager;
  envVarExamples: string[];
  confidence: number;
  signals: string[];
}

// ── Per-language detector functions ──────────────────────────────────────────

function detectNodejs(files: string[], pkgJson: string): Partial<Hints> | null {
  if (!files.some(f => ["package.json","package-lock.json","yarn.lock","bun.lockb","pnpm-lock.yaml"].includes(f.split("/").pop()!))) return null;

  let pkg: Record<string, unknown> = {};
  try { pkg = JSON.parse(pkgJson); } catch { /* ok */ }

  const deps: Record<string, string> = {
    ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
    ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
  };
  const scripts: Record<string, string> = (pkg.scripts as Record<string, string> | undefined) ?? {};

  let framework: Framework = "none";
  let port = 3000;
  let buildCmd = "npm run build";
  let startCmd = "npm start";
  let pm: PackageManager = "npm";
  const signals: string[] = ["Found package.json"];

  if (files.some(f => f.endsWith("pnpm-lock.yaml"))) { pm = "pnpm"; buildCmd = "pnpm build"; startCmd = "pnpm start"; }
  else if (files.some(f => f.endsWith("yarn.lock")))  { pm = "yarn"; buildCmd = "yarn build"; startCmd = "yarn start"; }
  else if (files.some(f => f.endsWith("bun.lockb")))  { pm = "bun";  buildCmd = "bun run build"; startCmd = "bun start"; }

  if ("next" in deps)           { framework = "nextjs";  port = 3000; buildCmd = `${pm} run build`; startCmd = `node server.js`; signals.push("next dependency"); }
  else if ("@nestjs/core" in deps) { framework = "nestjs"; port = 3000; buildCmd = `${pm} run build`; startCmd = `node dist/main.js`; signals.push("@nestjs/core"); }
  else if ("fastify" in deps)   { framework = "fastify"; port = 3000; signals.push("fastify"); }
  else if ("hono" in deps)      { framework = "hono";    port = 3000; signals.push("hono"); }
  else if ("express" in deps)   { framework = "express"; port = 3000; signals.push("express"); }
  else if (scripts.dev?.includes("vite") || "vite" in deps) { framework = "vite"; port = 5173; signals.push("vite"); }
  else if ("react-scripts" in deps) { framework = "react"; port = 3000; signals.push("react-scripts (CRA)"); }

  const portMatch = (scripts.start ?? scripts.dev ?? "").match(/--port[= ](\d+)/);
  if (portMatch) { port = parseInt(portMatch[1]); signals.push(`custom port ${port}`); }

  const nodeVer = typeof pkg.engines === "object" && pkg.engines !== null
    ? (pkg.engines as Record<string, string>).node ?? "20"
    : "20";
  const cleanVer = nodeVer.replace(/[^0-9.]/g, "").split(".")[0] || "20";

  return {
    language: "nodejs", framework, languageVersion: cleanVer,
    port, buildCmd, startCmd, packageManager: pm,
    envVarExamples: ["NODE_ENV", "PORT", "DATABASE_URL", "SECRET_KEY"],
    confidence: 92, signals,
  };
}

function detectPython(files: string[], reqTxt: string, pyProject: string): Partial<Hints> | null {
  if (!files.some(f => ["requirements.txt","pyproject.toml","setup.py"].includes(f.split("/").pop()!))) return null;

  const allText = (reqTxt + pyProject).toLowerCase();
  let framework: Framework = "none";
  let port = 8000;
  let startCmd = "python main.py";
  let pm: PackageManager = "pip";
  const signals: string[] = ["Python project detected"];

  if (pyProject.toLowerCase().includes("[tool.poetry]"))     { pm = "poetry"; signals.push("Poetry"); }
  else if (pyProject.toLowerCase().includes("hatchling"))    { pm = "uv";     signals.push("uv/hatchling"); }

  if (allText.includes("fastapi")) {
    framework = "fastapi"; port = 8000;
    startCmd = "uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4";
    signals.push("FastAPI");
  } else if (allText.includes("django")) {
    framework = "django"; port = 8000;
    startCmd = "gunicorn wsgi:application --bind 0.0.0.0:8000 --workers 4";
    signals.push("Django");
  } else if (allText.includes("flask")) {
    framework = "flask"; port = 5000;
    startCmd = "gunicorn app:app --bind 0.0.0.0:5000 --workers 4";
    signals.push("Flask");
  }

  return {
    language: "python", framework, languageVersion: "3.12",
    port,
    buildCmd: pm === "poetry" ? "poetry install --only main" : "pip install -r requirements.txt",
    startCmd, packageManager: pm,
    envVarExamples: ["SECRET_KEY", "DEBUG", "DATABASE_URL", "ALLOWED_HOSTS"],
    confidence: 90, signals,
  };
}

function detectGo(files: string[], goMod: string): Partial<Hints> | null {
  if (!files.some(f => f.split("/").pop() === "go.mod")) return null;

  const gl = goMod.toLowerCase();
  let framework: Framework = "none";
  const signals = ["go.mod found"];
  if (gl.includes("gin-gonic/gin"))  { framework = "gin";   signals.push("Gin"); }
  else if (gl.includes("labstack/echo")) { framework = "echo";  signals.push("Echo"); }
  else if (gl.includes("gofiber/fiber")) { framework = "fiber"; signals.push("Fiber"); }

  const ver = goMod.match(/^go\s+(\d+\.\d+)/m)?.[1] ?? "1.22";
  return {
    language: "go", framework, languageVersion: ver,
    port: 8080, buildCmd: "go build -o main .", startCmd: "./main",
    packageManager: "go",
    envVarExamples: ["PORT", "DATABASE_URL", "REDIS_URL"],
    confidence: 95, signals,
  };
}

function detectJava(files: string[]): Partial<Hints> | null {
  if (!files.some(f => ["pom.xml","build.gradle","build.gradle.kts"].includes(f.split("/").pop()!))) return null;

  const hasGradle = files.some(f => f.includes("gradlew") || f.includes("build.gradle"));
  const pm: PackageManager = hasGradle ? "gradle" : "maven";
  return {
    language: "java", framework: "spring", languageVersion: "21",
    port: 8080,
    buildCmd: hasGradle ? "./gradlew bootJar" : "mvn package -DskipTests",
    startCmd: hasGradle ? "java -jar build/libs/*.jar" : "java -jar target/*.jar",
    packageManager: pm,
    envVarExamples: ["SERVER_PORT", "SPRING_DATASOURCE_URL", "SPRING_PROFILES_ACTIVE"],
    confidence: 88, signals: [hasGradle ? "Gradle" : "Maven"],
  };
}

function detectRust(files: string[]): Partial<Hints> | null {
  if (!files.some(f => f.split("/").pop() === "Cargo.toml")) return null;
  return {
    language: "rust", framework: "actix", languageVersion: "1.78",
    port: 8080, buildCmd: "cargo build --release", startCmd: "./target/release/app",
    packageManager: "cargo",
    envVarExamples: ["RUST_LOG", "PORT", "DATABASE_URL"],
    confidence: 90, signals: ["Cargo.toml"],
  };
}

function detectRuby(files: string[], gemfile: string): Partial<Hints> | null {
  if (!files.some(f => f.split("/").pop() === "Gemfile")) return null;
  const isRails = gemfile.toLowerCase().includes("rails");
  const framework: Framework = isRails ? "rails" : "sinatra";
  return {
    language: "ruby", framework, languageVersion: "3.3",
    port: isRails ? 3000 : 4567,
    buildCmd: "bundle install",
    startCmd: isRails ? "bundle exec puma -C config/puma.rb" : "bundle exec ruby app.rb",
    packageManager: "bundler",
    envVarExamples: ["SECRET_KEY_BASE", "DATABASE_URL", "RAILS_ENV"],
    confidence: 88, signals: ["Gemfile", framework],
  };
}

function detectPhp(files: string[], composerJson: string): Partial<Hints> | null {
  if (!files.some(f => f.split("/").pop() === "composer.json")) return null;
  const isLaravel = composerJson.toLowerCase().includes("laravel");
  const framework: Framework = isLaravel ? "laravel" : "symfony";
  return {
    language: "php", framework, languageVersion: "8.3",
    port: 8000, buildCmd: "composer install --no-dev --optimize-autoloader",
    startCmd: "php -S 0.0.0.0:8000 -t public", packageManager: "composer",
    envVarExamples: ["APP_KEY", "APP_ENV", "DB_CONNECTION", "DB_HOST"],
    confidence: 87, signals: ["composer.json", framework],
  };
}

function detectDotnet(files: string[]): Partial<Hints> | null {
  if (!files.some(f => f.endsWith(".csproj") || f.split("/").pop() === "global.json")) return null;
  return {
    language: "csharp", framework: "aspnet", languageVersion: "8.0",
    port: 5000, buildCmd: "dotnet publish -c Release -o out", startCmd: "dotnet out/*.dll",
    packageManager: "dotnet",
    envVarExamples: ["ASPNETCORE_ENVIRONMENT", "ConnectionStrings__Default", "JWT_SECRET"],
    confidence: 90, signals: [".csproj found"],
  };
}

// ── Core detect logic (shared) ────────────────────────────────────────────────

async function detectFromClient(
  client: IRepoClient,
  ref: string,
): Promise<{ hints: Hints; fileNames: string[] }> {
  const tree = await client.getTree(ref);
  const fileNames = tree.map(e => e.path);

  // Fetch key manifests
  const MANIFESTS = [
    "package.json","requirements.txt","pyproject.toml",
    "go.mod","Gemfile","composer.json",
  ];
  const manifestPaths = MANIFESTS.filter(m => fileNames.some(f => f === m || f.endsWith(`/${m}`)));
  const contents = await client.getFiles(manifestPaths, ref);

  const get = (name: string) => contents[name] ?? contents[Object.keys(contents).find(k => k.endsWith(`/${name}`)) ?? ""] ?? "";

  const detected =
    detectNodejs(fileNames, get("package.json")) ??
    detectPython(fileNames, get("requirements.txt"), get("pyproject.toml")) ??
    detectGo(fileNames, get("go.mod")) ??
    detectJava(fileNames) ??
    detectRust(fileNames) ??
    detectRuby(fileNames, get("Gemfile")) ??
    detectPhp(fileNames, get("composer.json")) ??
    detectDotnet(fileNames);

  const hints: Hints = {
    language: "unknown", framework: "none", languageVersion: "latest",
    port: 3000, buildCmd: "", startCmd: "",
    packageManager: null, envVarExamples: [],
    confidence: 30, signals: ["No recognized manifest found"],
    ...detected,
  };

  return { hints, fileNames };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Analyze from a pre-downloaded ZipClient (public GitHub, no API calls). */
export async function analyzeFromZipClient(
  client: IRepoClient,
  creds: RepoCredentials,
): Promise<AnalyzeResult> {
  try {
    const meta = await client.getMeta();
    const ref  = creds.branch || meta.defaultBranch;
    const { hints, fileNames } = await detectFromClient(client, ref);

    const app: DetectedApp = {
      ...hints,
      repoOwner:     client.owner,
      repoName:      client.repo,
      repoUrl:       creds.repoUrl,
      description:   meta.description,
      defaultBranch: meta.defaultBranch,
      platform:      creds.platform,
      hasDockerfile: fileNames.some(f => f === "Dockerfile" || f.endsWith("/Dockerfile")),
      hasDotEnv:     fileNames.some(f => [".env",".env.example",".env.sample"].includes(f.split("/").pop()!)),
    };

    return { ok: true, app };
  } catch (err) {
    return { ok: false, error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Analyze with explicit credentials (all platforms, public + private). */
export async function analyzeRepoWithCredentials(
  creds: RepoCredentials,
): Promise<AnalyzeResult> {
  const parsed = parseRepoUrl(creds.repoUrl);
  if (!parsed) return { ok: false, error: "Cannot parse repository URL" };

  try {
    const client = new RepoClient(creds);
    const meta   = await client.getMeta();
    const ref    = creds.branch || meta.defaultBranch;
    const { hints, fileNames } = await detectFromClient(client, ref);

    const app: DetectedApp = {
      ...hints,
      repoOwner:     client.owner,
      repoName:      client.repo,
      repoUrl:       creds.repoUrl,
      description:   meta.description,
      defaultBranch: meta.defaultBranch,
      platform:      creds.platform,
      hasDockerfile: fileNames.some(f => f === "Dockerfile" || f.endsWith("/Dockerfile")),
      hasDotEnv:     fileNames.some(f => [".env",".env.example",".env.sample"].includes(f.split("/").pop()!)),
    };

    return { ok: true, app };
  } catch (err) {
    const msg      = err instanceof Error ? err.message : String(err);
    const hasToken = !!creds.token?.trim();
    if (msg.includes("rate limit")) return { ok: false, error: msg };
    if (msg.includes("404")) return { ok: false, error: hasToken
      ? "Repository not found. Check the URL and ensure the token has access."
      : "Repository not found. Check the URL — or add a token if this is a private repo." };
    if (msg.includes("401")) return { ok: false, error: "Authentication failed. Check your personal access token." };
    if (msg.includes("403")) return { ok: false, error: hasToken
      ? "Access denied. Ensure the token has read access to this repository."
      : "Access denied. This may be a private repository — add a Personal Access Token to connect." };
    return { ok: false, error: `Analysis failed: ${msg}` };
  }
}

/** Legacy fast path — public GitHub only, no credentials needed. */
export async function analyzeRepo(repoUrl: string): Promise<AnalyzeResult> {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return { ok: false, error: "Invalid repository URL." };
  return analyzeRepoWithCredentials({
    platform: parsed.platform ?? "github",
    repoUrl,
    token: "",
    branch: "main",
  });
}
