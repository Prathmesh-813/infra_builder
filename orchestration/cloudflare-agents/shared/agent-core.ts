// Shared runtime for the Cloudflare infra agents (docker / server-health / proxmox).
// One copy of: message types, the Llama-4 tool-calling loop, inline tool-call
// parsing, API-key auth, and fetch-with-timeout — imported by all three Workers.
// (Optimization #1: kill the ~150 lines that used to be copy-pasted per agent.)

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description?: string; enum?: string[] }>
      required?: string[]
    }
  }
}

export interface OaiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface UserMessage { role: 'user'; content: string }
interface SystemMessage { role: 'system'; content: string }
interface AssistantMessage { role: 'assistant'; content: string | null; tool_calls?: OaiToolCall[] }
interface ToolMessage { role: 'tool'; tool_call_id: string; content: string }
type Message = UserMessage | SystemMessage | AssistantMessage | ToolMessage

interface AiResponse { response?: string | null; tool_calls?: OaiToolCall[] }

export const AGENT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

// ── Auth (fix #1) ────────────────────────────────────────────────────────────
export interface AuthEnv { AGENT_API_KEY?: string }

/**
 * Gate POST requests behind a shared secret. Fail-closed: if AGENT_API_KEY is not
 * configured on the Worker, every request is rejected (503) rather than left open.
 * Returns an error Response when unauthorized, or null when the caller may proceed.
 */
export function requireApiKey(request: Request, env: AuthEnv): Response | null {
  const expected = env.AGENT_API_KEY
  if (!expected) {
    return Response.json(
      { error: 'Worker not configured: set the AGENT_API_KEY secret (wrangler secret put AGENT_API_KEY).' },
      { status: 503 },
    )
  }
  const provided = request.headers.get('x-api-key') ?? bearerToken(request)
  if (!provided || !timingSafeEqual(provided, expected)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function bearerToken(request: Request): string | null {
  const h = request.headers.get('authorization') ?? ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

/** Constant-time comparison so the key can't be recovered via response timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── Fetch with timeout (fix #4) ──────────────────────────────────────────────
export const DEFAULT_TIMEOUT_MS = 15_000

/** fetch() that aborts after timeoutMs so a hung endpoint can't stall the Worker. */
export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}

// ── Inline tool-call parsing (fix #9: string-aware brace matching) ────────────
/**
 * Llama 4 Scout sometimes emits tool calls as inline JSON in the response field
 * instead of the structured tool_calls array, e.g.
 *   {"name":"tool","parameters":{"arg":{"type":"string","value":"v"}}}
 * Extract and normalise them. The brace scanner ignores braces inside JSON string
 * values, so arguments containing `{`/`}` no longer derail extraction.
 */
export function parseLlamaInlineToolCalls(
  response: string,
  validNames: Set<string>,
): OaiToolCall[] | null {
  if (!response || !response.includes('"name"')) return null
  const calls: OaiToolCall[] = []
  let searchFrom = 0

  while (searchFrom < response.length) {
    const braceIdx = response.indexOf('{', searchFrom)
    if (braceIdx === -1) break
    const end = matchBrace(response, braceIdx)
    if (end === -1) break

    const chunk = response.slice(braceIdx, end + 1)
    searchFrom = end + 1

    try {
      const obj = JSON.parse(chunk) as { name?: string; parameters?: Record<string, unknown> }
      if (!obj.name || !validNames.has(obj.name)) continue
      const flat: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(obj.parameters ?? {})) {
        flat[k] = (v && typeof v === 'object' && 'value' in (v as object))
          ? (v as { value: unknown }).value
          : v
      }
      calls.push({
        id: `llama_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'function',
        function: { name: obj.name, arguments: JSON.stringify(flat) },
      })
    } catch { /* malformed chunk — skip */ }
  }

  return calls.length > 0 ? calls : null
}

/** Index of the `}` matching the `{` at `start`, ignoring braces inside strings. */
function matchBrace(s: string, start: number): number {
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

// ── Tool-result serialisation (fix #14: never emit invalid JSON) ──────────────
const MAX_TOOL_RESULT = 20_000

function clampJson(value: unknown): string {
  const s = JSON.stringify(value ?? null) ?? 'null'
  if (s.length <= MAX_TOOL_RESULT) return s
  // Wrap the truncated text as a valid JSON object instead of slicing raw JSON.
  return JSON.stringify({ _truncated: true, preview: s.slice(0, MAX_TOOL_RESULT) })
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ── Agent loop ───────────────────────────────────────────────────────────────
export interface RunAgentOptions {
  ai: Ai
  system: string
  task: string
  tools: ToolDefinition[]
  maxToolSteps: number
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>
  /** Shown when the loop ends after tool calls but with no final text. */
  noAnswerHint?: string
}

/**
 * Drive the Workers-AI tool-calling loop: alternate model calls and tool
 * execution until the model returns a text answer or the step budget is spent.
 */
export async function runAgent(
  opts: RunAgentOptions,
): Promise<{ output: string; toolCalls: number }> {
  const { ai, system, task, tools, maxToolSteps, executeTool } = opts

  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: task },
  ]
  const validToolNames = new Set(tools.map((t) => t.function.name))
  // Tie every LLM call in this request to one Workers-AI instance for cache hits.
  const sessionId = `ses_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
  const aiRun = ai.run as unknown as (
    model: string,
    input: unknown,
    opts?: unknown,
  ) => Promise<AiResponse>

  let toolCalls = 0
  let finalText = ''

  for (let step = 0; step <= maxToolSteps; step++) {
    const isWrapUp = step === maxToolSteps
    if (isWrapUp) {
      messages.push({
        role: 'user',
        content: 'You have all the data you need. Write your final answer now — do NOT call any more tools.',
      })
    }

    // Retry transient 429s with backoff.
    let result!: AiResponse
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await aiRun(
          AGENT_MODEL,
          isWrapUp ? { messages } : { messages, tools },
          { extraHeaders: { 'x-session-affinity': sessionId } },
        )
        break
      } catch (aiErr) {
        const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
        if (msg.includes('429') && attempt < 2) {
          await sleep((attempt + 1) * 5000)
          continue
        }
        throw aiErr
      }
    }

    const activeCalls: OaiToolCall[] = isWrapUp
      ? []
      : (result.tool_calls && result.tool_calls.length > 0)
        ? result.tool_calls
        : (parseLlamaInlineToolCalls(result.response ?? '', validToolNames) ?? [])

    if (activeCalls.length > 0) {
      messages.push({ role: 'assistant', content: null, tool_calls: activeCalls })
      for (const call of activeCalls) {
        toolCalls++
        let toolResult: unknown
        try {
          const args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
          toolResult = await executeTool(call.function.name, args)
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : String(err) }
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: clampJson(toolResult) })
      }
    } else {
      finalText = result.response?.trim() ?? ''
      break
    }
  }

  if (!finalText) {
    const attempted = messages
      .filter((m): m is AssistantMessage => m.role === 'assistant' && Array.isArray(m.tool_calls))
      .flatMap((m) => m.tool_calls ?? [])
      .map((c) => c.function.name)
      .join(', ')
    finalText = attempted
      ? (opts.noAnswerHint ?? `The agent ran ${toolCalls} tool call(s) (${attempted}) but could not produce a final answer.`)
      : 'No tools were called and no response was generated. The model may have failed to start.'
  }

  return { output: finalText, toolCalls }
}
