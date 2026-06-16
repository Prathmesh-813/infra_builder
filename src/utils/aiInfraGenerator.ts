import { Node, Edge, MarkerType } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  nodes?: Node<ResourceNodeData>[];
  edges?: Edge[];
}

export interface AIGenerateResult {
  nodes: Node<ResourceNodeData>[];
  edges: Edge[];
  explanation: string;
}

const PORT_COLORS: Record<string, string> = {
  'bg-cyan-400': '#22d3ee', 'bg-red-400': '#f87171', 'bg-pink-400': '#f472b6',
  'bg-blue-400': '#60a5fa', 'bg-orange-400': '#fb923c', 'bg-purple-400': '#c084fc',
  'bg-yellow-400': '#facc15', 'bg-green-400': '#4ade80', 'bg-teal-400': '#2dd4bf',
  'bg-indigo-400': '#818cf8',
};

const API_BASE = 'http://localhost:8001';

export async function generateInfrastructure(
  prompt: string,
  provider: string = 'aws'
): Promise<AIGenerateResult> {
  try {
    const response = await fetch(`${API_BASE}/api/ai/generate-infra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, use_llm: false }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const nodes: Node<ResourceNodeData>[] = data.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        resourceType: n.data.resourceType,
        resourceName: n.data.resourceName,
        config: n.data.config,
        definition: enrichDefinition(n.data.definition, provider),
      },
    }));

    const edges: Edge[] = data.edges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type || 'smoothstep',
      animated: e.animated !== false,
      style: e.style || { stroke: '#6b7280', strokeWidth: 2 },
      markerEnd: e.markerEnd ? { type: MarkerType.ArrowClosed, color: e.markerEnd.color } : undefined,
      label: e.label,
    }));

    return { nodes, edges, explanation: data.explanation };
  } catch {
    return localGenerate(prompt, provider);
  }
}

function enrichDefinition(def: any, provider: string) {
  if (def && def.fields) return def;
  const source = provider === 'ansible' ? ANSIBLE_DEFINITIONS : RESOURCE_DEFINITIONS;
  const match = source.find(d => d.type === def?.type);
  if (match) return match;
  return def;
}

let localIdCounter = 1;

// ── Terraform / Cloud Infra ────────────────────────────────────────────────────

const INFRA_PATTERNS: [RegExp, string[]][] = [
  [/web.?app|web.?application|three.?tier|3.?tier/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_lb', 'aws_instance']],
  [/ec2.*vpc|vpc.*ec2/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_instance']],
  [/vpc/, ['aws_vpc']],
  [/ec2/, ['aws_instance']],
  [/rds|database|db/, ['aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_rds_instance']],
  [/load.?balancer|alb|nlb/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_lb', 'aws_instance']],
  [/lambda|serverless/, ['aws_iam_role', 'aws_lambda_function', 'aws_s3_bucket']],
  [/s3|bucket/, ['aws_s3_bucket']],
  [/auto.?scal|asg/, ['aws_launch_template', 'aws_autoscaling_group', 'aws_instance']],
];

// ── Ansible Patterns ───────────────────────────────────────────────────────────

const ANSIBLE_PATTERNS: [RegExp, string[]][] = [
  [/nginx.*web|web.*server|web.*nginx/, ['ansible_host_group', 'ansible_package', 'ansible_copy', 'ansible_service']],
  [/lamp.*stack|lamp|wordpress/, ['ansible_host_group', 'ansible_package', 'ansible_service', 'ansible_copy']],
  [/docker.*container|container/, ['ansible_host_group', 'ansible_docker_container']],
  [/install.*package|package|apt|yum/, ['ansible_host_group', 'ansible_package']],
  [/user|create.*user|manage.*user/, ['ansible_host_group', 'ansible_user']],
  [/git|clone.*repo|deploy.*app/, ['ansible_host_group', 'ansible_git', 'ansible_shell']],
  [/firewall|ufw|security/, ['ansible_host_group', 'ansible_ufw']],
  [/service|start.*service|restart/, ['ansible_host_group', 'ansible_service']],
  [/command|script|run.*cmd/, ['ansible_host_group', 'ansible_shell']],
  [/config|template|jinja/, ['ansible_host_group', 'ansible_template']],
  [/copy.*file|file/, ['ansible_host_group', 'ansible_copy']],
  [/monitoring|prometheus|grafana/, ['ansible_host_group', 'ansible_package', 'ansible_service', 'ansible_copy']],
  [/full.*stack|complete/, ['ansible_host_group', 'ansible_package', 'ansible_copy', 'ansible_service', 'ansible_git', 'ansible_shell', 'ansible_docker_container']],
];

const ANSIBLE_RESOURCE_ORDER = [
  'ansible_host_group', 'ansible_user', 'ansible_package', 'ansible_copy',
  'ansible_template', 'ansible_git', 'ansible_shell', 'ansible_service',
  'ansible_docker_container', 'ansible_ufw',
];

const INFRA_ORDER = ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_iam_role', 'aws_launch_template', 'aws_lb', 'aws_instance', 'aws_autoscaling_group', 'aws_rds_instance', 'aws_lambda_function', 'aws_s3_bucket'];

// ── Local Generator ────────────────────────────────────────────────────────────

function detectAnsibleResources(norm: string): string[] {
  for (const [regex, resources] of ANSIBLE_PATTERNS) {
    if (regex.test(norm)) return [...resources];
  }
  if (norm.includes('playbook') || norm.includes('ansible')) {
    return ['ansible_host_group', 'ansible_package', 'ansible_service'];
  }
  return ['ansible_host_group', 'ansible_package', 'ansible_service'];
}

function detectInfraResources(norm: string): string[] {
  for (const [regex, resources] of INFRA_PATTERNS) {
    if (regex.test(norm)) return [...resources];
  }
  if (norm.includes('instance') || norm.includes('server') || norm.includes('compute')) {
    return ['aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_instance'];
  }
  return ['aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_instance'];
}

function layoutNodes(
  types: string[],
  source: typeof RESOURCE_DEFINITIONS,
  order: string[]
): { nodes: Node<ResourceNodeData>[]; edges: Edge[] } {
  const nodes: Node<ResourceNodeData>[] = [];
  const edges: Edge[] = [];
  const spacing = 260;
  const startX = 80;
  const startY = 200;
  let prevNodeId: string | null = null;
  let prevPortId: string | null = null;

  const ordered = order.filter(t => types.includes(t));
  types.forEach(t => { if (!ordered.includes(t)) ordered.push(t); });

  ordered.forEach((type, idx) => {
    const def = source.find(d => d.type === type);
    if (!def) return;

    const nodeId = `ai_${localIdCounter++}`;
    const name = `${def.label.toLowerCase().replace(/\s+/g, '_')}_${localIdCounter}`;

    const config: Record<string, string | number | boolean> = {};
    def.fields.forEach(f => {
      if (f.default !== undefined) config[f.key] = f.default;
    });

    nodes.push({
      id: nodeId,
      type: 'resourceNode',
      position: { x: startX + idx * spacing, y: startY },
      data: { resourceType: def.type as any, resourceName: name, config, definition: def },
    });

    if (prevNodeId && prevPortId) {
      const targetPort = def.ports.find(p => p.side === 'left');
      if (targetPort) {
        const color = PORT_COLORS[targetPort.color] || '#6b7280';
        edges.push({
          id: `ai_edge_${localIdCounter}_${idx}`,
          source: prevNodeId,
          target: nodeId,
          sourceHandle: prevPortId,
          targetHandle: targetPort.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        });
      }
    }

    const rightPort = def.ports.find(p => p.side === 'right');
    prevNodeId = nodeId;
    prevPortId = rightPort?.id || null;
  });

  return { nodes, edges };
}

function localGenerate(prompt: string, provider: string): AIGenerateResult {
  const norm = prompt.toLowerCase();
  let nodes: Node<ResourceNodeData>[] = [];
  let edges: Edge[] = [];
  let label = '';

  if (provider === 'ansible') {
    const types = detectAnsibleResources(norm);
    const result = layoutNodes(types, ANSIBLE_DEFINITIONS as any, ANSIBLE_RESOURCE_ORDER);
    nodes = result.nodes;
    edges = result.edges;
    const names = nodes.map(n => n.data.definition?.label || n.data.resourceType);
    label = `I created an Ansible playbook with ${nodes.length} tasks: ${names.join(', ')}. Tap "Add to Canvas" to add them to your playbook.`;
  } else if (provider === 'crossplane') {
    const types = detectInfraResources(norm);
    const result = layoutNodes(types, RESOURCE_DEFINITIONS, INFRA_ORDER);
    nodes = result.nodes;
    edges = result.edges;
    const names = nodes.map(n => n.data.definition?.label || n.data.resourceType);
    label = `I created ${nodes.length} Crossplane-managed resources: ${names.join(', ')}. Tap "Add to Canvas" to place them.`;
  } else {
    const types = detectInfraResources(norm);
    const result = layoutNodes(types, RESOURCE_DEFINITIONS, INFRA_ORDER);
    nodes = result.nodes;
    edges = result.edges;
    const names = nodes.map(n => n.data.definition?.label || n.data.resourceType);
    label = `I created ${nodes.length} ${provider.toUpperCase()} resources: ${names.join(', ')}. Tap "Add to Canvas" to place them.`;
  }

  return { nodes, edges, explanation: label };
}
