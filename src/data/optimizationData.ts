export type OptimizableProvider = 'aws' | 'azure' | 'gcp';

export interface InstanceUpgradePath {
  current: string;
  upgrade: string | null;
  downgrade: string | null;
  vcpu: number;
  memory: number;
  price: number;
}

export interface ServiceFamily {
  family: string;
  label: string;
  instances: InstanceUpgradePath[];
}

export interface UtilizationThreshold {
  metric: 'cpu' | 'memory' | 'network' | 'io';
  label: string;
  highThreshold: number;
  lowThreshold: number;
}

export interface OptimizationService {
  id: string;
  provider: OptimizableProvider;
  providerLabel: string;
  serviceName: string;
  serviceLabel: string;
  category: string;
  icon: string;
  color: string;
  bgColor: string;
  families: ServiceFamily[];
  thresholds: UtilizationThreshold[];
  getRecommendationReason: (metric: string, currentValue: number, currentInst: string, recommendedInst: string, direction: 'upgrade' | 'downgrade') => string;
}

export const AWS_EC2_FAMILIES: ServiceFamily[] = [
  {
    family: 't2',
    label: 'T2 Burstable',
    instances: [
      { current: 't2.nano',    upgrade: 't2.micro',  downgrade: null,       vcpu: 1,  memory: 0.5,  price: 5.2 },
      { current: 't2.micro',   upgrade: 't2.small',  downgrade: 't2.nano',  vcpu: 1,  memory: 1,    price: 8.5 },
      { current: 't2.small',   upgrade: 't2.medium', downgrade: 't2.micro', vcpu: 1,  memory: 2,    price: 17 },
      { current: 't2.medium',  upgrade: 't2.large',  downgrade: 't2.small', vcpu: 2,  memory: 4,    price: 34 },
      { current: 't2.large',   upgrade: 't2.xlarge', downgrade: 't2.medium',vcpu: 2,  memory: 8,    price: 67 },
      { current: 't2.xlarge',  upgrade: 't2.2xlarge',downgrade: 't2.large', vcpu: 4,  memory: 16,   price: 135 },
      { current: 't2.2xlarge', upgrade: null,         downgrade: 't2.xlarge',vcpu: 8, memory: 32,   price: 270 },
    ],
  },
  {
    family: 't3',
    label: 'T3 Burstable',
    instances: [
      { current: 't3.nano',    upgrade: 't3.micro',  downgrade: null,       vcpu: 2,  memory: 0.5,  price: 4.2 },
      { current: 't3.micro',   upgrade: 't3.small',  downgrade: 't3.nano',  vcpu: 2,  memory: 1,    price: 7.6 },
      { current: 't3.small',   upgrade: 't3.medium', downgrade: 't3.micro', vcpu: 2,  memory: 2,    price: 15 },
      { current: 't3.medium',  upgrade: 't3.large',  downgrade: 't3.small', vcpu: 2,  memory: 4,    price: 30 },
      { current: 't3.large',   upgrade: 't3.xlarge', downgrade: 't3.medium',vcpu: 2,  memory: 8,    price: 60 },
      { current: 't3.xlarge',  upgrade: 't3.2xlarge',downgrade: 't3.large', vcpu: 4,  memory: 16,   price: 120 },
      { current: 't3.2xlarge', upgrade: null,         downgrade: 't3.xlarge',vcpu: 8, memory: 32,   price: 240 },
    ],
  },
  {
    family: 'm5',
    label: 'M5 General Purpose',
    instances: [
      { current: 'm5.large',   upgrade: 'm5.xlarge',    downgrade: null,       vcpu: 2,  memory: 8,   price: 70 },
      { current: 'm5.xlarge',  upgrade: 'm5.2xlarge',   downgrade: 'm5.large', vcpu: 4,  memory: 16,  price: 140 },
      { current: 'm5.2xlarge', upgrade: 'm5.4xlarge',   downgrade: 'm5.xlarge',vcpu: 8,  memory: 32,  price: 280 },
      { current: 'm5.4xlarge', upgrade: 'm5.8xlarge',   downgrade: 'm5.2xlarge',vcpu: 16,memory: 64,  price: 560 },
      { current: 'm5.8xlarge', upgrade: 'm5.12xlarge',  downgrade: 'm5.4xlarge',vcpu: 32,memory: 128, price: 1120 },
      { current: 'm5.12xlarge',upgrade: 'm5.24xlarge',  downgrade: 'm5.8xlarge',vcpu: 48,memory: 192, price: 1680 },
      { current: 'm5.24xlarge',upgrade: null,            downgrade: 'm5.12xlarge',vcpu: 96,memory: 384, price: 3360 },
    ],
  },
  {
    family: 'c5',
    label: 'C5 Compute Optimized',
    instances: [
      { current: 'c5.large',   upgrade: 'c5.xlarge',    downgrade: null,        vcpu: 2,  memory: 4,   price: 62 },
      { current: 'c5.xlarge',  upgrade: 'c5.2xlarge',   downgrade: 'c5.large',  vcpu: 4,  memory: 8,   price: 124 },
      { current: 'c5.2xlarge', upgrade: 'c5.4xlarge',   downgrade: 'c5.xlarge', vcpu: 8,  memory: 16,  price: 248 },
      { current: 'c5.4xlarge', upgrade: 'c5.9xlarge',   downgrade: 'c5.2xlarge',vcpu: 16, memory: 32,  price: 496 },
      { current: 'c5.9xlarge', upgrade: 'c5.18xlarge',  downgrade: 'c5.4xlarge',vcpu: 36, memory: 72,  price: 1116 },
      { current: 'c5.18xlarge',upgrade: null,            downgrade: 'c5.9xlarge',vcpu: 72, memory: 144, price: 2232 },
    ],
  },
  {
    family: 'r5',
    label: 'R5 Memory Optimized',
    instances: [
      { current: 'r5.large',   upgrade: 'r5.xlarge',   downgrade: null,         vcpu: 2,  memory: 16,  price: 91 },
      { current: 'r5.xlarge',  upgrade: 'r5.2xlarge',  downgrade: 'r5.large',   vcpu: 4,  memory: 32,  price: 182 },
      { current: 'r5.2xlarge', upgrade: 'r5.4xlarge',  downgrade: 'r5.xlarge',  vcpu: 8,  memory: 64,  price: 364 },
      { current: 'r5.4xlarge', upgrade: 'r5.8xlarge',  downgrade: 'r5.2xlarge', vcpu: 16, memory: 128, price: 728 },
      { current: 'r5.8xlarge', upgrade: 'r5.12xlarge', downgrade: 'r5.4xlarge', vcpu: 32, memory: 256, price: 1456 },
      { current: 'r5.12xlarge',upgrade: 'r5.24xlarge', downgrade: 'r5.8xlarge', vcpu: 48, memory: 384, price: 2184 },
      { current: 'r5.24xlarge',upgrade: null,           downgrade: 'r5.12xlarge',vcpu: 96,memory: 768, price: 4368 },
    ],
  },
];

export const AWS_RDS_FAMILIES: ServiceFamily[] = [
  {
    family: 'db-t3',
    label: 'db.t3 Burstable',
    instances: [
      { current: 'db.t3.micro',   upgrade: 'db.t3.small',  downgrade: null,         vcpu: 2,  memory: 1,   price: 15 },
      { current: 'db.t3.small',   upgrade: 'db.t3.medium', downgrade: 'db.t3.micro',vcpu: 2,  memory: 2,   price: 30 },
      { current: 'db.t3.medium',  upgrade: 'db.t3.large',  downgrade: 'db.t3.small',vcpu: 2,  memory: 4,   price: 60 },
      { current: 'db.t3.large',   upgrade: 'db.t3.xlarge', downgrade: 'db.t3.medium',vcpu: 2, memory: 8,   price: 120 },
      { current: 'db.t3.xlarge',  upgrade: null,            downgrade: 'db.t3.large',vcpu: 4,  memory: 16,  price: 240 },
    ],
  },
  {
    family: 'db-m5',
    label: 'db.m5 General Purpose',
    instances: [
      { current: 'db.m5.large',   upgrade: 'db.m5.xlarge',  downgrade: null,         vcpu: 2,  memory: 8,   price: 138 },
      { current: 'db.m5.xlarge',  upgrade: 'db.m5.2xlarge', downgrade: 'db.m5.large',vcpu: 4,  memory: 16,  price: 276 },
      { current: 'db.m5.2xlarge', upgrade: 'db.m5.4xlarge', downgrade: 'db.m5.xlarge',vcpu: 8, memory: 32,  price: 552 },
      { current: 'db.m5.4xlarge', upgrade: null,             downgrade: 'db.m5.2xlarge',vcpu: 16,memory: 64, price: 1104 },
    ],
  },
];

export const AZURE_VM_FAMILIES: ServiceFamily[] = [
  {
    family: 'B-series',
    label: 'B-series Burstable',
    instances: [
      { current: 'Standard_B1s',  upgrade: 'Standard_B1ms', downgrade: null,          vcpu: 1, memory: 1,  price: 7.6 },
      { current: 'Standard_B1ms', upgrade: 'Standard_B2s',  downgrade: 'Standard_B1s', vcpu: 1, memory: 2,  price: 15 },
      { current: 'Standard_B2s',  upgrade: 'Standard_B2ms', downgrade: 'Standard_B1ms',vcpu: 2, memory: 4,  price: 30 },
      { current: 'Standard_B2ms', upgrade: 'Standard_B4ms', downgrade: 'Standard_B2s', vcpu: 2, memory: 8,  price: 60 },
      { current: 'Standard_B4ms', upgrade: 'Standard_B8ms', downgrade: 'Standard_B2ms',vcpu: 4, memory: 16, price: 120 },
      { current: 'Standard_B8ms', upgrade: null,             downgrade: 'Standard_B4ms',vcpu: 8, memory: 32, price: 240 },
    ],
  },
  {
    family: 'D-series',
    label: 'D-series General Purpose',
    instances: [
      { current: 'Standard_D2s_v3',  upgrade: 'Standard_D4s_v3',  downgrade: null,           vcpu: 2,  memory: 8,  price: 69 },
      { current: 'Standard_D4s_v3',  upgrade: 'Standard_D8s_v3',  downgrade: 'Standard_D2s_v3',vcpu: 4,  memory: 16, price: 138 },
      { current: 'Standard_D8s_v3',  upgrade: 'Standard_D16s_v3', downgrade: 'Standard_D4s_v3',vcpu: 8,  memory: 32, price: 276 },
      { current: 'Standard_D16s_v3', upgrade: 'Standard_D32s_v3', downgrade: 'Standard_D8s_v3',vcpu: 16, memory: 64, price: 552 },
      { current: 'Standard_D32s_v3', upgrade: null,                downgrade: 'Standard_D16s_v3',vcpu: 32,memory: 128,price: 1104 },
    ],
  },
  {
    family: 'E-series',
    label: 'E-series Memory Optimized',
    instances: [
      { current: 'Standard_E2s_v3',  upgrade: 'Standard_E4s_v3',  downgrade: null,           vcpu: 2,  memory: 16, price: 100 },
      { current: 'Standard_E4s_v3',  upgrade: 'Standard_E8s_v3',  downgrade: 'Standard_E2s_v3',vcpu: 4,  memory: 32, price: 200 },
      { current: 'Standard_E8s_v3',  upgrade: 'Standard_E16s_v3', downgrade: 'Standard_E4s_v3',vcpu: 8,  memory: 64, price: 400 },
      { current: 'Standard_E16s_v3', upgrade: null,                downgrade: 'Standard_E8s_v3',vcpu: 16, memory: 128,price: 800 },
    ],
  },
];

export const GCP_VM_FAMILIES: ServiceFamily[] = [
  {
    family: 'e2',
    label: 'E2 Cost-Optimized',
    instances: [
      { current: 'e2-micro',      upgrade: 'e2-small',      downgrade: null,            vcpu: 2, memory: 1,  price: 6.1 },
      { current: 'e2-small',      upgrade: 'e2-medium',     downgrade: 'e2-micro',     vcpu: 2, memory: 2,  price: 12 },
      { current: 'e2-medium',     upgrade: 'e2-standard-2', downgrade: 'e2-small',     vcpu: 2, memory: 4,  price: 24 },
      { current: 'e2-standard-2', upgrade: 'e2-standard-4', downgrade: 'e2-medium',    vcpu: 2, memory: 8,  price: 48 },
      { current: 'e2-standard-4', upgrade: 'e2-standard-8', downgrade: 'e2-standard-2',vcpu: 4, memory: 16, price: 97 },
      { current: 'e2-standard-8', upgrade: 'e2-standard-16',downgrade: 'e2-standard-4',vcpu: 8, memory: 32, price: 194 },
      { current: 'e2-standard-16',upgrade: null,             downgrade: 'e2-standard-8',vcpu: 16,memory: 64, price: 388 },
    ],
  },
  {
    family: 'n2',
    label: 'N2 General Purpose',
    instances: [
      { current: 'n2-standard-2', upgrade: 'n2-standard-4', downgrade: null,             vcpu: 2,  memory: 8,  price: 58 },
      { current: 'n2-standard-4', upgrade: 'n2-standard-8', downgrade: 'n2-standard-2',  vcpu: 4,  memory: 16, price: 116 },
      { current: 'n2-standard-8', upgrade: 'n2-standard-16',downgrade: 'n2-standard-4',  vcpu: 8,  memory: 32, price: 232 },
      { current: 'n2-standard-16',upgrade: 'n2-standard-32',downgrade: 'n2-standard-8',  vcpu: 16, memory: 64, price: 464 },
      { current: 'n2-standard-32',upgrade: null,             downgrade: 'n2-standard-16', vcpu: 32, memory: 128,price: 928 },
    ],
  },
  {
    family: 'c2',
    label: 'C2 Compute Optimized',
    instances: [
      { current: 'c2-standard-4', upgrade: 'c2-standard-8',  downgrade: null,            vcpu: 4,  memory: 16, price: 147 },
      { current: 'c2-standard-8', upgrade: 'c2-standard-16', downgrade: 'c2-standard-4', vcpu: 8,  memory: 32, price: 295 },
      { current: 'c2-standard-16',upgrade: 'c2-standard-30', downgrade: 'c2-standard-8', vcpu: 16, memory: 64, price: 590 },
      { current: 'c2-standard-30',upgrade: 'c2-standard-60', downgrade: 'c2-standard-16',vcpu: 30, memory: 120,price: 1107 },
      { current: 'c2-standard-60',upgrade: null,              downgrade: 'c2-standard-30',vcpu: 60, memory: 240,price: 2214 },
    ],
  },
];

function awsEC2Reason(metric: string, currentValue: number, currentInst: string, recommendedInst: string, direction: 'upgrade' | 'downgrade'): string {
  if (direction === 'upgrade') {
    if (metric === 'cpu') return `CPU utilization is consistently at ${currentValue}%, exceeding the 90% threshold. Upgrading from ${currentInst} to ${recommendedInst} provides more compute capacity, reducing CPU pressure and improving application responsiveness.`;
    if (metric === 'memory') return `Memory utilization is at ${currentValue}%, approaching capacity limits. Upgrading from ${currentInst} to ${recommendedInst} increases available memory, preventing out-of-memory errors.`;
    if (metric === 'network') return `Network throughput is at ${currentValue}% of the instance's baseline. Upgrading from ${currentInst} to ${recommendedInst} provides higher network bandwidth.`;
    return `Resource utilization (${metric}) is consistently at ${currentValue}%. Upgrading from ${currentInst} to ${recommendedInst} is recommended for optimal performance.`;
  }
  if (metric === 'cpu') return `CPU utilization is consistently low at ${currentValue}%. Downgrading from ${currentInst} to ${recommendedInst} maintains adequate performance while reducing costs.`;
  if (metric === 'memory') return `Memory utilization is low at ${currentValue}%. Downgrading from ${currentInst} to ${recommendedInst} can reduce costs without impacting workloads.`;
  return `Resource utilization (${metric}) is low at ${currentValue}%. Downgrading from ${currentInst} to ${recommendedInst} optimizes costs.`;
}

function azureVMReason(metric: string, currentValue: number, currentInst: string, recommendedInst: string, direction: 'upgrade' | 'downgrade'): string {
  if (direction === 'upgrade') {
    if (metric === 'cpu') return `Azure VM ${currentInst} shows CPU utilization at ${currentValue}%. Right-sizing to ${recommendedInst} improves compute performance and reduces latency.`;
    if (metric === 'memory') return `Memory pressure detected at ${currentValue}% on ${currentInst}. Scaling up to ${recommendedInst} increases memory capacity for demanding workloads.`;
    return `${currentInst} has ${metric} utilization at ${currentValue}%. Moving to ${recommendedInst} ensures optimal performance.`;
  }
  return `Azure VM ${currentInst} has low ${metric} utilization (${currentValue}%). Downgrading to ${recommendedInst} saves costs while maintaining performance.`;
}

function gcpVMReason(metric: string, currentValue: number, currentInst: string, recommendedInst: string, direction: 'upgrade' | 'downgrade'): string {
  if (direction === 'upgrade') {
    if (metric === 'cpu') return `GCE ${currentInst} CPU utilization is at ${currentValue}%, above the recommended threshold. Upgrade to ${recommendedInst} for better compute performance.`;
    if (metric === 'memory') return `GCE ${currentInst} memory usage is at ${currentValue}%. Migrating to ${recommendedInst} provides additional memory for memory-intensive workloads.`;
    return `Resource ${metric} on ${currentInst} is at ${currentValue}%. Right-sizing to ${recommendedInst} is recommended.`;
  }
  return `GCE ${currentInst} has low ${metric} utilization (${currentValue}%). Downgrading to ${recommendedInst} optimizes costs without performance impact.`;
}

export const OPTIMIZATION_SERVICES: OptimizationService[] = [
  {
    id: 'aws-ec2',
    provider: 'aws',
    providerLabel: 'AWS',
    serviceName: 'EC2 Instance',
    serviceLabel: 'EC2',
    category: 'Compute',
    icon: '🖥️',
    color: '#f97316',
    bgColor: 'rgba(249,115,22,0.10)',
    families: AWS_EC2_FAMILIES,
    thresholds: [
      { metric: 'cpu', label: 'CPU Utilization', highThreshold: 90, lowThreshold: 10 },
      { metric: 'memory', label: 'Memory Utilization', highThreshold: 90, lowThreshold: 10 },
      { metric: 'network', label: 'Network Utilization', highThreshold: 90, lowThreshold: 5 },
    ],
    getRecommendationReason: awsEC2Reason,
  },
  {
    id: 'aws-rds',
    provider: 'aws',
    providerLabel: 'AWS',
    serviceName: 'RDS Instance',
    serviceLabel: 'RDS',
    category: 'Database',
    icon: '🗄️',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
    families: AWS_RDS_FAMILIES,
    thresholds: [
      { metric: 'cpu', label: 'CPU Utilization', highThreshold: 90, lowThreshold: 10 },
      { metric: 'memory', label: 'Memory Utilization', highThreshold: 85, lowThreshold: 10 },
      { metric: 'io', label: 'IO Utilization', highThreshold: 85, lowThreshold: 5 },
    ],
    getRecommendationReason: awsEC2Reason,
  },
  {
    id: 'azure-vm',
    provider: 'azure',
    providerLabel: 'Azure',
    serviceName: 'Virtual Machine',
    serviceLabel: 'Azure VM',
    category: 'Compute',
    icon: '🖥️',
    color: '#3b82f6',
    bgColor: 'rgba(59,130,246,0.10)',
    families: AZURE_VM_FAMILIES,
    thresholds: [
      { metric: 'cpu', label: 'CPU Utilization', highThreshold: 90, lowThreshold: 10 },
      { metric: 'memory', label: 'Memory Utilization', highThreshold: 90, lowThreshold: 10 },
    ],
    getRecommendationReason: azureVMReason,
  },
  {
    id: 'gcp-vm',
    provider: 'gcp',
    providerLabel: 'GCP',
    serviceName: 'Compute Engine',
    serviceLabel: 'GCE VM',
    category: 'Compute',
    icon: '🖥️',
    color: '#ef4444',
    bgColor: 'rgba(239,68,68,0.10)',
    families: GCP_VM_FAMILIES,
    thresholds: [
      { metric: 'cpu', label: 'CPU Utilization', highThreshold: 90, lowThreshold: 10 },
      { metric: 'memory', label: 'Memory Utilization', highThreshold: 90, lowThreshold: 10 },
    ],
    getRecommendationReason: gcpVMReason,
  },
];

export function findFamilyForInstance(service: OptimizationService, instanceType: string): ServiceFamily | undefined {
  return service.families.find(f => f.instances.some(i => i.current === instanceType));
}

export function findInstanceInFamily(family: ServiceFamily, instanceType: string): InstanceUpgradePath | undefined {
  return family.instances.find(i => i.current === instanceType);
}

export function getInstanceByType(service: OptimizationService, instanceType: string): { family: ServiceFamily; instance: InstanceUpgradePath } | undefined {
  for (const family of service.families) {
    const inst = family.instances.find(i => i.current === instanceType);
    if (inst) return { family, instance: inst };
  }
  return undefined;
}
