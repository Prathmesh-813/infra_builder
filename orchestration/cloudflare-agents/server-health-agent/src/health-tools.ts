import {
  dockerGet, parseDockerStream, sampleStats, cpuPercent, memInfo, toHuman,
} from '../../shared/docker'
import { fetchWithTimeout, type ToolDefinition } from '../../shared/agent-core'

export type { ToolDefinition }

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      type: 'function',
      function: {
        name: 'system_info',
        description: 'Get Docker host info: OS, kernel, CPU count, total memory, Docker version, and container counts (running/paused/stopped).',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'disk_usage',
        description: 'Get Docker disk usage: space consumed by images, containers, and volumes.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_containers',
        description: 'List all containers (running and stopped) with name, image, status, and state.',
        parameters: {
          type: 'object',
          properties: { all: { type: 'boolean', description: 'Include stopped containers, default true' } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_resource_usage',
        description: 'Get CPU and memory usage for every running container. Returns per-container stats and totals.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'exec_in_container',
        description: 'Run a shell command inside a running container. Use to get host-level metrics: "df -h" for disk space, "free -h" for RAM, "uptime" for load average. Try containers likely to have a shell (nginx, app, api, backend, postgres).',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Container name or ID' },
            command: { type: 'string', description: 'Shell command, e.g. "df -h" or "free -h && uptime"' },
          },
          required: ['id', 'command'],
        },
      },
    },
  ]
}

// ── Tool execution ─────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  dockerUrl: string,
): Promise<unknown> {
  const base = dockerUrl.replace(/\/$/, '')

  switch (name) {
    case 'system_info': {
      const [info, version] = await Promise.all([
        dockerGet(base, '/info') as Promise<Record<string, any>>,
        dockerGet(base, '/version') as Promise<Record<string, any>>,
      ])
      return {
        os: info.OperatingSystem,
        kernel: info.KernelVersion,
        arch: info.Architecture,
        cpus: info.NCPU,
        memory_total: toHuman(info.MemTotal ?? 0),
        docker_version: version.Version,
        containers: {
          running: info.ContainersRunning,
          paused: info.ContainersPaused,
          stopped: info.ContainersStopped,
          total: info.Containers,
        },
        images: info.Images,
        hostname: info.Name,
        server_time: info.SystemTime,
      }
    }

    case 'disk_usage': {
      const df = await dockerGet(base, '/system/df') as Record<string, any>
      const images = (df.Images as Array<Record<string, any>>) ?? []
      const containers = (df.Containers as Array<Record<string, any>>) ?? []
      const volumes = (df.Volumes as Array<Record<string, any>>) ?? []

      const totalImageSize = images.reduce((a, img) => a + (img.Size ?? 0), 0)
      const totalImageShared = images.reduce((a, img) => a + (img.SharedSize ?? 0), 0)
      const totalContainerSize = containers.reduce((a, c) => a + (c.SizeRw ?? 0), 0)
      const totalVolumeSize = volumes.reduce((a, v) => a + (v.UsageData?.Size ?? 0), 0)

      return {
        images: {
          count: images.length,
          total_size: toHuman(totalImageSize),
          shared_size: toHuman(totalImageShared),
          unique_size: toHuman(totalImageSize - totalImageShared),
        },
        containers: { count: containers.length, rw_layer_size: toHuman(totalContainerSize) },
        volumes: { count: volumes.length, total_size: toHuman(totalVolumeSize) },
      }
    }

    case 'list_containers': {
      const raw = await dockerGet(base, `/containers/json?all=${args.all ?? true}`) as Array<Record<string, any>>
      return (raw ?? []).map((c) => ({
        id: String(c.Id ?? '').slice(0, 12),
        name: (c.Names as string[] | undefined)?.[0]?.replace(/^\//, ''),
        image: c.Image,
        status: c.Status,
        state: c.State,
      }))
    }

    case 'get_resource_usage': {
      const running = await dockerGet(base, '/containers/json?all=false') as Array<Record<string, any>>
      if (!running?.length) return { containers: [], message: 'No running containers' }

      const results = await Promise.allSettled(
        running.map(async (c) => {
          const id = String(c.Id ?? '').slice(0, 12)
          const name = (c.Names as string[] | undefined)?.[0]?.replace(/^\//, '')
          try {
            const s = await sampleStats(base, id)
            const mem = memInfo(s)
            return { name, id, cpu: `${cpuPercent(s)}%`, memory: { used: toHuman(mem.usage), limit: toHuman(mem.limit), percent: `${mem.pct}%` } }
          } catch {
            return { name, id, cpu: 'unavailable', memory: null }
          }
        }),
      )

      return {
        containers: results.map((r) =>
          r.status === 'fulfilled' ? r.value : { error: String((r as PromiseRejectedResult).reason) },
        ),
      }
    }

    case 'exec_in_container': {
      const id = encodeURIComponent(String(args.id ?? ''))
      const cmd = ['sh', '-c', String(args.command ?? '')]

      const execRes = await fetchWithTimeout(`${base}/containers/${id}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ AttachStdout: true, AttachStderr: true, Cmd: cmd }),
      })
      if (!execRes.ok) throw new Error(`Exec create failed (${execRes.status}): ${(await execRes.text()).slice(0, 200)}`)
      const exec = await execRes.json() as { Id: string }

      const startRes = await fetchWithTimeout(`${base}/exec/${exec.Id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Detach: false, Tty: false }),
      })
      if (!startRes.ok) throw new Error(`Exec start failed (${startRes.status}): ${(await startRes.text()).slice(0, 200)}`)

      return { output: parseDockerStream(await startRes.arrayBuffer()).slice(-3000) }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
