import { Node, Edge } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import { RESOURCE_DEFINITIONS } from './resourceDefinitions';
import { MarkerType } from 'reactflow';

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;          // tailwind text color
  bgColor: string;        // tailwind bg color
  borderColor: string;    // tailwind border color
  tags: string[];
}

export const BLUEPRINTS: Blueprint[] = [
  {
    id: 'ec2-full',
    name: 'EC2 Full Stack',
    description: 'EC2 + VPC + Subnet + Security Group + Internet Gateway + IAM Role — all wired up',
    icon: '🖥️',
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/60',
    borderColor: 'border-orange-500',
    tags: ['EC2', 'VPC', 'Subnet', 'Security Group', 'IAM', 'IGW'],
  },
  {
    id: 'rds-full',
    name: 'RDS Full Stack',
    description: 'RDS + VPC + 2 Subnets + Security Group — production-ready database setup',
    icon: '🗄️',
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/60',
    borderColor: 'border-purple-500',
    tags: ['RDS', 'VPC', 'Subnet', 'Security Group'],
  },
  {
    id: 'lambda-full',
    name: 'Lambda Full Stack',
    description: 'Lambda + IAM Role + S3 Bucket + Security Group + Subnet',
    icon: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950/60',
    borderColor: 'border-yellow-500',
    tags: ['Lambda', 'IAM', 'S3', 'Security Group'],
  },
  {
    id: 'web-app',
    name: 'Web Application',
    description: 'Load Balancer + EC2 + VPC + Subnet + Security Group + IGW',
    icon: '🌐',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-950/60',
    borderColor: 'border-indigo-500',
    tags: ['ALB', 'EC2', 'VPC', 'Subnet', 'Security Group'],
  },
];

// ── Edge color map ────────────────────────────────────────────────────────────
const PORT_COLORS: Record<string, string> = {
  'bg-cyan-400':   '#22d3ee',
  'bg-red-400':    '#f87171',
  'bg-pink-400':   '#f472b6',
  'bg-blue-400':   '#60a5fa',
  'bg-orange-400': '#fb923c',
  'bg-purple-400': '#c084fc',
  'bg-yellow-400': '#facc15',
  'bg-green-400':  '#4ade80',
  'bg-teal-400':   '#2dd4bf',
  'bg-indigo-400': '#818cf8',
};

function def(type: string) {
  return RESOURCE_DEFINITIONS.find((d) => d.type === type)!;
}

function makeNode(
  id: string,
  type: string,
  name: string,
  position: { x: number; y: number },
  extraConfig: Record<string, string | number | boolean> = {}
): Node<ResourceNodeData> {
  const definition = def(type);
  const config: Record<string, string | number | boolean> = {};
  definition.fields.forEach((f) => {
    if (f.default !== undefined) config[f.key] = f.default;
  });
  Object.assign(config, extraConfig);
  return {
    id,
    type: 'resourceNode',
    position,
    data: { resourceType: definition.type as ResourceNodeData['resourceType'], resourceName: name, config, definition },
  };
}

function makeEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  portColor: string,
  label: string
): Edge {
  const color = PORT_COLORS[portColor] ?? '#6b7280';
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: 'smoothstep',
    animated: true,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
    label,
    labelStyle: { fill: '#9ca3af', fontSize: 10 },
    labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85 },
  };
}

// ── Blueprint generators ──────────────────────────────────────────────────────

export function generateBlueprintNodes(
  blueprintId: string,
  basePosition: { x: number; y: number },
  idOffset: number
): { nodes: Node<ResourceNodeData>[]; edges: Edge[] } {
  const o = idOffset; // numeric offset so IDs don't clash

  switch (blueprintId) {

    // ── EC2 Full Stack ──────────────────────────────────────────────────────
    case 'ec2-full': {
      const igwId  = `bp_${o}_igw`;
      const vpcId  = `bp_${o}_vpc`;
      const subId  = `bp_${o}_sub`;
      const sgId   = `bp_${o}_sg`;
      const iamId  = `bp_${o}_iam`;
      const ec2Id  = `bp_${o}_ec2`;

      const bx = basePosition.x;
      const by = basePosition.y;

      const nodes: Node<ResourceNodeData>[] = [
        makeNode(igwId, 'aws_internet_gateway', 'main_igw',  { x: bx,       y: by },       { tags_name: 'main-igw' }),
        makeNode(vpcId, 'aws_vpc',              'main_vpc',  { x: bx + 220, y: by },       { cidr_block: '10.0.0.0/16', tags_name: 'main-vpc' }),
        makeNode(subId, 'aws_subnet',           'main_sub',  { x: bx + 440, y: by - 80 },  { cidr_block: '10.0.1.0/24', vpc_id: `aws_vpc.main_vpc.id`, tags_name: 'main-subnet' }),
        makeNode(sgId,  'aws_security_group',   'main_sg',   { x: bx + 440, y: by + 80 },  { name: 'main-sg', description: 'Main security group', vpc_id: `aws_vpc.main_vpc.id`, tags_name: 'main-sg' }),
        makeNode(iamId, 'aws_iam_role',         'ec2_role',  { x: bx + 660, y: by - 80 },  { name: 'ec2-role', assume_role_service: 'ec2.amazonaws.com', tags_name: 'ec2-role' }),
        makeNode(ec2Id, 'aws_instance',         'web_server',{ x: bx + 880, y: by },       { ami: 'ami-0c55b159cbfafe1f0', instance_type: 't3.micro', subnet_id: `aws_subnet.main_sub.id`, vpc_security_group_ids: `aws_security_group.main_sg.id`, tags_name: 'web-server' }),
      ];

      const edges: Edge[] = [
        makeEdge(`e_${o}_igw_vpc`,  igwId, 'inet-out', vpcId,  'subnet-out', 'bg-teal-400',   'attaches'),
        makeEdge(`e_${o}_vpc_sub`,  vpcId, 'subnet-out', subId, 'vpc-in',    'bg-cyan-400',   'Subnet'),
        makeEdge(`e_${o}_vpc_sg`,   vpcId, 'sg-out',    sgId,  'vpc-in',     'bg-red-400',    'Security Group'),
        makeEdge(`e_${o}_sub_ec2`,  subId, 'ec2-out',   ec2Id, 'subnet-in',  'bg-orange-400', 'Subnet'),
        makeEdge(`e_${o}_sg_ec2`,   sgId,  'ec2-out',   ec2Id, 'sg-in',      'bg-red-400',    'Security Group'),
        makeEdge(`e_${o}_iam_ec2`,  iamId, 'ec2-out',   ec2Id, 'iam-in',     'bg-pink-400',   'IAM Role'),
      ];

      return { nodes, edges };
    }

    // ── RDS Full Stack ──────────────────────────────────────────────────────
    case 'rds-full': {
      const vpcId  = `bp_${o}_vpc`;
      const sub1Id = `bp_${o}_sub1`;
      const sub2Id = `bp_${o}_sub2`;
      const sgId   = `bp_${o}_sg`;
      const rdsId  = `bp_${o}_rds`;

      const bx = basePosition.x;
      const by = basePosition.y;

      const nodes: Node<ResourceNodeData>[] = [
        makeNode(vpcId,  'aws_vpc',          'db_vpc',   { x: bx,       y: by },       { cidr_block: '10.1.0.0/16', tags_name: 'db-vpc' }),
        makeNode(sub1Id, 'aws_subnet',       'db_sub_a', { x: bx + 220, y: by - 100 }, { cidr_block: '10.1.1.0/24', availability_zone: 'us-east-1a', vpc_id: 'aws_vpc.db_vpc.id', tags_name: 'db-subnet-a' }),
        makeNode(sub2Id, 'aws_subnet',       'db_sub_b', { x: bx + 220, y: by + 100 }, { cidr_block: '10.1.2.0/24', availability_zone: 'us-east-1b', vpc_id: 'aws_vpc.db_vpc.id', tags_name: 'db-subnet-b' }),
        makeNode(sgId,   'aws_security_group','db_sg',   { x: bx + 440, y: by - 100 }, { name: 'db-sg', description: 'RDS security group', vpc_id: 'aws_vpc.db_vpc.id', ingress_from_port: 3306, ingress_to_port: 3306, tags_name: 'db-sg' }),
        makeNode(rdsId,  'aws_rds_instance', 'main_db',  { x: bx + 660, y: by },       { identifier: 'main-db', engine: 'mysql', instance_class: 'db.t3.micro', allocated_storage: 20, username: 'admin', password: 'changeme123!', tags_name: 'main-db' }),
      ];

      const edges: Edge[] = [
        makeEdge(`e_${o}_vpc_sub1`, vpcId,  'subnet-out', sub1Id, 'vpc-in',   'bg-cyan-400',   'Subnet A'),
        makeEdge(`e_${o}_vpc_sub2`, vpcId,  'subnet-out', sub2Id, 'vpc-in',   'bg-cyan-400',   'Subnet B'),
        makeEdge(`e_${o}_vpc_sg`,   vpcId,  'sg-out',     sgId,   'vpc-in',   'bg-red-400',    'Security Group'),
        makeEdge(`e_${o}_sub1_rds`, sub1Id, 'rds-out',    rdsId,  'subnet-in','bg-purple-400', 'Subnet'),
        makeEdge(`e_${o}_sg_rds`,   sgId,   'rds-out',    rdsId,  'sg-in',    'bg-red-400',    'Security Group'),
      ];

      return { nodes, edges };
    }

    // ── Lambda Full Stack ───────────────────────────────────────────────────
    case 'lambda-full': {
      const iamId = `bp_${o}_iam`;
      const s3Id  = `bp_${o}_s3`;
      const sgId  = `bp_${o}_sg`;
      const subId = `bp_${o}_sub`;
      const fnId  = `bp_${o}_fn`;

      const bx = basePosition.x;
      const by = basePosition.y;

      const nodes: Node<ResourceNodeData>[] = [
        makeNode(iamId, 'aws_iam_role',         'lambda_role',  { x: bx,       y: by - 80 },  { name: 'lambda-role', assume_role_service: 'lambda.amazonaws.com', tags_name: 'lambda-role' }),
        makeNode(s3Id,  'aws_s3_bucket',        'fn_bucket',    { x: bx,       y: by + 80 },  { bucket: 'my-lambda-bucket', tags_name: 'lambda-bucket' }),
        makeNode(sgId,  'aws_security_group',   'lambda_sg',    { x: bx + 220, y: by - 80 },  { name: 'lambda-sg', description: 'Lambda security group', tags_name: 'lambda-sg' }),
        makeNode(subId, 'aws_subnet',           'lambda_sub',   { x: bx + 220, y: by + 80 },  { cidr_block: '10.2.1.0/24', tags_name: 'lambda-subnet' }),
        makeNode(fnId,  'aws_lambda_function',  'my_function',  { x: bx + 460, y: by },       { function_name: 'my-function', runtime: 'nodejs18.x', handler: 'index.handler', role: 'aws_iam_role.lambda_role.arn', memory_size: 256, timeout: 30, tags_name: 'my-function' }),
      ];

      const edges: Edge[] = [
        makeEdge(`e_${o}_iam_fn`,  iamId, 'lambda-out', fnId, 'iam-in',    'bg-pink-400',  'IAM Role'),
        makeEdge(`e_${o}_sg_fn`,   sgId,  'ec2-out',    fnId, 'sg-in',     'bg-red-400',   'Security Group'),
        makeEdge(`e_${o}_sub_fn`,  subId, 'ec2-out',    fnId, 'subnet-in', 'bg-cyan-400',  'Subnet'),
        makeEdge(`e_${o}_fn_s3`,   fnId,  's3-out',     s3Id, 'data-out',  'bg-green-400', 'S3 Trigger'),
      ];

      return { nodes, edges };
    }

    // ── Web Application ─────────────────────────────────────────────────────
    case 'web-app': {
      const igwId = `bp_${o}_igw`;
      const vpcId = `bp_${o}_vpc`;
      const subId = `bp_${o}_sub`;
      const sgId  = `bp_${o}_sg`;
      const lbId  = `bp_${o}_lb`;
      const ec2Id = `bp_${o}_ec2`;

      const bx = basePosition.x;
      const by = basePosition.y;

      const nodes: Node<ResourceNodeData>[] = [
        makeNode(igwId, 'aws_internet_gateway', 'app_igw',    { x: bx,       y: by },       { tags_name: 'app-igw' }),
        makeNode(vpcId, 'aws_vpc',              'app_vpc',    { x: bx + 220, y: by },       { cidr_block: '10.3.0.0/16', tags_name: 'app-vpc' }),
        makeNode(subId, 'aws_subnet',           'app_sub',    { x: bx + 440, y: by - 80 },  { cidr_block: '10.3.1.0/24', vpc_id: 'aws_vpc.app_vpc.id', tags_name: 'app-subnet' }),
        makeNode(sgId,  'aws_security_group',   'app_sg',     { x: bx + 440, y: by + 80 },  { name: 'app-sg', description: 'App security group', vpc_id: 'aws_vpc.app_vpc.id', ingress_from_port: 443, ingress_to_port: 443, tags_name: 'app-sg' }),
        makeNode(lbId,  'aws_lb',               'app_alb',    { x: bx + 660, y: by },       { name: 'app-alb', load_balancer_type: 'application', subnets: 'aws_subnet.app_sub.id', security_groups: 'aws_security_group.app_sg.id', tags_name: 'app-alb' }),
        makeNode(ec2Id, 'aws_instance',         'app_server', { x: bx + 880, y: by },       { ami: 'ami-0c55b159cbfafe1f0', instance_type: 't3.small', subnet_id: 'aws_subnet.app_sub.id', vpc_security_group_ids: 'aws_security_group.app_sg.id', tags_name: 'app-server' }),
      ];

      const edges: Edge[] = [
        makeEdge(`e_${o}_igw_vpc`, igwId, 'inet-out',   vpcId, 'subnet-out', 'bg-teal-400',   'attaches'),
        makeEdge(`e_${o}_vpc_sub`, vpcId, 'subnet-out', subId, 'vpc-in',     'bg-cyan-400',   'Subnet'),
        makeEdge(`e_${o}_vpc_sg`,  vpcId, 'sg-out',     sgId,  'vpc-in',     'bg-red-400',    'Security Group'),
        makeEdge(`e_${o}_sub_lb`,  subId, 'lb-out',     lbId,  'subnet-in',  'bg-indigo-400', 'Subnet'),
        makeEdge(`e_${o}_sg_lb`,   sgId,  'lb-out',     lbId,  'sg-in',      'bg-red-400',    'Security Group'),
        makeEdge(`e_${o}_lb_ec2`,  lbId,  'ec2-out',    ec2Id, 'subnet-in',  'bg-orange-400', 'EC2 Target'),
      ];

      return { nodes, edges };
    }

    default:
      return { nodes: [], edges: [] };
  }
}
