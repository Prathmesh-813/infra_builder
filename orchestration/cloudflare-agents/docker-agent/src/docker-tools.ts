import {
  dockerGet, dockerPost, dockerDelete, parseDockerStream,
  sampleStats, cpuPercent, memInfo, toHuman,
} from '../../shared/docker'
import { fetchWithTimeout, type ToolDefinition } from '../../shared/agent-core'

export type { ToolDefinition }

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'list_containers',
        description: 'List Docker containers. Set all=true to include stopped containers.',
        parameters: {
          type: 'object',
          properties: { all: { type: 'boolean', description: 'Include stopped containers (default false)' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'inspect_container',
        description: 'Get detailed configuration and state for a container.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Container ID or name' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_container_logs',
        description: 'Fetch stdout/stderr logs from a container.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Container ID or name' },
            tail: { type: 'string', description: 'Lines to tail, default 100' },
            timestamps: { type: 'boolean', description: 'Prefix lines with timestamps' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'container_stats',
        description: 'Get one-shot CPU, memory, and network I/O stats for a container.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Container ID or name' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'run_container',
        description: 'Create and start a Docker container. The image is pulled automatically if missing.',
        parameters: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Image name, e.g. nginx:latest' },
            name: { type: 'string', description: 'Optional container name' },
            env: { type: 'string', description: 'Comma-separated KEY=VALUE env vars' },
          },
          required: ['image'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'start_container',
        description: 'Start a stopped container.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Container ID or name' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'stop_container',
        description: 'Stop a running container.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Container ID or name' } },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'remove_container',
        description: 'Remove a stopped container. Use force=true to kill and remove running containers.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Container ID or name' },
            force: { type: 'boolean', description: 'Force remove even if running' },
          },
          required: ['id'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_images',
        description: 'List Docker images available on the host.',
        parameters: {
          type: 'object',
          properties: { all: { type: 'boolean', description: 'Include intermediate images' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'pull_image',
        description: 'Pull (download) an image from a registry, e.g. "redis:7". Use before run_container if unsure the image exists.',
        parameters: {
          type: 'object',
          properties: { image: { type: 'string', description: 'Image ref, e.g. nginx:latest' } },
          required: ['image'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'exec_in_container',
        description: 'Run a shell command inside a running container and return its output. Supports pipes, quotes, and redirects.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Container ID or name' },
            command: { type: 'string', description: 'Shell command to run, e.g. "df -h" or "ls /app | head"' },
          },
          required: ['id', 'command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'docker_system_info',
        description: 'Get Docker daemon info: version, OS, total containers and images.',
        parameters: { type: 'object', properties: {} },
      },
    },
  ]
}

export function getToolsForTask(task: string): ToolDefinition[] {
  const all = getToolDefinitions()
  const pick = (...names: string[]) => all.filter((t) => names.includes(t.function.name))
  if (/\blog\b/i.test(task)) return pick('list_containers', 'get_container_logs')
  if (/\b(start|stop|restart|remove|kill|run|create)\b/i.test(task))
    return pick('list_containers', 'start_container', 'run_container', 'pull_image', 'stop_container', 'remove_container')
  if (/\bimage\b|\bpull\b/i.test(task)) return pick('list_images', 'pull_image')
  if (/\bexec\b|\bshell\b|\bbash\b/i.test(task)) return pick('list_containers', 'exec_in_container')
  if (/\b(cpu|memory|resource|stat|usage)\b/i.test(task))
    return pick('list_containers', 'container_stats', 'docker_system_info')
  return all
}

// ── Execution ─────────────────────────────────────────────────────────────────

/** Split "repo:tag" into fromImage + tag (defaults to latest). */
function splitImage(ref: string): { fromImage: string; tag: string } {
  const at = ref.indexOf('@')
  if (at !== -1) return { fromImage: ref.slice(0, at), tag: ref.slice(at + 1) }
  const slash = ref.lastIndexOf('/')
  const colon = ref.lastIndexOf(':')
  if (colon > slash) return { fromImage: ref.slice(0, colon), tag: ref.slice(colon + 1) }
  return { fromImage: ref, tag: 'latest' }
}

/** Pull an image and drain the progress stream so the pull actually completes. */
async function pullImage(base: string, image: string): Promise<void> {
  const { fromImage, tag } = splitImage(image)
  const res = await fetchWithTimeout(
    `${base}/images/create?fromImage=${encodeURIComponent(fromImage)}&tag=${encodeURIComponent(tag)}`,
    { method: 'POST' },
    120_000, // pulls can be slow
  )
  if (!res.ok) throw new Error(`Image pull ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const text = await res.text() // draining the body blocks until the pull finishes
  if (/"error"/.test(text)) {
    const m = text.match(/"error"\s*:\s*"([^"]+)"/)
    throw new Error(`Image pull failed: ${m?.[1] ?? 'unknown error'}`)
  }
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  dockerUrl: string,
): Promise<unknown> {
  const base = dockerUrl.replace(/\/$/, '')
  const id = () => encodeURIComponent(String(args.id ?? ''))

  switch (name) {
    case 'list_containers': {
      const raw = await dockerGet(base, `/containers/json?all=${args.all ?? false}`) as Array<Record<string, any>>
      return (raw ?? []).map((c) => ({
        id: String(c.Id ?? '').slice(0, 12),
        name: (c.Names as string[] | undefined)?.[0]?.replace(/^\//, ''),
        image: c.Image,
        status: c.Status,
        state: c.State,
        ports: ((c.Ports as Array<Record<string, any>> | undefined) ?? [])
          .filter((p) => p.PublicPort)
          .map((p) => `${p.PublicPort}->${p.PrivatePort}/${p.Type}`),
      }))
    }

    case 'inspect_container':
      return dockerGet(base, `/containers/${id()}/json`)

    case 'get_container_logs': {
      const tail = args.tail ?? '100'
      const ts = args.timestamps ? '&timestamps=true' : ''
      const res = await fetchWithTimeout(
        `${base}/containers/${id()}/logs?stdout=true&stderr=true&tail=${tail}${ts}`,
      )
      if (!res.ok) throw new Error(`Docker API ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return { logs: parseDockerStream(await res.arrayBuffer()).slice(-6000) }
    }

    case 'container_stats': {
      const s = await sampleStats(base, String(args.id ?? ''))
      const mem = memInfo(s)
      const nets = s.networks as Record<string, Record<string, number>> | undefined
      const netRx = nets ? Object.values(nets).reduce((a, n) => a + (n.rx_bytes ?? 0), 0) : 0
      const netTx = nets ? Object.values(nets).reduce((a, n) => a + (n.tx_bytes ?? 0), 0) : 0
      const blk = (s.blkio_stats?.io_service_bytes_recursive as Array<Record<string, any>> | undefined) ?? []
      const blkRead = blk.filter((e) => e.op === 'read').reduce((a, e) => a + (e.value ?? 0), 0)
      const blkWrite = blk.filter((e) => e.op === 'write').reduce((a, e) => a + (e.value ?? 0), 0)
      return {
        cpu_percent: `${cpuPercent(s)}%`,
        memory: { used: toHuman(mem.usage), limit: toHuman(mem.limit), percent: `${mem.pct}%` },
        network: { rx: toHuman(netRx), tx: toHuman(netTx) },
        block_io: { read: toHuman(blkRead), write: toHuman(blkWrite) },
        pids: s.pids_stats?.current ?? 0,
      }
    }

    case 'pull_image':
      await pullImage(base, String(args.image ?? ''))
      return { pulled: true, image: args.image }

    case 'run_container': {
      const image = String(args.image ?? '')
      const body: Record<string, unknown> = { Image: image }
      if (args.env) body.Env = String(args.env).split(',').map((s) => s.trim()).filter(Boolean)
      const qs = args.name ? `?name=${encodeURIComponent(String(args.name))}` : ''

      let created: { Id: string }
      try {
        created = await dockerPost(base, `/containers/create${qs}`, body) as { Id: string }
      } catch (err) {
        // Image not present locally → pull then retry once (fix #7).
        if (err instanceof Error && /404|no such image/i.test(err.message)) {
          await pullImage(base, image)
          created = await dockerPost(base, `/containers/create${qs}`, body) as { Id: string }
        } else {
          throw err
        }
      }
      await dockerPost(base, `/containers/${created.Id}/start`)
      return { id: created.Id, image, started: true }
    }

    case 'start_container':
      await dockerPost(base, `/containers/${id()}/start`)
      return { started: true }

    case 'stop_container':
      await dockerPost(base, `/containers/${id()}/stop?t=10`)
      return { stopped: true }

    case 'remove_container':
      await dockerDelete(base, `/containers/${id()}?force=${args.force ?? false}`)
      return { removed: true }

    case 'list_images':
      return dockerGet(base, `/images/json?all=${args.all ?? false}`)

    case 'exec_in_container': {
      // Run through a shell so pipes/quotes/redirects work (fix #3).
      const cmd = ['sh', '-c', String(args.command ?? '')]
      const exec = await dockerPost(base, `/containers/${id()}/exec`, {
        AttachStdout: true, AttachStderr: true, Cmd: cmd,
      }) as { Id: string }
      const res = await fetchWithTimeout(`${base}/exec/${exec.Id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Detach: false, Tty: false }),
      })
      if (!res.ok) throw new Error(`Exec start ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return { output: parseDockerStream(await res.arrayBuffer()).slice(-3000) }
    }

    case 'docker_system_info': {
      const [info, version] = await Promise.all([dockerGet(base, '/info'), dockerGet(base, '/version')])
      return { info, version }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
