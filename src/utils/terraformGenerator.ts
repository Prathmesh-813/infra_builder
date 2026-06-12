import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import { estimateCosts } from './costEstimator';

type Cfg = Record<string, string | number | boolean>;

// ── helpers ──────────────────────────────────────────────────────────────────
function s(v: unknown): string { return String(v ?? ''); }
function n(v: unknown, fallback = 0): number { return Number(v ?? fallback); }
function b(v: unknown, fallback = false): boolean { return v !== undefined ? Boolean(v) : fallback; }
function str(key: string, cfg: Cfg, fallback = ''): string {
  const v = cfg[key]; return v !== undefined && v !== '' ? String(v) : fallback;
}
function tags(cfg: Cfg, extra: Record<string,string> = {}): string[] {
  const lines: string[] = [];
  const all = { ...(cfg.tags_name ? { Name: String(cfg.tags_name) } : {}), ...extra };
  if (Object.keys(all).length === 0) return [];
  lines.push('  tags = {');
  for (const [k, v] of Object.entries(all)) lines.push(`    ${k} = "${v}"`);
  lines.push('  }');
  return lines;
}
function csvArr(val: unknown): string {
  const items = String(val || '').split(',').map(s => s.trim()).filter(Boolean);
  return items.length ? `[${items.join(', ')}]` : '[]';
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTE
// ═══════════════════════════════════════════════════════════════════════════

function genEC2(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_instance" "${name}" {`];
  L.push(`  ami           = "${str('ami', c, 'ami-0c55b159cbfafe1f0')}"`);
  L.push(`  instance_type = "${str('instance_type', c, 't2.micro')}"`);
  if (c.key_name)                       L.push(`  key_name      = "${c.key_name}"`);
  if (c.subnet_id)                      L.push(`  subnet_id     = ${c.subnet_id}`);
  if (c.vpc_security_group_ids)         L.push(`  vpc_security_group_ids = [${c.vpc_security_group_ids}]`);
  if (c.associate_public_ip_address !== undefined) L.push(`  associate_public_ip_address = ${c.associate_public_ip_address}`);
  if (c.root_volume_size) { L.push(''); L.push('  root_block_device {'); L.push(`    volume_size = ${c.root_volume_size}`); L.push('  }'); }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genASG(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_autoscaling_group" "${name}" {`];
  L.push(`  name               = "${str('name', c, name)}"`);
  L.push(`  min_size           = ${n(c.min_size, 1)}`);
  L.push(`  max_size           = ${n(c.max_size, 3)}`);
  L.push(`  desired_capacity   = ${n(c.desired_capacity, 2)}`);
  if (c.vpc_zone_identifier) L.push(`  vpc_zone_identifier = ${csvArr(c.vpc_zone_identifier)}`);
  if (c.health_check_type)   L.push(`  health_check_type   = "${c.health_check_type}"`);
  if (c.health_check_grace_period) L.push(`  health_check_grace_period = ${c.health_check_grace_period}`);
  if (c.target_group_arns)   L.push(`  target_group_arns   = [${c.target_group_arns}]`);
  if (c.default_cooldown)    L.push(`  default_cooldown    = ${c.default_cooldown}`);
  if (c.protect_from_scale_in !== undefined) L.push(`  protect_from_scale_in = ${c.protect_from_scale_in}`);
  if (c.launch_template_id) {
    L.push(''); L.push('  launch_template {');
    L.push(`    id      = ${c.launch_template_id}`);
    L.push(`    version = "${str('launch_template_version', c, '$Latest')}"`);
    L.push('  }');
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genLaunchTemplate(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_launch_template" "${name}" {`];
  L.push(`  name          = "${str('name', c, name)}"`);
  L.push(`  image_id      = "${str('image_id', c, 'ami-0c55b159cbfafe1f0')}"`);
  L.push(`  instance_type = "${str('instance_type', c, 't3.micro')}"`);
  if (c.key_name)                L.push(`  key_name      = "${c.key_name}"`);
  if (c.vpc_security_group_ids)  L.push(`  vpc_security_group_ids = [${c.vpc_security_group_ids}]`);
  if (c.ebs_optimized !== undefined) L.push(`  ebs_optimized = ${c.ebs_optimized}`);
  if (c.monitoring_enabled !== undefined) { L.push(''); L.push('  monitoring {'); L.push(`    enabled = ${c.monitoring_enabled}`); L.push('  }'); }
  if (c.volume_size) {
    L.push(''); L.push('  block_device_mappings {'); L.push('    device_name = "/dev/xvda"');
    L.push('    ebs {');
    L.push(`      volume_size           = ${c.volume_size}`);
    L.push(`      volume_type           = "${str('volume_type', c, 'gp3')}"`);
    if (c.volume_encrypted !== undefined) L.push(`      encrypted             = ${c.volume_encrypted}`);
    L.push('    }'); L.push('  }');
  }
  if (c.iam_instance_profile) { L.push(''); L.push('  iam_instance_profile {'); L.push(`    name = "${c.iam_instance_profile}"`); L.push('  }'); }
  if (c.user_data) L.push(`  user_data = "${c.user_data}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genEKSCluster(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_eks_cluster" "${name}" {`];
  L.push(`  name     = "${str('name', c, name)}"`);
  L.push(`  role_arn = ${c.role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push(`  version  = "${str('version', c, '1.29')}"`);
  L.push(''); L.push('  vpc_config {');
  if (c.subnet_ids)          L.push(`    subnet_ids              = ${csvArr(c.subnet_ids)}`);
  if (c.security_group_ids)  L.push(`    security_group_ids      = ${csvArr(c.security_group_ids)}`);
  if (c.endpoint_public_access !== undefined)  L.push(`    endpoint_public_access  = ${c.endpoint_public_access}`);
  if (c.endpoint_private_access !== undefined) L.push(`    endpoint_private_access = ${c.endpoint_private_access}`);
  if (c.public_access_cidrs) L.push(`    public_access_cidrs     = ${csvArr(c.public_access_cidrs)}`);
  L.push('  }');
  if (c.enabled_cluster_log_types) {
    L.push(''); L.push('  enabled_cluster_log_types = ' + csvArr(c.enabled_cluster_log_types));
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genEKSNodeGroup(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_eks_node_group" "${name}" {`];
  L.push(`  cluster_name    = ${c.cluster_name || '"REPLACE_WITH_CLUSTER_NAME"'}`);
  L.push(`  node_group_name = "${str('node_group_name', c, name)}"`);
  L.push(`  node_role_arn   = ${c.node_role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  if (c.subnet_ids) L.push(`  subnet_ids      = ${csvArr(c.subnet_ids)}`);
  L.push(''); L.push('  scaling_config {');
  L.push(`    desired_size = ${n(c.desired_size, 2)}`);
  L.push(`    min_size     = ${n(c.min_size, 1)}`);
  L.push(`    max_size     = ${n(c.max_size, 4)}`);
  L.push('  }');
  L.push(''); L.push('  update_config {');
  L.push(`    max_unavailable = ${n(c.max_unavailable, 1)}`);
  L.push('  }');
  if (c.instance_types) L.push(`  instance_types = ${csvArr(c.instance_types)}`);
  if (c.ami_type)        L.push(`  ami_type       = "${c.ami_type}"`);
  if (c.capacity_type)   L.push(`  capacity_type  = "${c.capacity_type}"`);
  if (c.disk_size)       L.push(`  disk_size      = ${c.disk_size}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genECSCluster(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_ecs_cluster" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  L.push(''); L.push('  setting {');
  L.push('    name  = "containerInsights"');
  L.push(`    value = "${b(c.container_insights, true) ? 'enabled' : 'disabled'}"`);
  L.push('  }');
  if (c.execute_command_logging && c.execute_command_logging !== 'DEFAULT') {
    L.push(''); L.push('  configuration {'); L.push('    execute_command_configuration {');
    if (c.execute_command_kms_key_id) L.push(`      kms_key_id = ${c.execute_command_kms_key_id}`);
    L.push(`      logging    = "${c.execute_command_logging}"`);
    L.push('    }'); L.push('  }');
  }
  L.push(...tags(c)); L.push('}');
  // Capacity provider association
  if (c.capacity_provider && c.capacity_provider !== 'EC2') {
    L.push(''); L.push(`resource "aws_ecs_cluster_capacity_providers" "${name}_cp" {`);
    L.push(`  cluster_name       = aws_ecs_cluster.${name}.name`);
    L.push(`  capacity_providers = ["${c.capacity_provider}"${c.capacity_provider === 'FARGATE' ? ', "FARGATE_SPOT"' : ''}]`);
    L.push(''); L.push('  default_capacity_provider_strategy {');
    L.push(`    base              = ${n(c.fargate_base, 1)}`);
    L.push(`    weight            = ${n(c.fargate_weight, 100)}`);
    L.push(`    capacity_provider = "${c.capacity_provider}"`);
    L.push('  }'); L.push('}');
  }
  return L.join('\n');
}

function genECSTaskDef(name: string, c: Cfg): string {
  const containerDef = JSON.stringify([{
    name: str('container_name', c, 'app'),
    image: str('container_image', c, 'nginx:latest'),
    essential: b(c.container_essential, true),
    portMappings: [{ containerPort: n(c.container_port, 80), hostPort: n(c.host_port, 80), protocol: 'tcp' }],
    cpu: n(c.container_cpu, 256),
    memory: n(c.container_memory, 512),
    logConfiguration: c.log_group ? {
      logDriver: 'awslogs',
      options: { 'awslogs-group': str('log_group', c), 'awslogs-region': str('log_region', c, 'us-east-1'), 'awslogs-stream-prefix': 'ecs' }
    } : undefined,
    environment: c.env_var_key ? [{ name: str('env_var_key', c), value: str('env_var_value', c) }] : undefined,
  }], null, 2);
  const L: string[] = [`resource "aws_ecs_task_definition" "${name}" {`];
  L.push(`  family                   = "${str('family', c, name)}"`);
  L.push(`  network_mode             = "${str('network_mode', c, 'awsvpc')}"`);
  L.push(`  requires_compatibilities = ["${str('requires_compatibilities', c, 'FARGATE')}"]`);
  L.push(`  cpu                      = "${str('cpu', c, '256')}"`);
  L.push(`  memory                   = "${str('memory', c, '512')}"`);
  if (c.execution_role_arn) L.push(`  execution_role_arn       = ${c.execution_role_arn}`);
  if (c.task_role_arn)      L.push(`  task_role_arn            = ${c.task_role_arn}`);
  L.push(''); L.push(`  container_definitions = jsonencode(${containerDef})`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genECSService(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_ecs_service" "${name}" {`];
  L.push(`  name            = "${str('name', c, name)}"`);
  L.push(`  cluster         = ${c.cluster || '"REPLACE_WITH_CLUSTER_ARN"'}`);
  L.push(`  task_definition = ${c.task_definition || '"REPLACE_WITH_TASK_DEF_ARN"'}`);
  L.push(`  desired_count   = ${n(c.desired_count, 2)}`);
  L.push(`  launch_type     = "${str('launch_type', c, 'FARGATE')}"`);
  if (c.scheduling_strategy) L.push(`  scheduling_strategy = "${c.scheduling_strategy}"`);
  if (c.health_check_grace_period_seconds) L.push(`  health_check_grace_period_seconds = ${c.health_check_grace_period_seconds}`);
  if (c.deployment_minimum_healthy_percent !== undefined) L.push(`  deployment_minimum_healthy_percent = ${c.deployment_minimum_healthy_percent}`);
  if (c.deployment_maximum_percent !== undefined) L.push(`  deployment_maximum_percent = ${c.deployment_maximum_percent}`);
  if (c.enable_execute_command !== undefined) L.push(`  enable_execute_command = ${c.enable_execute_command}`);
  if (c.force_new_deployment !== undefined) L.push(`  force_new_deployment = ${c.force_new_deployment}`);
  if (c.subnets || c.security_groups) {
    L.push(''); L.push('  network_configuration {');
    if (c.subnets)          L.push(`    subnets          = ${csvArr(c.subnets)}`);
    if (c.security_groups)  L.push(`    security_groups  = ${csvArr(c.security_groups)}`);
    if (c.assign_public_ip !== undefined) L.push(`    assign_public_ip = ${c.assign_public_ip}`);
    L.push('  }');
  }
  if (c.lb_target_group_arn) {
    L.push(''); L.push('  load_balancer {');
    L.push(`    target_group_arn = ${c.lb_target_group_arn}`);
    L.push(`    container_name   = "${str('lb_container_name', c, 'app')}"`);
    L.push(`    container_port   = ${n(c.lb_container_port, 80)}`);
    L.push('  }');
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genBeanstalk(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_elastic_beanstalk_environment" "${name}" {`];
  L.push(`  name                = "${str('name', c, name)}"`);
  L.push(`  application         = "${str('application_name', c, 'my-app')}"`);
  L.push(`  solution_stack_name = "${str('solution_stack_name', c)}"`);
  L.push(`  tier                = "${str('tier', c, 'WebServer')}"`);
  if (c.instance_type) { L.push(''); L.push('  setting { namespace = "aws:autoscaling:launchconfiguration" name = "InstanceType" value = "' + c.instance_type + '" }'); }
  if (c.min_instances)  L.push('  setting { namespace = "aws:autoscaling:asg" name = "MinSize" value = "' + c.min_instances + '" }');
  if (c.max_instances)  L.push('  setting { namespace = "aws:autoscaling:asg" name = "MaxSize" value = "' + c.max_instances + '" }');
  if (c.deployment_policy) L.push('  setting { namespace = "aws:elasticbeanstalk:command" name = "DeploymentPolicy" value = "' + c.deployment_policy + '" }');
  if (c.load_balancer_type) L.push('  setting { namespace = "aws:elasticbeanstalk:environment" name = "LoadBalancerType" value = "' + c.load_balancer_type + '" }');
  if (c.vpc_id)    L.push('  setting { namespace = "aws:ec2:vpc" name = "VPCId" value = "' + c.vpc_id + '" }');
  if (c.subnets)   L.push('  setting { namespace = "aws:ec2:vpc" name = "Subnets" value = "' + c.subnets + '" }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════

function genS3(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_s3_bucket" "${name}" {`];
  L.push(`  bucket        = "${str('bucket', c, name)}"`);
  if (c.force_destroy !== undefined) L.push(`  force_destroy = ${c.force_destroy}`);
  if (c.object_lock_enabled !== undefined) L.push(`  object_lock_enabled = ${c.object_lock_enabled}`);
  L.push(...tags(c)); L.push('}');
  if (c.acl) { L.push(''); L.push(`resource "aws_s3_bucket_acl" "${name}_acl" {`); L.push(`  bucket = aws_s3_bucket.${name}.id`); L.push(`  acl    = "${c.acl}"`); L.push('}'); }
  if (c.versioning_enabled) { L.push(''); L.push(`resource "aws_s3_bucket_versioning" "${name}_versioning" {`); L.push(`  bucket = aws_s3_bucket.${name}.id`); L.push('  versioning_configuration { status = "Enabled" }'); L.push('}'); }
  if (c.server_side_encryption) {
    L.push(''); L.push(`resource "aws_s3_bucket_server_side_encryption_configuration" "${name}_sse" {`);
    L.push(`  bucket = aws_s3_bucket.${name}.id`);
    L.push('  rule { apply_server_side_encryption_by_default {');
    L.push(`    sse_algorithm = "${c.server_side_encryption}"`);
    if (c.kms_master_key_id && c.server_side_encryption === 'aws:kms') L.push(`    kms_master_key_id = ${c.kms_master_key_id}`);
    L.push('  } }'); L.push('}');
  }
  if (c.block_public_acls !== undefined || c.block_public_policy !== undefined) {
    L.push(''); L.push(`resource "aws_s3_bucket_public_access_block" "${name}_pab" {`);
    L.push(`  bucket                  = aws_s3_bucket.${name}.id`);
    L.push(`  block_public_acls       = ${b(c.block_public_acls, true)}`);
    L.push(`  block_public_policy     = ${b(c.block_public_policy, true)}`);
    L.push(`  ignore_public_acls      = ${b(c.ignore_public_acls, true)}`);
    L.push(`  restrict_public_buckets = ${b(c.restrict_public_buckets, true)}`);
    L.push('}');
  }
  if (c.lifecycle_rule_enabled) {
    L.push(''); L.push(`resource "aws_s3_bucket_lifecycle_configuration" "${name}_lifecycle" {`);
    L.push(`  bucket = aws_s3_bucket.${name}.id`);
    L.push('  rule { id = "expire-old-objects" status = "Enabled"');
    L.push(`    expiration { days = ${n(c.lifecycle_expiration_days, 90)} }`);
    L.push('  }'); L.push('}');
  }
  return L.join('\n');
}

function genEBS(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_ebs_volume" "${name}" {`];
  L.push(`  availability_zone = "${str('availability_zone', c, 'us-east-1a')}"`);
  L.push(`  size              = ${n(c.size, 100)}`);
  L.push(`  type              = "${str('type', c, 'gp3')}"`);
  if (c.iops)       L.push(`  iops              = ${c.iops}`);
  if (c.throughput) L.push(`  throughput        = ${c.throughput}`);
  L.push(`  encrypted         = ${b(c.encrypted, true)}`);
  if (c.kms_key_id) L.push(`  kms_key_id        = ${c.kms_key_id}`);
  if (c.snapshot_id) L.push(`  snapshot_id       = "${c.snapshot_id}"`);
  if (c.multi_attach_enabled !== undefined) L.push(`  multi_attach_enabled = ${c.multi_attach_enabled}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genEFS(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_efs_file_system" "${name}" {`];
  if (c.creation_token)    L.push(`  creation_token   = "${c.creation_token}"`);
  L.push(`  performance_mode = "${str('performance_mode', c, 'generalPurpose')}"`);
  L.push(`  throughput_mode  = "${str('throughput_mode', c, 'bursting')}"`);
  if (c.throughput_mode === 'provisioned' && c.provisioned_throughput_in_mibps) L.push(`  provisioned_throughput_in_mibps = ${c.provisioned_throughput_in_mibps}`);
  L.push(`  encrypted        = ${b(c.encrypted, true)}`);
  if (c.kms_key_id) L.push(`  kms_key_id       = ${c.kms_key_id}`);
  if (c.lifecycle_policy && c.lifecycle_policy !== 'NONE') { L.push('  lifecycle_policy { transition_to_ia = "' + c.lifecycle_policy + '" }'); }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genFSxLustre(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_fsx_lustre_file_system" "${name}" {`];
  L.push(`  storage_capacity              = ${n(c.storage_capacity, 1200)}`);
  L.push(`  deployment_type               = "${str('deployment_type', c, 'SCRATCH_2')}"`);
  if (c.per_unit_storage_throughput) L.push(`  per_unit_storage_throughput   = ${c.per_unit_storage_throughput}`);
  if (c.subnet_id) L.push(`  subnet_ids                    = [${c.subnet_id}]`);
  if (c.security_group_ids) L.push(`  security_group_ids            = ${csvArr(c.security_group_ids)}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genGlacier(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_glacier_vault" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  if (c.notification_sns_topic) {
    L.push('  notification {');
    L.push(`    sns_topic = ${c.notification_sns_topic}`);
    L.push(`    events    = ${csvArr(c.notification_events || 'ArchiveRetrievalCompleted')}`);
    L.push('  }');
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════════

function genVPC(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_vpc" "${name}" {`];
  L.push(`  cidr_block           = "${str('cidr_block', c, '10.0.0.0/16')}"`);
  if (c.enable_dns_support !== undefined)   L.push(`  enable_dns_support   = ${c.enable_dns_support}`);
  if (c.enable_dns_hostnames !== undefined) L.push(`  enable_dns_hostnames = ${c.enable_dns_hostnames}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genSubnet(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_subnet" "${name}" {`];
  L.push(`  vpc_id            = ${c.vpc_id || '"REPLACE_WITH_VPC_ID"'}`);
  L.push(`  cidr_block        = "${str('cidr_block', c, '10.0.1.0/24')}"`);
  if (c.availability_zone) L.push(`  availability_zone = "${c.availability_zone}"`);
  if (c.map_public_ip_on_launch !== undefined) L.push(`  map_public_ip_on_launch = ${c.map_public_ip_on_launch}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genSG(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_security_group" "${name}" {`];
  L.push(`  name        = "${str('name', c, name)}"`);
  L.push(`  description = "${str('description', c, 'Managed by Terraform')}"`);
  if (c.vpc_id) L.push(`  vpc_id      = ${c.vpc_id}`);
  L.push(''); L.push('  ingress {');
  L.push(`    from_port   = ${n(c.ingress_from_port, 80)}`);
  L.push(`    to_port     = ${n(c.ingress_to_port, 80)}`);
  L.push(`    protocol    = "${str('ingress_protocol', c, 'tcp')}"`);
  L.push(`    cidr_blocks = ["${str('ingress_cidr', c, '0.0.0.0/0')}"]`);
  L.push('  }'); L.push(''); L.push('  egress {');
  L.push('    from_port   = 0'); L.push('    to_port     = 0'); L.push('    protocol    = "-1"'); L.push('    cidr_blocks = ["0.0.0.0/0"]');
  L.push('  }'); L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genIGW(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_internet_gateway" "${name}" {`];
  L.push(`  vpc_id = ${c.vpc_id || '"REPLACE_WITH_VPC_ID"'}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genLB(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_lb" "${name}" {`];
  L.push(`  name               = "${str('name', c, name)}"`);
  L.push(`  load_balancer_type = "${str('load_balancer_type', c, 'application')}"`);
  L.push(`  internal           = ${b(c.internal, false)}`);
  if (c.subnets)          L.push(`  subnets            = ${csvArr(c.subnets)}`);
  if (c.security_groups)  L.push(`  security_groups    = ${csvArr(c.security_groups)}`);
  if (c.idle_timeout)     L.push(`  idle_timeout       = ${c.idle_timeout}`);
  if (c.enable_deletion_protection !== undefined) L.push(`  enable_deletion_protection = ${c.enable_deletion_protection}`);
  if (c.enable_http2 !== undefined) L.push(`  enable_http2 = ${c.enable_http2}`);
  if (c.enable_cross_zone_load_balancing !== undefined) L.push(`  enable_cross_zone_load_balancing = ${c.enable_cross_zone_load_balancing}`);
  if (c.access_logs_enabled) { L.push('  access_logs { bucket = "' + (c.access_logs_bucket || 'my-logs') + '" enabled = true }'); }
  L.push(...tags(c)); L.push('}');
  // Target group
  if (c.target_group_port) {
    L.push(''); L.push(`resource "aws_lb_target_group" "${name}_tg" {`);
    L.push(`  name     = "${name}-tg"`);
    L.push(`  port     = ${c.target_group_port}`);
    L.push(`  protocol = "${str('target_group_protocol', c, 'HTTP')}"`);
    L.push(`  target_type = "${str('target_type', c, 'instance')}"`);
    if (c.health_check_path) { L.push('  health_check {'); L.push(`    path     = "${c.health_check_path}"`); if (c.health_check_interval) L.push(`    interval = ${c.health_check_interval}`); L.push('  }'); }
    L.push('}');
  }
  // Listener
  if (c.listener_port) {
    L.push(''); L.push(`resource "aws_lb_listener" "${name}_listener" {`);
    L.push(`  load_balancer_arn = aws_lb.${name}.arn`);
    L.push(`  port              = ${c.listener_port}`);
    L.push(`  protocol          = "${str('listener_protocol', c, 'HTTP')}"`);
    if (c.ssl_certificate_arn) L.push(`  certificate_arn   = ${c.ssl_certificate_arn}`);
    L.push('  default_action { type = "forward"' + (c.target_group_port ? ` target_group_arn = aws_lb_target_group.${name}_tg.arn` : '') + ' }');
    L.push('}');
  }
  return L.join('\n');
}

function genRouteTable(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_route_table" "${name}" {`];
  L.push(`  vpc_id = ${c.vpc_id || '"REPLACE_WITH_VPC_ID"'}`);
  if (c.route_cidr) {
    L.push(''); L.push('  route {');
    L.push(`    cidr_block = "${c.route_cidr}"`);
    if (c.gateway_id)     L.push(`    gateway_id = ${c.gateway_id}`);
    if (c.nat_gateway_id) L.push(`    nat_gateway_id = ${c.nat_gateway_id}`);
    if (c.transit_gateway_id) L.push(`    transit_gateway_id = "${c.transit_gateway_id}"`);
    L.push('  }');
  }
  L.push(...tags(c)); L.push('}');
  if (c.subnet_association_id) {
    L.push(''); L.push(`resource "aws_route_table_association" "${name}_assoc" {`);
    L.push(`  subnet_id      = ${c.subnet_association_id}`);
    L.push(`  route_table_id = aws_route_table.${name}.id`);
    L.push('}');
  }
  return L.join('\n');
}

function genNAT(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_nat_gateway" "${name}" {`];
  L.push(`  subnet_id     = ${c.subnet_id || '"REPLACE_WITH_SUBNET_ID"'}`);
  if (c.allocation_id) L.push(`  allocation_id = ${c.allocation_id}`);
  L.push(`  connectivity_type = "${str('connectivity_type', c, 'public')}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genEIP(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_eip" "${name}" {`];
  L.push(`  domain = "${str('domain', c, 'vpc')}"`);
  if (c.instance)                    L.push(`  instance                    = ${c.instance}`);
  if (c.network_interface)           L.push(`  network_interface           = ${c.network_interface}`);
  if (c.associate_with_private_ip)   L.push(`  associate_with_private_ip   = "${c.associate_with_private_ip}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genVPCPeering(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_vpc_peering_connection" "${name}" {`];
  L.push(`  vpc_id      = ${c.vpc_id || '"REPLACE_WITH_VPC_ID"'}`);
  L.push(`  peer_vpc_id = ${c.peer_vpc_id || '"REPLACE_WITH_PEER_VPC_ID"'}`);
  if (c.auto_accept !== undefined) L.push(`  auto_accept = ${c.auto_accept}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genCloudFront(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_cloudfront_distribution" "${name}" {`];
  if (c.comment) L.push(`  comment             = "${c.comment}"`);
  L.push(`  enabled             = ${b(c.enabled, true)}`);
  if (c.default_root_object) L.push(`  default_root_object = "${c.default_root_object}"`);
  L.push(`  price_class         = "${str('price_class', c, 'PriceClass_100')}"`);
  L.push(`  http_version        = "${str('http_version', c, 'http2')}"`);
  L.push(''); L.push('  origin {');
  L.push(`    domain_name = "REPLACE_WITH_ORIGIN_DOMAIN"`);
  L.push(`    origin_id   = "${name}-origin"`);
  L.push('  }');
  L.push(''); L.push('  default_cache_behavior {');
  L.push(`    target_origin_id       = "${name}-origin"`);
  L.push('    viewer_protocol_policy = "redirect-to-https"');
  L.push('    allowed_methods        = ["GET", "HEAD"]');
  L.push('    cached_methods         = ["GET", "HEAD"]');
  L.push('    forwarded_values { query_string = false; cookies { forward = "none" } }');
  L.push('  }');
  L.push(''); L.push('  restrictions { geo_restriction { restriction_type = "none" } }');
  L.push(''); L.push('  viewer_certificate { cloudfront_default_certificate = true }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genRoute53Zone(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_route53_zone" "${name}" {`];
  L.push(`  name    = "${str('name', c, 'example.com')}"`);
  if (c.private_zone !== undefined) L.push(`  # private_zone = ${c.private_zone}`);
  if (c.comment) L.push(`  comment = "${c.comment}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genRoute53Record(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_route53_record" "${name}" {`];
  L.push(`  zone_id = ${c.zone_id || '"REPLACE_WITH_ZONE_ID"'}`);
  L.push(`  name    = "${str('name', c, 'www')}"`);
  L.push(`  type    = "${str('type', c, 'A')}"`);
  if (c.ttl)     L.push(`  ttl     = ${c.ttl}`);
  if (c.records) L.push(`  records = ${csvArr(c.records)}`);
  L.push('}'); return L.join('\n');
}

function genAPIGatewayREST(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_api_gateway_rest_api" "${name}" {`];
  L.push(`  name        = "${str('name', c, name)}"`);
  if (c.description) L.push(`  description = "${c.description}"`);
  L.push('  endpoint_configuration {');
  L.push(`    types = ["${str('endpoint_type', c, 'REGIONAL')}"]`);
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genAPIGatewayV2(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_apigatewayv2_api" "${name}" {`];
  L.push(`  name          = "${str('name', c, name)}"`);
  L.push(`  protocol_type = "${str('protocol_type', c, 'HTTP')}"`);
  if (c.cors_allow_origins) {
    L.push('  cors_configuration {');
    L.push(`    allow_origins = ${csvArr(c.cors_allow_origins)}`);
    L.push('    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]');
    L.push('    allow_headers = ["Content-Type", "Authorization"]');
    L.push('  }');
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genVPNGateway(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_vpn_gateway" "${name}" {`];
  L.push(`  vpc_id          = ${c.vpc_id || '"REPLACE_WITH_VPC_ID"'}`);
  if (c.amazon_side_asn) L.push(`  amazon_side_asn = ${c.amazon_side_asn}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genDXConnection(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_dx_connection" "${name}" {`];
  L.push(`  name      = "${str('name', c, name)}"`);
  L.push(`  bandwidth = "${str('bandwidth', c, '1Gbps')}"`);
  L.push(`  location  = "${str('location', c, 'EqDC2')}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════

function genRDS(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_db_instance" "${name}" {`];
  L.push(`  identifier        = "${str('identifier', c, name)}"`);
  L.push(`  engine            = "${str('engine', c, 'mysql')}"`);
  L.push(`  engine_version    = "${str('engine_version', c, '8.0')}"`);
  L.push(`  instance_class    = "${str('instance_class', c, 'db.t3.micro')}"`);
  L.push(`  allocated_storage = ${n(c.allocated_storage, 20)}`);
  if (c.max_allocated_storage) L.push(`  max_allocated_storage = ${c.max_allocated_storage}`);
  L.push(`  storage_type      = "${str('storage_type', c, 'gp3')}"`);
  L.push(`  storage_encrypted = ${b(c.storage_encrypted, true)}`);
  if (c.kms_key_id) L.push(`  kms_key_id        = ${c.kms_key_id}`);
  if (c.db_name)    L.push(`  db_name           = "${c.db_name}"`);
  L.push(`  username          = "${str('username', c, 'admin')}"`);
  L.push(`  password          = "${str('password', c, 'changeme123!')}"`);
  if (c.port)       L.push(`  port              = ${c.port}`);
  if (c.db_subnet_group_name) L.push(`  db_subnet_group_name   = ${c.db_subnet_group_name}`);
  if (c.vpc_security_group_ids) L.push(`  vpc_security_group_ids = ${csvArr(c.vpc_security_group_ids)}`);
  L.push(`  multi_az               = ${b(c.multi_az, false)}`);
  L.push(`  publicly_accessible    = ${b(c.publicly_accessible, false)}`);
  if (c.backup_retention_period !== undefined) L.push(`  backup_retention_period = ${c.backup_retention_period}`);
  if (c.backup_window)      L.push(`  backup_window           = "${c.backup_window}"`);
  if (c.maintenance_window) L.push(`  maintenance_window      = "${c.maintenance_window}"`);
  L.push(`  deletion_protection    = ${b(c.deletion_protection, false)}`);
  L.push(`  skip_final_snapshot    = ${b(c.skip_final_snapshot, true)}`);
  if (!b(c.skip_final_snapshot, true) && c.final_snapshot_identifier) L.push(`  final_snapshot_identifier = "${c.final_snapshot_identifier}"`);
  if (c.performance_insights_enabled !== undefined) L.push(`  performance_insights_enabled = ${c.performance_insights_enabled}`);
  if (c.auto_minor_version_upgrade !== undefined) L.push(`  auto_minor_version_upgrade = ${c.auto_minor_version_upgrade}`);
  if (c.enabled_cloudwatch_logs_exports) L.push(`  enabled_cloudwatch_logs_exports = ${csvArr(c.enabled_cloudwatch_logs_exports)}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genAurora(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_rds_cluster" "${name}" {`];
  L.push(`  cluster_identifier      = "${str('cluster_identifier', c, name)}"`);
  L.push(`  engine                  = "${str('engine', c, 'aurora-mysql')}"`);
  L.push(`  engine_mode             = "${str('engine_mode', c, 'provisioned')}"`);
  L.push(`  engine_version          = "${str('engine_version', c, '8.0.mysql_aurora.3.04.0')}"`);
  L.push(`  master_username         = "${str('master_username', c, 'admin')}"`);
  L.push(`  master_password         = "${str('master_password', c, 'changeme123!')}"`);
  if (c.backup_retention_period) L.push(`  backup_retention_period = ${c.backup_retention_period}`);
  L.push(`  skip_final_snapshot     = ${b(c.skip_final_snapshot, true)}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genDynamoDB(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_dynamodb_table" "${name}" {`];
  L.push(`  name         = "${str('name', c, name)}"`);
  L.push(`  billing_mode = "${str('billing_mode', c, 'PAY_PER_REQUEST')}"`);
  if (str('billing_mode', c) === 'PROVISIONED') {
    L.push(`  read_capacity  = ${n(c.read_capacity, 5)}`);
    L.push(`  write_capacity = ${n(c.write_capacity, 5)}`);
  }
  L.push(`  hash_key     = "${str('hash_key', c, 'id')}"`);
  if (c.range_key) L.push(`  range_key    = "${c.range_key}"`);
  L.push(''); L.push('  attribute {');
  L.push(`    name = "${str('hash_key', c, 'id')}"`);
  L.push(`    type = "${str('hash_key_type', c, 'S')}"`);
  L.push('  }');
  if (c.range_key) { L.push('  attribute {'); L.push(`    name = "${c.range_key}"`); L.push(`    type = "${str('range_key_type', c, 'N')}"`); L.push('  }'); }
  if (c.ttl_enabled) { L.push('  ttl { enabled = true attribute_name = "' + str('ttl_attribute_name', c, 'expiration') + '" }'); }
  if (c.stream_enabled) { L.push('  stream_enabled   = true'); L.push(`  stream_view_type = "${str('stream_view_type', c, 'NEW_AND_OLD_IMAGES')}"`); }
  if (c.server_side_encryption_enabled) { L.push('  server_side_encryption { enabled = true' + (c.kms_key_arn ? ' kms_key_arn = ' + c.kms_key_arn : '') + ' }'); }
  if (c.point_in_time_recovery) { L.push('  point_in_time_recovery { enabled = true }'); }
  if (c.table_class) L.push(`  table_class = "${c.table_class}"`);
  if (c.deletion_protection_enabled !== undefined) L.push(`  deletion_protection_enabled = ${c.deletion_protection_enabled}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genElastiCache(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_elasticache_cluster" "${name}" {`];
  L.push(`  cluster_id           = "${str('cluster_id', c, name)}"`);
  L.push(`  engine               = "${str('engine', c, 'redis')}"`);
  L.push(`  engine_version       = "${str('engine_version', c, '7.0')}"`);
  L.push(`  node_type            = "${str('node_type', c, 'cache.t3.micro')}"`);
  L.push(`  num_cache_nodes      = ${n(c.num_cache_nodes, 1)}`);
  L.push(`  port                 = ${n(c.port, 6379)}`);
  if (c.subnet_group_name)    L.push(`  subnet_group_name    = ${c.subnet_group_name}`);
  if (c.security_group_ids)   L.push(`  security_group_ids   = ${csvArr(c.security_group_ids)}`);
  if (c.parameter_group_name) L.push(`  parameter_group_name = "${c.parameter_group_name}"`);
  if (c.snapshot_retention_limit !== undefined) L.push(`  snapshot_retention_limit = ${c.snapshot_retention_limit}`);
  if (c.snapshot_window)      L.push(`  snapshot_window      = "${c.snapshot_window}"`);
  if (c.maintenance_window)   L.push(`  maintenance_window   = "${c.maintenance_window}"`);
  if (c.apply_immediately !== undefined) L.push(`  apply_immediately    = ${c.apply_immediately}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genElastiCacheHA(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_elasticache_replication_group" "${name}" {`];
  L.push(`  replication_group_id          = "${str('replication_group_id', c, name)}"`);
  L.push(`  description                   = "${str('description', c, 'Redis HA')}"`);
  L.push(`  node_type                     = "${str('node_type', c, 'cache.r6g.large')}"`);
  L.push(`  num_cache_clusters            = ${n(c.num_cache_clusters, 2)}`);
  L.push(`  automatic_failover_enabled    = ${b(c.automatic_failover_enabled, true)}`);
  L.push(`  multi_az_enabled              = ${b(c.multi_az_enabled, true)}`);
  L.push(`  at_rest_encryption_enabled    = ${b(c.at_rest_encryption_enabled, true)}`);
  L.push(`  transit_encryption_enabled    = ${b(c.transit_encryption_enabled, true)}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genRedshift(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_redshift_cluster" "${name}" {`];
  L.push(`  cluster_identifier = "${str('cluster_identifier', c, name)}"`);
  L.push(`  node_type          = "${str('node_type', c, 'dc2.large')}"`);
  L.push(`  cluster_type       = "${str('cluster_type', c, 'single-node')}"`);
  if (str('cluster_type', c) === 'multi-node') L.push(`  number_of_nodes    = ${n(c.number_of_nodes, 2)}`);
  L.push(`  database_name      = "${str('database_name', c, 'mydb')}"`);
  L.push(`  master_username    = "${str('master_username', c, 'admin')}"`);
  L.push(`  master_password    = "${str('master_password', c, 'Changeme1!')}"`);
  L.push(`  skip_final_snapshot = ${b(c.skip_final_snapshot, true)}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genNeptune(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_neptune_cluster" "${name}" {`];
  L.push(`  cluster_identifier        = "${str('cluster_identifier', c, name)}"`);
  L.push(`  engine                    = "neptune"`);
  if (c.backup_retention_period) L.push(`  backup_retention_period   = ${c.backup_retention_period}`);
  L.push(`  skip_final_snapshot       = ${b(c.skip_final_snapshot, true)}`);
  L.push(`  apply_immediately         = true`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genDocDB(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_docdb_cluster" "${name}" {`];
  L.push(`  cluster_identifier      = "${str('cluster_identifier', c, name)}"`);
  L.push(`  engine                  = "docdb"`);
  L.push(`  master_username         = "${str('master_username', c, 'admin')}"`);
  L.push(`  master_password         = "${str('master_password', c, 'changeme123!')}"`);
  if (c.backup_retention_period) L.push(`  backup_retention_period = ${c.backup_retention_period}`);
  L.push(`  skip_final_snapshot     = ${b(c.skip_final_snapshot, true)}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genTimestream(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_timestreamwrite_database" "${name}" {`];
  L.push(`  database_name = "${str('database_name', c, name)}"`);
  if (c.kms_key_id) L.push(`  kms_key_id    = ${c.kms_key_id}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVERLESS / MESSAGING
// ═══════════════════════════════════════════════════════════════════════════

function genLambda(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_lambda_function" "${name}" {`];
  L.push(`  function_name = "${str('function_name', c, name)}"`);
  L.push(`  runtime       = "${str('runtime', c, 'nodejs18.x')}"`);
  L.push(`  handler       = "${str('handler', c, 'index.handler')}"`);
  L.push(`  role          = ${c.role || '"REPLACE_WITH_ROLE_ARN"'}`);
  if (c.filename)    L.push(`  filename      = "${c.filename}"`);
  if (c.s3_bucket)   L.push(`  s3_bucket     = "${c.s3_bucket}"`);
  if (c.s3_key)      L.push(`  s3_key        = "${c.s3_key}"`);
  if (c.memory_size) L.push(`  memory_size   = ${c.memory_size}`);
  if (c.timeout)     L.push(`  timeout       = ${c.timeout}`);
  if (c.architectures) L.push(`  architectures = ["${c.architectures}"]`);
  if (c.reserved_concurrent_executions !== undefined && n(c.reserved_concurrent_executions) >= 0) L.push(`  reserved_concurrent_executions = ${c.reserved_concurrent_executions}`);
  if (c.publish !== undefined) L.push(`  publish = ${c.publish}`);
  if (c.ephemeral_storage_size && n(c.ephemeral_storage_size) !== 512) { L.push('  ephemeral_storage { size = ' + c.ephemeral_storage_size + ' }'); }
  if (c.vpc_subnet_ids || c.vpc_security_group_ids) {
    L.push('  vpc_config {');
    if (c.vpc_subnet_ids)          L.push(`    subnet_ids         = ${csvArr(c.vpc_subnet_ids)}`);
    if (c.vpc_security_group_ids)  L.push(`    security_group_ids = ${csvArr(c.vpc_security_group_ids)}`);
    L.push('  }');
  }
  if (c.environment_variables) {
    const pairs = String(c.environment_variables).split(',').map(p => p.trim()).filter(Boolean);
    if (pairs.length) {
      L.push('  environment { variables = {');
      pairs.forEach(p => { const [k, v] = p.split('='); if (k) L.push(`    ${k.trim()} = "${(v || '').trim()}"`); });
      L.push('  } }');
    }
  }
  if (c.layers) L.push(`  layers = ${csvArr(c.layers)}`);
  if (c.tracing_mode && c.tracing_mode !== 'PassThrough') L.push(`  tracing_config { mode = "${c.tracing_mode}" }`);
  L.push(...tags(c)); L.push('}');
  if (c.log_retention_days) {
    L.push(''); L.push(`resource "aws_cloudwatch_log_group" "${name}_logs" {`);
    L.push(`  name              = "/aws/lambda/${str('function_name', c, name)}"`);
    L.push(`  retention_in_days = ${c.log_retention_days}`);
    L.push('}');
  }
  return L.join('\n');
}

function genSNS(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_sns_topic" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  if (c.display_name) L.push(`  display_name                  = "${c.display_name}"`);
  if (c.fifo_topic !== undefined) L.push(`  fifo_topic                    = ${c.fifo_topic}`);
  if (c.content_based_deduplication !== undefined) L.push(`  content_based_deduplication   = ${c.content_based_deduplication}`);
  if (c.kms_master_key_id) L.push(`  kms_master_key_id             = "${c.kms_master_key_id}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genSQS(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_sqs_queue" "${name}" {`];
  L.push(`  name                       = "${str('name', c, name)}"`);
  if (c.fifo_queue !== undefined) L.push(`  fifo_queue                 = ${c.fifo_queue}`);
  if (c.visibility_timeout_seconds) L.push(`  visibility_timeout_seconds = ${c.visibility_timeout_seconds}`);
  if (c.message_retention_seconds)  L.push(`  message_retention_seconds  = ${c.message_retention_seconds}`);
  if (c.max_message_size)           L.push(`  max_message_size           = ${c.max_message_size}`);
  if (c.delay_seconds !== undefined) L.push(`  delay_seconds              = ${c.delay_seconds}`);
  if (c.receive_wait_time_seconds !== undefined) L.push(`  receive_wait_time_seconds  = ${c.receive_wait_time_seconds}`);
  if (c.kms_master_key_id) L.push(`  kms_master_key_id          = "${c.kms_master_key_id}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genKinesis(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_kinesis_stream" "${name}" {`];
  L.push(`  name             = "${str('name', c, name)}"`);
  if (str('stream_mode', c) !== 'ON_DEMAND') L.push(`  shard_count      = ${n(c.shard_count, 1)}`);
  if (c.retention_period) L.push(`  retention_period = ${c.retention_period}`);
  L.push('  stream_mode_details { stream_mode = "' + str('stream_mode', c, 'PROVISIONED') + '" }');
  if (c.encryption_type && c.encryption_type !== 'NONE') { L.push(`  encryption_type = "${c.encryption_type}"`); if (c.kms_key_id) L.push(`  kms_key_id      = ${c.kms_key_id}`); }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genFirehose(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_kinesis_firehose_delivery_stream" "${name}" {`];
  L.push(`  name        = "${str('name', c, name)}"`);
  L.push(`  destination = "${str('destination', c, 's3')}"`);
  L.push(''); L.push('  extended_s3_configuration {');
  L.push('    role_arn           = "REPLACE_WITH_ROLE_ARN"');
  L.push('    bucket_arn         = "REPLACE_WITH_BUCKET_ARN"');
  if (c.buffer_size)     L.push(`    buffer_size        = ${c.buffer_size}`);
  if (c.buffer_interval) L.push(`    buffer_interval    = ${c.buffer_interval}`);
  if (c.compression_format) L.push(`    compression_format = "${c.compression_format}"`);
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genEventBridge(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_cloudwatch_event_rule" "${name}" {`];
  L.push(`  name        = "${str('name', c, name)}"`);
  if (c.description) L.push(`  description = "${c.description}"`);
  if (c.schedule_expression) L.push(`  schedule_expression = "${c.schedule_expression}"`);
  if (c.event_pattern) L.push(`  event_pattern = jsonencode(${c.event_pattern})`);
  L.push(`  state       = "${str('state', c, 'ENABLED')}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genStepFunctions(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_sfn_state_machine" "${name}" {`];
  L.push(`  name     = "${str('name', c, name)}"`);
  L.push(`  type     = "${str('type', c, 'STANDARD')}"`);
  L.push(`  role_arn = ${c.role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push('  definition = jsonencode({');
  L.push('    Comment = "State machine managed by Terraform"');
  L.push('    StartAt = "FirstState"');
  L.push('    States  = { FirstState = { Type = "Pass" End = true } }');
  L.push('  })');
  if (c.logging_level && c.logging_level !== 'OFF') {
    L.push('  logging_configuration { level = "' + c.logging_level + '" include_execution_data = true }');
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genMQ(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_mq_broker" "${name}" {`];
  L.push(`  broker_name        = "${str('broker_name', c, name)}"`);
  L.push(`  engine_type        = "${str('engine_type', c, 'RabbitMQ')}"`);
  L.push(`  engine_version     = "${str('engine_version', c, '3.11.20')}"`);
  L.push(`  host_instance_type = "${str('host_instance_type', c, 'mq.t3.micro')}"`);
  L.push(`  deployment_mode    = "${str('deployment_mode', c, 'SINGLE_INSTANCE')}"`);
  L.push(`  publicly_accessible = ${b(c.publicly_accessible, false)}`);
  L.push('  user { username = "' + str('username', c, 'admin') + '" password = "' + str('password', c, 'changeme123!') + '" }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY / IAM
// ═══════════════════════════════════════════════════════════════════════════

function genIAMRole(name: string, c: Cfg): string {
  const service = str('assume_role_service', c, 'lambda.amazonaws.com');
  const L: string[] = [`resource "aws_iam_role" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  L.push(''); L.push('  assume_role_policy = jsonencode({');
  L.push('    Version = "2012-10-17"');
  L.push('    Statement = [{');
  L.push('      Action    = "sts:AssumeRole"');
  L.push('      Effect    = "Allow"');
  L.push(`      Principal = { Service = "${service}" }`);
  L.push('    }]');
  L.push('  })');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genIAMPolicy(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_iam_policy" "${name}" {`];
  L.push(`  name        = "${str('name', c, name)}"`);
  if (c.description) L.push(`  description = "${c.description}"`);
  L.push(`  path        = "${str('path', c, '/')}"`);
  L.push('  policy = jsonencode({');
  L.push('    Version = "2012-10-17"');
  L.push('    Statement = [{ Effect = "Allow" Action = ["*"] Resource = ["*"] }]');
  L.push('  })');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genIAMUser(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_iam_user" "${name}" {`];
  L.push(`  name          = "${str('name', c, name)}"`);
  L.push(`  path          = "${str('path', c, '/')}"`);
  if (c.force_destroy !== undefined) L.push(`  force_destroy = ${c.force_destroy}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genIAMGroup(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_iam_group" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  L.push(`  path = "${str('path', c, '/')}"`);
  L.push('}'); return L.join('\n');
}

function genKMS(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_kms_key" "${name}" {`];
  if (c.description) L.push(`  description             = "${c.description}"`);
  L.push(`  key_usage               = "${str('key_usage', c, 'ENCRYPT_DECRYPT')}"`);
  L.push(`  deletion_window_in_days = ${n(c.deletion_window_in_days, 30)}`);
  L.push(`  enable_key_rotation     = ${b(c.enable_key_rotation, true)}`);
  if (c.multi_region !== undefined) L.push(`  multi_region            = ${c.multi_region}`);
  L.push(...tags(c)); L.push('}');
  L.push(''); L.push(`resource "aws_kms_alias" "${name}_alias" {`);
  L.push(`  name          = "alias/${name}"`);
  L.push(`  target_key_id = aws_kms_key.${name}.key_id`);
  L.push('}'); return L.join('\n');
}

function genSecretsManager(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_secretsmanager_secret" "${name}" {`];
  L.push(`  name                    = "${str('name', c, name)}"`);
  if (c.description) L.push(`  description             = "${c.description}"`);
  if (c.kms_key_id)  L.push(`  kms_key_id              = ${c.kms_key_id}`);
  if (c.recovery_window_in_days !== undefined) L.push(`  recovery_window_in_days = ${c.recovery_window_in_days}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genSSMParameter(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_ssm_parameter" "${name}" {`];
  L.push(`  name  = "${str('name', c, '/' + name)}"`);
  L.push(`  type  = "${str('type', c, 'SecureString')}"`);
  L.push(`  value = "${str('value', c, 'REPLACE_WITH_VALUE')}"`);
  if (c.description) L.push(`  description = "${c.description}"`);
  if (c.tier)        L.push(`  tier        = "${c.tier}"`);
  if (c.kms_key_id)  L.push(`  key_id      = ${c.kms_key_id}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genWAF(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_wafv2_web_acl" "${name}" {`];
  L.push(`  name  = "${str('name', c, name)}"`);
  L.push(`  scope = "${str('scope', c, 'REGIONAL')}"`);
  if (c.description) L.push(`  description = "${c.description}"`);
  L.push(`  default_action { ${str('default_action', c, 'allow') === 'allow' ? 'allow {}' : 'block {}'} }`);
  L.push('  visibility_config {');
  L.push('    cloudwatch_metrics_enabled = true');
  L.push(`    metric_name                = "${name}-metric"`);
  L.push('    sampled_requests_enabled   = true');
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genShield(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_shield_protection" "${name}" {`];
  L.push(`  name         = "${str('name', c, name)}"`);
  L.push(`  resource_arn = ${c.resource_arn || '"REPLACE_WITH_RESOURCE_ARN"'}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genCognito(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_cognito_user_pool" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  if (c.username_attributes) L.push(`  username_attributes      = ["${c.username_attributes}"]`);
  if (c.auto_verified_attributes) L.push(`  auto_verified_attributes = ["${c.auto_verified_attributes}"]`);
  if (c.mfa_configuration) L.push(`  mfa_configuration        = "${c.mfa_configuration}"`);
  if (c.password_min_length) {
    L.push('  password_policy {');
    L.push(`    minimum_length    = ${c.password_min_length}`);
    L.push('    require_lowercase = true');
    L.push('    require_numbers   = true');
    L.push('    require_symbols   = true');
    L.push('    require_uppercase = true');
    L.push('  }');
  }
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genACM(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_acm_certificate" "${name}" {`];
  L.push(`  domain_name       = "${str('domain_name', c, 'example.com')}"`);
  L.push(`  validation_method = "${str('validation_method', c, 'DNS')}"`);
  if (c.subject_alternative_names) {
    const sans = String(c.subject_alternative_names).split(',').map(s => s.trim()).filter(Boolean);
    if (sans.length) L.push(`  subject_alternative_names = ${JSON.stringify(sans)}`);
  }
  L.push('  lifecycle { create_before_destroy = true }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING / DEVOPS / AI / ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function genCWLogGroup(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_cloudwatch_log_group" "${name}" {`];
  L.push(`  name              = "${str('name', c, '/aws/' + name)}"`);
  L.push(`  retention_in_days = ${n(c.retention_in_days, 30)}`);
  if (c.kms_key_id) L.push(`  kms_key_id        = ${c.kms_key_id}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genCWAlarm(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_cloudwatch_metric_alarm" "${name}" {`];
  L.push(`  alarm_name          = "${str('alarm_name', c, name)}"`);
  L.push(`  comparison_operator = "${str('comparison_operator', c, 'GreaterThanThreshold')}"`);
  L.push(`  evaluation_periods  = ${n(c.evaluation_periods, 2)}`);
  L.push(`  metric_name         = "${str('metric_name', c, 'CPUUtilization')}"`);
  L.push(`  namespace           = "${str('namespace', c, 'AWS/EC2')}"`);
  L.push(`  period              = ${n(c.period, 120)}`);
  L.push(`  statistic           = "${str('statistic', c, 'Average')}"`);
  L.push(`  threshold           = ${n(c.threshold, 80)}`);
  if (c.alarm_description) L.push(`  alarm_description   = "${c.alarm_description}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genCloudTrail(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_cloudtrail" "${name}" {`];
  L.push(`  name                          = "${str('name', c, name)}"`);
  L.push(`  s3_bucket_name                = "${str('s3_bucket_name', c, 'REPLACE_WITH_BUCKET')}"`);
  if (c.include_global_service_events !== undefined) L.push(`  include_global_service_events = ${c.include_global_service_events}`);
  if (c.is_multi_region_trail !== undefined)         L.push(`  is_multi_region_trail         = ${c.is_multi_region_trail}`);
  if (c.enable_log_file_validation !== undefined)    L.push(`  enable_log_file_validation    = ${c.enable_log_file_validation}`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genAWSConfig(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_config_configuration_recorder" "${name}" {`];
  L.push(`  name     = "${str('name', c, 'default')}"`);
  L.push(`  role_arn = ${c.role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push('  recording_group {');
  L.push(`    all_supported                 = ${b(c.all_supported, true)}`);
  L.push(`    include_global_resource_types = ${b(c.include_global_resource_types, true)}`);
  L.push('  }');
  L.push('}'); return L.join('\n');
}

function genCodePipeline(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_codepipeline" "${name}" {`];
  L.push(`  name     = "${str('name', c, name)}"`);
  L.push(`  role_arn = ${c.role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push('  artifact_store {');
  L.push(`    location = "${str('artifact_bucket', c, 'REPLACE_WITH_BUCKET')}"`);
  L.push('    type     = "S3"');
  L.push('  }');
  L.push('  stage { name = "Source" action { name = "Source" category = "Source" owner = "AWS" provider = "CodeCommit" version = "1" output_artifacts = ["source_output"] configuration = { RepositoryName = "REPLACE" BranchName = "main" } } }');
  L.push('  stage { name = "Build"  action { name = "Build"  category = "Build"  owner = "AWS" provider = "CodeBuild" version = "1" input_artifacts = ["source_output"] output_artifacts = ["build_output"] configuration = { ProjectName = "REPLACE" } } }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genCodeBuild(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_codebuild_project" "${name}" {`];
  L.push(`  name          = "${str('name', c, name)}"`);
  L.push(`  service_role  = ${c.service_role || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push('  artifacts { type = "NO_ARTIFACTS" }');
  L.push('  environment {');
  L.push(`    compute_type = "${str('compute_type', c, 'BUILD_GENERAL1_SMALL')}"`);
  L.push(`    image        = "${str('build_image', c, 'aws/codebuild/standard:7.0')}"`);
  L.push('    type         = "LINUX_CONTAINER"');
  L.push('  }');
  L.push('  source {');
  L.push('    type      = "NO_SOURCE"');
  L.push(`    buildspec = "${str('buildspec', c, 'buildspec.yml')}"`);
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genCodeCommit(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_codecommit_repository" "${name}" {`];
  L.push(`  repository_name = "${str('repository_name', c, name)}"`);
  if (c.description)     L.push(`  description     = "${c.description}"`);
  if (c.default_branch)  L.push(`  default_branch  = "${c.default_branch}"`);
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genECR(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_ecr_repository" "${name}" {`];
  L.push(`  name                 = "${str('name', c, name)}"`);
  L.push(`  image_tag_mutability = "${str('image_tag_mutability', c, 'MUTABLE')}"`);
  if (c.scan_on_push !== undefined) { L.push('  image_scanning_configuration { scan_on_push = ' + c.scan_on_push + ' }'); }
  if (c.encryption_type) { L.push('  encryption_configuration { encryption_type = "' + c.encryption_type + '"' + (c.kms_key ? ' kms_key = ' + c.kms_key : '') + ' }'); }
  if (c.force_delete !== undefined) L.push(`  force_delete = ${c.force_delete}`);
  L.push(...tags(c)); L.push('}');
  L.push(''); L.push(`resource "aws_ecr_lifecycle_policy" "${name}_lifecycle" {`);
  L.push(`  repository = aws_ecr_repository.${name}.name`);
  L.push('  policy = jsonencode({');
  L.push('    rules = [{ rulePriority = 1 description = "Keep last 30 images" selection = { tagStatus = "any" countType = "imageCountMoreThan" countNumber = 30 } action = { type = "expire" } }]');
  L.push('  })');
  L.push('}');
  return L.join('\n');
}

function genSageMakerModel(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_sagemaker_model" "${name}" {`];
  L.push(`  name               = "${str('name', c, name)}"`);
  L.push(`  execution_role_arn = ${c.execution_role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push('  primary_container {');
  L.push(`    image     = "${str('container_image', c, 'REPLACE_WITH_IMAGE_URI')}"`);
  if (c.model_data_url) L.push(`    model_data_url = "${c.model_data_url}"`);
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genSageMakerEndpoint(name: string, c: Cfg): string {
  const configName = str('endpoint_config_name', c, name + '_config');
  const L: string[] = [];
  L.push(`resource "aws_sagemaker_endpoint_configuration" "${name}_config" {`);
  L.push(`  name = "${configName}"`);
  L.push('  production_variants {');
  L.push('    variant_name           = "AllTraffic"');
  L.push('    model_name             = "REPLACE_WITH_MODEL_NAME"');
  L.push(`    instance_type          = "${str('instance_type', c, 'ml.t2.medium')}"`);
  L.push(`    initial_instance_count = ${n(c.initial_instance_count, 1)}`);
  L.push('  }');
  L.push(...tags(c)); L.push('}');
  L.push(''); L.push(`resource "aws_sagemaker_endpoint" "${name}" {`);
  L.push(`  name                 = "${str('name', c, name)}"`);
  L.push(`  endpoint_config_name = aws_sagemaker_endpoint_configuration.${name}_config.name`);
  L.push(...tags(c)); L.push('}');
  return L.join('\n');
}

function genAthena(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_athena_workgroup" "${name}" {`];
  L.push(`  name = "${str('name', c, name)}"`);
  if (c.description) L.push(`  description = "${c.description}"`);
  L.push('  configuration {');
  L.push(`    enforce_workgroup_configuration    = ${b(c.enforce_workgroup_configuration, true)}`);
  L.push(`    publish_cloudwatch_metrics_enabled = ${b(c.publish_cloudwatch_metrics_enabled, true)}`);
  if (c.output_location) { L.push('    result_configuration { output_location = "' + c.output_location + '" }'); }
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genGlue(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_glue_job" "${name}" {`];
  L.push(`  name         = "${str('name', c, name)}"`);
  L.push(`  role_arn     = ${c.role_arn || '"REPLACE_WITH_ROLE_ARN"'}`);
  L.push(`  glue_version = "${str('glue_version', c, '4.0')}"`);
  L.push(`  worker_type  = "${str('worker_type', c, 'G.1X')}"`);
  L.push(`  number_of_workers = ${n(c.number_of_workers, 2)}`);
  L.push('  command {');
  L.push(`    name            = "${str('command_name', c, 'glueetl')}"`);
  L.push(`    script_location = "${str('script_location', c, 's3://REPLACE/script.py')}"`);
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}

function genEMR(name: string, c: Cfg): string {
  const L: string[] = [`resource "aws_emr_cluster" "${name}" {`];
  L.push(`  name          = "${str('name', c, name)}"`);
  L.push(`  release_label = "${str('release_label', c, 'emr-7.0.0')}"`);
  L.push(`  applications  = ["Spark", "Hadoop"]`);
  if (c.log_uri) L.push(`  log_uri       = "${c.log_uri}"`);
  L.push('  ec2_attributes {');
  L.push('    instance_profile = "REPLACE_WITH_INSTANCE_PROFILE"');
  L.push('  }');
  L.push('  master_instance_group {');
  L.push(`    instance_type = "${str('master_instance_type', c, 'm5.xlarge')}"`);
  L.push('  }');
  L.push('  core_instance_group {');
  L.push(`    instance_type  = "${str('core_instance_type', c, 'm5.xlarge')}"`);
  L.push(`    instance_count = ${n(c.core_instance_count, 2)}`);
  L.push('  }');
  L.push(...tags(c)); L.push('}'); return L.join('\n');
}


export function generateTerraform(
  nodes: Node<ResourceNodeData>[],
  region: string,
  profile: string,
  showCostComments = false
): string {
  if (nodes.length === 0) {
    return '# Drag AWS resources onto the canvas to generate Terraform code\n';
  }

  const sections: string[] = [];

  // ── Cost summary header ───────────────────────────────────────────────────
  if (showCostComments && nodes.length > 0) {
    const costSummary = estimateCosts(nodes);
    const totalStr = costSummary.totalMin === costSummary.totalMax
      ? `$${costSummary.totalMin.toFixed(2)}`
      : `$${costSummary.totalMin.toFixed(0)}–$${costSummary.totalMax.toFixed(0)}`;

    const costLines = [
      '# ╔══════════════════════════════════════════════════════════════════╗',
      '# ║                    AWS COST ESTIMATE                            ║',
      '# ║              Generated by Terraform Visual Builder              ║',
      '# ╠══════════════════════════════════════════════════════════════════╣',
      `# ║  Estimated Monthly Cost: ${totalStr.padEnd(40)}║`,
      `# ║  Region: ${region.padEnd(57)}║`,
      '# ╠══════════════════════════════════════════════════════════════════╣',
      '# ║  Resource Breakdown:                                            ║',
    ];

    for (const item of costSummary.items) {
      const costStr = item.monthlyMax === 0
        ? 'FREE'
        : item.monthlyMin === item.monthlyMax
          ? `~$${item.monthlyMax.toFixed(2)}/mo`
          : `~$${item.monthlyMin.toFixed(0)}–$${item.monthlyMax.toFixed(0)}/mo`;
      const label = `${item.icon} ${item.label} (${item.resourceName})`;
      const line = `# ║  ${label.substring(0, 44).padEnd(44)}  ${costStr.padEnd(16)}║`;
      costLines.push(line);
    }

    costLines.push('# ╠══════════════════════════════════════════════════════════════════╣');
    costLines.push('# ║  * Estimates based on us-east-1 on-demand pricing.              ║');
    costLines.push('# ║  * Actual costs vary by usage, reserved pricing & region.       ║');
    costLines.push('# ╚══════════════════════════════════════════════════════════════════╝');
    sections.push(costLines.join('\n'));
  }

  // ── Terraform block ───────────────────────────────────────────────────────
  sections.push(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}`);

  // ── Provider block ────────────────────────────────────────────────────────
  sections.push(`provider "aws" {
  region  = "${region}"
  profile = "${profile}"
}`);

  // ── Resource blocks ───────────────────────────────────────────────────────
  // Pre-compute costs if needed for per-resource comments
  const costMap = showCostComments
    ? Object.fromEntries(
        estimateCosts(nodes).items.map(item => [item.resourceName, item])
      )
    : {};

  for (const node of nodes) {
    const { resourceType, resourceName, config } = node.data;
    const name = (resourceName || 'main').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const c = config;

    let block = '';
    switch (resourceType) {
      // Compute
      case 'aws_instance':                      block = genEC2(name, c); break;
      case 'aws_autoscaling_group':             block = genASG(name, c); break;
      case 'aws_launch_template':               block = genLaunchTemplate(name, c); break;
      case 'aws_eks_cluster':                   block = genEKSCluster(name, c); break;
      case 'aws_eks_node_group':                block = genEKSNodeGroup(name, c); break;
      case 'aws_ecs_cluster':                   block = genECSCluster(name, c); break;
      case 'aws_ecs_task_definition':           block = genECSTaskDef(name, c); break;
      case 'aws_ecs_service':                   block = genECSService(name, c); break;
      case 'aws_elastic_beanstalk_environment': block = genBeanstalk(name, c); break;
      // Storage
      case 'aws_s3_bucket':                     block = genS3(name, c); break;
      case 'aws_ebs_volume':                    block = genEBS(name, c); break;
      case 'aws_efs_file_system':               block = genEFS(name, c); break;
      case 'aws_fsx_lustre_file_system':        block = genFSxLustre(name, c); break;
      case 'aws_glacier_vault':                 block = genGlacier(name, c); break;
      // Network
      case 'aws_vpc':                           block = genVPC(name, c); break;
      case 'aws_subnet':                        block = genSubnet(name, c); break;
      case 'aws_security_group':                block = genSG(name, c); break;
      case 'aws_internet_gateway':              block = genIGW(name, c); break;
      case 'aws_lb':                            block = genLB(name, c); break;
      case 'aws_route_table':                   block = genRouteTable(name, c); break;
      case 'aws_nat_gateway':                   block = genNAT(name, c); break;
      case 'aws_eip':                           block = genEIP(name, c); break;
      case 'aws_vpc_peering_connection':        block = genVPCPeering(name, c); break;
      case 'aws_cloudfront_distribution':       block = genCloudFront(name, c); break;
      case 'aws_route53_zone':                  block = genRoute53Zone(name, c); break;
      case 'aws_route53_record':                block = genRoute53Record(name, c); break;
      case 'aws_api_gateway_rest_api':          block = genAPIGatewayREST(name, c); break;
      case 'aws_apigatewayv2_api':              block = genAPIGatewayV2(name, c); break;
      case 'aws_vpn_gateway':                   block = genVPNGateway(name, c); break;
      case 'aws_dx_connection':                 block = genDXConnection(name, c); break;
      // Database
      case 'aws_rds_instance':                  block = genRDS(name, c); break;
      case 'aws_rds_cluster':                   block = genAurora(name, c); break;
      case 'aws_dynamodb_table':                block = genDynamoDB(name, c); break;
      case 'aws_elasticache_cluster':           block = genElastiCache(name, c); break;
      case 'aws_elasticache_replication_group': block = genElastiCacheHA(name, c); break;
      case 'aws_redshift_cluster':              block = genRedshift(name, c); break;
      case 'aws_neptune_cluster':               block = genNeptune(name, c); break;
      case 'aws_docdb_cluster':                 block = genDocDB(name, c); break;
      case 'aws_timestream_database':           block = genTimestream(name, c); break;
      // Serverless / Messaging
      case 'aws_lambda_function':               block = genLambda(name, c); break;
      case 'aws_sns_topic':                     block = genSNS(name, c); break;
      case 'aws_sqs_queue':                     block = genSQS(name, c); break;
      case 'aws_kinesis_stream':                block = genKinesis(name, c); break;
      case 'aws_kinesis_firehose_delivery_stream': block = genFirehose(name, c); break;
      case 'aws_eventbridge_rule':              block = genEventBridge(name, c); break;
      case 'aws_sfn_state_machine':             block = genStepFunctions(name, c); break;
      case 'aws_mq_broker':                     block = genMQ(name, c); break;
      // Security / IAM
      case 'aws_iam_role':                      block = genIAMRole(name, c); break;
      case 'aws_iam_policy':                    block = genIAMPolicy(name, c); break;
      case 'aws_iam_user':                      block = genIAMUser(name, c); break;
      case 'aws_iam_group':                     block = genIAMGroup(name, c); break;
      case 'aws_kms_key':                       block = genKMS(name, c); break;
      case 'aws_secretsmanager_secret':         block = genSecretsManager(name, c); break;
      case 'aws_ssm_parameter':                 block = genSSMParameter(name, c); break;
      case 'aws_wafv2_web_acl':                 block = genWAF(name, c); break;
      case 'aws_shield_protection':             block = genShield(name, c); break;
      case 'aws_cognito_user_pool':             block = genCognito(name, c); break;
      case 'aws_acm_certificate':               block = genACM(name, c); break;
      // Monitoring / DevOps
      case 'aws_cloudwatch_log_group':          block = genCWLogGroup(name, c); break;
      case 'aws_cloudwatch_metric_alarm':       block = genCWAlarm(name, c); break;
      case 'aws_cloudtrail':                    block = genCloudTrail(name, c); break;
      case 'aws_config_configuration_recorder': block = genAWSConfig(name, c); break;
      case 'aws_codepipeline':                  block = genCodePipeline(name, c); break;
      case 'aws_codebuild_project':             block = genCodeBuild(name, c); break;
      case 'aws_codecommit_repository':         block = genCodeCommit(name, c); break;
      case 'aws_ecr_repository':                block = genECR(name, c); break;
      // AI/ML
      case 'aws_sagemaker_model':               block = genSageMakerModel(name, c); break;
      case 'aws_sagemaker_endpoint':            block = genSageMakerEndpoint(name, c); break;
      // Analytics
      case 'aws_athena_workgroup':              block = genAthena(name, c); break;
      case 'aws_glue_job':                      block = genGlue(name, c); break;
      case 'aws_emr_cluster':                   block = genEMR(name, c); break;
    }

    if (block) {
      // Prepend per-resource cost comment if enabled
      if (showCostComments) {
        const costItem = costMap[resourceName];
        if (costItem) {
          const costStr = costItem.monthlyMax === 0
            ? 'FREE'
            : costItem.monthlyMin === costItem.monthlyMax
              ? `~$${costItem.monthlyMax.toFixed(2)}/month`
              : `~$${costItem.monthlyMin.toFixed(0)}–$${costItem.monthlyMax.toFixed(0)}/month`;
          block = `# Cost: ${costStr} | ${costItem.basis}\n${block}`;
        }
      }
      sections.push(block);
    }
  }

  return sections.join('\n\n') + '\n';
}

// ── Generator map (maps terraform type → gen function) ────────────────────────

type GeneratorFn = (name: string, c: Cfg) => string;

export const RESOURCE_GENERATORS: Record<string, GeneratorFn> = {
  // Compute
  'aws_instance':                      genEC2,
  'aws_autoscaling_group':             genASG,
  'aws_launch_template':               genLaunchTemplate,
  'aws_eks_cluster':                   genEKSCluster,
  'aws_eks_node_group':                genEKSNodeGroup,
  'aws_ecs_cluster':                   genECSCluster,
  'aws_ecs_task_definition':           genECSTaskDef,
  'aws_ecs_service':                   genECSService,
  'aws_elastic_beanstalk_environment': genBeanstalk,
  // Storage
  'aws_s3_bucket':                     genS3,
  'aws_ebs_volume':                    genEBS,
  'aws_efs_file_system':               genEFS,
  'aws_fsx_lustre_file_system':        genFSxLustre,
  'aws_glacier_vault':                 genGlacier,
  // Network
  'aws_vpc':                           genVPC,
  'aws_subnet':                        genSubnet,
  'aws_security_group':                genSG,
  'aws_internet_gateway':              genIGW,
  'aws_lb':                            genLB,
  'aws_route_table':                   genRouteTable,
  'aws_nat_gateway':                   genNAT,
  'aws_eip':                           genEIP,
  'aws_vpc_peering_connection':        genVPCPeering,
  'aws_cloudfront_distribution':       genCloudFront,
  'aws_route53_zone':                  genRoute53Zone,
  'aws_route53_record':                genRoute53Record,
  'aws_api_gateway_rest_api':          genAPIGatewayREST,
  'aws_apigatewayv2_api':              genAPIGatewayV2,
  'aws_vpn_gateway':                   genVPNGateway,
  'aws_dx_connection':                 genDXConnection,
  // Database
  'aws_rds_instance':                  genRDS,
  'aws_rds_cluster':                   genAurora,
  'aws_dynamodb_table':                genDynamoDB,
  'aws_elasticache_cluster':           genElastiCache,
  'aws_elasticache_replication_group': genElastiCacheHA,
  'aws_redshift_cluster':              genRedshift,
  'aws_neptune_cluster':               genNeptune,
  'aws_docdb_cluster':                 genDocDB,
  'aws_timestream_database':           genTimestream,
  // Serverless / Messaging
  'aws_lambda_function':               genLambda,
  'aws_sns_topic':                     genSNS,
  'aws_sqs_queue':                     genSQS,
  'aws_kinesis_stream':                genKinesis,
  'aws_kinesis_firehose_delivery_stream': genFirehose,
  'aws_eventbridge_rule':              genEventBridge,
  'aws_sfn_state_machine':             genStepFunctions,
  'aws_mq_broker':                     genMQ,
  // Security / IAM
  'aws_iam_role':                      genIAMRole,
  'aws_iam_policy':                    genIAMPolicy,
  'aws_iam_user':                      genIAMUser,
  'aws_iam_group':                     genIAMGroup,
  'aws_kms_key':                       genKMS,
  'aws_secretsmanager_secret':         genSecretsManager,
  'aws_ssm_parameter':                 genSSMParameter,
  'aws_wafv2_web_acl':                 genWAF,
  'aws_shield_protection':             genShield,
  'aws_cognito_user_pool':             genCognito,
  'aws_acm_certificate':               genACM,
  // Monitoring / DevOps
  'aws_cloudwatch_log_group':          genCWLogGroup,
  'aws_cloudwatch_metric_alarm':       genCWAlarm,
  'aws_cloudtrail':                    genCloudTrail,
  'aws_config_configuration_recorder': genAWSConfig,
  'aws_codepipeline':                  genCodePipeline,
  'aws_codebuild_project':             genCodeBuild,
  'aws_codecommit_repository':         genCodeCommit,
  'aws_ecr_repository':                genECR,
  // AI/ML
  'aws_sagemaker_model':               genSageMakerModel,
  'aws_sagemaker_endpoint':            genSageMakerEndpoint,
  // Analytics
  'aws_athena_workgroup':              genAthena,
  'aws_glue_job':                      genGlue,
  'aws_emr_cluster':                   genEMR,
};

export { s as _s };
