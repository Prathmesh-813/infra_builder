import type {
  ResourceStat, CategoryStat, ProviderStat,
  CostBreakdown, ActivityEvent, ComplexityMetric, AnalyticsSummary,
} from '../types/analytics';

const MOCK_RESOURCES: { type: string; label: string; icon: string; color: string; category: string; provider: string; cost: number }[] = [
  { type: 'aws_instance', label: 'EC2 Instances', icon: '🖥️', color: '#fb923c', category: 'Compute', provider: 'aws', cost: 87.42 },
  { type: 'aws_vpc', label: 'VPCs', icon: '🌐', color: '#4ade80', category: 'Network', provider: 'aws', cost: 0 },
  { type: 'aws_subnet', label: 'Subnets', icon: '🔀', color: '#22d3ee', category: 'Network', provider: 'aws', cost: 0 },
  { type: 'aws_security_group', label: 'Security Groups', icon: '🛡️', color: '#f87171', category: 'Security', provider: 'aws', cost: 0 },
  { type: 'aws_lb', label: 'Load Balancers', icon: '⚖️', color: '#818cf8', category: 'Network', provider: 'aws', cost: 23.15 },
  { type: 'aws_rds_instance', label: 'RDS Instances', icon: '🗄️', color: '#c084fc', category: 'Database', provider: 'aws', cost: 124.50 },
  { type: 'aws_s3_bucket', label: 'S3 Buckets', icon: '🪣', color: '#4ade80', category: 'Storage', provider: 'aws', cost: 12.30 },
  { type: 'aws_lambda_function', label: 'Lambda Functions', icon: '⚡', color: '#facc15', category: 'Serverless', provider: 'aws', cost: 5.67 },
  { type: 'aws_iam_role', label: 'IAM Roles', icon: '🔑', color: '#f472b6', category: 'Security', provider: 'aws', cost: 0 },
  { type: 'azurerm_virtual_machine', label: 'Azure VMs', icon: '🖥️', color: '#60a5fa', category: 'Compute', provider: 'azure', cost: 134.20 },
  { type: 'azurerm_virtual_network', label: 'Azure VNets', icon: '🌐', color: '#60a5fa', category: 'Network', provider: 'azure', cost: 0 },
  { type: 'google_compute_instance', label: 'GCP Instances', icon: '🖥️', color: '#f87171', category: 'Compute', provider: 'gcp', cost: 98.75 },
  { type: 'ansible_host_group', label: 'Host Groups', icon: '🖥️', color: '#60a5fa', category: 'Inventory', provider: 'ansible', cost: 0 },
  { type: 'ansible_package', label: 'Ansible Packages', icon: '📦', color: '#4ade80', category: 'Packages', provider: 'ansible', cost: 0 },
  { type: 'ansible_service', label: 'Ansible Services', icon: '⚙️', color: '#facc15', category: 'Services', provider: 'ansible', cost: 0 },
  { type: 'xp_aws_instance', label: 'Crossplane EC2', icon: '🖥️', color: '#38bdf8', category: 'Compute', provider: 'crossplane', cost: 0 },
];

const ACTIVITY_VERBS = ['Created', 'Modified', 'Deleted', 'Deployed', 'Configured', 'Scaled', 'Updated'];
const RESOURCE_NAMES = ['web-server', 'db-primary', 'app-backend', 'cache-cluster', 'load-balancer', 'vpc-main', 's3-assets', 'lambda-worker'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

export function generateAnalyticsSummary(): AnalyticsSummary {
  const resourceStats: ResourceStat[] = MOCK_RESOURCES.map(r => {
    const count = Math.floor(Math.random() * 12) + 1;
    return { ...r, count, cost: Math.round(r.cost * count * 100) / 100 };
  });

  const categoryMap = new Map<string, { count: number; cost: number; color: string; icon: string }>();
  resourceStats.forEach(r => {
    const existing = categoryMap.get(r.category) || { count: 0, cost: 0, color: r.color, icon: r.icon };
    existing.count += r.count;
    existing.cost += r.cost;
    categoryMap.set(r.category, existing);
  });
  const categoryStats: CategoryStat[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category, ...data,
  }));

  const providerMap = new Map<string, { count: number; cost: number; color: string; icon: string }>();
  resourceStats.forEach(r => {
    const existing = providerMap.get(r.provider) || { count: 0, cost: 0, color: r.color, icon: r.icon };
    existing.count += r.count;
    existing.cost += r.cost;
    providerMap.set(r.provider, existing);
  });
  const totalCount = resourceStats.reduce((s, r) => s + r.count, 0);
  const totalCost = resourceStats.reduce((s, r) => s + r.cost, 0);
  const providerLabels: Record<string, string> = { aws: 'AWS', azure: 'Azure', gcp: 'GCP', ansible: 'Ansible', crossplane: 'Crossplane' };
  const providerColors: Record<string, string> = { aws: '#fb923c', azure: '#60a5fa', gcp: '#f87171', ansible: '#60a5fa', crossplane: '#38bdf8' };
  const providerIcons: Record<string, string> = { aws: 'aws', azure: 'azure', gcp: 'gcp', ansible: 'ansible', crossplane: 'crossplane' };
  const providerStats: ProviderStat[] = Array.from(providerMap.entries()).map(([provider, data]) => ({
    ...data,
    provider,
    label: providerLabels[provider] || provider,
    color: providerColors[provider] || '#6b7280',
    icon: providerIcons[provider] || 'cloud',
    percentage: totalCount > 0 ? Math.round((data.count / totalCount) * 100) : 0,
  }));

  const services = [
    { service: 'EC2 / Compute', provider: 'AWS', baseCost: 320, trend: 'up' as const },
    { service: 'RDS / Database', provider: 'AWS', baseCost: 185, trend: 'stable' as const },
    { service: 'S3 / Storage', provider: 'AWS', baseCost: 42, trend: 'down' as const },
    { service: 'Load Balancer', provider: 'AWS', baseCost: 28, trend: 'up' as const },
    { service: 'Lambda / Serverless', provider: 'AWS', baseCost: 8, trend: 'up' as const },
    { service: 'Azure VMs', provider: 'Azure', baseCost: 134, trend: 'stable' as const },
    { service: 'GCP Instances', provider: 'GCP', baseCost: 99, trend: 'up' as const },
    { service: 'Data Transfer', provider: 'Multi', baseCost: 53, trend: 'down' as const },
  ];
  const totalServiceCost = services.reduce((s, svc) => s + svc.baseCost, 0);
  const costBreakdown: CostBreakdown[] = services.map(svc => ({
    ...svc,
    monthly: svc.baseCost,
    yearly: svc.baseCost * 12,
    percentage: Math.round((svc.baseCost / totalServiceCost) * 100),
  }));

  const recentActivity: ActivityEvent[] = Array.from({ length: 12 }, (_, i) => ({
    id: `evt-${i}`,
    action: pick(ACTIVITY_VERBS),
    resourceType: pick(MOCK_RESOURCES).type,
    resourceName: `${pick(RESOURCE_NAMES)}-${Math.floor(Math.random() * 9) + 1}`,
    timestamp: new Date(Date.now() - i * 3600000 - Math.random() * 3600000).toISOString(),
    user: pick(['alice@co.io', 'bob@co.io', 'carol@co.io', 'deploy-bot']),
    provider: pick(['aws', 'azure', 'gcp', 'ansible', 'crossplane']),
  }));

  const complexityMetrics: ComplexityMetric[] = [
    { label: 'Resource Complexity', value: jitter(45, 88), max: 100, color: '#818cf8', icon: 'GitBranch', description: 'Interconnection complexity between resources' },
    { label: 'Security Posture', value: jitter(60, 95), max: 100, color: '#34d399', icon: 'Shield', description: 'Overall security configuration score' },
    { label: 'Cost Efficiency', value: jitter(40, 85), max: 100, color: '#fbbf24', icon: 'DollarSign', description: 'Optimization potential vs current spend' },
    { label: 'Config Completeness', value: jitter(55, 92), max: 100, color: '#60a5fa', icon: 'CheckCircle2', description: 'How fully resources are configured' },
    { label: 'Drift Risk', value: jitter(10, 45), max: 100, color: '#f87171', icon: 'AlertTriangle', description: 'Likelihood of configuration drift (lower is better)' },
    { label: 'Coverage', value: jitter(50, 90), max: 100, color: '#c084fc', icon: 'Layers', description: 'Infrastructure-as-code coverage percentage' },
  ];

  return {
    totalResources: totalCount,
    totalCost: Math.round(totalCost * 100) / 100,
    totalProjects: Math.floor(Math.random() * 8) + 2,
    complexityScore: Math.floor(jitter(55, 92)),
    healthScore: Math.floor(jitter(60, 95)),
    securityScore: Math.floor(jitter(50, 90)),
    resourceStats,
    categoryStats,
    providerStats,
    costBreakdown,
    recentActivity,
    complexityMetrics,
  };
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    Compute: '🖥️', Network: '🌐', Database: '🗄️', Storage: '🪣',
    Security: '🛡️', Serverless: '⚡', Inventory: '📋', Packages: '📦',
    Services: '⚙️', Files: '📄', Commands: '💻', Users: '👤',
  };
  return icons[category] || '📊';
}
