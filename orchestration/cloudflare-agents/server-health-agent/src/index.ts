import { runAgent, requireApiKey, AGENT_MODEL, type AuthEnv } from '../../shared/agent-core'
import { getToolDefinitions, executeTool } from './health-tools'

export interface Env extends AuthEnv {
  AI: Ai
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'cf-server-health-agent', model: AGENT_MODEL })
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
    const system = `You are a server health monitoring specialist. You have access to a Docker Engine API at ${docker_url}${label} via the provided tools.

Always follow this procedure to produce a complete health report:
1. Call system_info — get OS, CPU count, total memory, Docker version, running/stopped container counts.
2. Call list_containers (all=true) — get the full container inventory. Note which are stopped or restarting.
3. Call get_resource_usage — get per-container CPU and memory usage.
4. Call disk_usage — get Docker disk footprint for images, containers, and volumes.
5. Call exec_in_container with command "df -h" on the first running container that likely has a shell (prefer containers named: nginx, app, api, backend, postgres, web). If it fails, try the next container.
6. Call exec_in_container with command "free -h && uptime" on the same container to get RAM and load average.

Then produce a structured report with these sections:
- Overall status: HEALTHY / WARNING / CRITICAL with a one-line reason
- Host: OS, kernel, hostname, CPU count, total RAM
- Containers: running vs total, list any stopped/restarting containers by name
- Resources: per-container CPU% and memory usage
- Disk: host filesystem usage (from df -h), Docker disk footprint
- Load: from uptime output
- Warnings: flag disk > 80%, containers in restart loops, CPU > 80%, memory > 90%

Be concise. Use bullet points and short headers. Do not repeat raw JSON.`

    try {
      const { output, toolCalls } = await runAgent({
        ai: env.AI,
        system,
        task,
        tools: getToolDefinitions(),
        maxToolSteps: 7,
        executeTool: (name, args) => executeTool(name, args, docker_url),
        noAnswerHint: 'The agent gathered health data but could not produce a final report. Check the Docker endpoint URL and credentials.',
      })
      return Response.json({ output, success: true, tool_calls: toolCalls })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return Response.json({ output: message, success: false }, { status: 500 })
    }
  },
}
