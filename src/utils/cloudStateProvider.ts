import { ParsedResource, parseTFState } from './driftDetector';

export interface CloudCredentials {
  accessKey?: string;
  secretKey?: string;
  region?: string;
  projectId?: string;
  subscriptionId?: string;
  apiKey?: string;
}

export type CloudSource = 'aws' | 'gcp' | 'azure';

async function fetchAWSResources(creds: CloudCredentials): Promise<ParsedResource[]> {
  const resources: ParsedResource[] = [];
  const region = creds.region ?? 'us-east-1';

  const apis: Array<{ service: string; action: string; resourceType: string; nameKey: string; attrs: Record<string, string> }> = [
    { service: 'ec2', action: 'DescribeInstances', resourceType: 'aws_instance', nameKey: 'tag:Name', attrs: { instance_type: 'InstanceType' } },
    { service: 'ec2', action: 'DescribeSecurityGroups', resourceType: 'aws_security_group', nameKey: 'GroupName', attrs: { description: 'Description' } },
    { service: 'ec2', action: 'DescribeVpcs', resourceType: 'aws_vpc', nameKey: 'tag:Name', attrs: { cidr_block: 'CidrBlock' } },
    { service: 'ec2', action: 'DescribeSubnets', resourceType: 'aws_subnet', nameKey: 'tag:Name', attrs: { cidr_block: 'CidrBlock' } },
    { service: 's3', action: 'ListBuckets', resourceType: 'aws_s3_bucket', nameKey: 'Name', attrs: {} },
  ];

  for (const api of apis) {
    try {
      const url = api.service === 's3'
        ? `https://s3.${region}.amazonaws.com/`
        : `https://${api.service}.${region}.amazonaws.com/`;

      const body = api.service !== 's3' ? `<${api.action}/>` : undefined;
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'X-Amz-Date': new Date().toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z',
          ...(creds.accessKey ? { 'X-Amz-Access-Key-Id': creds.accessKey } : {}),
        },
        body,
      });

      if (!res.ok) continue;

      const data = await res.text();
      const items = extractAWSItems(data, api);
      resources.push(...items);
    } catch {
      // Silently skip failed API calls
    }
  }

  return resources;
}

function extractAWSItems(xml: string, api: { resourceType: string; nameKey: string; attrs: Record<string, string> }): ParsedResource[] {
  const items: ParsedResource[] = [];
  try {
    const matches = xml.matchAll(/<member>([\s\S]*?)<\/member>/g);
    for (const match of matches) {
      const block = match[1];
      const attrs: Record<string, string> = {};

      let name = '';
      const nameMatch = block.match(new RegExp(`<${api.nameKey.replace(':', '')}>([^<]+)<`));
      if (nameMatch) name = nameMatch[1];

      for (const [attrKey, xmlKey] of Object.entries(api.attrs)) {
        const valMatch = block.match(new RegExp(`<${xmlKey}>([^<]+)<`));
        if (valMatch) attrs[attrKey] = valMatch[1];
      }

      if (name) {
        items.push({ type: api.resourceType, name, provider: 'aws', attributes: attrs });
      }
    }
  } catch {
    // Parse error
  }
  return items;
}

async function fetchGCPResources(creds: CloudCredentials): Promise<ParsedResource[]> {
  const resources: ParsedResource[] = [];
  const project = creds.projectId ?? '';

  if (!project || !creds.apiKey) return resources;

  const apis: Array<{ url: string; resourceType: string; itemsKey: string; nameKey: string; attrs: Record<string, string> }> = [
    {
      url: `https://compute.googleapis.com/compute/v1/projects/${project}/zones/us-central1-a/instances?key=${creds.apiKey}`,
      resourceType: 'google_compute_instance',
      itemsKey: 'items',
      nameKey: 'name',
      attrs: { machine_type: 'machineType' },
    },
    {
      url: `https://storage.googleapis.com/storage/v1/b?project=${project}&key=${creds.apiKey}`,
      resourceType: 'google_storage_bucket',
      itemsKey: 'items',
      nameKey: 'name',
      attrs: { location: 'location', storage_class: 'storageClass' },
    },
    {
      url: `https://container.googleapis.com/v1/projects/${project}/locations/us-central1/clusters?key=${creds.apiKey}`,
      resourceType: 'google_container_cluster',
      itemsKey: 'clusters',
      nameKey: 'name',
      attrs: { location: 'location', initial_node_count: 'initialNodeCount' },
    },
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api.url);
      if (!res.ok) continue;
      const data = await res.json();
      const items = data[api.itemsKey] ?? [];
      for (const item of items) {
        const attrs: Record<string, string> = {};
        const name = String(item[api.nameKey] ?? '');
        for (const [attrKey, jsonKey] of Object.entries(api.attrs)) {
          const val = item[jsonKey];
          if (val !== undefined) attrs[attrKey] = String(val);
        }
        if (name) resources.push({ type: api.resourceType, name, provider: 'gcp', attributes: attrs });
      }
    } catch {
      // skip
    }
  }

  return resources;
}

async function fetchAzureResources(creds: CloudCredentials): Promise<ParsedResource[]> {
  const resources: ParsedResource[] = [];
  const subId = creds.subscriptionId ?? '';
  const apiKey = creds.apiKey ?? '';

  if (!subId || !apiKey) return resources;

  const apis: Array<{ url: string; resourceType: string; itemsKey: string; nameKey: string; attrs: Record<string, string> }> = [
    {
      url: `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Compute/virtualMachines?api-version=2023-03-01`,
      resourceType: 'azurerm_linux_virtual_machine',
      itemsKey: 'value',
      nameKey: 'name',
      attrs: { location: 'location', vm_size: 'properties.hardwareProfile.vmSize' },
    },
    {
      url: `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`,
      resourceType: 'azurerm_storage_account',
      itemsKey: 'value',
      nameKey: 'name',
      attrs: { location: 'location', account_tier: 'sku.tier' },
    },
    {
      url: `https://management.azure.com/subscriptions/${subId}/providers/Microsoft.ContainerService/managedClusters?api-version=2023-08-01`,
      resourceType: 'azurerm_kubernetes_cluster',
      itemsKey: 'value',
      nameKey: 'name',
      attrs: { location: 'location' },
    },
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api.url, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data[api.itemsKey] ?? [];
      for (const item of items) {
        const attrs: Record<string, string> = {};
        const name = String(item[api.nameKey] ?? '');
        for (const [attrKey, jsonPath] of Object.entries(api.attrs)) {
          const parts = jsonPath.split('.');
          let val: unknown = item;
          for (const p of parts) {
            if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
            else { val = undefined; break; }
          }
          if (val !== undefined) attrs[attrKey] = String(val);
        }
        if (name) resources.push({ type: api.resourceType, name, provider: 'azure', attributes: attrs });
      }
    } catch {
      // skip
    }
  }

  return resources;
}

export async function fetchCloudState(source: CloudSource, creds: CloudCredentials): Promise<ParsedResource[]> {
  switch (source) {
    case 'aws':
      return fetchAWSResources(creds);
    case 'gcp':
      return fetchGCPResources(creds);
    case 'azure':
      return fetchAzureResources(creds);
    default:
      return [];
  }
}

export function parseTFStateFile(content: string): ParsedResource[] {
  return parseTFState(content);
}
