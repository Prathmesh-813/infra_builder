import { Node, Edge } from 'reactflow';
import { ResourceNodeData } from '../types/resources';

/**
 * Known default service ports keyed by resource type.
 */
const RESOURCE_PORTS: Record<string, { port: number; protocol: string; label: string }[]> = {
  aws_instance: [
    { port: 22, protocol: 'tcp', label: 'SSH' },
    { port: 80, protocol: 'tcp', label: 'HTTP' },
    { port: 443, protocol: 'tcp', label: 'HTTPS' },
  ],
  aws_rds_instance: [
    { port: 3306, protocol: 'tcp', label: 'MySQL' },
    { port: 5432, protocol: 'tcp', label: 'PostgreSQL' },
    { port: 1433, protocol: 'tcp', label: 'SQL Server' },
  ],
  aws_lb: [
    { port: 80, protocol: 'tcp', label: 'HTTP' },
    { port: 443, protocol: 'tcp', label: 'HTTPS' },
  ],
  aws_eks_cluster: [
    { port: 443, protocol: 'tcp', label: 'K8s API' },
  ],
  aws_elasticache_cluster: [
    { port: 6379, protocol: 'tcp', label: 'Redis' },
  ],
  aws_elasticache_replication_group: [
    { port: 6379, protocol: 'tcp', label: 'Redis' },
  ],
  aws_redshift_cluster: [
    { port: 5439, protocol: 'tcp', label: 'Redshift' },
  ],
  aws_neptune_cluster: [
    { port: 8182, protocol: 'tcp', label: 'Neptune' },
  ],
  aws_docdb_cluster: [
    { port: 27017, protocol: 'tcp', label: 'DocumentDB' },
  ],
};

function getResourceType(node: Node<ResourceNodeData>): string {
  return node.data?.resourceType ?? node.data?.definition?.type ?? '';
}

function getNodeConfig(node: Node<ResourceNodeData>): Record<string, string | number | boolean> {
  return node.data?.config ?? {};
}

function getResourceName(node: Node<ResourceNodeData>): string {
  return node.data?.resourceName ?? '';
}

/**
 * When a Security Group gets connected to a resource, auto-set the SG's
 * ingress port/protocol to match the resource's known ports.
 */
export function autoConfigureSG(
  sgNode: Node<ResourceNodeData>,
  connectedResourceNode: Node<ResourceNodeData>,
  _edge: Edge,
  updateConfig: (nodeId: string, config: Record<string, any>) => void
): void {
  const targetType = getResourceType(connectedResourceNode);
  const ports = RESOURCE_PORTS[targetType];
  if (!ports || ports.length === 0) return;

  const cfg = getNodeConfig(sgNode);
  const sgName = cfg.name || getResourceName(sgNode) || 'auto-sg';
  const targetName = getResourceName(connectedResourceNode) || connectedResourceNode.id;

  updateConfig(sgNode.id, {
    name: sgName,
    description: `Allow ${ports.map(p => p.label).join('/')} from ${targetName}`,
    ingress_from_port: ports[0].port,
    ingress_to_port: ports[0].port,
    ingress_protocol: ports[0].protocol,
    ingress_cidr: '0.0.0.0/0',
  });
}

/**
 * Services and the IAM actions they require.
 */
const SERVICE_IAM_ACTIONS: Record<string, { actions: string[]; resources: string[] }> = {
  aws_s3_bucket: {
    actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
    resources: ['arn:aws:s3:::${bucket_name}', 'arn:aws:s3:::${bucket_name}/*'],
  },
  aws_dynamodb_table: {
    actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan'],
    resources: ['arn:aws:dynamodb:*:*:table/${table_name}'],
  },
  aws_sqs_queue: {
    actions: ['sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
    resources: ['arn:aws:sqs:*:*:${queue_name}'],
  },
  aws_sns_topic: {
    actions: ['sns:Publish', 'sns:Subscribe'],
    resources: ['arn:aws:sns:*:*:${topic_name}'],
  },
  aws_kinesis_stream: {
    actions: ['kinesis:PutRecord', 'kinesis:GetRecords', 'kinesis:DescribeStream'],
    resources: ['arn:aws:kinesis:*:*:stream/${stream_name}'],
  },
  aws_kinesis_firehose_delivery_stream: {
    actions: ['firehose:PutRecord', 'firehose:PutRecordBatch'],
    resources: ['arn:aws:firehose:*:*:deliverystream/${stream_name}'],
  },
};

/**
 * Given all nodes and edges, generate IAM policy statements for any
 * compute → data-service connections. Returns a map of IAM role node ID
 * to the policy JSON statements to attach.
 */
export function generateAutoIAMStatements(
  nodes: Node<ResourceNodeData>[],
  edges: Edge[]
): Record<string, { roleName: string; roleId: string; statements: Record<string, any>[] }> {
  const rolePolicies: Record<string, { roleName: string; roleId: string; statements: Record<string, any>[] }> = {};

  const computeTypes = new Set(['aws_instance', 'aws_lambda_function', 'aws_ecs_service', 'aws_eks_node_group']);

  // Pre-build a map: compute node ID → connected IAM role node IDs
  const computeToRole: Record<string, string> = {};
  for (const roleEdge of edges) {
    const src = nodes.find(n => n.id === roleEdge.source);
    const tgt = nodes.find(n => n.id === roleEdge.target);
    if (!src || !tgt) continue;
    const srcType = getResourceType(src);
    const tgtType = getResourceType(tgt);
    if (srcType === 'aws_iam_role' && computeTypes.has(tgtType)) {
      computeToRole[tgt.id] = src.id;
    } else if (tgtType === 'aws_iam_role' && computeTypes.has(srcType)) {
      computeToRole[src.id] = tgt.id;
    }
  }

  for (const edge of edges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceType = getResourceType(sourceNode);
    const targetType = getResourceType(targetNode);

    const computeNode = computeTypes.has(sourceType) ? sourceNode : computeTypes.has(targetType) ? targetNode : null;
    const serviceNode = !computeNode ? null : (computeNode === sourceNode ? targetNode : sourceNode);
    if (!computeNode || !serviceNode) continue;

    const serviceType = getResourceType(serviceNode);
    const svcActions = SERVICE_IAM_ACTIONS[serviceType];
    if (!svcActions) continue;

    // Find IAM role connected to this compute node
    const roleId = computeToRole[computeNode.id];
    if (!roleId) continue;

    const roleNode = nodes.find(n => n.id === roleId);
    if (!roleNode) continue;

    const serviceConfig = getNodeConfig(serviceNode);
    const serviceName = getResourceName(serviceNode);

    const actions = svcActions.actions;
    const resources = svcActions.resources.map(r => {
      const bucket = serviceConfig.bucket || serviceName || serviceNode.id;
      const table = serviceConfig.table_name || serviceName || serviceNode.id;
      const queue = serviceConfig.name || serviceName || serviceNode.id;
      const topic = serviceConfig.name || serviceName || serviceNode.id;
      const stream = serviceConfig.name || serviceName || serviceNode.id;
      return r
        .replace('${bucket_name}', String(bucket))
        .replace('${table_name}', String(table))
        .replace('${queue_name}', String(queue))
        .replace('${topic_name}', String(topic))
        .replace('${stream_name}', String(stream));
    });

    const statement = {
      Effect: 'Allow',
      Action: actions,
      Resource: resources,
    };

    if (!rolePolicies[roleId]) {
      rolePolicies[roleId] = {
        roleName: getResourceName(roleNode) || roleNode.id,
        roleId,
        statements: [],
      };
    }

    rolePolicies[roleId].statements.push(statement);
  }

  return rolePolicies;
}

/**
 * Propagate the `tags_name` from parent resources to their connected children.
 * Eg. when a VPC has tags_name set, auto-set it on connected Subnets/EC2s.
 */
export function propagateTags(
  sourceNode: Node<ResourceNodeData>,
  targetNode: Node<ResourceNodeData>,
  updateConfig: (nodeId: string, config: Record<string, any>) => void
): void {
  const sourceCfg = getNodeConfig(sourceNode);
  const targetCfg = getNodeConfig(targetNode);
  const sourceType = getResourceType(sourceNode);
  const targetType = getResourceType(targetNode);

  const parentTypes = new Set(['aws_vpc', 'aws_subnet', 'aws_ecs_cluster', 'aws_eks_cluster']);
  const parentTag = sourceCfg.tags_name;

  if (parentTag && parentTypes.has(sourceType)) {
    if (!targetCfg.tags_name) {
      const derivedTag = `${parentTag}-${targetType.replace('aws_', '').replace('_', '-')}`;
      updateConfig(targetNode.id, { tags_name: derivedTag } as any);
    }
  }

  const reverseParentTag = targetCfg.tags_name;
  if (reverseParentTag && parentTypes.has(targetType)) {
    if (!sourceCfg.tags_name) {
      const derivedTag = `${reverseParentTag}-${sourceType.replace('aws_', '').replace('_', '-')}`;
      updateConfig(sourceNode.id, { tags_name: derivedTag } as any);
    }
  }
}
