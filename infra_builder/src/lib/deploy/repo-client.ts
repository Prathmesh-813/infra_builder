// ─── TechAtlas Deploy Wizard — Authenticated Repo API Client ─────────────────
// Supports GitHub, GitLab, and Bitbucket with PAT authentication.
// Tokens are used only in API request headers and never persisted.
// For public repos, auth failures automatically fall back to unauthenticated.

import type { RepoPlatform, RepoCredentials } from "./types";

// ── URL / ref parsing ─────────────────────────────────────────────────────────

export interface ParsedRepo {
  platform: RepoPlatform;
  owner: string;
  repo: string;
  host: string;
}

export function parseRepoUrl(raw: string): ParsedRepo | null {
  try {
    const cleaned = raw.trim().replace(/\.git$/, "");
    const url = cleaned.startsWith("http") ? new URL(cleaned) : new URL("https://" + cleaned);
    const parts = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    const h = url.hostname;
    const platform: RepoPlatform =
      h.includes("gitlab")    ? "gitlab"
      : h.includes("bitbucket") ? "bitbucket"
      : "github";
    return { platform, owner, repo, host: h };
  } catch {
    const parts = raw.trim().replace(/^github\.com\/|^gitlab\.com\/|^bitbucket\.org\//, "").split("/");
    if (parts.length >= 2) return { platform: "github", owner: parts[0], repo: parts[1], host: "github.com" };
    return null;
  }
}

// ── Auth header builders ──────────────────────────────────────────────────────

function makeHeaders(creds: RepoCredentials): Record<string, string> {
  const h: Record<string, string> = { "Accept": "application/json" };
  if (!creds.token?.trim()) return h;
  switch (creds.platform) {
    case "github":    h["Authorization"] = `Bearer ${creds.token.trim()}`; break;
    case "gitlab":    h["PRIVATE-TOKEN"] = creds.token.trim(); break;
    case "bitbucket": {
      const user = creds.username ?? "x-token-auth";
      h["Authorization"] = `Basic ${btoa(`${user}:${creds.token.trim()}`)}`;
      break;
    }
  }
  return h;
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface RepoMeta {
  description: string;
  defaultBranch: string;
  private: boolean;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

// ── GitLab helpers (standalone — no auth fallback needed for public repos) ────

async function gitlabMeta(host: string, owner: string, repo: string, h: Record<string, string>): Promise<RepoMeta> {
  const id = encodeURIComponent(`${owner}/${repo}`);
  const r = await fetch(`https://${host}/api/v4/projects/${id}`, { headers: h });
  if (!r.ok) throw new Error(`GitLab API ${r.status}`);
  const j = await r.json();
  return { description: j.description ?? "", defaultBranch: j.default_branch ?? "main", private: j.visibility !== "public" };
}

async function gitlabTree(host: string, owner: string, repo: string, ref: string, h: Record<string, string>): Promise<TreeEntry[]> {
  const id = encodeURIComponent(`${owner}/${repo}`);
  const all: TreeEntry[] = [];
  let page = 1;
  while (true) {
    const r = await fetch(`https://${host}/api/v4/projects/${id}/repository/tree?recursive=true&ref=${ref}&per_page=100&page=${page}`, { headers: h });
    if (!r.ok) throw new Error(`GitLab tree ${r.status}`);
    const j = await r.json() as { path: string; type: string }[];
    const entries = j.filter(e => e.type === "blob").map(e => ({ path: e.path, type: "blob" as const }));
    all.push(...entries);
    const next = r.headers.get("X-Next-Page");
    if (!next || entries.length === 0) break;
    page = parseInt(next, 10);
  }
  return all;
}

async function gitlabFile(host: string, owner: string, repo: string, path: string, ref: string, h: Record<string, string>): Promise<string> {
  const id = encodeURIComponent(`${owner}/${repo}`);
  const fp = encodeURIComponent(path);
  const r  = await fetch(`https://${host}/api/v4/projects/${id}/repository/files/${fp}/raw?ref=${ref}`, { headers: h });
  return r.ok ? r.text() : "";
}

// ── Bitbucket helpers ─────────────────────────────────────────────────────────

async function bitbucketMeta(owner: string, repo: string, h: Record<string, string>): Promise<RepoMeta> {
  const r = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`, { headers: h });
  if (!r.ok) throw new Error(`Bitbucket API ${r.status}`);
  const j = await r.json();
  return { description: j.description ?? "", defaultBranch: j.mainbranch?.name ?? "main", private: j.is_private ?? false };
}

async function bitbucketTreeDir(
  owner: string, repo: string, ref: string, dir: string,
  h: Record<string, string>, depth: number, all: TreeEntry[],
): Promise<void> {
  if (depth > 4 || all.length > 800) return;
  let url: string | null = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${ref}/${dir}?pagelen=100`;
  while (url) {
    const r = await fetch(url, { headers: h });
    if (!r.ok) return;
    const j = await r.json() as { values: { path: string; type: string }[]; next?: string };
    const files = j.values.filter(e => e.type === "commit_file").map(e => ({ path: e.path, type: "blob" as const }));
    const dirs  = j.values.filter(e => e.type === "commit_directory");
    all.push(...files);
    if (dirs.length > 0) {
      await Promise.all(dirs.slice(0, 8).map(d => bitbucketTreeDir(owner, repo, ref, d.path, h, depth + 1, all)));
    }
    url = j.next ?? null;
  }
}

async function bitbucketTree(owner: string, repo: string, ref: string, h: Record<string, string>): Promise<TreeEntry[]> {
  const all: TreeEntry[] = [];
  await bitbucketTreeDir(owner, repo, ref, "", h, 0, all);
  return all;
}

async function bitbucketFile(owner: string, repo: string, path: string, ref: string, h: Record<string, string>): Promise<string> {
  const r = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${ref}/${path}`, { headers: h });
  return r.ok ? r.text() : "";
}

// ── Shared client interface (implemented by both RepoClient and ZipClient) ────

export interface IRepoClient {
  readonly owner: string;
  readonly repo:  string;
  readonly host:  string;
  getMeta(  ): Promise<RepoMeta>;
  getTree(ref: string): Promise<TreeEntry[]>;
  getFile(path: string, ref: string): Promise<string>;
  getFiles(paths: string[], ref: string): Promise<Record<string, string>>;
}

// ── Unified client ────────────────────────────────────────────────────────────

export class RepoClient implements IRepoClient {
  // Mutable — stripped of bad auth if a public-repo fallback succeeds
  private h: Record<string, string>;
  private parsed: ParsedRepo;

  constructor(private creds: RepoCredentials) {
    const p = parseRepoUrl(creds.repoUrl);
    if (!p) throw new Error("Cannot parse repository URL");
    this.parsed = p;
    this.h = makeHeaders(creds);
  }

  get owner() { return this.parsed.owner; }
  get repo()  { return this.parsed.repo;  }
  get host()  { return this.parsed.host;  }

  // GitHub-only: on 401/403, strip the auth header and retry.
  // If the unauthenticated request succeeds we update this.h so all
  // subsequent requests (tree, file downloads) also go unauthenticated.
  private async githubFetch(url: string): Promise<Response> {
    const r = await fetch(url, { headers: this.h });
    if ((r.status === 401 || r.status === 403) && this.h["Authorization"]) {
      const { Authorization: _, ...noAuth } = this.h;
      const r2 = await fetch(url, { headers: noAuth });
      if (r2.ok) this.h = noAuth; // strip bad token for all future calls on this client
      return r2;
    }
    return r;
  }

  async getMeta(): Promise<RepoMeta> {
    switch (this.creds.platform) {
      case "github": {
        const r = await this.githubFetch(`https://api.github.com/repos/${this.owner}/${this.repo}`);
        if (!r.ok) {
          if (r.status === 403 || r.status === 429) {
            const remaining = r.headers.get("X-RateLimit-Remaining");
            const reset     = r.headers.get("X-RateLimit-Reset");
            const isRateLimited = remaining === "0" || r.status === 429;
            if (isRateLimited) {
              const resetMin = reset ? Math.ceil((parseInt(reset, 10) * 1000 - Date.now()) / 60000) : null;
              throw new Error(`GitHub rate limit exceeded${resetMin != null ? ` — resets in ${resetMin} min` : ""}. Add a token to get 5 000 req/hr.`);
            }
          }
          throw new Error(`GitHub API ${r.status}: ${r.statusText}`);
        }
        const j = await r.json();
        return { description: j.description ?? "", defaultBranch: j.default_branch ?? "main", private: j.private ?? false };
      }
      case "gitlab":    return gitlabMeta(this.host, this.owner, this.repo, this.h);
      case "bitbucket": return bitbucketMeta(this.owner, this.repo, this.h);
    }
  }

  async getTree(ref: string): Promise<TreeEntry[]> {
    switch (this.creds.platform) {
      case "github": {
        const r = await this.githubFetch(`https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${ref}?recursive=1`);
        if (!r.ok) throw new Error(`GitHub tree ${r.status}`);
        const j = await r.json();
        const blobs = (j.tree as { path: string; type: string; size?: number }[])
          .filter(e => e.type === "blob")
          .map(e => ({ path: e.path, type: "blob" as const, size: e.size }));
        // Truncated tree: re-order so config/.env files are scanned first within our 60-file cap
        if (j.truncated) {
          const isConfig = (p: string) => /\.(env|ya?ml|json|toml|properties|cfg|ini|conf)$|^\.env/.test(p);
          return [...blobs.filter(e => isConfig(e.path)), ...blobs.filter(e => !isConfig(e.path))];
        }
        return blobs;
      }
      case "gitlab":    return gitlabTree(this.host, this.owner, this.repo, ref, this.h);
      case "bitbucket": return bitbucketTree(this.owner, this.repo, ref, this.h);
    }
  }

  async getFile(path: string, ref: string): Promise<string> {
    switch (this.creds.platform) {
      case "github": {
        const r = await this.githubFetch(`https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${ref}`);
        if (!r.ok) return "";
        const j = await r.json();
        if (j.content) return atob(j.content.replace(/\n/g, ""));
        if (j.download_url) {
          const dr = await fetch(j.download_url, { headers: this.h });
          return dr.ok ? dr.text() : "";
        }
        return "";
      }
      case "gitlab":    return gitlabFile(this.host, this.owner, this.repo, path, ref, this.h);
      case "bitbucket": return bitbucketFile(this.owner, this.repo, path, ref, this.h);
    }
  }

  async getFiles(paths: string[], ref: string): Promise<Record<string, string>> {
    const pairs = await Promise.all(paths.map(async p => [p, await this.getFile(p, ref).catch(() => "")] as const));
    return Object.fromEntries(pairs.filter(([, c]) => c.length > 0));
  }
}
