export type ComparisonProvider = 'aws' | 'azure' | 'gcp' | 'onprem';

export interface ProviderConfigField {
  key: string;
  label: string;
  type: 'select' | 'number' | 'text' | 'boolean';
  default?: string | number | boolean;
  options?: string[];
  // For select with rich metadata
  instanceOptions?: InstanceOption[];
}

export interface InstanceOption {
  value: string;
  label: string;      // display name  e.g. "t3.micro"
  vcpu: number;
  memory: number;     // GB
  price: number;      // $/mo on-demand
  category?: string;  // "General", "Compute", "Memory" etc.
}

export interface ProviderPricing {
  provider: ComparisonProvider;
  providerLabel: string;
  serviceLabel: string;
  icon: string;
  color: string;
  fields: ProviderConfigField[];
  estimate: (config: Record<string, string | number | boolean>) => { min: number; max: number; basis: string };
}

export interface ComparisonService {
  id: string;
  category: string;
  serviceName: string;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
  providers: ProviderPricing[];
}

export interface ComparisonCategory {
  id: string;
  name: string;
  icon: string;
}

export const COMPARISON_CATEGORIES: ComparisonCategory[] = [
  { id: 'compute',    name: 'Compute',    icon: '🖥️' },
  { id: 'storage',    name: 'Storage',    icon: '💾' },
  { id: 'database',   name: 'Database',   icon: '🗄️' },
  { id: 'serverless', name: 'Serverless', icon: '⚡' },
  { id: 'kubernetes', name: 'Kubernetes', icon: '☸️' },
  { id: 'networking', name: 'Networking', icon: '🌐' },
  { id: 'cdn',        name: 'CDN',        icon: '🚀' },
  { id: 'messaging',  name: 'Messaging',  icon: '📨' },
  { id: 'ai',         name: 'AI / ML',    icon: '🤖' },
  { id: 'analytics',  name: 'Analytics',  icon: '📈' },
  { id: 'security',   name: 'Security',   icon: '🔒' },
  { id: 'devops',     name: 'DevOps',     icon: '🔧' },
  { id: 'monitoring', name: 'Monitoring', icon: '📊' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Real instance type catalogs
// ─────────────────────────────────────────────────────────────────────────────

export const AWS_EC2_INSTANCES: InstanceOption[] = [
  // Burstable
  { value: 't2.micro',    label: 't2.micro',    vcpu: 1,  memory: 1,    price: 8.5,   category: 'Burstable' },
  { value: 't2.small',    label: 't2.small',    vcpu: 1,  memory: 2,    price: 17,    category: 'Burstable' },
  { value: 't2.medium',   label: 't2.medium',   vcpu: 2,  memory: 4,    price: 34,    category: 'Burstable' },
  { value: 't2.large',    label: 't2.large',    vcpu: 2,  memory: 8,    price: 67,    category: 'Burstable' },
  { value: 't3.micro',    label: 't3.micro',    vcpu: 2,  memory: 1,    price: 7.6,   category: 'Burstable' },
  { value: 't3.small',    label: 't3.small',    vcpu: 2,  memory: 2,    price: 15,    category: 'Burstable' },
  { value: 't3.medium',   label: 't3.medium',   vcpu: 2,  memory: 4,    price: 30,    category: 'Burstable' },
  { value: 't3.large',    label: 't3.large',    vcpu: 2,  memory: 8,    price: 60,    category: 'Burstable' },
  { value: 't3.xlarge',   label: 't3.xlarge',   vcpu: 4,  memory: 16,   price: 120,   category: 'Burstable' },
  { value: 't3.2xlarge',  label: 't3.2xlarge',  vcpu: 8,  memory: 32,   price: 240,   category: 'Burstable' },
  // General Purpose
  { value: 'm5.large',    label: 'm5.large',    vcpu: 2,  memory: 8,    price: 70,    category: 'General' },
  { value: 'm5.xlarge',   label: 'm5.xlarge',   vcpu: 4,  memory: 16,   price: 140,   category: 'General' },
  { value: 'm5.2xlarge',  label: 'm5.2xlarge',  vcpu: 8,  memory: 32,   price: 280,   category: 'General' },
  { value: 'm5.4xlarge',  label: 'm5.4xlarge',  vcpu: 16, memory: 64,   price: 560,   category: 'General' },
  { value: 'm6i.large',   label: 'm6i.large',   vcpu: 2,  memory: 8,    price: 73,    category: 'General' },
  { value: 'm6i.xlarge',  label: 'm6i.xlarge',  vcpu: 4,  memory: 16,   price: 146,   category: 'General' },
  { value: 'm6i.2xlarge', label: 'm6i.2xlarge', vcpu: 8,  memory: 32,   price: 292,   category: 'General' },
  // Compute Optimized
  { value: 'c5.large',    label: 'c5.large',    vcpu: 2,  memory: 4,    price: 62,    category: 'Compute' },
  { value: 'c5.xlarge',   label: 'c5.xlarge',   vcpu: 4,  memory: 8,    price: 124,   category: 'Compute' },
  { value: 'c5.2xlarge',  label: 'c5.2xlarge',  vcpu: 8,  memory: 16,   price: 248,   category: 'Compute' },
  { value: 'c6i.large',   label: 'c6i.large',   vcpu: 2,  memory: 4,    price: 62,    category: 'Compute' },
  { value: 'c6i.xlarge',  label: 'c6i.xlarge',  vcpu: 4,  memory: 8,    price: 124,   category: 'Compute' },
  // Memory Optimized
  { value: 'r5.large',    label: 'r5.large',    vcpu: 2,  memory: 16,   price: 91,    category: 'Memory' },
  { value: 'r5.xlarge',   label: 'r5.xlarge',   vcpu: 4,  memory: 32,   price: 182,   category: 'Memory' },
  { value: 'r5.2xlarge',  label: 'r5.2xlarge',  vcpu: 8,  memory: 64,   price: 364,   category: 'Memory' },
  { value: 'r6i.large',   label: 'r6i.large',   vcpu: 2,  memory: 16,   price: 95,    category: 'Memory' },
  { value: 'r6i.xlarge',  label: 'r6i.xlarge',  vcpu: 4,  memory: 32,   price: 190,   category: 'Memory' },
];

export const AZURE_VM_INSTANCES: InstanceOption[] = [
  // B-series (Burstable)
  { value: 'Standard_B1s',   label: 'B1s',    vcpu: 1,  memory: 1,    price: 7.6,   category: 'Burstable' },
  { value: 'Standard_B1ms',  label: 'B1ms',   vcpu: 1,  memory: 2,    price: 15,    category: 'Burstable' },
  { value: 'Standard_B2s',   label: 'B2s',    vcpu: 2,  memory: 4,    price: 30,    category: 'Burstable' },
  { value: 'Standard_B2ms',  label: 'B2ms',   vcpu: 2,  memory: 8,    price: 60,    category: 'Burstable' },
  { value: 'Standard_B4ms',  label: 'B4ms',   vcpu: 4,  memory: 16,   price: 120,   category: 'Burstable' },
  { value: 'Standard_B8ms',  label: 'B8ms',   vcpu: 8,  memory: 32,   price: 240,   category: 'Burstable' },
  // D-series (General Purpose)
  { value: 'Standard_D2s_v3',  label: 'D2s v3',   vcpu: 2,  memory: 8,    price: 69,    category: 'General' },
  { value: 'Standard_D4s_v3',  label: 'D4s v3',   vcpu: 4,  memory: 16,   price: 138,   category: 'General' },
  { value: 'Standard_D8s_v3',  label: 'D8s v3',   vcpu: 8,  memory: 32,   price: 276,   category: 'General' },
  { value: 'Standard_D2s_v5',  label: 'D2s v5',   vcpu: 2,  memory: 8,    price: 67,    category: 'General' },
  { value: 'Standard_D4s_v5',  label: 'D4s v5',   vcpu: 4,  memory: 16,   price: 134,   category: 'General' },
  { value: 'Standard_D8s_v5',  label: 'D8s v5',   vcpu: 8,  memory: 32,   price: 268,   category: 'General' },
  // F-series (Compute)
  { value: 'Standard_F2s_v2',  label: 'F2s v2',   vcpu: 2,  memory: 4,    price: 61,    category: 'Compute' },
  { value: 'Standard_F4s_v2',  label: 'F4s v2',   vcpu: 4,  memory: 8,    price: 122,   category: 'Compute' },
  { value: 'Standard_F8s_v2',  label: 'F8s v2',   vcpu: 8,  memory: 16,   price: 244,   category: 'Compute' },
  // E-series (Memory)
  { value: 'Standard_E2s_v3',  label: 'E2s v3',   vcpu: 2,  memory: 16,   price: 100,   category: 'Memory' },
  { value: 'Standard_E4s_v3',  label: 'E4s v3',   vcpu: 4,  memory: 32,   price: 200,   category: 'Memory' },
  { value: 'Standard_E8s_v3',  label: 'E8s v3',   vcpu: 8,  memory: 64,   price: 400,   category: 'Memory' },
];

export const GCP_VM_INSTANCES: InstanceOption[] = [
  // E2 (Cost-optimized)
  { value: 'e2-micro',       label: 'e2-micro',      vcpu: 2,  memory: 1,    price: 6.1,   category: 'Shared' },
  { value: 'e2-small',       label: 'e2-small',      vcpu: 2,  memory: 2,    price: 12,    category: 'Shared' },
  { value: 'e2-medium',      label: 'e2-medium',     vcpu: 2,  memory: 4,    price: 24,    category: 'Shared' },
  { value: 'e2-standard-2',  label: 'e2-standard-2', vcpu: 2,  memory: 8,    price: 48,    category: 'Standard' },
  { value: 'e2-standard-4',  label: 'e2-standard-4', vcpu: 4,  memory: 16,   price: 97,    category: 'Standard' },
  { value: 'e2-standard-8',  label: 'e2-standard-8', vcpu: 8,  memory: 32,   price: 194,   category: 'Standard' },
  // N2 (General Purpose)
  { value: 'n2-standard-2',  label: 'n2-standard-2', vcpu: 2,  memory: 8,    price: 58,    category: 'General' },
  { value: 'n2-standard-4',  label: 'n2-standard-4', vcpu: 4,  memory: 16,   price: 116,   category: 'General' },
  { value: 'n2-standard-8',  label: 'n2-standard-8', vcpu: 8,  memory: 32,   price: 232,   category: 'General' },
  // C2 (Compute)
  { value: 'c2-standard-4',  label: 'c2-standard-4', vcpu: 4,  memory: 16,   price: 147,   category: 'Compute' },
  { value: 'c2-standard-8',  label: 'c2-standard-8', vcpu: 8,  memory: 32,   price: 295,   category: 'Compute' },
  // M2 (Memory)
  { value: 'n2-highmem-2',   label: 'n2-highmem-2',  vcpu: 2,  memory: 16,   price: 75,    category: 'Memory' },
  { value: 'n2-highmem-4',   label: 'n2-highmem-4',  vcpu: 4,  memory: 32,   price: 150,   category: 'Memory' },
  { value: 'n2-highmem-8',   label: 'n2-highmem-8',  vcpu: 8,  memory: 64,   price: 300,   category: 'Memory' },
];

// Helper: get instance option by value
export function getInstanceOption(list: InstanceOption[], value: string): InstanceOption | undefined {
  return list.find(i => i.value === value);
}

export const COMPARISON_SERVICES: ComparisonService[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTE — Virtual Machine
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'virtual-machine',
    category: 'compute',
    serviceName: 'Virtual Machine',
    icon: '🖥️',
    color: 'text-orange-400',
    bgColor: 'bg-orange-950',
    description: 'Compare VM / EC2 / Compute Engine costs with real instance types',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'EC2 Instance',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          {
            key: 'instance_type',
            label: 'Instance Type',
            type: 'select',
            default: 't3.medium',
            options: AWS_EC2_INSTANCES.map(i => i.value),
            instanceOptions: AWS_EC2_INSTANCES,
          },
          { key: 'storage_gb', label: 'EBS Storage (GB)', type: 'number', default: 50 },
          { key: 'os', label: 'OS', type: 'select', default: 'linux', options: ['linux', 'windows'] },
          { key: 'reserved', label: 'Reserved (1yr)', type: 'boolean', default: false },
        ],
        estimate: (cfg) => {
          const inst = getInstanceOption(AWS_EC2_INSTANCES, String(cfg.instance_type || 't3.medium'));
          const base = inst ? inst.price : 30;
          const isWindows = String(cfg.os || 'linux') === 'windows';
          const isReserved = !!cfg.reserved;
          const storage = Number(cfg.storage_gb || 50);
          const computeCost = base * (isWindows ? 1.4 : 1) * (isReserved ? 0.62 : 1);
          const storageCost = storage * 0.08;
          const vcpu = inst?.vcpu ?? 2;
          const mem = inst?.memory ?? 4;
          return {
            min: computeCost + storageCost,
            max: computeCost + storageCost + (isWindows ? 5 : 2),
            basis: `${inst?.label ?? cfg.instance_type} (${vcpu} vCPU, ${mem}GB RAM)${isWindows ? ' Windows' : ''}${isReserved ? ' [Reserved -38%]' : ''} + ${storage}GB EBS`,
          };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Virtual Machine',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          {
            key: 'vm_size',
            label: 'VM Size',
            type: 'select',
            default: 'Standard_B2s',
            options: AZURE_VM_INSTANCES.map(i => i.value),
            instanceOptions: AZURE_VM_INSTANCES,
          },
          { key: 'storage_gb', label: 'Managed Disk (GB)', type: 'number', default: 50 },
          { key: 'os', label: 'OS', type: 'select', default: 'linux', options: ['linux', 'windows'] },
          { key: 'reserved', label: 'Reserved (1yr)', type: 'boolean', default: false },
        ],
        estimate: (cfg) => {
          const inst = getInstanceOption(AZURE_VM_INSTANCES, String(cfg.vm_size || 'Standard_B2s'));
          const base = inst ? inst.price : 30;
          const isWindows = String(cfg.os || 'linux') === 'windows';
          const isReserved = !!cfg.reserved;
          const storage = Number(cfg.storage_gb || 50);
          const computeCost = base * (isWindows ? 1.5 : 1) * (isReserved ? 0.63 : 1);
          const storageCost = storage * 0.095;
          const vcpu = inst?.vcpu ?? 2;
          const mem = inst?.memory ?? 4;
          return {
            min: computeCost + storageCost,
            max: computeCost + storageCost + (isWindows ? 5 : 2),
            basis: `${inst?.label ?? cfg.vm_size} (${vcpu} vCPU, ${mem}GB RAM)${isWindows ? ' Windows' : ''}${isReserved ? ' [Reserved -37%]' : ''} + ${storage}GB disk`,
          };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Compute Engine VM',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          {
            key: 'machine_type',
            label: 'Machine Type',
            type: 'select',
            default: 'e2-medium',
            options: GCP_VM_INSTANCES.map(i => i.value),
            instanceOptions: GCP_VM_INSTANCES,
          },
          { key: 'storage_gb', label: 'Persistent Disk (GB)', type: 'number', default: 50 },
          { key: 'os', label: 'OS', type: 'select', default: 'linux', options: ['linux', 'windows'] },
          { key: 'committed', label: 'Committed Use (1yr)', type: 'boolean', default: false },
        ],
        estimate: (cfg) => {
          const inst = getInstanceOption(GCP_VM_INSTANCES, String(cfg.machine_type || 'e2-medium'));
          const base = inst ? inst.price : 24;
          const isWindows = String(cfg.os || 'linux') === 'windows';
          const isCommitted = !!cfg.committed;
          const storage = Number(cfg.storage_gb || 50);
          const computeCost = base * (isWindows ? 1.3 : 1) * (isCommitted ? 0.63 : 1);
          const storageCost = storage * 0.04;
          const vcpu = inst?.vcpu ?? 2;
          const mem = inst?.memory ?? 4;
          return {
            min: computeCost + storageCost,
            max: computeCost + storageCost + (isWindows ? 4 : 1),
            basis: `${inst?.label ?? cfg.machine_type} (${vcpu} vCPU, ${mem}GB RAM)${isWindows ? ' Windows' : ''}${isCommitted ? ' [CUD -37%]' : ''} + ${storage}GB pd-balanced`,
          };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Physical / Virtual Server',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'vcpu', label: 'vCPUs', type: 'number', default: 2 },
          { key: 'memory_gb', label: 'RAM (GB)', type: 'number', default: 4 },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 500 },
          { key: 'power_w', label: 'Power Draw (W)', type: 'number', default: 150 },
          { key: 'amortized_hardware', label: 'Hardware Amort. ($/mo)', type: 'number', default: 50 },
          { key: 'include_labor', label: 'Include IT Labor', type: 'boolean', default: true },
        ],
        estimate: (cfg) => {
          const power = Number(cfg.power_w || 150);
          const amortized = Number(cfg.amortized_hardware || 50);
          const powerCost = (power * 24 * 30 / 1000) * 0.12;
          const maintenance = 15;
          const labor = cfg.include_labor ? 60 : 0;
          const total = amortized + powerCost + maintenance + labor;
          return {
            min: total,
            max: total + 20,
            basis: `${cfg.vcpu || 2} vCPU, ${cfg.memory_gb || 4}GB RAM · Power: $${powerCost.toFixed(0)}/mo · HW: $${amortized}/mo${labor ? ' · Labor: $60/mo' : ''}`,
          };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTE — Managed Kubernetes
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'managed-kubernetes',
    category: 'kubernetes',
    serviceName: 'Managed Kubernetes',
    icon: '☸️',
    color: 'text-blue-400',
    bgColor: 'bg-blue-950',
    description: 'EKS vs AKS vs GKE vs self-hosted cluster costs',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'EKS',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'node_count', label: 'Node Count', type: 'number', default: 3 },
          {
            key: 'node_instance',
            label: 'Node Instance Type',
            type: 'select',
            default: 't3.medium',
            options: ['t3.medium','t3.large','m5.large','m5.xlarge','c5.large','c5.xlarge'],
            instanceOptions: AWS_EC2_INSTANCES.filter(i => ['t3.medium','t3.large','m5.large','m5.xlarge','c5.large','c5.xlarge'].includes(i.value)),
          },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.node_count || 3);
          const inst = getInstanceOption(AWS_EC2_INSTANCES, String(cfg.node_instance || 't3.medium'));
          const nodeCost = (inst?.price ?? 30) * nodes;
          const clusterFee = 73;
          const total = clusterFee + nodeCost;
          return { min: total, max: total + nodes * 5, basis: `$73 cluster fee + ${nodes}x ${inst?.label ?? cfg.node_instance} (${inst?.vcpu ?? 2} vCPU, ${inst?.memory ?? 4}GB)` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'AKS',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'node_count', label: 'Node Count', type: 'number', default: 3 },
          {
            key: 'node_vm',
            label: 'Node VM Size',
            type: 'select',
            default: 'Standard_D2s_v3',
            options: ['Standard_B2s','Standard_D2s_v3','Standard_D4s_v3','Standard_F2s_v2','Standard_F4s_v2'],
            instanceOptions: AZURE_VM_INSTANCES.filter(i => ['Standard_B2s','Standard_D2s_v3','Standard_D4s_v3','Standard_F2s_v2','Standard_F4s_v2'].includes(i.value)),
          },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.node_count || 3);
          const inst = getInstanceOption(AZURE_VM_INSTANCES, String(cfg.node_vm || 'Standard_D2s_v3'));
          const nodeCost = (inst?.price ?? 69) * nodes;
          return { min: nodeCost, max: nodeCost + nodes * 5, basis: `Free control plane + ${nodes}x ${inst?.label ?? cfg.node_vm} (${inst?.vcpu ?? 2} vCPU, ${inst?.memory ?? 8}GB)` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'GKE',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'node_count', label: 'Node Count', type: 'number', default: 3 },
          {
            key: 'node_machine',
            label: 'Node Machine Type',
            type: 'select',
            default: 'e2-standard-2',
            options: ['e2-medium','e2-standard-2','e2-standard-4','n2-standard-2','n2-standard-4'],
            instanceOptions: GCP_VM_INSTANCES.filter(i => ['e2-medium','e2-standard-2','e2-standard-4','n2-standard-2','n2-standard-4'].includes(i.value)),
          },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.node_count || 3);
          const inst = getInstanceOption(GCP_VM_INSTANCES, String(cfg.node_machine || 'e2-standard-2'));
          const nodeCost = (inst?.price ?? 48) * nodes;
          return { min: nodeCost, max: nodeCost + nodes * 4, basis: `Free control plane + ${nodes}x ${inst?.label ?? cfg.node_machine} (${inst?.vcpu ?? 2} vCPU, ${inst?.memory ?? 8}GB)` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Self-Hosted K8s',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'node_count', label: 'Node Count', type: 'number', default: 3 },
          { key: 'amortized_per_node', label: 'Hardware/Node ($/mo)', type: 'number', default: 50 },
          { key: 'include_labor', label: 'Include Admin Labor', type: 'boolean', default: true },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.node_count || 3);
          const perNode = Number(cfg.amortized_per_node || 50);
          const nodeCost = perNode * nodes;
          const powerCost = (200 * 24 * 30 / 1000) * 0.12 * nodes;
          const labor = cfg.include_labor ? 200 : 0;
          const total = nodeCost + powerCost + labor;
          return { min: total, max: total + 80, basis: `${nodes} nodes @ $${perNode}/mo + Power $${powerCost.toFixed(0)}/mo${labor ? ' + Admin labor $200/mo' : ''}` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE — Object Storage
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'object-storage',
    category: 'storage',
    serviceName: 'Object Storage',
    icon: '🪣',
    color: 'text-green-400',
    bgColor: 'bg-green-950',
    description: 'S3 vs Azure Blob vs GCS vs on-prem NAS',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'S3 Standard',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 1000 },
          { key: 'requests_m', label: 'Monthly Requests (M)', type: 'number', default: 1 },
          { key: 'transfer_gb', label: 'Data Transfer Out (GB)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 1000), r = Number(cfg.requests_m || 1), t = Number(cfg.transfer_gb || 100);
          const cost = s * 0.023 + r * 0.005 + t * 0.09;
          return { min: cost, max: cost + 5, basis: `${s}GB @ $0.023/GB + ${r}M req + ${t}GB transfer` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Blob Storage (Hot)',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 1000 },
          { key: 'requests_m', label: 'Monthly Requests (M)', type: 'number', default: 1 },
          { key: 'transfer_gb', label: 'Data Transfer Out (GB)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 1000), r = Number(cfg.requests_m || 1), t = Number(cfg.transfer_gb || 100);
          const cost = s * 0.018 + r * 0.004 + t * 0.087;
          return { min: cost, max: cost + 5, basis: `${s}GB @ $0.018/GB + ${r}M req + ${t}GB transfer` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud Storage Standard',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 1000 },
          { key: 'requests_m', label: 'Monthly Requests (M)', type: 'number', default: 1 },
          { key: 'transfer_gb', label: 'Data Transfer Out (GB)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 1000), r = Number(cfg.requests_m || 1), t = Number(cfg.transfer_gb || 100);
          const cost = s * 0.02 + r * 0.005 + t * 0.085;
          return { min: cost, max: cost + 5, basis: `${s}GB @ $0.020/GB + ${r}M req + ${t}GB transfer` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'NAS / SAN Storage',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'storage_gb', label: 'Raw Storage (GB)', type: 'number', default: 1000 },
          { key: 'amortized_hardware', label: 'Hardware ($/mo)', type: 'number', default: 80 },
          { key: 'backup_gb', label: 'Backup (GB)', type: 'number', default: 500 },
        ],
        estimate: (cfg) => {
          const amortized = Number(cfg.amortized_hardware || 80);
          const backupCost = Number(cfg.backup_gb || 500) * 0.01;
          const powerCost = (150 * 24 * 30 / 1000) * 0.12;
          const total = amortized + powerCost + backupCost + 30;
          return { min: total - 10, max: total + 20, basis: `HW: $${amortized}/mo · Power: $${powerCost.toFixed(0)}/mo · Backup: $${backupCost.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE — Managed Relational DB
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'managed-database',
    category: 'database',
    serviceName: 'Managed Relational DB',
    icon: '🗄️',
    color: 'text-purple-400',
    bgColor: 'bg-purple-950',
    description: 'RDS vs Azure SQL vs Cloud SQL vs self-hosted database',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'RDS Instance',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'instance_class', label: 'Instance Class', type: 'select', default: 'db.t3.medium', options: ['db.t3.micro','db.t3.small','db.t3.medium','db.t3.large','db.m5.large','db.m5.xlarge','db.r5.large','db.r5.xlarge'] },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 100 },
          { key: 'engine', label: 'Engine', type: 'select', default: 'mysql', options: ['mysql','postgres','mariadb','oracle','sqlserver'] },
          { key: 'multi_az', label: 'Multi-AZ', type: 'boolean', default: false },
        ],
        estimate: (cfg) => {
          const prices: Record<string, number> = { 'db.t3.micro': 15, 'db.t3.small': 30, 'db.t3.medium': 60, 'db.t3.large': 120, 'db.m5.large': 138, 'db.m5.xlarge': 276, 'db.r5.large': 175, 'db.r5.xlarge': 350 };
          const ic = String(cfg.instance_class || 'db.t3.medium');
          const base = (prices[ic] || 60) * (cfg.multi_az ? 2 : 1);
          const storageCost = Number(cfg.storage_gb || 100) * 0.115;
          return { min: base + storageCost, max: base + storageCost + 15, basis: `${ic}${cfg.multi_az ? ' Multi-AZ' : ''} · ${cfg.engine || 'mysql'} + ${cfg.storage_gb || 100}GB` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Azure SQL / PostgreSQL',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'tier', label: 'Compute Tier', type: 'select', default: 'General_Purpose_2vCores', options: ['Burstable_1vCore','Burstable_2vCores','General_Purpose_2vCores','General_Purpose_4vCores','General_Purpose_8vCores','Business_Critical_4vCores'] },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 100 },
          { key: 'engine', label: 'Engine', type: 'select', default: 'postgresql', options: ['postgresql','mysql','mssql'] },
        ],
        estimate: (cfg) => {
          const prices: Record<string, number> = { Burstable_1vCore: 12, Burstable_2vCores: 25, General_Purpose_2vCores: 70, General_Purpose_4vCores: 140, General_Purpose_8vCores: 280, Business_Critical_4vCores: 400 };
          const base = prices[String(cfg.tier || 'General_Purpose_2vCores')] || 70;
          const storageCost = Number(cfg.storage_gb || 100) * 0.115;
          return { min: base + storageCost, max: base + storageCost + 12, basis: `${cfg.tier || 'General_Purpose_2vCores'} · ${cfg.engine || 'postgresql'} + ${cfg.storage_gb || 100}GB` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud SQL',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'tier', label: 'Machine Type', type: 'select', default: 'db-custom-2-7680', options: ['db-f1-micro','db-g1-small','db-custom-1-3840','db-custom-2-7680','db-custom-4-15360','db-custom-8-30720','db-n1-highmem-2','db-n1-highmem-4'] },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 100 },
          { key: 'engine', label: 'Engine', type: 'select', default: 'postgres', options: ['mysql','postgres','sqlserver'] },
          { key: 'ha', label: 'High Availability', type: 'boolean', default: false },
        ],
        estimate: (cfg) => {
          const prices: Record<string, number> = { 'db-f1-micro': 10, 'db-g1-small': 25, 'db-custom-1-3840': 50, 'db-custom-2-7680': 95, 'db-custom-4-15360': 190, 'db-custom-8-30720': 380, 'db-n1-highmem-2': 120, 'db-n1-highmem-4': 240 };
          const base = (prices[String(cfg.tier || 'db-custom-2-7680')] || 95) * (cfg.ha ? 2 : 1);
          const storageCost = Number(cfg.storage_gb || 100) * 0.17;
          return { min: base + storageCost, max: base + storageCost + 10, basis: `${cfg.tier || 'db-custom-2-7680'}${cfg.ha ? ' HA' : ''} · ${cfg.engine || 'postgres'} + ${cfg.storage_gb || 100}GB` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Self-Hosted Database',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'vcpu', label: 'vCPUs', type: 'number', default: 4 },
          { key: 'memory_gb', label: 'RAM (GB)', type: 'number', default: 16 },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 500 },
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 100 },
          { key: 'license_cost', label: 'DB License ($/mo)', type: 'number', default: 0 },
        ],
        estimate: (cfg) => {
          const amortized = Number(cfg.amortized_hardware || 100);
          const license = Number(cfg.license_cost || 0);
          const powerCost = (250 * 24 * 30 / 1000) * 0.12;
          const dbaLabor = 150;
          const total = amortized + license + powerCost + dbaLabor;
          return { min: total - 20, max: total + 40, basis: `${cfg.vcpu || 4} vCPU, ${cfg.memory_gb || 16}GB · Server: $${amortized}/mo · DBA labor: $${dbaLabor}/mo${license ? ` · License: $${license}/mo` : ''}` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SERVERLESS — Functions
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'serverless-functions',
    category: 'serverless',
    serviceName: 'Serverless Functions',
    icon: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950',
    description: 'Lambda vs Azure Functions vs Cloud Functions vs self-hosted',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'Lambda',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'invocations_m', label: 'Monthly Invocations (M)', type: 'number', default: 1 },
          { key: 'memory_mb', label: 'Memory (MB)', type: 'select', default: '512', options: ['128','256','512','1024','2048','3008'] },
          { key: 'avg_duration_ms', label: 'Avg Duration (ms)', type: 'number', default: 200 },
        ],
        estimate: (cfg) => {
          const inv = Number(cfg.invocations_m || 1) * 1e6;
          const mem = Number(cfg.memory_mb || 512);
          const dur = Number(cfg.avg_duration_ms || 200);
          const gbSec = inv * (mem / 1024) * (dur / 1000);
          const chargeable = Math.max(0, gbSec - 400000);
          const reqCharge = Math.max(0, inv - 1e6) * 0.0000002;
          const total = chargeable * 0.0000166667 + reqCharge;
          return { min: Math.max(0, total), max: total + 1, basis: `${(inv / 1e6).toFixed(1)}M inv · ${mem}MB · ${dur}ms avg` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Azure Functions',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'invocations_m', label: 'Monthly Executions (M)', type: 'number', default: 1 },
          { key: 'memory_mb', label: 'Memory (MB)', type: 'select', default: '512', options: ['128','256','512','1024','2048'] },
          { key: 'avg_duration_ms', label: 'Avg Duration (ms)', type: 'number', default: 200 },
        ],
        estimate: (cfg) => {
          const inv = Number(cfg.invocations_m || 1) * 1e6;
          const mem = Number(cfg.memory_mb || 512);
          const dur = Number(cfg.avg_duration_ms || 200);
          const gbSec = inv * (mem / 1024) * (dur / 1000);
          const chargeable = Math.max(0, gbSec - 400000);
          const reqCharge = Math.max(0, inv - 1e6) * 0.0000002;
          const total = chargeable * 0.000016 + reqCharge;
          return { min: Math.max(0, total), max: total + 1, basis: `${(inv / 1e6).toFixed(1)}M exec · ${mem}MB · ${dur}ms avg` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud Functions',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'invocations_m', label: 'Monthly Invocations (M)', type: 'number', default: 1 },
          { key: 'memory_mb', label: 'Memory (MB)', type: 'select', default: '512', options: ['128','256','512','1024','2048'] },
          { key: 'avg_duration_ms', label: 'Avg Duration (ms)', type: 'number', default: 200 },
        ],
        estimate: (cfg) => {
          const inv = Number(cfg.invocations_m || 1) * 1e6;
          const mem = Number(cfg.memory_mb || 512);
          const dur = Number(cfg.avg_duration_ms || 200);
          const gbSec = inv * (mem / 1024) * (dur / 1000);
          const total = Math.max(0, gbSec - 400000) * 0.0000165 + Math.max(0, inv - 2e6) * 0.0000004;
          return { min: Math.max(0, total), max: total + 1, basis: `${(inv / 1e6).toFixed(1)}M inv · ${mem}MB · ${dur}ms avg` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Self-Hosted (App Server)',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'vcpu', label: 'vCPUs', type: 'number', default: 4 },
          { key: 'memory_gb', label: 'RAM (GB)', type: 'number', default: 8 },
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 60 },
        ],
        estimate: (cfg) => {
          const amortized = Number(cfg.amortized_hardware || 60);
          const powerCost = (150 * 24 * 30 / 1000) * 0.12;
          const total = amortized + powerCost + 40;
          return { min: total, max: total + 20, basis: `${cfg.vcpu || 4} vCPU, ${cfg.memory_gb || 8}GB · Server: $${amortized}/mo · Power: $${powerCost.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE — Block Storage
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'block-storage',
    category: 'storage',
    serviceName: 'Block Storage',
    icon: '💾',
    color: 'text-teal-400',
    bgColor: 'bg-teal-950',
    description: 'EBS vs Managed Disk vs Persistent Disk vs local SAN',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'EBS Volume',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'size_gb', label: 'Size (GB)', type: 'number', default: 100 },
          { key: 'type', label: 'Volume Type', type: 'select', default: 'gp3', options: ['gp2','gp3','io1','io2','st1','sc1'] },
          { key: 'iops', label: 'IOPS (io1/io2)', type: 'number', default: 3000 },
        ],
        estimate: (cfg) => {
          const size = Number(cfg.size_gb || 100);
          const type = String(cfg.type || 'gp3');
          const iops = Number(cfg.iops || 3000);
          const rates: Record<string, number> = { gp2: 0.1, gp3: 0.08, io1: 0.125, io2: 0.125, st1: 0.045, sc1: 0.025 };
          const storageCost = size * (rates[type] || 0.08);
          const iopsCost = (type === 'io1' || type === 'io2') ? iops * 0.065 : 0;
          return { min: storageCost, max: storageCost + iopsCost, basis: `${size}GB ${type}${iopsCost > 0 ? ` + ${iops} IOPS` : ''}` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Managed Disk',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'size_gb', label: 'Size (GB)', type: 'number', default: 100 },
          { key: 'tier', label: 'Disk Tier', type: 'select', default: 'Premium_LRS', options: ['Standard_LRS','StandardSSD_LRS','Premium_LRS','UltraSSD_LRS'] },
        ],
        estimate: (cfg) => {
          const size = Number(cfg.size_gb || 100);
          const rates: Record<string, number> = { Standard_LRS: 0.04, StandardSSD_LRS: 0.075, Premium_LRS: 0.135, UltraSSD_LRS: 0.29 };
          const cost = size * (rates[String(cfg.tier || 'Premium_LRS')] || 0.135);
          return { min: cost, max: cost + 5, basis: `${size}GB ${cfg.tier || 'Premium_LRS'}` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Persistent Disk',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'size_gb', label: 'Size (GB)', type: 'number', default: 100 },
          { key: 'type', label: 'Disk Type', type: 'select', default: 'pd-balanced', options: ['pd-standard','pd-balanced','pd-ssd','pd-extreme'] },
        ],
        estimate: (cfg) => {
          const size = Number(cfg.size_gb || 100);
          const rates: Record<string, number> = { 'pd-standard': 0.04, 'pd-balanced': 0.1, 'pd-ssd': 0.17, 'pd-extreme': 0.27 };
          const cost = size * (rates[String(cfg.type || 'pd-balanced')] || 0.1);
          return { min: cost, max: cost + 3, basis: `${size}GB ${cfg.type || 'pd-balanced'}` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Local / SAN Storage',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'size_gb', label: 'Size (GB)', type: 'number', default: 100 },
          { key: 'amortized_hardware', label: 'Hardware ($/mo)', type: 'number', default: 15 },
        ],
        estimate: (cfg) => {
          const amortized = Number(cfg.amortized_hardware || 15);
          const powerCost = 5;
          const total = amortized + powerCost;
          return { min: total, max: total + 10, basis: `${cfg.size_gb || 100}GB · HW: $${amortized}/mo · Power: ~$${powerCost}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NETWORKING — Load Balancer
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'load-balancer',
    category: 'networking',
    serviceName: 'Load Balancer',
    icon: '⚖️',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950',
    description: 'ALB/NLB vs Azure LB vs Cloud Load Balancing vs HAProxy',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'ALB / NLB',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'type', label: 'LB Type', type: 'select', default: 'application', options: ['application','network','gateway'] },
          { key: 'data_gb', label: 'Data Processed (GB/mo)', type: 'number', default: 500 },
        ],
        estimate: (cfg) => {
          const base = String(cfg.type || 'application') === 'network' ? 16.4 : 18;
          const lcu = Number(cfg.data_gb || 500) * 0.008;
          return { min: base + lcu, max: base + lcu + 10, basis: `${cfg.type || 'application'} LB $${base}/mo + ${cfg.data_gb || 500}GB @ $0.008/GB` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Azure Load Balancer',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'sku', label: 'SKU', type: 'select', default: 'Standard', options: ['Basic','Standard'] },
          { key: 'data_gb', label: 'Data Processed (GB/mo)', type: 'number', default: 500 },
        ],
        estimate: (cfg) => {
          const base = String(cfg.sku || 'Standard') === 'Standard' ? 18 : 0;
          const dataCost = Number(cfg.data_gb || 500) * 0.005;
          return { min: base + dataCost, max: base + dataCost + 8, basis: `${cfg.sku || 'Standard'} SKU $${base}/mo + ${cfg.data_gb || 500}GB processed` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud Load Balancing',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'rules', label: 'Forwarding Rules', type: 'number', default: 1 },
          { key: 'data_gb', label: 'Data Processed (GB/mo)', type: 'number', default: 500 },
        ],
        estimate: (cfg) => {
          const ruleCost = Number(cfg.rules || 1) * 18;
          const dataCost = Number(cfg.data_gb || 500) * 0.008;
          return { min: ruleCost + dataCost, max: ruleCost + dataCost + 8, basis: `${cfg.rules || 1} rule(s) @ $18/mo + ${cfg.data_gb || 500}GB processed` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'HAProxy / F5 / Nginx',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'amortized_hardware', label: 'HW Amortized ($/mo)', type: 'number', default: 40 },
          { key: 'license', label: 'License Cost ($/mo)', type: 'number', default: 0 },
        ],
        estimate: (cfg) => {
          const total = Number(cfg.amortized_hardware || 40) + Number(cfg.license || 0) + 10;
          return { min: total, max: total + 20, basis: `HW: $${cfg.amortized_hardware || 40}/mo · License: $${cfg.license || 0}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DATABASE — NoSQL / Document DB
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'nosql-database',
    category: 'database',
    serviceName: 'NoSQL Database',
    icon: '🍃',
    color: 'text-green-400',
    bgColor: 'bg-green-950',
    description: 'DynamoDB vs Cosmos DB vs Firestore vs self-hosted MongoDB',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'DynamoDB',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 100 },
          { key: 'read_units', label: 'RCU (read capacity)', type: 'number', default: 100 },
          { key: 'write_units', label: 'WCU (write capacity)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 100), r = Number(cfg.read_units || 100), w = Number(cfg.write_units || 50);
          const cost = s * 0.25 + r * 0.00013 * 730 + w * 0.00065 * 730;
          return { min: cost, max: cost + 10, basis: `${s}GB @ $0.25/GB + ${r} RCU + ${w} WCU` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Cosmos DB',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 100 },
          { key: 'request_units', label: 'RU/s (request units)', type: 'number', default: 1000 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 100), ru = Number(cfg.request_units || 1000);
          const cost = s * 0.25 + ru * 0.00008 * 730;
          return { min: cost, max: cost + 15, basis: `${s}GB @ $0.25/GB + ${ru} RU/s` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Firestore',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 100 },
          { key: 'reads_m', label: 'Document Reads (M/mo)', type: 'number', default: 5 },
          { key: 'writes_m', label: 'Document Writes (M/mo)', type: 'number', default: 1 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 100), r = Number(cfg.reads_m || 5), w = Number(cfg.writes_m || 1);
          const cost = s * 0.15 + r * 0.03 + w * 0.06;
          return { min: cost, max: cost + 5, basis: `${s}GB @ $0.15/GB + ${r}M reads + ${w}M writes` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'MongoDB / Couchbase',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 500 },
          { key: 'nodes', label: 'Replica Set Nodes', type: 'number', default: 3 },
          { key: 'amortized_per_node', label: 'Server/Node ($/mo)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.nodes || 3), perNode = Number(cfg.amortized_per_node || 100);
          const total = perNode * nodes + 50;
          return { min: total, max: total + 40, basis: `${nodes} nodes @ $${perNode}/mo + ops overhead` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHING — In-memory Cache
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'caching',
    category: 'database',
    serviceName: 'In-Memory Cache',
    icon: '⚡',
    color: 'text-red-400',
    bgColor: 'bg-red-950',
    description: 'ElastiCache vs Azure Redis Cache vs Memorystore vs self-hosted Redis',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'ElastiCache Redis',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'node_type', label: 'Node Type', type: 'select', default: 'cache.t3.medium', options: ['cache.t3.micro','cache.t3.small','cache.t3.medium','cache.t3.large','cache.r5.large','cache.r5.xlarge'] },
          { key: 'node_count', label: 'Node Count', type: 'number', default: 1 },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.node_count || 1);
          const nodeCosts: Record<string, number> = { 'cache.t3.micro': 15, 'cache.t3.small': 30, 'cache.t3.medium': 60, 'cache.t3.large': 120, 'cache.r5.large': 140, 'cache.r5.xlarge': 280 };
          const cost = (nodeCosts[String(cfg.node_type || 'cache.t3.medium')] || 60) * nodes;
          return { min: cost, max: cost + nodes * 5, basis: `${nodes}x ${cfg.node_type || 'cache.t3.medium'}` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Redis Cache',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'tier', label: 'Tier', type: 'select', default: 'Standard C1', options: ['Basic C0','Standard C1','Standard C2','Standard C3','Standard C4','Standard C5'] },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const tierCosts: Record<string, number> = { 'Basic C0': 15, 'Standard C1': 55, 'Standard C2': 110, 'Standard C3': 220, 'Standard C4': 440, 'Standard C5': 880 };
          const cost = tierCosts[String(cfg.tier || 'Standard C1')] || 55;
          return { min: cost, max: cost + 5, basis: `${cfg.tier || 'Standard C1'} cache instance` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Memorystore Redis',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'capacity_gb', label: 'Capacity (GB)', type: 'number', default: 5 },
          { key: 'tier', label: 'Tier', type: 'select', default: 'Standard', options: ['Basic','Standard','High Availability'] },
        ],
        estimate: (cfg) => {
          const cap = Number(cfg.capacity_gb || 5);
          const cost = cap * 30;
          return { min: cost, max: cost + cap * 5, basis: `${cap}GB Memorystore (${cfg.tier || 'Standard'})` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Self-Hosted Redis',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'memory_gb', label: 'Memory (GB)', type: 'number', default: 32 },
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const mem = Number(cfg.memory_gb || 32), hw = Number(cfg.amortized_hardware || 50);
          const power = (150 * 24 * 30 / 1000) * 0.12;
          const total = hw + power + 10;
          return { min: total, max: total + 15, basis: `${mem}GB RAM · Server: $${hw}/mo · Power: $${power.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGING — Message Queue
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'message-queue',
    category: 'messaging',
    serviceName: 'Message Queue',
    icon: '📨',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-950',
    description: 'SQS vs Queue Storage vs Pub/Sub vs RabbitMQ',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'SQS',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'requests_m', label: 'Requests (M/mo)', type: 'number', default: 100 },
          { key: 'data_gb', label: 'Data Transfer (GB/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const r = Number(cfg.requests_m || 100);
          const cost = Math.max(0, (r - 1) * 0.40);
          return { min: cost, max: cost + 5, basis: `${r}M requests (1M free) @ $0.40/M` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Queue Storage',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 10 },
          { key: 'operations_m', label: 'Operations (M/mo)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 10), ops = Number(cfg.operations_m || 100);
          const cost = s * 0.045 + ops * 0.0005;
          return { min: cost, max: cost + 5, basis: `${s}GB + ${ops}M operations` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Pub/Sub',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'messages_m', label: 'Messages (M/mo)', type: 'number', default: 100 },
          { key: 'data_gb', label: 'Data (GB/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const m = Number(cfg.messages_m || 100);
          const cost = Math.max(0, (m - 10) * 0.040);
          return { min: cost, max: cost + 5, basis: `${m}M messages (10M free) @ $0.04/M` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'RabbitMQ / Kafka',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'nodes', label: 'Broker Nodes', type: 'number', default: 3 },
          { key: 'amortized_per_node', label: 'Server/Node ($/mo)', type: 'number', default: 80 },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.nodes || 3), perNode = Number(cfg.amortized_per_node || 80);
          const power = (150 * 24 * 30 / 1000) * 0.12 * nodes;
          const total = perNode * nodes + power + 30;
          return { min: total, max: total + 40, basis: `${nodes} nodes @ $${perNode}/mo + power $${power.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // API GATEWAY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'api-gateway',
    category: 'networking',
    serviceName: 'API Gateway',
    icon: '🌉',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-950',
    description: 'API Gateway vs API Management vs Cloud Endpoints vs Kong',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'API Gateway (HTTP)',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'requests_m', label: 'API Requests (M/mo)', type: 'number', default: 10 },
          { key: 'data_gb', label: 'Data Transfer (GB/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const r = Number(cfg.requests_m || 10);
          const cost = r * 1.00;
          return { min: cost, max: cost + 5, basis: `${r}M requests @ $1.00/M` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'API Management',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'tier', label: 'Tier', type: 'select', default: 'Developer', options: ['Consumption','Developer','Basic','Standard','Premium'] },
          { key: 'requests_m', label: 'API Calls (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const tierCosts: Record<string, number> = { 'Consumption': 0, 'Developer': 60, 'Basic': 150, 'Standard': 650, 'Premium': 3000 };
          const base = tierCosts[String(cfg.tier || 'Developer')] || 60;
          return { min: base, max: base + base * 0.2, basis: `${cfg.tier || 'Developer'} tier ($${base}/mo)` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud Endpoints',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'requests_m', label: 'Requests (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const r = Number(cfg.requests_m || 10);
          const cost = r * 0.50;
          return { min: cost, max: cost + 3, basis: `${r}M requests @ $0.50/M` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Kong / Nginx',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 80 },
          { key: 'requests_m', label: 'Throughput (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const hw = Number(cfg.amortized_hardware || 80);
          const power = (150 * 24 * 30 / 1000) * 0.12;
          const total = hw + power + 20;
          return { min: total, max: total + 20, basis: `Server: $${hw}/mo · Power: $${power.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTAINER REGISTRY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'container-registry',
    category: 'devops',
    serviceName: 'Container Registry',
    icon: '📦',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950',
    description: 'ECR vs Container Registry vs Artifact Registry vs Harbor',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'ECR',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 50 },
          { key: 'data_transfer_gb', label: 'Data Transfer (GB/mo)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 50), d = Number(cfg.data_transfer_gb || 100);
          const cost = s * 0.10 + d * 0.09;
          return { min: cost, max: cost + 5, basis: `${s}GB @ $0.10/GB + ${d}GB transfer @ $0.09/GB` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Container Registry',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'tier', label: 'Tier', type: 'select', default: 'Basic', options: ['Basic','Standard','Premium'] },
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 50);
          const tierBase: Record<string, number> = { 'Basic': 5, 'Standard': 10, 'Premium': 50 };
          const base = tierBase[String(cfg.tier || 'Basic')] || 5;
          const cost = base + s * 0.10;
          return { min: cost, max: cost + 5, basis: `${cfg.tier || 'Basic'} tier ($${base}/mo) + ${s}GB storage` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Artifact Registry',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const s = Number(cfg.storage_gb || 50);
          const cost = s * 0.10;
          return { min: cost, max: cost + 3, basis: `${s}GB @ $0.10/GB` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Harbor / Docker Registry',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'storage_gb', label: 'Storage (GB)', type: 'number', default: 500 },
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 50 },
        ],
        estimate: (cfg) => {
          const hw = Number(cfg.amortized_hardware || 50);
          const power = (100 * 24 * 30 / 1000) * 0.12;
          const total = hw + power;
          return { min: total, max: total + 10, basis: `Server: $${hw}/mo · Power: $${power.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DNS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'dns',
    category: 'networking',
    serviceName: 'DNS Management',
    icon: '🌐',
    color: 'text-sky-400',
    bgColor: 'bg-sky-950',
    description: 'Route53 vs Azure DNS vs Cloud DNS vs self-hosted Bind',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'Route53',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'hosted_zones', label: 'Hosted Zones', type: 'number', default: 1 },
          { key: 'queries_m', label: 'Queries (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const z = Number(cfg.hosted_zones || 1), q = Number(cfg.queries_m || 10);
          const cost = z * 0.50 + q * 0.40;
          return { min: cost, max: cost + 2, basis: `${z} zones @ $0.50/zone + ${q}M queries @ $0.40/M` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Azure DNS',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'hosted_zones', label: 'DNS Zones', type: 'number', default: 1 },
          { key: 'queries_m', label: 'Queries (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const z = Number(cfg.hosted_zones || 1), q = Number(cfg.queries_m || 10);
          const cost = z * 0.50 + q * 0.20;
          return { min: cost, max: cost + 2, basis: `${z} zones @ $0.50/zone + ${q}M queries @ $0.20/M` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud DNS',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'hosted_zones', label: 'Managed Zones', type: 'number', default: 1 },
          { key: 'queries_m', label: 'Queries (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const z = Number(cfg.hosted_zones || 1), q = Number(cfg.queries_m || 10);
          const cost = z * 0.20 + q * 0.10;
          return { min: cost, max: cost + 2, basis: `${z} zones @ $0.20/zone + ${q}M queries @ $0.10/M` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Bind / PowerDNS',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 30 },
        ],
        estimate: (cfg) => {
          const hw = Number(cfg.amortized_hardware || 30);
          const power = (50 * 24 * 30 / 1000) * 0.12;
          const total = hw + power;
          return { min: total, max: total + 10, basis: `Server: $${hw}/mo · Power: $${power.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MONITORING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'monitoring',
    category: 'monitoring',
    serviceName: 'Monitoring & Observability',
    icon: '📊',
    color: 'text-teal-400',
    bgColor: 'bg-teal-950',
    description: 'CloudWatch vs Azure Monitor vs Cloud Monitoring vs Prometheus',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'CloudWatch',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'metrics', label: 'Custom Metrics', type: 'number', default: 10 },
          { key: 'logs_gb', label: 'Logs Ingestion (GB/mo)', type: 'number', default: 5 },
          { key: 'dashboards', label: 'Dashboards', type: 'number', default: 3 },
        ],
        estimate: (cfg) => {
          const m = Number(cfg.metrics || 10), l = Number(cfg.logs_gb || 5), d = Number(cfg.dashboards || 3);
          const cost = m * 0.30 + l * 0.50 + d * 3;
          return { min: cost, max: cost + 10, basis: `${m} metrics @ $0.30 + ${l}GB logs @ $0.50/GB + ${d} dashboards @ $3` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Azure Monitor',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'metrics', label: 'Metrics (M/mo)', type: 'number', default: 10 },
          { key: 'logs_gb', label: 'Log Analytics (GB/mo)', type: 'number', default: 5 },
        ],
        estimate: (cfg) => {
          const m = Number(cfg.metrics || 10), l = Number(cfg.logs_gb || 5);
          const cost = m * 0.10 + l * 2.30;
          return { min: cost, max: cost + 8, basis: `${m}M metrics @ $0.10/M + ${l}GB logs @ $2.30/GB` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud Monitoring',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'metrics_m', label: 'Metrics (M/mo)', type: 'number', default: 10 },
          { key: 'logs_gb', label: 'Logs (GB/mo)', type: 'number', default: 5 },
        ],
        estimate: (cfg) => {
          const m = Number(cfg.metrics_m || 10), l = Number(cfg.logs_gb || 5);
          const cost = Math.max(0, (m - 0.3) * 0.075) + l * 0.50;
          return { min: cost, max: cost + 8, basis: `${m}M metrics (300K free) + ${l}GB logs @ $0.50/GB` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Prometheus + Grafana',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'nodes', label: 'Monitored Nodes', type: 'number', default: 10 },
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 80 },
        ],
        estimate: (cfg) => {
          const nodes = Number(cfg.nodes || 10), hw = Number(cfg.amortized_hardware || 80);
          const power = (150 * 24 * 30 / 1000) * 0.12;
          const total = hw + power + nodes * 5;
          return { min: total, max: total + 20, basis: `Server: $${hw}/mo · ${nodes} nodes @ $5/node` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VPC / NETWORKING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'vpc-networking',
    category: 'networking',
    serviceName: 'VPC / Virtual Network',
    icon: '🔒',
    color: 'text-violet-400',
    bgColor: 'bg-violet-950',
    description: 'VPC vs Virtual Network vs VPC vs VLAN / VPN',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'VPC + NAT Gateway',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'nat_gateways', label: 'NAT Gateways', type: 'number', default: 1 },
          { key: 'data_processed_gb', label: 'NAT Data Processed (GB/mo)', type: 'number', default: 100 },
          { key: 'vpn_connections', label: 'VPN Connections', type: 'number', default: 0 },
        ],
        estimate: (cfg) => {
          const nat = Number(cfg.nat_gateways || 1), data = Number(cfg.data_processed_gb || 100), vpn = Number(cfg.vpn_connections || 0);
          const cost = nat * 32.40 + data * 0.045 + vpn * 18;
          return { min: cost, max: cost + 10, basis: `${nat} NAT GW @ $32.40 + ${data}GB data + ${vpn} VPN @ $18` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Virtual Network',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'vpn_gateway', label: 'VPN Gateway Type', type: 'select', default: 'Basic', options: ['Basic','VpnGw1','VpnGw2','VpnGw3'] },
          { key: 'data_processed_gb', label: 'Data Processed (GB/mo)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const gwCosts: Record<string, number> = { 'Basic': 30, 'VpnGw1': 65, 'VpnGw2': 130, 'VpnGw3': 260 };
          const gw = gwCosts[String(cfg.vpn_gateway || 'Basic')] || 30;
          const data = Number(cfg.data_processed_gb || 100) * 0.01;
          const cost = gw + data;
          return { min: cost, max: cost + 10, basis: `${cfg.vpn_gateway || 'Basic'} VPN GW ($${gw}/mo) + ${data}GB` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'VPC + Cloud NAT',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'vpn_tunnels', label: 'VPN Tunnels', type: 'number', default: 1 },
          { key: 'data_processed_gb', label: 'NAT Data (GB/mo)', type: 'number', default: 100 },
        ],
        estimate: (cfg) => {
          const vpn = Number(cfg.vpn_tunnels || 1) * 30;
          const data = Number(cfg.data_processed_gb || 100) * 0.045;
          const cost = vpn + data;
          return { min: cost, max: cost + 10, basis: `${cfg.vpn_tunnels || 1} VPN @ $30 + ${data}GB NAT data` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'VLAN / VPN Appliance',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'amortized_hardware', label: 'Router/FW ($/mo)', type: 'number', default: 100 },
          { key: 'power_w', label: 'Power Draw (W)', type: 'number', default: 200 },
        ],
        estimate: (cfg) => {
          const hw = Number(cfg.amortized_hardware || 100), power = Number(cfg.power_w || 200);
          const powerCost = (power * 24 * 30 / 1000) * 0.12;
          const total = hw + powerCost + 20;
          return { min: total, max: total + 20, basis: `HW: $${hw}/mo · Power: $${powerCost.toFixed(0)}/mo` };
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CDN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'cdn',
    category: 'cdn',
    serviceName: 'CDN / Content Delivery',
    icon: '🚀',
    color: 'text-orange-300',
    bgColor: 'bg-orange-900',
    description: 'CloudFront vs Azure Front Door vs Cloud CDN vs self-hosted',
    providers: [
      {
        provider: 'aws',
        providerLabel: 'AWS',
        serviceLabel: 'CloudFront',
        icon: 'aws',
        color: '#fb923c',
        fields: [
          { key: 'transfer_tb', label: 'Data Transfer (TB/mo)', type: 'number', default: 1 },
          { key: 'requests_m', label: 'HTTPS Requests (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const t = Number(cfg.transfer_tb || 1), r = Number(cfg.requests_m || 10);
          const cost = t * 85 + r * 0.01;
          return { min: cost, max: cost + 15, basis: `${t}TB @ $85/TB + ${r}M requests @ $0.01/M` };
        },
      },
      {
        provider: 'azure',
        providerLabel: 'Azure',
        serviceLabel: 'Front Door',
        icon: 'azure',
        color: '#60a5fa',
        fields: [
          { key: 'transfer_tb', label: 'Data Transfer (TB/mo)', type: 'number', default: 1 },
          { key: 'requests_m', label: 'Requests (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const t = Number(cfg.transfer_tb || 1), r = Number(cfg.requests_m || 10);
          const cost = t * 80 + r * 0.009;
          return { min: cost, max: cost + 12, basis: `${t}TB @ $80/TB + ${r}M requests` };
        },
      },
      {
        provider: 'gcp',
        providerLabel: 'GCP',
        serviceLabel: 'Cloud CDN',
        icon: 'gcp',
        color: '#f87171',
        fields: [
          { key: 'transfer_tb', label: 'Data Transfer (TB/mo)', type: 'number', default: 1 },
          { key: 'requests_m', label: 'Requests (M/mo)', type: 'number', default: 10 },
        ],
        estimate: (cfg) => {
          const t = Number(cfg.transfer_tb || 1), r = Number(cfg.requests_m || 10);
          const cost = t * 80 + r * 0.0075;
          return { min: cost, max: cost + 12, basis: `${t}TB @ $80/TB + ${r}M requests` };
        },
      },
      {
        provider: 'onprem',
        providerLabel: 'On-Premises',
        serviceLabel: 'Nginx / Varnish Cache',
        icon: 'onprem',
        color: '#a78bfa',
        fields: [
          { key: 'bandwidth_gbps', label: 'Bandwidth (Gbps)', type: 'number', default: 1 },
          { key: 'amortized_hardware', label: 'Server ($/mo)', type: 'number', default: 80 },
        ],
        estimate: (cfg) => {
          const bw = Number(cfg.bandwidth_gbps || 1);
          const amortized = Number(cfg.amortized_hardware || 80);
          const powerCost = (300 * 24 * 30 / 1000) * 0.12;
          const total = amortized + powerCost + bw * 50;
          return { min: total - 10, max: total + 30, basis: `${bw}Gbps · Server: $${amortized}/mo · Power: $${powerCost.toFixed(0)}/mo` };
        },
      },
    ],
  },
];
