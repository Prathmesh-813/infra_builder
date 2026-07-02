import { GraphNode } from '../types/graph';

export function generateGCPHCL(node: GraphNode): string {
  return `# GCP resource: ${node.data.label}`;
}
