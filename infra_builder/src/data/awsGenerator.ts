import { GraphNode } from '../types/graph';

export function generateAWSHCL(node: GraphNode): string {
  return `# AWS resource: ${node.data.label}`;
}

export function generateAzureHCL(node: GraphNode): string {
  return `# Azure resource: ${node.data.label}`;
}
