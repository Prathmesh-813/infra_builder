// ─── GitHub ZIP Archive Client ────────────────────────────────────────────────
// Downloads a public GitHub repo as a ZIP archive and serves files from it.
// No GitHub API calls → no rate limits, no token required.

import JSZip from "jszip";
import type { IRepoClient, RepoMeta, TreeEntry } from "./repo-client";

// Text file extensions worth extracting from the ZIP
const TEXT_EXT = /\.(json|ya?ml|toml|env|properties|cfg|ini|conf|txt|md|ts|tsx|js|jsx|mjs|cjs|py|go|java|rb|php|cs|rs|kt|swift|sh|ps1|tf|dockerfile)$/i;
const TEXT_BASENAME = /^(Dockerfile|Makefile|Gemfile|Pipfile|\.env|go\.mod|go\.sum|Cargo\.toml|Cargo\.lock|composer\.json)$/i;

function isText(name: string): boolean {
  const base = name.split("/").pop() ?? "";
  return TEXT_EXT.test(name) || TEXT_BASENAME.test(base);
}

export class ZipClient implements IRepoClient {
  readonly host = "github.com";

  private constructor(
    readonly owner:  string,
    readonly repo:   string,
    private  branch: string,
    private  paths:  string[],
    private  files:  Map<string, string>,
  ) {}

  static async download(
    owner: string,
    repo:  string,
    branch: string,
    onProgress?: (msg: string) => void,
  ): Promise<ZipClient> {
    onProgress?.(`Downloading ${owner}/${repo}@${branch}…`);

    const url = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${branch}`;
    const res = await fetch(url);
    if (res.status === 404) throw new Error("zip-not-found");
    if (!res.ok)            throw new Error(`zip-${res.status}`);

    onProgress?.("Extracting archive…");
    const buf = await res.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    // GitHub ZIPs have a top-level folder: {repo}-{branch}/
    const prefix = `${repo}-${branch}/`;
    const allPaths: string[] = [];
    const textFiles = new Map<string, string>();
    const reads: Promise<void>[] = [];

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir || !name.startsWith(prefix)) continue;
      const path = name.slice(prefix.length);
      if (!path) continue;
      allPaths.push(path);
      if (isText(path)) {
        reads.push(
          entry.async("string")
            .then(content => { textFiles.set(path, content); })
            .catch(() => { /* skip unreadable */ }),
        );
      }
    }

    await Promise.all(reads);
    return new ZipClient(owner, repo, branch, allPaths, textFiles);
  }

  async getMeta(): Promise<RepoMeta> {
    return { description: "", defaultBranch: this.branch, private: false };
  }

  async getTree(_ref: string): Promise<TreeEntry[]> {
    return this.paths.map(p => ({ path: p, type: "blob" as const }));
  }

  async getFile(path: string, _ref: string): Promise<string> {
    return this.files.get(path) ?? "";
  }

  async getFiles(paths: string[], _ref: string): Promise<Record<string, string>> {
    return Object.fromEntries(
      paths.flatMap(p => {
        const c = this.files.get(p);
        return c !== undefined ? [[p, c]] : [];
      }),
    );
  }
}
