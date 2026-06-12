import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AuditFinding {
  id: string;
  severity: Severity;
  resourceType: string;
  resourceName: string;
  icon: string;
  title: string;
  description: string;
  recommendation: string;
  cis?: string; // CIS benchmark reference
}

export interface AuditResult {
  findings: AuditFinding[];
  score: number; // 0-100
  passed: number;
  failed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

type Cfg = Record<string, string | number | boolean>;

function finding(
  id: string, severity: Severity, resourceType: string, resourceName: string,
  icon: string, title: string, description: string, recommendation: string, cis?: string
): AuditFinding {
  return { id, severity, resourceType, resourceName, icon, title, description, recommendation, cis };
}

// ── Per-resource audit rules ──────────────────────────────────────────────────
function auditEC2(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (cfg.associate_public_ip_address === true)
    f.push(finding('ec2-public-ip', 'medium', 'aws_instance', name, '🖥️',
      'EC2 instance has public IP',
      'Assigning a public IP exposes the instance directly to the internet.',
      'Use a NAT Gateway for outbound traffic and a Load Balancer for inbound. Disable public IP unless required.'));
  if (!cfg.key_name)
    f.push(finding('ec2-no-key', 'high', 'aws_instance', name, '🖥️',
      'No SSH key pair configured',
      'Without a key pair, you cannot SSH into the instance for troubleshooting.',
      'Assign a key pair or use AWS Systems Manager Session Manager for keyless access.'));
  if (!cfg.vpc_security_group_ids)
    f.push(finding('ec2-no-sg', 'critical', 'aws_instance', name, '🖥️',
      'No security group attached',
      'EC2 instance has no security group, which may use the default SG with unrestricted access.',
      'Always attach a custom security group with least-privilege rules.'));
  return f;
}

function auditSG(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  const cidr = String(cfg.ingress_cidr || '');
  const fromPort = Number(cfg.ingress_from_port ?? 0);
  const toPort = Number(cfg.ingress_to_port ?? 0);
  const proto = String(cfg.ingress_protocol || 'tcp');

  if (cidr === '0.0.0.0/0' || cidr === '::/0') {
    if (fromPort === 22 || (fromPort <= 22 && toPort >= 22))
      f.push(finding('sg-ssh-open', 'critical', 'aws_security_group', name, '🛡️',
        'SSH (port 22) open to the world',
        'Allowing SSH from 0.0.0.0/0 exposes the instance to brute-force attacks.',
        'Restrict SSH to specific IP ranges or use AWS Systems Manager Session Manager.',
        'CIS AWS 5.2'));
    if (fromPort === 3389 || (fromPort <= 3389 && toPort >= 3389))
      f.push(finding('sg-rdp-open', 'critical', 'aws_security_group', name, '🛡️',
        'RDP (port 3389) open to the world',
        'Allowing RDP from 0.0.0.0/0 exposes Windows instances to attacks.',
        'Restrict RDP to specific IP ranges or use AWS Systems Manager.',
        'CIS AWS 5.3'));
    if (proto === '-1' || (fromPort === 0 && toPort === 0))
      f.push(finding('sg-all-open', 'critical', 'aws_security_group', name, '🛡️',
        'All traffic allowed from the internet',
        'Security group allows all inbound traffic from 0.0.0.0/0.',
        'Apply least-privilege rules. Only open ports that are required.',
        'CIS AWS 5.1'));
    if (fromPort === 3306 || fromPort === 5432 || fromPort === 1433)
      f.push(finding('sg-db-open', 'high', 'aws_security_group', name, '🛡️',
        'Database port open to the internet',
        `Port ${fromPort} (database) is accessible from 0.0.0.0/0.`,
        'Database ports should only be accessible from application security groups, never the internet.'));
  }
  return f;
}

function auditS3(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (cfg.acl === 'public-read' || cfg.acl === 'public-read-write')
    f.push(finding('s3-public-acl', 'high', 'aws_s3_bucket', name, '🪣',
      'S3 bucket has public ACL',
      `Bucket ACL is set to "${cfg.acl}", making objects publicly accessible.`,
      'Use private ACL and CloudFront for public content delivery. Enable Block Public Access settings.',
      'CIS AWS 2.1.1'));
  if (!cfg.versioning_enabled)
    f.push(finding('s3-no-versioning', 'low', 'aws_s3_bucket', name, '🪣',
      'S3 versioning not enabled',
      'Without versioning, accidental deletions or overwrites cannot be recovered.',
      'Enable versioning for important buckets, especially those storing state files or backups.'));
  if (!cfg.server_side_encryption)
    f.push(finding('s3-no-encryption', 'medium', 'aws_s3_bucket', name, '🪣',
      'S3 bucket encryption not configured',
      'Data at rest is not encrypted with a managed key.',
      'Enable server-side encryption with AES256 or aws:kms.',
      'CIS AWS 2.1.1'));
  if (cfg.block_public_acls === false || cfg.block_public_policy === false)
    f.push(finding('s3-public-access-block', 'high', 'aws_s3_bucket', name, '🪣',
      'S3 Block Public Access not fully enabled',
      'One or more Block Public Access settings are disabled.',
      'Enable all four Block Public Access settings unless you specifically need public access.'));
  return f;
}

function auditRDS(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (cfg.publicly_accessible === true)
    f.push(finding('rds-public', 'critical', 'aws_rds_instance', name, '🗄️',
      'RDS instance is publicly accessible',
      'The database is reachable from the internet, exposing it to attacks.',
      'Set publicly_accessible = false and access the database only from within the VPC.',
      'CIS AWS 2.3.2'));
  if (cfg.storage_encrypted === false || cfg.storage_encrypted === undefined)
    f.push(finding('rds-no-encryption', 'high', 'aws_rds_instance', name, '🗄️',
      'RDS storage not encrypted',
      'Database storage is not encrypted at rest.',
      'Enable storage_encrypted = true. Note: requires a new instance (cannot be changed in-place).',
      'CIS AWS 2.3.1'));
  if (!cfg.backup_retention_period || Number(cfg.backup_retention_period) === 0)
    f.push(finding('rds-no-backup', 'high', 'aws_rds_instance', name, '🗄️',
      'RDS automated backups disabled',
      'backup_retention_period is 0, meaning no automated backups are taken.',
      'Set backup_retention_period to at least 7 days for production databases.'));
  if (!cfg.deletion_protection)
    f.push(finding('rds-no-deletion-protection', 'medium', 'aws_rds_instance', name, '🗄️',
      'RDS deletion protection disabled',
      'The database can be accidentally deleted without protection.',
      'Enable deletion_protection = true for production databases.'));
  if (!cfg.multi_az)
    f.push(finding('rds-no-multi-az', 'low', 'aws_rds_instance', name, '🗄️',
      'RDS not configured for Multi-AZ',
      'Single-AZ deployment has no automatic failover.',
      'Enable multi_az = true for production workloads requiring high availability.'));
  const pass = String(cfg.password || '');
  if (pass.length < 12 || pass === 'changeme123!' || pass === 'password' || pass === 'admin')
    f.push(finding('rds-weak-password', 'critical', 'aws_rds_instance', name, '🗄️',
      'Weak or default database password',
      'The master password appears to be weak or a default value.',
      'Use a strong, unique password. Consider using AWS Secrets Manager to manage database credentials.'));
  return f;
}

function auditIAMRole(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (!cfg.name || String(cfg.name).length < 3)
    f.push(finding('iam-no-name', 'low', 'aws_iam_role', name, '👤',
      'IAM role has no descriptive name',
      'Role names should be descriptive to understand their purpose.',
      'Use a clear, descriptive name that indicates the role\'s purpose and the service it\'s for.'));
  return f;
}

function auditLambda(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (!cfg.role || String(cfg.role).includes('REPLACE'))
    f.push(finding('lambda-no-role', 'critical', 'aws_lambda_function', name, '⚡',
      'Lambda function has no IAM execution role',
      'Without an execution role, Lambda cannot access AWS services.',
      'Create an IAM role with least-privilege permissions and assign it to the function.'));
  if (Number(cfg.timeout || 3) > 300)
    f.push(finding('lambda-long-timeout', 'low', 'aws_lambda_function', name, '⚡',
      'Lambda timeout is very long',
      'A very long timeout can lead to unexpected costs if the function hangs.',
      'Set the timeout to the minimum required. Use Step Functions for long-running workflows.'));
  if (cfg.reserved_concurrent_executions === undefined || Number(cfg.reserved_concurrent_executions) === -1)
    f.push(finding('lambda-no-concurrency', 'info', 'aws_lambda_function', name, '⚡',
      'Lambda has no reserved concurrency limit',
      'Without a concurrency limit, a traffic spike could consume all account-level concurrency.',
      'Set reserved_concurrent_executions to limit the function\'s concurrency and protect other functions.'));
  return f;
}

function auditEKS(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (cfg.endpoint_public_access === true && !cfg.public_access_cidrs)
    f.push(finding('eks-public-api', 'high', 'aws_eks_cluster', name, '☸️',
      'EKS API server is publicly accessible without CIDR restriction',
      'The Kubernetes API server is accessible from the internet without IP restrictions.',
      'Restrict public_access_cidrs to your office/VPN IP ranges, or disable public access entirely.'));
  if (!cfg.enabled_cluster_log_types)
    f.push(finding('eks-no-logging', 'medium', 'aws_eks_cluster', name, '☸️',
      'EKS control plane logging not enabled',
      'Without logging, security events and API calls are not captured.',
      'Enable at minimum "api", "audit", and "authenticator" log types.'));
  return f;
}

function auditKMS(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (!cfg.enable_key_rotation)
    f.push(finding('kms-no-rotation', 'medium', 'aws_kms_key', name, '🔑',
      'KMS key rotation not enabled',
      'Without automatic rotation, the same key material is used indefinitely.',
      'Enable enable_key_rotation = true for automatic annual key rotation.',
      'CIS AWS 3.8'));
  return f;
}

function auditCloudTrail(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (!cfg.is_multi_region_trail)
    f.push(finding('ct-single-region', 'medium', 'aws_cloudtrail', name, '🔍',
      'CloudTrail is not multi-region',
      'Single-region trails miss API activity in other regions.',
      'Enable is_multi_region_trail = true to capture all API activity.',
      'CIS AWS 3.1'));
  if (!cfg.enable_log_file_validation)
    f.push(finding('ct-no-validation', 'medium', 'aws_cloudtrail', name, '🔍',
      'CloudTrail log file validation disabled',
      'Without validation, log files could be tampered with undetected.',
      'Enable enable_log_file_validation = true.',
      'CIS AWS 3.2'));
  return f;
}

function auditEBS(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (!cfg.encrypted)
    f.push(finding('ebs-no-encryption', 'high', 'aws_ebs_volume', name, '💾',
      'EBS volume not encrypted',
      'Unencrypted EBS volumes expose data if the underlying hardware is compromised.',
      'Enable encrypted = true. Consider enabling account-level EBS encryption by default.',
      'CIS AWS 2.2.1'));
  return f;
}

function auditECR(name: string, cfg: Cfg): AuditFinding[] {
  const f: AuditFinding[] = [];
  if (!cfg.scan_on_push)
    f.push(finding('ecr-no-scan', 'medium', 'aws_ecr_repository', name, '🐋',
      'ECR image scanning not enabled',
      'Without scanning, container images may contain known vulnerabilities.',
      'Enable scan_on_push = true to automatically scan images for CVEs on push.'));
  if (cfg.image_tag_mutability === 'MUTABLE')
    f.push(finding('ecr-mutable-tags', 'low', 'aws_ecr_repository', name, '🐋',
      'ECR image tags are mutable',
      'Mutable tags allow overwriting existing images, which can cause deployment inconsistencies.',
      'Set image_tag_mutability = "IMMUTABLE" for production repositories.'));
  return f;
}

// ── Main audit function ───────────────────────────────────────────────────────
export function runSecurityAudit(nodes: Node<ResourceNodeData>[]): AuditResult {
  const findings: AuditFinding[] = [];

  for (const node of nodes) {
    const { resourceType, resourceName, config } = node.data;
    const name = resourceName || 'unnamed';

    switch (resourceType) {
      case 'aws_instance':          findings.push(...auditEC2(name, config)); break;
      case 'aws_security_group':    findings.push(...auditSG(name, config)); break;
      case 'aws_s3_bucket':         findings.push(...auditS3(name, config)); break;
      case 'aws_rds_instance':      findings.push(...auditRDS(name, config)); break;
      case 'aws_iam_role':          findings.push(...auditIAMRole(name, config)); break;
      case 'aws_lambda_function':   findings.push(...auditLambda(name, config)); break;
      case 'aws_eks_cluster':       findings.push(...auditEKS(name, config)); break;
      case 'aws_kms_key':           findings.push(...auditKMS(name, config)); break;
      case 'aws_cloudtrail':        findings.push(...auditCloudTrail(name, config)); break;
      case 'aws_ebs_volume':        findings.push(...auditEBS(name, config)); break;
      case 'aws_ecr_repository':    findings.push(...auditECR(name, config)); break;
    }
  }

  const critical = findings.filter(f => f.severity === 'critical').length;
  const high     = findings.filter(f => f.severity === 'high').length;
  const medium   = findings.filter(f => f.severity === 'medium').length;
  const low      = findings.filter(f => f.severity === 'low').length;
  const failed   = findings.length;

  // Score: start at 100, deduct per finding
  const deductions = critical * 20 + high * 10 + medium * 5 + low * 2;
  const score = Math.max(0, Math.min(100, 100 - deductions));

  // Estimate passed checks (rough: 3 checks per resource)
  const totalChecks = nodes.length * 3;
  const passed = Math.max(0, totalChecks - failed);

  return { findings, score, passed, failed, critical, high, medium, low };
}
