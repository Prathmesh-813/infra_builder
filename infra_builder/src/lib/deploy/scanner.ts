// ─── TechAtlas Deploy Wizard — SAST Code Scanner ─────────────────────────────
// Client-side static analysis — pattern-based vulnerability detection.
// Covers OWASP Top 10 / CWE Top 25 across 30+ detection rules.

import type { ScanFinding, ScanResult, Severity } from "./types";
import type { IRepoClient } from "./repo-client";

// ── File filtering ────────────────────────────────────────────────────────────

const SOURCE_EXTS = new Set([
  "ts","tsx","js","jsx","mjs","cjs",
  "py","go","java","kt","rs","rb","php","cs","swift",
  "env","yaml","yml","json","toml","properties","cfg","ini","conf",
]);

const SKIP_PATHS = /node_modules|\.min\.|vendor\/|dist\/|build\/|\.next\/|coverage\//;

const MAX_FILES = 60;
const MAX_BYTES = 120_000;

// ── Value-looks-like-a-reference guard ────────────────────────────────────────
// Returns true when a captured value is almost certainly NOT a real secret
// (it's a placeholder, env-var reference, or too short/simple).

function looksLikePlaceholder(val: string): boolean {
  if (val.length < 6) return true;
  const lc = val.toLowerCase();
  if (lc.match(/^(?:your|example|change.?me|replace|placeholder|fixme|todo|xxx+|dummy|sample|test|demo|fake|insert|enter|add|put|set|use|fill|provide|<[^>]+>|\[.*?\]|\{.*?\})/)) return true;
  if (lc.match(/^(?:true|false|null|none|undefined|nan|infinity)$/)) return true;
  if (lc.match(/^\$\{|^%\{|^#{|^@{/)) return true;  // ${VAR}, %{VAR}, etc.
  if (lc.match(/^process\.env|^os\.environ|^env\.|^getenv|^secrets\./)) return true;
  if (/^[*]+$/.test(val)) return true; // all asterisks
  return false;
}

// ── Pattern definitions ───────────────────────────────────────────────────────

interface Pattern {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  regex: RegExp;
  description: string;
  fix: string;
  fixCode?: (match: string) => string;
  cwe?: string;
  langs?: string[];
  // If true, run the placeholder filter on the first capture group
  filterCapture?: boolean;
}

const PATTERNS: Pattern[] = [

  // ════════════════════════════════════════════════════════════
  //  SECRETS — .env / properties / ini / config files
  // ════════════════════════════════════════════════════════════

  {
    id: "ENV-001",
    severity: "CRITICAL",
    category: "Hardcoded Secret",
    title: "Secret value in environment/config file",
    // KEY=VALUE format without a $ reference
    regex: /^[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|PRIVATE|CREDENTIAL|MASTER)[A-Z0-9_]*\s*=\s*(?!['"]?\$|['"]?process\.|['"]?env\.|\s*$|['"]?\{)([^\s#;,\n'"]{6,})/gm,
    description: "A secret or password is hardcoded as a plain value in a configuration file. If this file is committed to version control it exposes the credential to anyone with repository access.",
    fix: "Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault) or reference the value via environment variable injection at deploy time.",
    cwe: "CWE-798",
    langs: ["env","properties","cfg","ini","conf"],
    filterCapture: true,
  },

  {
    id: "ENV-002",
    severity: "CRITICAL",
    category: "Hardcoded Token",
    title: "API key or token in environment/config file",
    regex: /^[A-Z0-9_]*(?:API_KEY|APIKEY|ACCESS_TOKEN|AUTH_TOKEN|CLIENT_SECRET|BEARER|JWT_SECRET|NEXTAUTH_SECRET|APP_SECRET|WEBHOOK_SECRET|ENCRYPTION_KEY|SIGNING_KEY|STRIPE_(?:SECRET|LIVE|TEST))[A-Z0-9_]*\s*=\s*(?!['"]?\$|['"]?process\.|['"]?env\.|\s*$)([^\s#;,\n'"]{8,})/gm,
    description: "An API key or token is stored as a plain value in a configuration file committed to source control.",
    fix: "Rotate the token immediately. Inject secrets via environment variables at runtime — never commit real credentials.",
    cwe: "CWE-798",
    langs: ["env","properties","cfg","ini","conf"],
    filterCapture: true,
  },

  // ════════════════════════════════════════════════════════════
  //  SECRETS — Known token formats (any file type)
  // ════════════════════════════════════════════════════════════

  {
    id: "SEC-001",
    severity: "CRITICAL",
    category: "Hardcoded Secret",
    title: "Hardcoded password or secret in source code",
    // Matches:  password = 'value'   secret: "value"   passwd = `value`
    regex: /\b(?:password|passwd|pwd|secret|api_secret|db_pass|database_pass)\s*[:=]\s*['"`]([^'"`\s${}]{6,})['"`]/gi,
    description: "A password or secret literal is assigned directly in source code. Committed credentials become part of permanent git history and can be exposed via repository access or git log.",
    fix: "Move secrets to environment variables: const secret = process.env.MY_SECRET;",
    fixCode: () => `const secret = process.env.MY_SECRET;\nif (!secret) throw new Error("MY_SECRET env var not set");`,
    cwe: "CWE-798",
    filterCapture: true,
  },

  {
    id: "SEC-002",
    severity: "CRITICAL",
    category: "Hardcoded Token",
    title: "Hardcoded API key or token in source code",
    regex: /\b(?:api_key|apikey|access_token|auth_token|bearer_token|client_secret|app_secret)\s*[:=]\s*['"`]([A-Za-z0-9_\-./+]{16,})['"`]/gi,
    description: "An API key or bearer token literal is hardcoded in source. Leaked tokens can be exploited immediately by anyone who sees the code.",
    fix: "Store tokens in environment variables or a secrets manager. Rotate any token that has been committed.",
    cwe: "CWE-798",
    filterCapture: true,
  },

  {
    id: "SEC-003",
    severity: "CRITICAL",
    category: "Exposed Private Key",
    title: "PEM private key material in source code",
    regex: /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
    description: "A PEM-encoded private key is embedded in the file. This immediately compromises any service that uses this key.",
    fix: "Revoke this key immediately. Store private keys in a secrets manager or inject them at runtime. Add *.pem and *.key to .gitignore.",
    cwe: "CWE-312",
  },

  {
    id: "SEC-004",
    severity: "CRITICAL",
    category: "AWS Credentials",
    title: "Hardcoded AWS access key ID",
    regex: /(?:AKIA|ASIA|AIPA|AROA)[0-9A-Z]{16}/g,
    description: "An AWS IAM access key ID is present. AWS actively scans public repositories for these patterns and notifies the account owner, but attackers may exploit it first.",
    fix: "Revoke the key in the AWS IAM console immediately. Use IAM roles (EC2/ECS/Lambda) or environment variables for local development.",
    cwe: "CWE-798",
  },

  {
    id: "SEC-005",
    severity: "CRITICAL",
    category: "Hardcoded Token",
    title: "GitHub Personal Access Token",
    // GitHub PATs: ghp_, gho_, ghs_, ghu_  followed by 36 base62 chars
    regex: /\b(ghp_|gho_|ghs_|ghu_|github_pat_)[A-Za-z0-9_]{36,}/g,
    description: "A GitHub Personal Access Token (PAT) is present in the code. A leaked PAT grants access to your GitHub account, repos, and organizations.",
    fix: "Revoke this token in GitHub Settings → Developer settings → Personal access tokens. Never commit tokens to source control.",
    cwe: "CWE-798",
  },

  {
    id: "SEC-006",
    severity: "CRITICAL",
    category: "Hardcoded Token",
    title: "Stripe live secret key",
    regex: /\bsk_live_[A-Za-z0-9]{24,}/g,
    description: "A Stripe live-mode secret key is present. This grants full access to your Stripe account including charges, refunds, and customer data.",
    fix: "Revoke this key in the Stripe dashboard immediately. Use environment variables and never expose live keys in code.",
    cwe: "CWE-798",
  },

  {
    id: "SEC-007",
    severity: "CRITICAL",
    category: "Hardcoded Token",
    title: "Slack API token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    description: "A Slack API token is present. Leaked Slack tokens can expose workspace messages, channels, and member information.",
    fix: "Revoke this token in the Slack API dashboard. Store tokens in environment variables.",
    cwe: "CWE-798",
  },

  {
    id: "SEC-008",
    severity: "HIGH",
    category: "Hardcoded Secret",
    title: "Generic secret assignment with literal value",
    regex: /\b(?:SECRET_KEY|JWT_SECRET|NEXTAUTH_SECRET|ENCRYPTION_KEY|SIGNING_KEY|SESSION_SECRET|COOKIE_SECRET)\s*=\s*['"`]([^'"`${}]{8,})['"`]/gi,
    description: "A well-known secret constant is assigned a literal string value in code.",
    fix: "Remove the hardcoded value: const SECRET_KEY = process.env.SECRET_KEY;",
    cwe: "CWE-798",
    filterCapture: true,
  },

  {
    id: "SEC-009",
    severity: "HIGH",
    category: "Hardcoded Secret",
    title: "Password in database connection string",
    // Matches: postgres://user:PASSWORD@host  or  mysql://user:PASSWORD@host
    regex: /(?:postgres|mysql|mongodb|mariadb|mssql):\/\/[^:@\s]+:([^@\s${}]{6,})@/gi,
    description: "A database connection string with a hardcoded password is present. Connection strings in source code expose credentials to anyone who can read the file.",
    fix: "Use a DATABASE_URL environment variable and construct the connection at runtime. Never hardcode credentials in connection strings.",
    cwe: "CWE-798",
    filterCapture: true,
  },

  // ════════════════════════════════════════════════════════════
  //  SECRETS — YAML / JSON config files
  // ════════════════════════════════════════════════════════════

  {
    id: "YAML-001",
    severity: "HIGH",
    category: "Hardcoded Secret",
    title: "Secret value in YAML/JSON configuration",
    // YAML: password: myvalue   JSON: "password": "myvalue"
    regex: /(?:"(?:password|secret|token|api_key|apikey|auth_token|access_token|private_key|client_secret)"\s*:\s*"([^"${}]{6,})"|\b(?:password|secret|token|api_key)\s*:\s*(?!['"\[{]|null|true|false|~|!|&|\*)([^\s\n#${}|>][^\n#]{5,}))/gi,
    description: "A secret or token literal appears in a YAML or JSON configuration file. Config files committed to version control expose these values.",
    fix: "Use environment variable substitution: password: ${DB_PASSWORD} (YAML) or inject the value at deploy time via a secrets manager.",
    cwe: "CWE-798",
    langs: ["yaml","yml","json","toml"],
    filterCapture: true,
  },

  // ════════════════════════════════════════════════════════════
  //  INJECTION
  // ════════════════════════════════════════════════════════════

  {
    id: "INJ-001",
    severity: "CRITICAL",
    category: "SQL Injection",
    title: "SQL query built by string concatenation",
    regex: /(?:execute|query|cursor\.execute|db\.query|connection\.query|knex\.raw|sequelize\.query|prisma\.\$queryRaw)\s*\(\s*(?:[`'"]\s*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)[^`'"]*(?:\+|\$\{|%s|%d|\??\s*\+)|[\w.]+\s*\+\s*['"`]?\s*(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM))/gi,
    description: "User-controlled data appears to be concatenated directly into a SQL query string, allowing an attacker to alter query logic, bypass authentication, or exfiltrate data.",
    fix: "Use parameterised queries / prepared statements. Never concatenate user input into SQL strings.",
    fixCode: () => `// ✅ Safe — parameterised query\nawait db.query("SELECT * FROM users WHERE id = $1", [userId]);\n// ✅ With Prisma\nawait prisma.user.findUnique({ where: { id: userId } });`,
    cwe: "CWE-89",
  },

  {
    id: "INJ-002",
    severity: "HIGH",
    category: "SQL Injection",
    title: "Go fmt.Sprintf used to build SQL query",
    regex: /fmt\.Sprintf\s*\(\s*['"`][^'"`]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/gi,
    description: "fmt.Sprintf is used to format a SQL query string, which may include unsanitised user input.",
    fix: "Use database/sql placeholders: db.Query(\"SELECT * FROM t WHERE id = ?\", id)",
    cwe: "CWE-89",
    langs: ["go"],
  },

  {
    id: "INJ-003",
    severity: "CRITICAL",
    category: "Command Injection",
    title: "Shell command injection risk",
    regex: /(?:subprocess\.(?:call|run|Popen|check_output)|os\.system|os\.popen|exec\.Command|child_process\.exec(?:Sync)?|Runtime\.getRuntime\(\)\.exec)\s*\([^)]*(?:user|input|request|req\.|params|query\.|body\.|args|argv|stdin)/gi,
    description: "A shell command is constructed using user-supplied input. Attackers can inject additional commands using shell metacharacters (;, |, &, $(...)).",
    fix: "Pass arguments as a list and never use shell=True. Validate and whitelist all inputs strictly before using them in any command.",
    cwe: "CWE-78",
  },

  {
    id: "INJ-004",
    severity: "HIGH",
    category: "Code Injection",
    title: "eval() called with user-controlled input",
    regex: /\beval\s*\([^)]*(?:req\.|request\.|input|user|param|query|body|argv|stdin)/gi,
    description: "eval() executes arbitrary code. Using it with user-controlled data enables remote code execution.",
    fix: "Avoid eval() entirely. Use JSON.parse() for JSON data, or a sandboxed expression evaluator for formulas.",
    cwe: "CWE-95",
  },

  {
    id: "INJ-005",
    severity: "HIGH",
    category: "SQL Injection",
    title: "Raw SQL with string interpolation (Python f-string)",
    regex: /(?:execute|cursor\.execute|connection\.execute)\s*\(\s*f['"`][^'"`]*(?:WHERE|SELECT|INSERT|UPDATE|DELETE|LIKE)/gi,
    description: "An f-string is used to inject variables directly into a SQL query string. If any variable comes from user input, SQL injection is possible.",
    fix: "Use parameterised queries: cursor.execute('SELECT * FROM t WHERE id = %s', (user_id,))",
    cwe: "CWE-89",
    langs: ["py"],
  },

  // ════════════════════════════════════════════════════════════
  //  XSS
  // ════════════════════════════════════════════════════════════

  {
    id: "XSS-001",
    severity: "HIGH",
    category: "Cross-Site Scripting",
    title: "DOM-based XSS via innerHTML",
    regex: /\.innerHTML\s*(?:\+=|=)\s*(?!['"`]<[a-z]|DOMPurify)/gi,
    description: "Setting innerHTML with dynamic content allows script injection if the value contains untrusted user input.",
    fix: "Use textContent for plain text. For HTML, sanitize with DOMPurify before assigning to innerHTML.",
    fixCode: () => `// ✅ Safe options\nelement.textContent = userInput;\n// or\nelement.innerHTML = DOMPurify.sanitize(userInput);`,
    cwe: "CWE-79",
    langs: ["ts","tsx","js","jsx"],
  },

  {
    id: "XSS-002",
    severity: "HIGH",
    category: "Cross-Site Scripting",
    title: "dangerouslySetInnerHTML with dynamic value",
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!\s*['"`](?:<[a-z]|$)|DOMPurify)/gi,
    description: "dangerouslySetInnerHTML is used with a dynamic value. If the value contains user input, XSS is possible.",
    fix: "Sanitize content before rendering: { __html: DOMPurify.sanitize(content) }",
    cwe: "CWE-79",
    langs: ["tsx","jsx"],
  },

  // ════════════════════════════════════════════════════════════
  //  INSECURE DESERIALIZATION
  // ════════════════════════════════════════════════════════════

  {
    id: "DES-001",
    severity: "CRITICAL",
    category: "Insecure Deserialization",
    title: "Unsafe pickle deserialization",
    regex: /pickle\.loads?\s*\(/gi,
    description: "pickle.load/loads() can execute arbitrary Python code when deserializing untrusted data.",
    fix: "Use JSON or a safe serialization format for untrusted data. If pickle is required, verify an HMAC signature before deserializing.",
    cwe: "CWE-502",
    langs: ["py"],
  },

  {
    id: "DES-002",
    severity: "HIGH",
    category: "Insecure Deserialization",
    title: "YAML.load() with untrusted input",
    regex: /yaml\.load\s*\([^)]*(?:req\.|request\.|input|user|param|query|body|read\(\)|stdin|open\()/gi,
    description: "yaml.load() can execute arbitrary Python code through YAML tags. Use yaml.safe_load() instead.",
    fix: "Replace yaml.load() with yaml.safe_load() for all untrusted input.",
    cwe: "CWE-502",
    langs: ["py"],
  },

  // ════════════════════════════════════════════════════════════
  //  WEAK CRYPTOGRAPHY
  // ════════════════════════════════════════════════════════════

  {
    id: "CRYPTO-001",
    severity: "HIGH",
    category: "Weak Cryptography",
    title: "Broken hash algorithm (MD5 or SHA-1)",
    regex: /(?:hashlib\.(?:md5|sha1)\s*\(|MessageDigest\.getInstance\s*\(\s*['"`](?:MD5|SHA-?1)['"`]|crypto\.createHash\s*\(\s*['"`](?:md5|sha1)['"`]|hash\/md5|hash\/sha1)/gi,
    description: "MD5 and SHA-1 are cryptographically broken and must not be used for passwords, signatures, or integrity checks.",
    fix: "Use SHA-256 or SHA-3 for general hashing. For passwords use bcrypt, Argon2, or scrypt.",
    fixCode: () => `// ✅ Python\nhashlib.sha256(data).hexdigest()\n// ✅ Node.js\ncrypto.createHash('sha256').update(data).digest('hex')`,
    cwe: "CWE-327",
  },

  {
    id: "CRYPTO-002",
    severity: "MEDIUM",
    category: "Weak Cryptography",
    title: "Math.random() for security-sensitive value",
    regex: /Math\.random\s*\(\s*\).*(?:token|secret|password|session|nonce|csrf|otp|code)/gi,
    description: "Math.random() is not cryptographically secure and is predictable. Do not use it to generate security-sensitive values.",
    fix: "Use crypto.randomBytes() (Node.js) or crypto.getRandomValues() (browser).",
    fixCode: () => `// ✅ Cryptographically secure\nimport { randomBytes } from 'crypto';\nconst token = randomBytes(32).toString('hex');`,
    cwe: "CWE-338",
    langs: ["ts","tsx","js","jsx"],
  },

  {
    id: "CRYPTO-003",
    severity: "HIGH",
    category: "Weak Cryptography",
    title: "ECB mode cipher (no IV — deterministic)",
    regex: /(?:AES\/ECB|Cipher\.getInstance\s*\(\s*['"`]AES['"`]\s*\)|createCipheriv\s*\(\s*['"`]aes-\d+-ecb)/gi,
    description: "ECB mode encrypts identical blocks to identical ciphertext, leaking patterns in the plaintext. It should never be used.",
    fix: "Use AES-GCM or AES-CBC with a random IV. Example: Cipher.getInstance(\"AES/GCM/NoPadding\")",
    cwe: "CWE-327",
  },

  // ════════════════════════════════════════════════════════════
  //  SECURITY MISCONFIGURATION
  // ════════════════════════════════════════════════════════════

  {
    id: "CONF-001",
    severity: "HIGH",
    category: "Security Misconfiguration",
    title: "Django DEBUG=True",
    regex: /\bDEBUG\s*=\s*True\b/g,
    description: "Django DEBUG=True exposes full stack traces, SQL queries, local variables, and settings to end users in production.",
    fix: "Set DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True' and ensure it is False in production.",
    cwe: "CWE-489",
    langs: ["py"],
  },

  {
    id: "CONF-002",
    severity: "MEDIUM",
    category: "Security Misconfiguration",
    title: "CORS wildcard origin (*)",
    regex: /(?:cors\s*\(\s*\)|Access-Control-Allow-Origin['":\s]+\*|allow_origins\s*=\s*\[\s*['"`]\*['"`]|CORS_ALLOW_ALL_ORIGINS\s*=\s*True)/gi,
    description: "A wildcard CORS origin allows cross-origin requests from any website, which can expose authenticated API endpoints to malicious sites.",
    fix: "Specify an explicit list of trusted origins instead of *.",
    fixCode: () => `// ✅ Explicit allowlist\napp.use(cors({ origin: ['https://app.example.com', 'https://admin.example.com'] }));`,
    cwe: "CWE-942",
  },

  {
    id: "CONF-003",
    severity: "HIGH",
    category: "Security Misconfiguration",
    title: "subprocess with shell=True",
    regex: /subprocess\.[a-z_]+\s*\([^)]*shell\s*=\s*True/gi,
    description: "shell=True passes the command to the OS shell, enabling shell injection via metacharacters if any part comes from user input.",
    fix: "Pass commands as a list and use shell=False: subprocess.run(['ls', '-la'], shell=False)",
    cwe: "CWE-78",
    langs: ["py"],
  },

  {
    id: "CONF-004",
    severity: "MEDIUM",
    category: "Security Misconfiguration",
    title: "Cookie without Secure / HttpOnly flags",
    regex: /(?:res\.cookie|setcookie|setCookie)\s*\([^)]+\)(?![^;]*secure)(?![^;]*httpOnly)/gi,
    description: "Cookies without Secure and HttpOnly flags can be intercepted over HTTP or read by JavaScript (enabling session hijacking via XSS).",
    fix: "Set { secure: true, httpOnly: true, sameSite: 'Strict' } on all authentication cookies.",
    fixCode: () => `res.cookie('session', token, {\n  secure: true,\n  httpOnly: true,\n  sameSite: 'Strict',\n  maxAge: 3600000\n});`,
    cwe: "CWE-614",
  },

  {
    id: "CONF-005",
    severity: "LOW",
    category: "Security Misconfiguration",
    title: "Hardcoded localhost / 0.0.0.0 binding",
    regex: /(?:host|bind|listen)\s*[:=]\s*['"`](?:0\.0\.0\.0|localhost|127\.0\.0\.1)['"`]/gi,
    description: "Binding to 0.0.0.0 in production code exposes the service on all network interfaces. This may be fine in containers but is risky in bare-metal environments.",
    fix: "Bind to a specific interface in production. Use environment variables: host = os.environ.get('HOST', '127.0.0.1')",
    cwe: "CWE-605",
  },

  // ════════════════════════════════════════════════════════════
  //  SENSITIVE DATA EXPOSURE
  // ════════════════════════════════════════════════════════════

  {
    id: "DATA-001",
    severity: "HIGH",
    category: "Sensitive Data Exposure",
    title: "Sensitive data logged to console",
    regex: /(?:console\.(?:log|info|warn|error|debug)|print\s*\(|logger\.(?:debug|info|warn|error|critical))\s*\([^)]*(?:password|token|secret|credit.?card|ssn|cvv|private.?key|api.?key)/gi,
    description: "Sensitive data such as passwords or tokens is being logged. Logs are often stored as plaintext and accessible to more people than the actual application.",
    fix: "Never log credentials or PII. Log only non-sensitive context: user IDs, request IDs, action types.",
    cwe: "CWE-532",
  },

  {
    id: "DATA-002",
    severity: "MEDIUM",
    category: "Sensitive Data Exposure",
    title: "TODO/FIXME referencing unresolved security issue",
    regex: /(?:TODO|FIXME|HACK|XXX)\s*[:\-]?\s*.*(?:auth|security|password|token|secret|sanitize|validate|injection|xss|csrf)/gi,
    description: "A comment flags an unresolved security concern. Security TODOs are often deprioritised and never fixed.",
    fix: "Create a tracked security issue for this item and fix it before the next production release.",
    cwe: "CWE-1078",
  },

  // ════════════════════════════════════════════════════════════
  //  PATH TRAVERSAL
  // ════════════════════════════════════════════════════════════

  {
    id: "PATH-001",
    severity: "HIGH",
    category: "Path Traversal",
    title: "User-controlled file path without sanitization",
    regex: /(?:path\.(?:join|resolve)|os\.path\.(?:join|abspath)|fs\.(?:readFile|writeFile|createReadStream|createWriteStream|existsSync|statSync)|open\s*\()\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.|argv|stdin|user|input)/gi,
    description: "A file path constructed from user input without sanitization allows path traversal attacks (../../etc/passwd).",
    fix: "Resolve the path and verify it starts with the intended base directory.",
    fixCode: () => `const safe = path.resolve(BASE_DIR, userInput);\nif (!safe.startsWith(BASE_DIR + path.sep)) throw new Error('Invalid path');`,
    cwe: "CWE-22",
  },

  // ════════════════════════════════════════════════════════════
  //  HTTP / NETWORK
  // ════════════════════════════════════════════════════════════

  {
    id: "NET-001",
    severity: "LOW",
    category: "Security Misconfiguration",
    title: "Hardcoded HTTP URL (not HTTPS)",
    // Match http:// URLs that are not localhost/127.0.0.1
    regex: /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)([A-Za-z0-9._/-]{5,})['"`]/gi,
    description: "A hardcoded HTTP URL transmits data without TLS encryption, enabling man-in-the-middle attacks and eavesdropping.",
    fix: "Use HTTPS for all external service URLs. Never hardcode production service URLs — use environment variables.",
    cwe: "CWE-319",
  },
];

// ── Scanner engine ────────────────────────────────────────────────────────────

function getExt(filePath: string): string {
  // Special handling for .env, .env.local, etc.
  const base = filePath.split("/").pop() ?? "";
  if (base.startsWith(".env")) return "env";
  return filePath.split(".").pop()?.toLowerCase() ?? "";
}

function shouldScan(filePath: string): boolean {
  if (SKIP_PATHS.test(filePath)) return false;
  return SOURCE_EXTS.has(getExt(filePath));
}

function scanContent(content: string, filePath: string, out: ScanFinding[]): void {
  const ext   = getExt(filePath);
  const lines = content.split("\n");

  for (const pattern of PATTERNS) {
    if (pattern.langs && !pattern.langs.includes(ext)) continue;

    pattern.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      // Run placeholder filter on first non-empty capture group (if required)
      if (pattern.filterCapture) {
        const capturedValue = match[1] ?? match[2] ?? "";
        if (looksLikePlaceholder(capturedValue)) continue;
      }

      const lineNum = content.slice(0, match.index).split("\n").length;
      const snippet = lines[lineNum - 1]?.trim().slice(0, 120) ?? "";

      // Deduplicate same file+line+rule
      if (out.some(f => f.file === filePath && f.line === lineNum && f.id === pattern.id)) continue;

      out.push({
        id:          pattern.id,
        severity:    pattern.severity,
        title:       pattern.title,
        category:    pattern.category,
        file:        filePath,
        line:        lineNum,
        snippet,
        description: pattern.description,
        fix:         pattern.fix,
        fixCode:     pattern.fixCode?.(match[0]),
        cwe:         pattern.cwe,
      });
    }
    pattern.regex.lastIndex = 0;
  }
}

function computeScore(findings: ScanFinding[]): number {
  let deduction = 0;
  for (const f of findings) {
    deduction += f.severity === "CRITICAL" ? 20
               : f.severity === "HIGH"     ? 10
               : f.severity === "MEDIUM"   ? 4
               : f.severity === "LOW"      ? 1
               : 0;
  }
  return Math.max(0, 100 - deduction);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scanRepository(
  client: IRepoClient,
  ref: string,
  onProgress?: (msg: string) => void,
): Promise<ScanResult> {
  onProgress?.("Fetching file tree…");

  const tree = await client.getTree(ref).catch(() => null);
  if (!tree) return { findings: [], score: 100, filesScanned: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0 };

  // Prioritise .env, config, and source files; keep under MAX_FILES
  const isConfig = (p: string) => /\.(env|properties|cfg|ini|conf|ya?ml|json|toml)$|^\.env/.test(p);
  const allScannable = tree.filter(e => shouldScan(e.path) && (!e.size || e.size <= MAX_BYTES));
  const configs  = allScannable.filter(e => isConfig(e.path));
  const sources  = allScannable.filter(e => !isConfig(e.path));
  const toScan   = [...configs, ...sources].slice(0, MAX_FILES);

  onProgress?.(`Scanning ${toScan.length} source files…`);

  const findings: ScanFinding[] = [];

  // Batch fetch in groups of 10 to avoid rate-limit bursts
  const BATCH = 10;
  for (let i = 0; i < toScan.length; i += BATCH) {
    const batch    = toScan.slice(i, i + BATCH);
    const contents = await Promise.all(batch.map(e => client.getFile(e.path, ref).catch(() => "")));
    for (let j = 0; j < batch.length; j++) {
      if (contents[j]) scanContent(contents[j], batch[j].path, findings);
    }
    onProgress?.(`Scanned ${Math.min(i + BATCH, toScan.length)} / ${toScan.length} files…`);
  }

  // Sort: CRITICAL → HIGH → MEDIUM → LOW → INFO
  const ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  const score = computeScore(findings);
  return {
    findings,
    score,
    filesScanned:  toScan.length,
    criticalCount: findings.filter(f => f.severity === "CRITICAL").length,
    highCount:     findings.filter(f => f.severity === "HIGH").length,
    mediumCount:   findings.filter(f => f.severity === "MEDIUM").length,
    lowCount:      findings.filter(f => f.severity === "LOW").length,
    infoCount:     findings.filter(f => f.severity === "INFO").length,
  };
}
