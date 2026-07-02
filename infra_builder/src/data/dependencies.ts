import { ResourceType } from '../types/resources';
import { MarkerType, Edge } from 'reactflow';

export interface Dependency {
  resourceType: ResourceType;
  label: string;
  icon: string;
  reason: string;           // why it's needed
  required: boolean;        // required vs optional
  sourcePortId: string;     // port on the dep node that connects OUT
  targetPortId: string;     // port on the main node that connects IN
  portColor: string;        // bg-* class for the edge color
  defaultConfig?: Record<string, string | number | boolean>;
}

export interface ResourceDependencies {
  resourceType: ResourceType;
  deps: Dependency[];
}

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

export function edgeColor(portColor: string): string {
  return PORT_COLORS[portColor] ?? '#6b7280';
}

export function makeDepEdge(
  sourceId: string,
  sourceHandle: string,
  targetId: string,
  targetHandle: string,
  portColor: string,
  label: string
): Edge {
  const color = edgeColor(portColor);
  return {
    id: `dep-${sourceId}-${sourceHandle}-${targetId}-${targetHandle}-${Date.now()}`,
    source: sourceId,
    target: targetId,
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

export const RESOURCE_DEPENDENCIES: ResourceDependencies[] = [
  // ── EC2 Instance ─────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_instance',
    deps: [
      {
        resourceType: 'aws_vpc',
        label: 'VPC',
        icon: '🌐',
        reason: 'EC2 must live inside a VPC network',
        required: true,
        sourcePortId: 'subnet-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-blue-400',
        defaultConfig: { cidr_block: '10.0.0.0/16', enable_dns_support: true, enable_dns_hostnames: true, tags_name: 'main-vpc' },
      },
      {
        resourceType: 'aws_subnet',
        label: 'Subnet',
        icon: '🔗',
        reason: 'EC2 needs a subnet to determine its IP range and AZ',
        required: true,
        sourcePortId: 'ec2-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-cyan-400',
        defaultConfig: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a', tags_name: 'main-subnet' },
      },
      {
        resourceType: 'aws_security_group',
        label: 'Security Group',
        icon: '🛡️',
        reason: 'Controls inbound/outbound traffic to the EC2 instance',
        required: true,
        sourcePortId: 'ec2-out',
        targetPortId: 'sg-in',
        portColor: 'bg-red-400',
        defaultConfig: { name: 'ec2-sg', description: 'EC2 security group', ingress_from_port: 22, ingress_to_port: 22, ingress_protocol: 'tcp', ingress_cidr: '0.0.0.0/0', tags_name: 'ec2-sg' },
      },
      {
        resourceType: 'aws_iam_role',
        label: 'IAM Role',
        icon: '👤',
        reason: 'Grants the EC2 instance permissions to call AWS services',
        required: false,
        sourcePortId: 'ec2-out',
        targetPortId: 'iam-in',
        portColor: 'bg-pink-400',
        defaultConfig: { name: 'ec2-role', assume_role_service: 'ec2.amazonaws.com', tags_name: 'ec2-role' },
      },
      {
        resourceType: 'aws_internet_gateway',
        label: 'Internet Gateway',
        icon: '🌍',
        reason: 'Required for the EC2 to have public internet access',
        required: false,
        sourcePortId: 'inet-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-teal-400',
        defaultConfig: { tags_name: 'main-igw' },
      },
    ],
  },

  // ── RDS Instance ─────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_rds_instance',
    deps: [
      {
        resourceType: 'aws_vpc',
        label: 'VPC',
        icon: '🌐',
        reason: 'RDS must be deployed inside a VPC',
        required: true,
        sourcePortId: 'subnet-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-blue-400',
        defaultConfig: { cidr_block: '10.1.0.0/16', enable_dns_support: true, enable_dns_hostnames: true, tags_name: 'db-vpc' },
      },
      {
        resourceType: 'aws_subnet',
        label: 'Subnet',
        icon: '🔗',
        reason: 'RDS needs a subnet (ideally 2 for Multi-AZ)',
        required: true,
        sourcePortId: 'rds-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-cyan-400',
        defaultConfig: { cidr_block: '10.1.1.0/24', availability_zone: 'us-east-1a', tags_name: 'db-subnet' },
      },
      {
        resourceType: 'aws_security_group',
        label: 'Security Group',
        icon: '🛡️',
        reason: 'Controls which resources can connect to the database port',
        required: true,
        sourcePortId: 'rds-out',
        targetPortId: 'sg-in',
        portColor: 'bg-red-400',
        defaultConfig: { name: 'rds-sg', description: 'RDS security group', ingress_from_port: 3306, ingress_to_port: 3306, ingress_protocol: 'tcp', ingress_cidr: '10.0.0.0/8', tags_name: 'rds-sg' },
      },
    ],
  },

  // ── Lambda Function ──────────────────────────────────────────────────────────
  {
    resourceType: 'aws_lambda_function',
    deps: [
      {
        resourceType: 'aws_iam_role',
        label: 'IAM Role',
        icon: '👤',
        reason: 'Lambda MUST have an execution role to run',
        required: true,
        sourcePortId: 'lambda-out',
        targetPortId: 'iam-in',
        portColor: 'bg-pink-400',
        defaultConfig: { name: 'lambda-role', assume_role_service: 'lambda.amazonaws.com', tags_name: 'lambda-role' },
      },
      {
        resourceType: 'aws_security_group',
        label: 'Security Group',
        icon: '🛡️',
        reason: 'Required when Lambda runs inside a VPC',
        required: false,
        sourcePortId: 'ec2-out',
        targetPortId: 'sg-in',
        portColor: 'bg-red-400',
        defaultConfig: { name: 'lambda-sg', description: 'Lambda security group', tags_name: 'lambda-sg' },
      },
      {
        resourceType: 'aws_subnet',
        label: 'Subnet',
        icon: '🔗',
        reason: 'Required when Lambda runs inside a VPC',
        required: false,
        sourcePortId: 'ec2-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-cyan-400',
        defaultConfig: { cidr_block: '10.2.1.0/24', availability_zone: 'us-east-1a', tags_name: 'lambda-subnet' },
      },
      {
        resourceType: 'aws_s3_bucket',
        label: 'S3 Bucket',
        icon: '🪣',
        reason: 'Store Lambda deployment package or use as trigger',
        required: false,
        sourcePortId: 'data-out',
        targetPortId: 's3-out',
        portColor: 'bg-green-400',
        defaultConfig: { bucket: 'lambda-deployment-bucket', tags_name: 'lambda-bucket' },
      },
    ],
  },

  // ── Load Balancer ────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_lb',
    deps: [
      {
        resourceType: 'aws_vpc',
        label: 'VPC',
        icon: '🌐',
        reason: 'ALB must be deployed inside a VPC',
        required: true,
        sourcePortId: 'subnet-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-blue-400',
        defaultConfig: { cidr_block: '10.3.0.0/16', tags_name: 'alb-vpc' },
      },
      {
        resourceType: 'aws_subnet',
        label: 'Subnet',
        icon: '🔗',
        reason: 'ALB needs at least 2 subnets in different AZs',
        required: true,
        sourcePortId: 'lb-out',
        targetPortId: 'subnet-in',
        portColor: 'bg-cyan-400',
        defaultConfig: { cidr_block: '10.3.1.0/24', availability_zone: 'us-east-1a', tags_name: 'alb-subnet' },
      },
      {
        resourceType: 'aws_security_group',
        label: 'Security Group',
        icon: '🛡️',
        reason: 'Controls traffic allowed into the load balancer',
        required: true,
        sourcePortId: 'lb-out',
        targetPortId: 'sg-in',
        portColor: 'bg-red-400',
        defaultConfig: { name: 'alb-sg', description: 'ALB security group', ingress_from_port: 443, ingress_to_port: 443, ingress_protocol: 'tcp', ingress_cidr: '0.0.0.0/0', tags_name: 'alb-sg' },
      },
    ],
  },

  // ── VPC ──────────────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_vpc',
    deps: [
      {
        resourceType: 'aws_internet_gateway',
        label: 'Internet Gateway',
        icon: '🌍',
        reason: 'Attach an IGW to give the VPC internet access',
        required: false,
        sourcePortId: 'vpc-in',
        targetPortId: 'igw-out',
        portColor: 'bg-teal-400',
        defaultConfig: { tags_name: 'main-igw' },
      },
      {
        resourceType: 'aws_subnet',
        label: 'Subnet',
        icon: '🔗',
        reason: 'VPCs need subnets to place resources in',
        required: true,
        sourcePortId: 'vpc-in',
        targetPortId: 'subnet-out',
        portColor: 'bg-cyan-400',
        defaultConfig: { cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a', tags_name: 'main-subnet' },
      },
    ],
  },

  // ── Subnet ───────────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_subnet',
    deps: [
      {
        resourceType: 'aws_vpc',
        label: 'VPC',
        icon: '🌐',
        reason: 'Every subnet must belong to a VPC',
        required: true,
        sourcePortId: 'subnet-out',
        targetPortId: 'vpc-in',
        portColor: 'bg-blue-400',
        defaultConfig: { cidr_block: '10.0.0.0/16', tags_name: 'main-vpc' },
      },
    ],
  },

  // ── Security Group ───────────────────────────────────────────────────────────
  {
    resourceType: 'aws_security_group',
    deps: [
      {
        resourceType: 'aws_vpc',
        label: 'VPC',
        icon: '🌐',
        reason: 'Security groups are scoped to a VPC',
        required: true,
        sourcePortId: 'sg-out',
        targetPortId: 'vpc-in',
        portColor: 'bg-blue-400',
        defaultConfig: { cidr_block: '10.0.0.0/16', tags_name: 'main-vpc' },
      },
    ],
  },

  // ── Auto Scaling Group ───────────────────────────────────────────────────
  {
    resourceType: 'aws_autoscaling_group',
    deps: [
      { resourceType: 'aws_launch_template', label: 'Launch Template', icon: '📋', reason: 'ASG needs a launch template to define instance configuration', required: true, sourcePortId: 'asg-out', targetPortId: 'lt-in', portColor: 'bg-orange-400', defaultConfig: { name: 'my-lt', image_id: 'ami-0c55b159cbfafe1f0', instance_type: 't3.micro', tags_name: 'my-lt' } },
      { resourceType: 'aws_subnet', label: 'Subnet', icon: '🔗', reason: 'ASG distributes instances across subnets', required: true, sourcePortId: 'ec2-out', targetPortId: 'subnet-in', portColor: 'bg-cyan-400', defaultConfig: { cidr_block: '10.0.1.0/24', tags_name: 'asg-subnet' } },
      { resourceType: 'aws_lb', label: 'Load Balancer', icon: '⚖️', reason: 'Attach ASG to a load balancer for traffic distribution', required: false, sourcePortId: 'ec2-out', targetPortId: 'lb-in', portColor: 'bg-indigo-400', defaultConfig: { name: 'my-alb', load_balancer_type: 'application', tags_name: 'my-alb' } },
    ],
  },

  // ── EKS Cluster ─────────────────────────────────────────────────────────
  {
    resourceType: 'aws_eks_cluster',
    deps: [
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'EKS cluster requires a service role', required: true, sourcePortId: 'ec2-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'eks-cluster-role', assume_role_service: 'eks.amazonaws.com', tags_name: 'eks-role' } },
      { resourceType: 'aws_vpc', label: 'VPC', icon: '🌐', reason: 'EKS cluster must be deployed in a VPC', required: true, sourcePortId: 'subnet-out', targetPortId: 'subnet-in', portColor: 'bg-blue-400', defaultConfig: { cidr_block: '10.0.0.0/16', tags_name: 'eks-vpc' } },
      { resourceType: 'aws_subnet', label: 'Subnet', icon: '🔗', reason: 'EKS needs subnets in multiple AZs', required: true, sourcePortId: 'ec2-out', targetPortId: 'subnet-in', portColor: 'bg-cyan-400', defaultConfig: { cidr_block: '10.0.1.0/24', tags_name: 'eks-subnet' } },
      { resourceType: 'aws_security_group', label: 'Security Group', icon: '🛡️', reason: 'Controls traffic to the EKS control plane', required: true, sourcePortId: 'ec2-out', targetPortId: 'sg-in', portColor: 'bg-red-400', defaultConfig: { name: 'eks-sg', description: 'EKS cluster security group', tags_name: 'eks-sg' } },
    ],
  },

  // ── ECS Service ─────────────────────────────────────────────────────────
  {
    resourceType: 'aws_ecs_service',
    deps: [
      { resourceType: 'aws_ecs_cluster', label: 'ECS Cluster', icon: '🐳', reason: 'Service must run inside an ECS cluster', required: true, sourcePortId: 'svc-out', targetPortId: 'cluster-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'my-cluster', capacity_provider: 'FARGATE', tags_name: 'my-cluster' } },
      { resourceType: 'aws_ecs_task_definition', label: 'Task Definition', icon: '📄', reason: 'Defines the container configuration to run', required: true, sourcePortId: 'svc-out', targetPortId: 'task-in', portColor: 'bg-teal-400', defaultConfig: { family: 'my-task', network_mode: 'awsvpc', requires_compatibilities: 'FARGATE', cpu: '256', memory: '512', tags_name: 'my-task' } },
      { resourceType: 'aws_subnet', label: 'Subnet', icon: '🔗', reason: 'Fargate tasks need a subnet to run in', required: true, sourcePortId: 'ec2-out', targetPortId: 'subnet-in', portColor: 'bg-cyan-400', defaultConfig: { cidr_block: '10.0.1.0/24', tags_name: 'ecs-subnet' } },
      { resourceType: 'aws_security_group', label: 'Security Group', icon: '🛡️', reason: 'Controls traffic to the ECS tasks', required: true, sourcePortId: 'ec2-out', targetPortId: 'sg-in', portColor: 'bg-red-400', defaultConfig: { name: 'ecs-sg', description: 'ECS service security group', tags_name: 'ecs-sg' } },
    ],
  },

  // ── DynamoDB ─────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_dynamodb_table',
    deps: [
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'Grants Lambda/EC2 permissions to read/write the table', required: false, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'dynamodb-role', assume_role_service: 'lambda.amazonaws.com', tags_name: 'dynamodb-role' } },
      { resourceType: 'aws_kms_key', label: 'KMS Key', icon: '🔑', reason: 'Encrypt DynamoDB table at rest', required: false, sourcePortId: 'enc-out', targetPortId: 'iam-in', portColor: 'bg-yellow-400', defaultConfig: { description: 'DynamoDB encryption key', enable_key_rotation: true, tags_name: 'dynamodb-kms' } },
    ],
  },

  // ── SNS Topic ────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_sns_topic',
    deps: [
      { resourceType: 'aws_sqs_queue', label: 'SQS Queue', icon: '📬', reason: 'Subscribe an SQS queue to receive SNS messages', required: false, sourcePortId: 'sns-in', targetPortId: 'msg-out', portColor: 'bg-amber-400', defaultConfig: { name: 'my-queue', tags_name: 'my-queue' } },
      { resourceType: 'aws_lambda_function', label: 'Lambda', icon: '⚡', reason: 'Trigger a Lambda function on SNS messages', required: false, sourcePortId: 'iam-in', targetPortId: 'msg-out', portColor: 'bg-yellow-400', defaultConfig: { function_name: 'sns-handler', runtime: 'nodejs18.x', handler: 'index.handler', role: 'aws_iam_role.lambda.arn', tags_name: 'sns-handler' } },
      { resourceType: 'aws_kms_key', label: 'KMS Key', icon: '🔑', reason: 'Encrypt SNS messages at rest', required: false, sourcePortId: 'enc-out', targetPortId: 'iam-in', portColor: 'bg-yellow-400', defaultConfig: { description: 'SNS encryption key', tags_name: 'sns-kms' } },
    ],
  },

  // ── SQS Queue ────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_sqs_queue',
    deps: [
      { resourceType: 'aws_lambda_function', label: 'Lambda Consumer', icon: '⚡', reason: 'Lambda polls the queue and processes messages', required: false, sourcePortId: 'iam-in', targetPortId: 'lambda-out', portColor: 'bg-yellow-400', defaultConfig: { function_name: 'sqs-consumer', runtime: 'nodejs18.x', handler: 'index.handler', role: 'aws_iam_role.lambda.arn', tags_name: 'sqs-consumer' } },
      { resourceType: 'aws_kms_key', label: 'KMS Key', icon: '🔑', reason: 'Encrypt SQS messages at rest', required: false, sourcePortId: 'enc-out', targetPortId: 'sns-in', portColor: 'bg-yellow-400', defaultConfig: { description: 'SQS encryption key', tags_name: 'sqs-kms' } },
    ],
  },

  // ── Kinesis Stream ───────────────────────────────────────────────────────
  {
    resourceType: 'aws_kinesis_stream',
    deps: [
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'Grants producers/consumers access to the stream', required: true, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'kinesis-role', assume_role_service: 'lambda.amazonaws.com', tags_name: 'kinesis-role' } },
      { resourceType: 'aws_lambda_function', label: 'Lambda Consumer', icon: '⚡', reason: 'Process stream records with Lambda', required: false, sourcePortId: 'iam-in', targetPortId: 'lambda-out', portColor: 'bg-yellow-400', defaultConfig: { function_name: 'stream-processor', runtime: 'nodejs18.x', handler: 'index.handler', role: 'aws_iam_role.lambda.arn', tags_name: 'stream-processor' } },
      { resourceType: 'aws_kinesis_firehose_delivery_stream', label: 'Firehose', icon: '🔥', reason: 'Deliver stream data to S3/Redshift', required: false, sourcePortId: 'kinesis-in', targetPortId: 'fh-out', portColor: 'bg-blue-400', defaultConfig: { name: 'my-firehose', destination: 's3', tags_name: 'my-firehose' } },
    ],
  },

  // ── API Gateway REST ─────────────────────────────────────────────────────
  {
    resourceType: 'aws_api_gateway_rest_api',
    deps: [
      { resourceType: 'aws_lambda_function', label: 'Lambda Backend', icon: '⚡', reason: 'Lambda handles the API requests', required: true, sourcePortId: 'iam-in', targetPortId: 'lambda-in', portColor: 'bg-yellow-400', defaultConfig: { function_name: 'api-handler', runtime: 'nodejs18.x', handler: 'index.handler', role: 'aws_iam_role.api_role.arn', tags_name: 'api-handler' } },
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'Grants API Gateway permission to invoke Lambda', required: true, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'api-gw-role', assume_role_service: 'apigateway.amazonaws.com', tags_name: 'api-gw-role' } },
      { resourceType: 'aws_cognito_user_pool', label: 'Cognito Auth', icon: '🔐', reason: 'Authenticate API requests with Cognito', required: false, sourcePortId: 'api-out', targetPortId: 'lambda-in', portColor: 'bg-indigo-400', defaultConfig: { name: 'api-user-pool', tags_name: 'api-cognito' } },
      { resourceType: 'aws_wafv2_web_acl', label: 'WAF', icon: '🧱', reason: 'Protect the API from common web exploits', required: false, sourcePortId: 'api-out', targetPortId: 'waf-in', portColor: 'bg-red-400', defaultConfig: { name: 'api-waf', scope: 'REGIONAL', default_action: 'allow', tags_name: 'api-waf' } },
    ],
  },

  // ── CloudFront ───────────────────────────────────────────────────────────
  {
    resourceType: 'aws_cloudfront_distribution',
    deps: [
      { resourceType: 'aws_s3_bucket', label: 'S3 Origin', icon: '🪣', reason: 'S3 bucket serves as the content origin', required: false, sourcePortId: 'data-out', targetPortId: 's3-in', portColor: 'bg-green-400', defaultConfig: { bucket: 'my-cdn-bucket', tags_name: 'cdn-bucket' } },
      { resourceType: 'aws_acm_certificate', label: 'SSL Certificate', icon: '📜', reason: 'HTTPS requires an ACM certificate in us-east-1', required: false, sourcePortId: 'cf-out', targetPortId: 'cf-in', portColor: 'bg-green-400', defaultConfig: { domain_name: 'example.com', validation_method: 'DNS', tags_name: 'cdn-cert' } },
      { resourceType: 'aws_wafv2_web_acl', label: 'WAF', icon: '🧱', reason: 'Protect CloudFront from web attacks', required: false, sourcePortId: 'cf-out', targetPortId: 'waf-in', portColor: 'bg-red-400', defaultConfig: { name: 'cf-waf', scope: 'CLOUDFRONT', default_action: 'allow', tags_name: 'cf-waf' } },
    ],
  },

  // ── CodePipeline ─────────────────────────────────────────────────────────
  {
    resourceType: 'aws_codepipeline',
    deps: [
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'Pipeline needs permissions to access source, build, and deploy', required: true, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'pipeline-role', assume_role_service: 'codepipeline.amazonaws.com', tags_name: 'pipeline-role' } },
      { resourceType: 'aws_s3_bucket', label: 'Artifact Bucket', icon: '🪣', reason: 'S3 bucket stores pipeline artifacts between stages', required: true, sourcePortId: 'data-out', targetPortId: 's3-in', portColor: 'bg-green-400', defaultConfig: { bucket: 'my-pipeline-artifacts', tags_name: 'pipeline-artifacts' } },
      { resourceType: 'aws_codecommit_repository', label: 'Source Repo', icon: '📦', reason: 'CodeCommit repository as the pipeline source', required: false, sourcePortId: 'pipe-out', targetPortId: 'source-in', portColor: 'bg-orange-400', defaultConfig: { repository_name: 'my-app', tags_name: 'my-repo' } },
      { resourceType: 'aws_codebuild_project', label: 'Build Project', icon: '🔨', reason: 'CodeBuild project for the build stage', required: false, sourcePortId: 'pipe-out', targetPortId: 'build-in', portColor: 'bg-blue-400', defaultConfig: { name: 'my-build', tags_name: 'my-build' } },
    ],
  },

  // ── SageMaker Endpoint ───────────────────────────────────────────────────
  {
    resourceType: 'aws_sagemaker_endpoint',
    deps: [
      { resourceType: 'aws_sagemaker_model', label: 'SageMaker Model', icon: '🤖', reason: 'Endpoint needs a model to serve', required: true, sourcePortId: 'ep-out', targetPortId: 'model-in', portColor: 'bg-green-400', defaultConfig: { name: 'my-model', tags_name: 'my-sm-model' } },
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'SageMaker needs permissions to access model artifacts', required: true, sourcePortId: 'lambda-out', targetPortId: 'model-in', portColor: 'bg-pink-400', defaultConfig: { name: 'sagemaker-role', assume_role_service: 'sagemaker.amazonaws.com', tags_name: 'sm-role' } },
    ],
  },

  // ── Glue Job ─────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_glue_job',
    deps: [
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'Glue needs permissions to access S3 and other services', required: true, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'glue-role', assume_role_service: 'glue.amazonaws.com', tags_name: 'glue-role' } },
      { resourceType: 'aws_s3_bucket', label: 'Script Bucket', icon: '🪣', reason: 'S3 bucket stores the Glue ETL script', required: true, sourcePortId: 'data-out', targetPortId: 's3-in', portColor: 'bg-green-400', defaultConfig: { bucket: 'my-glue-scripts', tags_name: 'glue-scripts' } },
    ],
  },

  // ── EMR Cluster ──────────────────────────────────────────────────────────
  {
    resourceType: 'aws_emr_cluster',
    deps: [
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'EMR needs a service role and instance profile', required: true, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'emr-role', assume_role_service: 'elasticmapreduce.amazonaws.com', tags_name: 'emr-role' } },
      { resourceType: 'aws_subnet', label: 'Subnet', icon: '🔗', reason: 'EMR cluster runs in a VPC subnet', required: true, sourcePortId: 'ec2-out', targetPortId: 'subnet-in', portColor: 'bg-cyan-400', defaultConfig: { cidr_block: '10.0.1.0/24', tags_name: 'emr-subnet' } },
      { resourceType: 'aws_security_group', label: 'Security Group', icon: '🛡️', reason: 'Controls traffic to EMR master and core nodes', required: true, sourcePortId: 'ec2-out', targetPortId: 'sg-in', portColor: 'bg-red-400', defaultConfig: { name: 'emr-sg', description: 'EMR security group', tags_name: 'emr-sg' } },
      { resourceType: 'aws_s3_bucket', label: 'Log Bucket', icon: '🪣', reason: 'Store EMR logs and output data', required: false, sourcePortId: 'data-out', targetPortId: 's3-out', portColor: 'bg-green-400', defaultConfig: { bucket: 'my-emr-logs', tags_name: 'emr-logs' } },
    ],
  },

  // ── KMS Key ──────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_kms_key',
    deps: [
      { resourceType: 'aws_iam_role', label: 'Key Admin Role', icon: '👤', reason: 'IAM role to administer the KMS key', required: false, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'kms-admin-role', assume_role_service: 'lambda.amazonaws.com', tags_name: 'kms-admin' } },
    ],
  },

  // ── Cognito User Pool ────────────────────────────────────────────────────
  {
    resourceType: 'aws_cognito_user_pool',
    deps: [
      { resourceType: 'aws_lambda_function', label: 'Lambda Trigger', icon: '⚡', reason: 'Lambda for pre-signup, post-confirmation, etc.', required: false, sourcePortId: 'iam-in', targetPortId: 'lambda-in', portColor: 'bg-yellow-400', defaultConfig: { function_name: 'cognito-trigger', runtime: 'nodejs18.x', handler: 'index.handler', role: 'aws_iam_role.lambda.arn', tags_name: 'cognito-trigger' } },
    ],
  },

  // ── Redshift ─────────────────────────────────────────────────────────────
  {
    resourceType: 'aws_redshift_cluster',
    deps: [
      { resourceType: 'aws_vpc', label: 'VPC', icon: '🌐', reason: 'Redshift cluster must be in a VPC', required: true, sourcePortId: 'subnet-out', targetPortId: 'subnet-in', portColor: 'bg-blue-400', defaultConfig: { cidr_block: '10.4.0.0/16', tags_name: 'redshift-vpc' } },
      { resourceType: 'aws_subnet', label: 'Subnet', icon: '🔗', reason: 'Redshift needs a subnet group', required: true, sourcePortId: 'rds-out', targetPortId: 'subnet-in', portColor: 'bg-cyan-400', defaultConfig: { cidr_block: '10.4.1.0/24', tags_name: 'redshift-subnet' } },
      { resourceType: 'aws_security_group', label: 'Security Group', icon: '🛡️', reason: 'Controls access to Redshift port 5439', required: true, sourcePortId: 'rds-out', targetPortId: 'sg-in', portColor: 'bg-red-400', defaultConfig: { name: 'redshift-sg', description: 'Redshift security group', ingress_from_port: 5439, ingress_to_port: 5439, tags_name: 'redshift-sg' } },
      { resourceType: 'aws_iam_role', label: 'IAM Role', icon: '👤', reason: 'Grants Redshift access to S3 for COPY/UNLOAD', required: false, sourcePortId: 'lambda-out', targetPortId: 'iam-in', portColor: 'bg-pink-400', defaultConfig: { name: 'redshift-role', assume_role_service: 'redshift.amazonaws.com', tags_name: 'redshift-role' } },
    ],
  },

];
