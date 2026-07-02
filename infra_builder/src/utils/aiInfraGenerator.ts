import { Node, Edge, MarkerType } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions';
import { API_BASE } from '../config/api';

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

export async function generateInfrastructure(
  prompt: string,
  provider: string = 'aws'
): Promise<AIGenerateResult> {
  try {
    const response = await fetch(`${API_BASE}/ai/generate-infra`, {
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
  [/microservice|ecs.*fargate|fargate/, ['aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_lb', 'aws_ecs_cluster', 'aws_ecs_task_definition', 'aws_ecs_service']],
  [/eks|kubernetes|k8s/, ['aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_eks_cluster', 'aws_eks_node_group']],
  [/three.?tier|3.?tier|web.?app.*db|web.*application.*database/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_lb', 'aws_instance', 'aws_rds_instance']],
  [/web.?app|web.?application/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_lb', 'aws_instance']],
  [/ec2.*vpc|vpc.*ec2/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_instance']],
  [/vpc/, ['aws_vpc']],
  [/ec2/, ['aws_instance']],
  [/rds|database|db/, ['aws_vpc', 'aws_subnet', 'aws_security_group', 'aws_rds_instance']],
  [/load.?balancer|alb|nlb/, ['aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group', 'aws_lb', 'aws_instance']],
  [/lambda|serverless/, ['aws_iam_role', 'aws_lambda_function', 'aws_s3_bucket']],
  [/s3|bucket/, ['aws_s3_bucket']],
  [/auto.?scal|asg/, ['aws_launch_template', 'aws_autoscaling_group', 'aws_instance']],
  [/dynamodb|dynamo/, ['aws_dynamodb_table']],
  [/api.?gateway|rest.?api/, ['aws_api_gateway_rest_api', 'aws_lambda_function', 'aws_iam_role']],
  [/cloudfront|cdn/, ['aws_cloudfront_distribution', 'aws_s3_bucket']],
  [/sns|notification/, ['aws_sns_topic', 'aws_sqs_queue']],
  [/sqs|queue/, ['aws_sqs_queue']],
  [/cache|redis|memcached|elasticache/, ['aws_elasticache_cluster']],
  [/ci.?cd|pipeline|codebuild|codepipeline/, ['aws_codecommit_repository', 'aws_codebuild_project', 'aws_codepipeline']],
  [/monitoring|cloudwatch|alarm/, ['aws_cloudwatch_log_group', 'aws_cloudwatch_metric_alarm']],
  [/iam.*role|iam.*policy/, ['aws_iam_role', 'aws_iam_policy']],
  [/nat.?gateway/, ['aws_nat_gateway', 'aws_eip']],
  [/vpn/, ['aws_vpn_gateway']],
  [/route.?53|dns|domain/, ['aws_route53_zone', 'aws_route53_record']],
  [/ecr|container.*registry/, ['aws_ecr_repository']],
  [/elastic.?beanstalk|beanstalk/, ['aws_elastic_beanstalk_environment']],
  [/kinesis|stream/, ['aws_kinesis_stream', 'aws_kinesis_firehose_delivery_stream']],
  [/step.?function|sfn|workflow/, ['aws_sfn_state_machine', 'aws_iam_role']],
  [/cognito|auth|user.*pool/, ['aws_cognito_user_pool']],
  [/waf|firewall/, ['aws_wafv2_web_acl']],
  [/secrets.?manager|secret/, ['aws_secretsmanager_secret']],
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

const INFRA_ORDER = [
  'aws_vpc', 'aws_internet_gateway', 'aws_subnet', 'aws_security_group',
  'aws_iam_role', 'aws_launch_template', 'aws_lb', 'aws_ecs_cluster',
  'aws_eks_cluster', 'aws_instance', 'aws_autoscaling_group', 'aws_rds_instance',
  'aws_lambda_function', 'aws_s3_bucket', 'aws_dynamodb_table',
  'aws_api_gateway_rest_api', 'aws_sns_topic', 'aws_sqs_queue',
  'aws_elasticache_cluster', 'aws_cloudfront_distribution', 'aws_route53_zone',
  'aws_nat_gateway', 'aws_eip', 'aws_vpn_gateway',
  'aws_codecommit_repository', 'aws_codebuild_project', 'aws_codepipeline',
  'aws_cloudwatch_log_group', 'aws_cloudwatch_metric_alarm',
  'aws_ecr_repository', 'aws_kinesis_stream', 'aws_sfn_state_machine',
  'aws_cognito_user_pool', 'aws_wafv2_web_acl', 'aws_secretsmanager_secret',
];

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

// Architecture tier definitions — used for multi-row layout
const TIERS = [
  { name: 'Network', keywords: ['vpc', 'subnet', 'igw', 'nat', 'eip', 'vpn', 'dx'], y: 120 },
  { name: 'Security', keywords: ['security_group', 'iam', 'waf', 'cognito', 'kms', 'acm', 'shield', 'secretsmanager'], y: 320 },
  { name: 'Compute', keywords: ['instance', 'autoscaling', 'launch_template', 'ecs', 'eks', 'lambda', 'beanstalk', 'ecr'], y: 520 },
  { name: 'Network-Services', keywords: ['lb', 'cloudfront', 'route53', 'api_gateway'], y: 720 },
  { name: 'Storage', keywords: ['s3', 'ebs', 'efs', 'glacier'], y: 920 },
  { name: 'Database', keywords: ['rds', 'dynamodb', 'elasticache', 'redshift', 'neptune', 'docdb'], y: 1120 },
  { name: 'Messaging', keywords: ['sns', 'sqs', 'kinesis', 'eventbridge', 'sfn'], y: 1320 },
  { name: 'DevOps', keywords: ['codecommit', 'codebuild', 'codepipeline', 'cloudwatch', 'cloudtrail', 'config'], y: 1520 },
];

function getTier(type: string): number {
  for (const tier of TIERS) {
    if (tier.keywords.some(k => type.includes(k))) return tier.y;
  }
  return 420;
}

function layoutNodes(
  types: string[],
  source: typeof RESOURCE_DEFINITIONS,
  order: string[]
): { nodes: Node<ResourceNodeData>[]; edges: Edge[] } {
  const nodes: Node<ResourceNodeData>[] = [];
  const edges: Edge[] = [];
  const spacing = 260;
  const startX = 120;

  // Build ordered list
  const ordered = order.filter(t => types.includes(t));
  types.forEach(t => { if (!ordered.includes(t)) ordered.push(t); });

  // For <= 5 nodes, use single horizontal row
  // For > 5 nodes, use tier-based multi-row layout
  if (ordered.length <= 5) {
    const startY = 250;
    let prevNodeId: string | null = null;
    let prevPortId: string | null = null;

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
  } else {
    // Multi-row layout — group by tier, flow left-to-right within tiers
    const tierMap = new Map<number, { type: string; def: typeof source[0] }[]>();
    ordered.forEach(type => {
      const def = source.find(d => d.type === type);
      if (!def) return;
      const tierY = getTier(type);
      if (!tierMap.has(tierY)) tierMap.set(tierY, []);
      tierMap.get(tierY)!.push({ type, def });
    });

    const sortedTiers = [...tierMap.entries()].sort((a, b) => a[0] - b[0]);

    // Track all nodes by type for edge creation
    const nodeByType = new Map<string, string>();

    sortedTiers.forEach(([y, items]) => {
      items.forEach(({ type, def }, idx) => {
        const nodeId = `ai_${localIdCounter++}`;
        const name = `${def.label.toLowerCase().replace(/\s+/g, '_')}_${localIdCounter}`;

        const config: Record<string, string | number | boolean> = {};
        def.fields.forEach(f => {
          if (f.default !== undefined) config[f.key] = f.default;
        });

        // Center nodes within each tier
        const totalWidth = items.length * spacing;
        const offsetX = Math.max(0, (800 - totalWidth) / 2);

        nodes.push({
          id: nodeId,
          type: 'resourceNode',
          position: { x: offsetX + startX + idx * spacing, y },
          data: { resourceType: def.type as any, resourceName: name, config, definition: def },
        });

        nodeByType.set(type, nodeId);
      });
    });

    // Create edges between tiers: connect compute/storage to network, etc.
    const tierEntries = sortedTiers.map(([, items]) => items.map(i => i.type));
    for (let t = 0; t < tierEntries.length - 1; t++) {
      const currentTier = tierEntries[t];
      const nextTier = tierEntries[t + 1];
      for (const curType of currentTier) {
        const sourceId = nodeByType.get(curType);
        if (!sourceId) continue;
        const srcDef = source.find(d => d.type === curType);
        if (!srcDef) continue;
        for (const nextType of nextTier) {
          const targetId = nodeByType.get(nextType);
          if (!targetId) continue;
          const tgtDef = source.find(d => d.type === nextType);
          if (!tgtDef) continue;

          const rightPort = srcDef.ports.find(p => p.side === 'right');
          const leftPort = tgtDef.ports.find(p => p.side === 'left');
          if (rightPort && leftPort) {
            const color = PORT_COLORS[rightPort.color] || '#6b7280';
            const edgeId = `ai_edge_${localIdCounter}_${curType}_${nextType}`;
            if (!edges.find(e => e.source === sourceId && e.target === targetId)) {
              edges.push({
                id: edgeId,
                source: sourceId,
                target: targetId,
                sourceHandle: rightPort.id,
                targetHandle: leftPort.id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: color, strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color },
              });
            }
          }
        }
      }
    }
  }

  return { nodes, edges };
}

const PROVIDER_NAMES: Record<string, string> = {
  aws: 'AWS', azure: 'Azure', gcp: 'GCP', ansible: 'Ansible', crossplane: 'Crossplane',
};

const ARCHITECTURE_LABELS: [RegExp, string][] = [
  [/microservice|ecs.*fargate/, 'microservices architecture on ECS Fargate'],
  [/eks|kubernetes|k8s/, 'Kubernetes cluster on EKS'],
  [/three.?tier|3.?tier/, 'three-tier architecture'],
  [/web.?app|web.?application/, 'web application architecture'],
  [/serverless|lambda/, 'serverless architecture'],
  [/ci.?cd|pipeline/, 'CI/CD pipeline'],
  [/monitoring|cloudwatch/, 'monitoring architecture'],
  [/database|rds/, 'database architecture'],
  [/vpc.*ec2|ec2.*vpc/, 'VPC-based architecture'],
  [/load.?balancer|alb/, 'load-balanced architecture'],
  [/api.?gateway/, 'API architecture'],
  [/cloudfront|cdn/, 'CDN architecture'],
];

function detectArchitecture(norm: string): string {
  for (const [regex, label] of ARCHITECTURE_LABELS) {
    if (regex.test(norm)) return label;
  }
  return 'cloud infrastructure';
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
    label = `I created an Ansible playbook with ${nodes.length} tasks: ${names.join(', ')}. Add it to the canvas to see the full automation workflow.`;
  } else if (provider === 'crossplane') {
    const types = detectInfraResources(norm);
    const result = layoutNodes(types, RESOURCE_DEFINITIONS, INFRA_ORDER);
    nodes = result.nodes;
    edges = result.edges;
    const names = nodes.map(n => n.data.definition?.label || n.data.resourceType);
    label = `I created ${nodes.length} Crossplane-managed resources for your ${detectArchitecture(norm)}: ${names.join(', ')}. Add to canvas to visualize the composition.`;
  } else {
    const types = detectInfraResources(norm);
    const result = layoutNodes(types, RESOURCE_DEFINITIONS, INFRA_ORDER);
    nodes = result.nodes;
    edges = result.edges;
    const names = nodes.map(n => n.data.definition?.label || n.data.resourceType);
    const archName = detectArchitecture(norm);
    label = `I designed a ${PROVIDER_NAMES[provider] || provider.toUpperCase()} ${archName} with ${nodes.length} resources: ${names.join(', ')}. The diagram is wired with appropriate connections — add it to the canvas to explore and customize.`;
  }

  return { nodes, edges, explanation: label };
}
