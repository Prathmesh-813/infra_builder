// Resolve the resource-definition palette for the builder's current provider,
// so the add-node panel (in the shared Canvas) shows the right resources for
// Terraform (aws/azure/gcp), Ansible, or Crossplane.
import type { ResourceDefinition } from '../types/resources';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { AZURE_DEFINITIONS } from '../data/azureDefinitions';
import { GCP_DEFINITIONS } from '../data/gcpDefinitions';
import { ANSIBLE_DEFINITIONS } from '../data/ansibleDefinitions';
import {
  CROSSPLANE_AWS_DEFINITIONS,
  CROSSPLANE_AZURE_DEFINITIONS,
  CROSSPLANE_GCP_DEFINITIONS,
} from '../data/crossplaneDefinitions';

export function getActiveDefinitions(provider: string, xpCloud: string): ResourceDefinition[] {
  switch (provider) {
    case 'azure': return AZURE_DEFINITIONS as ResourceDefinition[];
    case 'gcp':   return GCP_DEFINITIONS as ResourceDefinition[];
    case 'ansible': return ANSIBLE_DEFINITIONS as ResourceDefinition[];
    case 'crossplane':
      if (xpCloud === 'azure') return CROSSPLANE_AZURE_DEFINITIONS as ResourceDefinition[];
      if (xpCloud === 'gcp')   return CROSSPLANE_GCP_DEFINITIONS as ResourceDefinition[];
      return CROSSPLANE_AWS_DEFINITIONS as ResourceDefinition[];
    default: return RESOURCE_DEFINITIONS; // aws terraform
  }
}
