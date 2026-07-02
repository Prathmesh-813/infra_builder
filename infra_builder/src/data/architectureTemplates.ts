import { Node, Edge } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import { RESOURCE_DEFINITIONS } from './resourceDefinitions';
import { MarkerType } from 'reactflow';

export interface ArchTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  category: string;
  tags: string[];
  resourceCount: number;
  generate: (idOffset: number) => { nodes: Node<ResourceNodeData>[]; edges: Edge[] };
}

const PORT_COLORS: Record<string, string> = {
  'bg-cyan-400': '#22d3ee', 'bg-red-400': '#f87171', 'bg-pink-400': '#f472b6',
  'bg-blue-400': '#60a5fa', 'bg-orange-400': '#fb923c', 'bg-purple-400': '#c084fc',
  'bg-yellow-400': '#facc15', 'bg-green-400': '#4ade80', 'bg-teal-400': '#2dd4bf',
  'bg-indigo-400': '#818cf8', 'bg-lime-400': '#a3e635', 'bg-rose-400': '#fb7185',
};

function def(type: string) {
  return RESOURCE_DEFINITIONS.find((d) => d.type === type)!;
}

function mn(id: string, type: string, name: string, pos: { x: number; y: number }, extra: Record<string, string | number | boolean> = {}): Node<ResourceNodeData> {
  const definition = def(type);
  const config: Record<string, string | number | boolean> = {};
  definition.fields.forEach((f) => { if (f.default !== undefined) config[f.key] = f.default; });
  Object.assign(config, extra);
  return { id, type: 'resourceNode', position: pos, data: { resourceType: definition.type as ResourceNodeData['resourceType'], resourceName: name, config, definition } };
}

function me(id: string, src: string, sh: string, tgt: string, th: string, pc: string, label: string): Edge {
  const color = PORT_COLORS[pc] ?? '#6b7280';
  return { id, source: src, target: tgt, sourceHandle: sh, targetHandle: th, type: 'smoothstep', animated: true, style: { stroke: color, strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color }, label, labelStyle: { fill: '#9ca3af', fontSize: 10 }, labelBgStyle: { fill: '#1f2937', fillOpacity: 0.85 } };
}

export const TEMPLATES: ArchTemplate[] = [
  {
    id: '3tier-web',
    name: '3-Tier Web Application',
    description: 'ALB + EC2 Auto Scaling + RDS Multi-AZ with VPC, subnets, and security groups',
    icon: '🌐',
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/60',
    borderColor: 'border-blue-500',
    category: 'Web',
    tags: ['ALB', 'EC2', 'ASG', 'RDS', 'VPC', 'Multi-AZ'],
    resourceCount: 8,
    generate: (o: number) => {
      const bx = 80, by = 100;
      const nodes = [
        mn(`n${o}igw`, 'aws_internet_gateway', 'app_igw', { x: bx, y: by }, { tags_name: 'app-igw' }),
        mn(`n${o}vpc`, 'aws_vpc', 'app_vpc', { x: bx+220, y: by }, { cidr_block: '10.0.0.0/16', tags_name: 'app-vpc' }),
        mn(`n${o}sub`, 'aws_subnet', 'public_subnet', { x: bx+440, y: by-80 }, { cidr_block: '10.0.1.0/24', tags_name: 'public-subnet' }),
        mn(`n${o}sg`, 'aws_security_group', 'app_sg', { x: bx+440, y: by+80 }, { name: 'app-sg', description: 'App SG', ingress_from_port: 443, ingress_to_port: 443, tags_name: 'app-sg' }),
        mn(`n${o}lb`, 'aws_lb', 'app_alb', { x: bx+660, y: by }, { name: 'app-alb', load_balancer_type: 'application', tags_name: 'app-alb' }),
        mn(`n${o}lt`, 'aws_launch_template', 'app_lt', { x: bx+880, y: by-80 }, { name: 'app-lt', instance_type: 't3.medium', tags_name: 'app-lt' }),
        mn(`n${o}asg`, 'aws_autoscaling_group', 'app_asg', { x: bx+880, y: by+80 }, { name: 'app-asg', min_size: 2, max_size: 6, desired_capacity: 3, tags_name: 'app-asg' }),
        mn(`n${o}rds`, 'aws_rds_instance', 'app_db', { x: bx+1100, y: by }, { identifier: 'app-db', engine: 'mysql', instance_class: 'db.t3.medium', multi_az: true, tags_name: 'app-db' }),
      ];
      const edges = [
        me(`e${o}1`, `n${o}igw`, 'inet-out', `n${o}vpc`, 'subnet-out', 'bg-teal-400', 'attaches'),
        me(`e${o}2`, `n${o}vpc`, 'subnet-out', `n${o}sub`, 'vpc-in', 'bg-cyan-400', 'Subnet'),
        me(`e${o}3`, `n${o}vpc`, 'sg-out', `n${o}sg`, 'vpc-in', 'bg-red-400', 'SG'),
        me(`e${o}4`, `n${o}sub`, 'lb-out', `n${o}lb`, 'subnet-in', 'bg-indigo-400', 'Subnet'),
        me(`e${o}5`, `n${o}sg`, 'lb-out', `n${o}lb`, 'sg-in', 'bg-red-400', 'SG'),
        me(`e${o}6`, `n${o}lt`, 'asg-out', `n${o}asg`, 'lt-in', 'bg-orange-400', 'Template'),
        me(`e${o}7`, `n${o}sub`, 'rds-out', `n${o}rds`, 'subnet-in', 'bg-purple-400', 'Subnet'),
        me(`e${o}8`, `n${o}sg`, 'rds-out', `n${o}rds`, 'sg-in', 'bg-red-400', 'SG'),
      ];
      return { nodes, edges };
    },
  },
  {
    id: 'serverless-api',
    name: 'Serverless REST API',
    description: 'API Gateway + Lambda + DynamoDB with IAM roles and CloudWatch logging',
    icon: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950/60',
    borderColor: 'border-yellow-500',
    category: 'Serverless',
    tags: ['API Gateway', 'Lambda', 'DynamoDB', 'IAM', 'CloudWatch'],
    resourceCount: 5,
    generate: (o: number) => {
      const bx = 80, by = 100;
      const nodes = [
        mn(`n${o}iam`, 'aws_iam_role', 'lambda_role', { x: bx, y: by+160 }, { name: 'lambda-api-role', assume_role_service: 'lambda.amazonaws.com', tags_name: 'lambda-role' }),
        mn(`n${o}fn`, 'aws_lambda_function', 'api_handler', { x: bx+260, y: by }, { function_name: 'api-handler', runtime: 'nodejs18.x', handler: 'index.handler', memory_size: 256, timeout: 30, tags_name: 'api-handler' }),
        mn(`n${o}api`, 'aws_api_gateway_rest_api', 'rest_api', { x: bx+520, y: by }, { name: 'my-api', endpoint_type: 'REGIONAL', tags_name: 'my-api' }),
        mn(`n${o}db`, 'aws_dynamodb_table', 'app_table', { x: bx+260, y: by+200 }, { name: 'app-table', billing_mode: 'PAY_PER_REQUEST', hash_key: 'id', hash_key_type: 'S', tags_name: 'app-table' }),
        mn(`n${o}log`, 'aws_cloudwatch_log_group', 'api_logs', { x: bx, y: by }, { name: '/aws/lambda/api-handler', retention_in_days: 14, tags_name: 'api-logs' }),
      ];
      const edges = [
        me(`e${o}1`, `n${o}iam`, 'lambda-out', `n${o}fn`, 'iam-in', 'bg-pink-400', 'IAM Role'),
        me(`e${o}2`, `n${o}fn`, 's3-out', `n${o}api`, 'lambda-in', 'bg-yellow-400', 'Handler'),
      ];
      return { nodes, edges };
    },
  },
  {
    id: 'data-pipeline',
    name: 'Data Ingestion Pipeline',
    description: 'Kinesis Stream + Firehose + S3 + Glue ETL + Athena for analytics',
    icon: '🌊',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/60',
    borderColor: 'border-cyan-500',
    category: 'Analytics',
    tags: ['Kinesis', 'Firehose', 'S3', 'Glue', 'Athena', 'IAM'],
    resourceCount: 6,
    generate: (o: number) => {
      const bx = 80, by = 100;
      const nodes = [
        mn(`n${o}iam`, 'aws_iam_role', 'pipeline_role', { x: bx, y: by+150 }, { name: 'pipeline-role', assume_role_service: 'firehose.amazonaws.com', tags_name: 'pipeline-role' }),
        mn(`n${o}ks`, 'aws_kinesis_stream', 'data_stream', { x: bx, y: by }, { name: 'data-stream', shard_count: 2, retention_period: 24, tags_name: 'data-stream' }),
        mn(`n${o}fh`, 'aws_kinesis_firehose_delivery_stream', 'data_firehose', { x: bx+280, y: by }, { name: 'data-firehose', destination: 'extended_s3', buffer_size: 5, buffer_interval: 300, tags_name: 'data-firehose' }),
        mn(`n${o}s3`, 'aws_s3_bucket', 'data_lake', { x: bx+560, y: by }, { bucket: 'my-data-lake-bucket', versioning_enabled: true, server_side_encryption: 'AES256', tags_name: 'data-lake' }),
        mn(`n${o}glue`, 'aws_glue_job', 'etl_job', { x: bx+560, y: by+200 }, { name: 'etl-job', glue_version: '4.0', number_of_workers: 5, tags_name: 'etl-job' }),
        mn(`n${o}ath`, 'aws_athena_workgroup', 'analytics', { x: bx+840, y: by }, { name: 'analytics', output_location: 's3://my-data-lake-bucket/results/', tags_name: 'analytics' }),
      ];
      const edges = [
        me(`e${o}1`, `n${o}ks`, 'fh-out', `n${o}fh`, 'kinesis-in', 'bg-blue-400', 'Stream'),
        me(`e${o}2`, `n${o}iam`, 'lambda-out', `n${o}fh`, 'iam-in', 'bg-pink-400', 'IAM'),
        me(`e${o}3`, `n${o}fh`, 's3-out', `n${o}s3`, 'iam-in', 'bg-green-400', 'Deliver'),
        me(`e${o}4`, `n${o}s3`, 'data-out', `n${o}ath`, 's3-in', 'bg-green-400', 'Query'),
      ];
      return { nodes, edges };
    },
  },
  {
    id: 'static-website',
    name: 'Static Website (CDN)',
    description: 'S3 + CloudFront + Route53 + ACM certificate for a production static site',
    icon: '🚀',
    color: 'text-orange-400',
    bgColor: 'bg-orange-950/60',
    borderColor: 'border-orange-500',
    category: 'Web',
    tags: ['S3', 'CloudFront', 'Route53', 'ACM', 'WAF'],
    resourceCount: 5,
    generate: (o: number) => {
      const bx = 80, by = 100;
      const nodes = [
        mn(`n${o}s3`, 'aws_s3_bucket', 'website_bucket', { x: bx, y: by }, { bucket: 'my-website-bucket', block_public_acls: true, server_side_encryption: 'AES256', tags_name: 'website-bucket' }),
        mn(`n${o}acm`, 'aws_acm_certificate', 'site_cert', { x: bx+260, y: by+180 }, { domain_name: 'example.com', validation_method: 'DNS', tags_name: 'site-cert' }),
        mn(`n${o}waf`, 'aws_wafv2_web_acl', 'site_waf', { x: bx+260, y: by-80 }, { name: 'site-waf', scope: 'CLOUDFRONT', default_action: 'allow', tags_name: 'site-waf' }),
        mn(`n${o}cf`, 'aws_cloudfront_distribution', 'cdn', { x: bx+520, y: by }, { default_root_object: 'index.html', price_class: 'PriceClass_100', http_version: 'http2', tags_name: 'cdn' }),
        mn(`n${o}r53`, 'aws_route53_zone', 'dns_zone', { x: bx+780, y: by }, { name: 'example.com', tags_name: 'dns-zone' }),
      ];
      const edges = [
        me(`e${o}1`, `n${o}s3`, 'data-out', `n${o}cf`, 's3-in', 'bg-green-400', 'Origin'),
        me(`e${o}2`, `n${o}waf`, 'cf-out', `n${o}cf`, 'waf-in', 'bg-red-400', 'WAF'),
      ];
      return { nodes, edges };
    },
  },
  {
    id: 'microservices-ecs',
    name: 'Microservices on ECS Fargate',
    description: 'ECS Fargate cluster with ALB, ECR, CloudWatch, and IAM for containerised microservices',
    icon: '🐳',
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-900/60',
    borderColor: 'border-cyan-400',
    category: 'Containers',
    tags: ['ECS', 'Fargate', 'ECR', 'ALB', 'CloudWatch', 'IAM'],
    resourceCount: 7,
    generate: (o: number) => {
      const bx = 80, by = 100;
      const nodes = [
        mn(`n${o}vpc`, 'aws_vpc', 'svc_vpc', { x: bx, y: by }, { cidr_block: '10.10.0.0/16', tags_name: 'svc-vpc' }),
        mn(`n${o}sub`, 'aws_subnet', 'svc_subnet', { x: bx+220, y: by-60 }, { cidr_block: '10.10.1.0/24', tags_name: 'svc-subnet' }),
        mn(`n${o}sg`, 'aws_security_group', 'svc_sg', { x: bx+220, y: by+80 }, { name: 'svc-sg', description: 'ECS SG', ingress_from_port: 80, ingress_to_port: 80, tags_name: 'svc-sg' }),
        mn(`n${o}ecr`, 'aws_ecr_repository', 'app_repo', { x: bx+440, y: by-120 }, { name: 'app-service', scan_on_push: true, image_tag_mutability: 'IMMUTABLE', tags_name: 'app-repo' }),
        mn(`n${o}iam`, 'aws_iam_role', 'ecs_role', { x: bx+440, y: by+160 }, { name: 'ecs-task-role', assume_role_service: 'ecs-tasks.amazonaws.com', tags_name: 'ecs-role' }),
        mn(`n${o}cluster`, 'aws_ecs_cluster', 'app_cluster', { x: bx+660, y: by }, { name: 'app-cluster', capacity_provider: 'FARGATE', container_insights: true, tags_name: 'app-cluster' }),
        mn(`n${o}lb`, 'aws_lb', 'svc_alb', { x: bx+880, y: by }, { name: 'svc-alb', load_balancer_type: 'application', tags_name: 'svc-alb' }),
      ];
      const edges = [
        me(`e${o}1`, `n${o}vpc`, 'subnet-out', `n${o}sub`, 'vpc-in', 'bg-cyan-400', 'Subnet'),
        me(`e${o}2`, `n${o}vpc`, 'sg-out', `n${o}sg`, 'vpc-in', 'bg-red-400', 'SG'),
        me(`e${o}3`, `n${o}sub`, 'lb-out', `n${o}lb`, 'subnet-in', 'bg-indigo-400', 'Subnet'),
        me(`e${o}4`, `n${o}sg`, 'lb-out', `n${o}lb`, 'sg-in', 'bg-red-400', 'SG'),
      ];
      return { nodes, edges };
    },
  },
  {
    id: 'ml-inference',
    name: 'ML Inference API',
    description: 'SageMaker endpoint behind API Gateway with S3 model storage and IAM',
    icon: '🤖',
    color: 'text-green-400',
    bgColor: 'bg-green-950/60',
    borderColor: 'border-green-500',
    category: 'AI/ML',
    tags: ['SageMaker', 'API Gateway', 'S3', 'IAM', 'Lambda'],
    resourceCount: 5,
    generate: (o: number) => {
      const bx = 80, by = 100;
      const nodes = [
        mn(`n${o}s3`, 'aws_s3_bucket', 'model_bucket', { x: bx, y: by }, { bucket: 'my-ml-models', server_side_encryption: 'AES256', tags_name: 'model-bucket' }),
        mn(`n${o}iam`, 'aws_iam_role', 'sm_role', { x: bx+260, y: by+160 }, { name: 'sagemaker-role', assume_role_service: 'sagemaker.amazonaws.com', tags_name: 'sm-role' }),
        mn(`n${o}model`, 'aws_sagemaker_model', 'ml_model', { x: bx+260, y: by }, { name: 'my-model', container_image: '763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:2.0.0-cpu-py310', tags_name: 'ml-model' }),
        mn(`n${o}ep`, 'aws_sagemaker_endpoint', 'ml_endpoint', { x: bx+520, y: by }, { name: 'ml-endpoint', instance_type: 'ml.m5.large', initial_instance_count: 1, tags_name: 'ml-endpoint' }),
        mn(`n${o}api`, 'aws_api_gateway_rest_api', 'inference_api', { x: bx+780, y: by }, { name: 'inference-api', endpoint_type: 'REGIONAL', tags_name: 'inference-api' }),
      ];
      const edges = [
        me(`e${o}1`, `n${o}iam`, 'lambda-out', `n${o}model`, 'iam-in', 'bg-pink-400', 'IAM'),
        me(`e${o}2`, `n${o}model`, 'ep-out', `n${o}ep`, 'model-in', 'bg-green-400', 'Model'),
        me(`e${o}3`, `n${o}ep`, 'api-out', `n${o}api`, 'lambda-in', 'bg-lime-400', 'Endpoint'),
      ];
      return { nodes, edges };
    },
  },
];
