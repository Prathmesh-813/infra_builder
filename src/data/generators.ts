import { GraphNode } from '../types/graph';
import { generateAWSHCL } from './awsGenerator';
import { generateGCPHCL } from './gcpGenerator';
import { generateMonitoringHCL } from './monitoringGenerator';

export function generateHCL(nodes: GraphNode[]): string {
  const lines: string[] = [];
  const terraformBlock = `terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "google" {
  project = "my-project"
  region  = "us-central1"
}`;

  lines.push(terraformBlock);
  lines.push('');

  for (const node of nodes) {
    const type = node.data.type as string;
    try {
      if (type.startsWith('aws_')) {
        lines.push(generateAWSHCL(node));
      } else if (type.startsWith('gcp_') || type.startsWith('google_')) {
        lines.push(generateGCPHCL(node));
      } else if (type.startsWith('mon_')) {
        lines.push(generateMonitoringHCL(node));
      } else {
        lines.push(`# Unknown resource type: ${type}`);
      }
      lines.push('');
    } catch (e) {
      lines.push(`# Error generating HCL for ${node.data.label}: ${e}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
