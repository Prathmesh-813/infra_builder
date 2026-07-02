import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';
import { generateTerraform } from './terraformGenerator';

export interface TerraformProject {
  'main.tf': string;
  'variables.tf': string;
  'outputs.tf': string;
  'providers.tf': string;
  'terraform.tfvars': string;
  'README.md': string;
}

// ── providers.tf ─────────────────────────────────────────────────────────────
function genProviders(_region: string): string {
  return `terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use remote state
  # backend "s3" {
  #   bucket = "my-terraform-state"
  #   key    = "terraform.tfstate"
  #   region = var.aws_region
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
      Project     = var.project_name
    }
  }
}
`;
}

// ── variables.tf ─────────────────────────────────────────────────────────────
function genVariables(nodes: Node<ResourceNodeData>[], region: string): string {
  const lines: string[] = [];

  lines.push(`variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "${region}"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "default"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used for tagging"
  type        = string
  default     = "my-project"
}
`);

  // Generate variables for key config values
  const seen = new Set<string>();
  for (const node of nodes) {
    const { resourceType, resourceName, config } = node.data;
    const safeName = resourceName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    // AMI IDs
    if (resourceType === 'aws_instance' && config.ami && !seen.has('ami_id')) {
      seen.add('ami_id');
      lines.push(`variable "ami_id" {
  description = "AMI ID for EC2 instances"
  type        = string
  default     = "${config.ami}"
}
`);
    }

    // DB passwords
    if ((resourceType === 'aws_rds_instance' || resourceType === 'aws_rds_cluster') && !seen.has(`${safeName}_db_password`)) {
      seen.add(`${safeName}_db_password`);
      lines.push(`variable "${safeName}_db_password" {
  description = "Master password for ${resourceName} database"
  type        = string
  sensitive   = true
  default     = "${config.password || config.master_password || 'changeme123!'}"
}
`);
    }

    // S3 bucket names
    if (resourceType === 'aws_s3_bucket' && config.bucket && !seen.has(`${safeName}_bucket_name`)) {
      seen.add(`${safeName}_bucket_name`);
      lines.push(`variable "${safeName}_bucket_name" {
  description = "Name for the ${resourceName} S3 bucket"
  type        = string
  default     = "${config.bucket}"
}
`);
    }

    // VPC CIDR
    if (resourceType === 'aws_vpc' && config.cidr_block && !seen.has(`${safeName}_cidr`)) {
      seen.add(`${safeName}_cidr`);
      lines.push(`variable "${safeName}_cidr" {
  description = "CIDR block for ${resourceName} VPC"
  type        = string
  default     = "${config.cidr_block}"
}
`);
    }
  }

  return lines.join('\n');
}

// ── outputs.tf ───────────────────────────────────────────────────────────────
function genOutputs(nodes: Node<ResourceNodeData>[]): string {
  const lines: string[] = [];
  lines.push('# Useful outputs from your infrastructure\n');

  for (const node of nodes) {
    const { resourceType, resourceName } = node.data;
    const name = resourceName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    switch (resourceType) {
      case 'aws_instance':
        lines.push(`output "${name}_instance_id" {
  description = "ID of EC2 instance ${resourceName}"
  value       = aws_instance.${name}.id
}

output "${name}_public_ip" {
  description = "Public IP of EC2 instance ${resourceName}"
  value       = aws_instance.${name}.public_ip
}
`);
        break;
      case 'aws_vpc':
        lines.push(`output "${name}_vpc_id" {
  description = "ID of VPC ${resourceName}"
  value       = aws_vpc.${name}.id
}

output "${name}_vpc_cidr" {
  description = "CIDR block of VPC ${resourceName}"
  value       = aws_vpc.${name}.cidr_block
}
`);
        break;
      case 'aws_subnet':
        lines.push(`output "${name}_subnet_id" {
  description = "ID of subnet ${resourceName}"
  value       = aws_subnet.${name}.id
}
`);
        break;
      case 'aws_lb':
        lines.push(`output "${name}_lb_dns" {
  description = "DNS name of load balancer ${resourceName}"
  value       = aws_lb.${name}.dns_name
}

output "${name}_lb_arn" {
  description = "ARN of load balancer ${resourceName}"
  value       = aws_lb.${name}.arn
}
`);
        break;
      case 'aws_rds_instance':
        lines.push(`output "${name}_db_endpoint" {
  description = "Endpoint of RDS instance ${resourceName}"
  value       = aws_db_instance.${name}.endpoint
}

output "${name}_db_port" {
  description = "Port of RDS instance ${resourceName}"
  value       = aws_db_instance.${name}.port
}
`);
        break;
      case 'aws_s3_bucket':
        lines.push(`output "${name}_bucket_name" {
  description = "Name of S3 bucket ${resourceName}"
  value       = aws_s3_bucket.${name}.bucket
}

output "${name}_bucket_arn" {
  description = "ARN of S3 bucket ${resourceName}"
  value       = aws_s3_bucket.${name}.arn
}
`);
        break;
      case 'aws_lambda_function':
        lines.push(`output "${name}_lambda_arn" {
  description = "ARN of Lambda function ${resourceName}"
  value       = aws_lambda_function.${name}.arn
}

output "${name}_lambda_invoke_arn" {
  description = "Invoke ARN of Lambda function ${resourceName}"
  value       = aws_lambda_function.${name}.invoke_arn
}
`);
        break;
      case 'aws_iam_role':
        lines.push(`output "${name}_role_arn" {
  description = "ARN of IAM role ${resourceName}"
  value       = aws_iam_role.${name}.arn
}
`);
        break;
      case 'aws_eks_cluster':
        lines.push(`output "${name}_cluster_endpoint" {
  description = "Endpoint of EKS cluster ${resourceName}"
  value       = aws_eks_cluster.${name}.endpoint
}

output "${name}_cluster_name" {
  description = "Name of EKS cluster ${resourceName}"
  value       = aws_eks_cluster.${name}.name
}
`);
        break;
      case 'aws_ecr_repository':
        lines.push(`output "${name}_ecr_url" {
  description = "URL of ECR repository ${resourceName}"
  value       = aws_ecr_repository.${name}.repository_url
}
`);
        break;
      case 'aws_api_gateway_rest_api':
        lines.push(`output "${name}_api_id" {
  description = "ID of API Gateway ${resourceName}"
  value       = aws_api_gateway_rest_api.${name}.id
}
`);
        break;
      case 'aws_cloudfront_distribution':
        lines.push(`output "${name}_cf_domain" {
  description = "Domain name of CloudFront distribution ${resourceName}"
  value       = aws_cloudfront_distribution.${name}.domain_name
}
`);
        break;
    }
  }

  return lines.join('\n');
}

// ── terraform.tfvars ─────────────────────────────────────────────────────────
function genTfvars(nodes: Node<ResourceNodeData>[], region: string): string {
  const lines: string[] = [];
  lines.push(`# Terraform variable values
# Copy this file to terraform.tfvars.local for local overrides

aws_region   = "${region}"
aws_profile  = "default"
environment  = "dev"
project_name = "my-project"
`);

  const seen = new Set<string>();
  for (const node of nodes) {
    const { resourceType, resourceName, config } = node.data;
    const safeName = resourceName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    if (resourceType === 'aws_instance' && config.ami && !seen.has('ami_id')) {
      seen.add('ami_id');
      lines.push(`ami_id = "${config.ami}"`);
    }
    if ((resourceType === 'aws_rds_instance' || resourceType === 'aws_rds_cluster') && !seen.has(`${safeName}_db_password`)) {
      seen.add(`${safeName}_db_password`);
      lines.push(`${safeName}_db_password = "${config.password || config.master_password || 'CHANGE_ME'}"`);
    }
    if (resourceType === 'aws_s3_bucket' && config.bucket && !seen.has(`${safeName}_bucket_name`)) {
      seen.add(`${safeName}_bucket_name`);
      lines.push(`${safeName}_bucket_name = "${config.bucket}"`);
    }
    if (resourceType === 'aws_vpc' && config.cidr_block && !seen.has(`${safeName}_cidr`)) {
      seen.add(`${safeName}_cidr`);
      lines.push(`${safeName}_cidr = "${config.cidr_block}"`);
    }
  }

  return lines.join('\n') + '\n';
}

// ── README.md ─────────────────────────────────────────────────────────────────
function genReadme(nodes: Node<ResourceNodeData>[], region: string): string {
  const resourceList = nodes.map(n =>
    `- **${n.data.definition.label}** (\`${n.data.resourceName}\`) — ${n.data.definition.description}`
  ).join('\n');

  return `# Terraform Infrastructure

> Generated by InfraStudio

## Architecture Overview

This Terraform project provisions the following AWS resources in **${region}**:

${resourceList}

## Prerequisites

- [Terraform](https://www.terraform.io/downloads) >= 1.5.0
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate credentials
- AWS account with required permissions

## Quick Start

\`\`\`bash
# 1. Initialize Terraform
terraform init

# 2. Review the plan
terraform plan -var-file="terraform.tfvars"

# 3. Apply the infrastructure
terraform apply -var-file="terraform.tfvars"

# 4. Destroy when done
terraform destroy -var-file="terraform.tfvars"
\`\`\`

## File Structure

\`\`\`
.
├── main.tf           # Main resource definitions
├── providers.tf      # Provider configuration
├── variables.tf      # Input variable declarations
├── outputs.tf        # Output value declarations
├── terraform.tfvars  # Variable values (customize this)
└── README.md         # This file
\`\`\`

## Variables

| Variable | Description | Default |
|----------|-------------|---------|
| \`aws_region\` | AWS region | \`${region}\` |
| \`aws_profile\` | AWS CLI profile | \`default\` |
| \`environment\` | Environment name | \`dev\` |
| \`project_name\` | Project name for tagging | \`my-project\` |

## Security Notes

- ⚠️ Review all security group rules before applying
- ⚠️ Database passwords in \`terraform.tfvars\` should be changed
- ⚠️ Consider using AWS Secrets Manager for sensitive values
- ✅ All resources are tagged with Environment and Project

## Cost Estimate

Run \`terraform plan\` to see resource details. Use [AWS Cost Calculator](https://calculator.aws/) for accurate estimates.
`;
}

// ── main.tf (resources only, no provider) ────────────────────────────────────
function genMainTf(nodes: Node<ResourceNodeData>[], region: string): string {
  // Generate full terraform, then strip the terraform{} and provider{} blocks
  const full = generateTerraform(nodes, region, 'default');
  const lines = full.split('\n');
  const start = lines.findIndex(l => l.startsWith('resource ') || l.startsWith('# '));
  return lines.slice(start >= 0 ? start : 0).join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────
export function buildTerraformProject(
  nodes: Node<ResourceNodeData>[],
  region: string,
  _profile: string
): TerraformProject {
  return {
    'main.tf': genMainTf(nodes, region),
    'providers.tf': genProviders(region),
    'variables.tf': genVariables(nodes, region),
    'outputs.tf': genOutputs(nodes),
    'terraform.tfvars': genTfvars(nodes, region),
    'README.md': genReadme(nodes, region),
  };
}

export async function downloadAsZip(project: TerraformProject, projectName = 'terraform-project'): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder(projectName)!;

  for (const [filename, content] of Object.entries(project)) {
    folder.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
