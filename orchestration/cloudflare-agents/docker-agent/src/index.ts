import { runAgent, requireApiKey, AGENT_MODEL, type AuthEnv } from '../../shared/agent-core'
import { getToolsForTask, executeTool } from './docker-tools'

export interface Env extends AuthEnv {
  AI: Ai
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Public, unauthenticated liveness probe.
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'cf-docker-agent', model: AGENT_MODEL })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const unauthorized = requireApiKey(request, env)
    if (unauthorized) return unauthorized

    let body: { task?: string; docker_url?: string; endpoint_name?: string }
    try {
      body = await request.json() as typeof body
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { task, docker_url, endpoint_name } = body
    if (!task || !docker_url) {
      return Response.json({ error: 'Missing required fields: task, docker_url' }, { status: 400 })
    }

    const label = endpoint_name ? ` (${endpoint_name})` : ''
    const system = `You are a Docker operations specialist. You have direct access to a Docker Engine API at ${docker_url}${label} via the provided tools.

Rules:
- ALWAYS call a tool to get real data. Never guess or fabricate container names, IDs, or status.
- For listing tasks: call list_containers or list_images, then summarise the real results.
- For log tasks: call get_container_logs with the exact tail count the user requested. Then output EVERY log line verbatim — do NOT summarise, truncate, or paraphrase log lines.
- For counts or status: a short paragraph or bullet list is fine.
- If a tool returns an error, report it exactly.`

    try {
      const { output, toolCalls } = await runAgent({
        ai: env.AI,
        system,
        task,
        tools: getToolsForTask(task),
        maxToolSteps: 5,
        executeTool: (name, args) => executeTool(name, args, docker_url),
        noAnswerHint: 'The agent ran tool call(s) but could not produce a final answer. Check the Docker endpoint URL and credentials.',
      })
      return Response.json({ output, success: true, tool_calls: toolCalls })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Response.json({ output: message, success: false }, { status: 500 })
    }
  },
}
