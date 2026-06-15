import {
  HealthMetric, DriftAlert, MonitoringSummary,
  ComplianceCheck, ComplianceSummary, ResourceTrend, TrendDataPoint,
  Incident, IncidentSummary, AlertRule, TeamMember, Ticket, TicketSummary,
} from '../types/monitoring';

const MOCK_RESOURCES: Array<{
  id: string;
  name: string;
  type: string;
  provider: 'aws' | 'azure' | 'gcp';
  baseCpu: number;
  baseMem: number;
  baseDisk: number;
  baseNet: number;
}> = [
  { id: 'i-0a1b2c3d', name: 'web-server-01',   type: 'aws_instance',    provider: 'aws',   baseCpu: 32,  baseMem: 45, baseDisk: 22, baseNet: 12 },
  { id: 'i-0e4f5g6h', name: 'web-server-02',   type: 'aws_instance',    provider: 'aws',   baseCpu: 68,  baseMem: 72, baseDisk: 45, baseNet: 34 },
  { id: 'i-0i7j8k9l', name: 'db-primary',      type: 'aws_rds_instance', provider: 'aws',   baseCpu: 55,  baseMem: 61, baseDisk: 78, baseNet: 8  },
  { id: 'vm-001',     name: 'app-svc-east',    type: 'azurerm_virtual_machine', provider: 'azure', baseCpu: 28,  baseMem: 33, baseDisk: 19, baseNet: 15 },
  { id: 'vm-002',     name: 'cache-cluster',    type: 'azurerm_redis_cache',     provider: 'azure', baseCpu: 12,  baseMem: 41, baseDisk: 55, baseNet: 22 },
  { id: 'gcp-01',     name: 'compute-engine-a', type: 'google_compute_instance', provider: 'gcp',   baseCpu: 45,  baseMem: 38, baseDisk: 33, baseNet: 27 },
  { id: 'gcp-02',     name: 'compute-engine-b', type: 'google_compute_instance', provider: 'gcp',   baseCpu: 82,  baseMem: 91, baseDisk: 44, baseNet: 63 },
  { id: 'i-0m0n1o2p', name: 'load-balancer',   type: 'aws_lb',           provider: 'aws',   baseCpu: 5,   baseMem: 8,  baseDisk: 2,  baseNet: 71 },
];

const DRIFT_SCENARIOS: Array<{
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  changedFields: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = [
  { resourceName: 'web-server-01', resourceType: 'aws_instance', provider: 'aws',   changedFields: ['security_group', 'instance_type'], severity: 'high' },
  { resourceName: 'db-primary',    resourceType: 'aws_rds_instance', provider: 'aws',   changedFields: ['storage_size'],                     severity: 'medium' },
  { resourceName: 'app-svc-east',  resourceType: 'azurerm_virtual_machine', provider: 'azure', changedFields: ['tags', 'network_interface'],  severity: 'low' },
  { resourceName: 'compute-engine-a', resourceType: 'google_compute_instance', provider: 'gcp', changedFields: ['machine_type', 'service_account'], severity: 'critical' },
];



function jitter(base: number, range: number): number {
  const delta = (Math.random() - 0.5) * range * 2;
  return Math.max(0, Math.min(100, Math.round(base + delta)));
}

export function generateHealthMetrics(): HealthMetric[] {
  return MOCK_RESOURCES.map(r => {
    const cpu = jitter(r.baseCpu, 18);
    const mem = jitter(r.baseMem, 14);
    const disk = jitter(r.baseDisk, 12);
    const net = jitter(r.baseNet, 10);
    const maxUtil = Math.max(cpu, mem, disk, net);
    const status = maxUtil >= 85 ? 'critical' : maxUtil >= 65 ? 'warning' : 'healthy';

    return {
      resourceId: r.id,
      resourceName: r.name,
      resourceType: r.type,
      provider: r.provider,
      status,
      cpu,
      memory: mem,
      disk,
      network: net,
      uptime: Math.floor(Math.random() * 720) + 24,
      lastChecked: new Date().toISOString(),
    };
  });
}

export function generateDriftAlerts(): DriftAlert[] {
  return DRIFT_SCENARIOS.map((s, i) => ({
    id: `drift-${i}-${Date.now()}`,
    ...s,
    status: 'drifted' as const,
    detectedAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
  }));
}

const COMPLIANCE_CHECKS: Array<{
  standard: string;
  control: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  baseStatus: 'pass' | 'fail' | 'na';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
}> = [
  { standard: 'CIS AWS Foundations', control: '1.4 - Root account access key', resourceId: 'i-0a1b2c3d', resourceName: 'web-server-01', resourceType: 'aws_instance', provider: 'aws', baseStatus: 'pass', severity: 'critical', description: 'Ensure no root account access keys exist', remediation: 'Delete root access keys and use IAM roles' },
  { standard: 'CIS AWS Foundations', control: '2.1 - S3 bucket public access', resourceId: 'i-0e4f5g6h', resourceName: 'web-server-02', resourceType: 'aws_instance', provider: 'aws', baseStatus: 'fail', severity: 'high', description: 'S3 bucket allows public read access', remediation: 'Enable Block Public Access settings on the bucket' },
  { standard: 'PCI DSS', control: '3.4 - Encryption at rest', resourceId: 'i-0i7j8k9l', resourceName: 'db-primary', resourceType: 'aws_rds_instance', provider: 'aws', baseStatus: 'pass', severity: 'critical', description: 'RDS encryption at rest is enabled', remediation: 'N/A' },
  { standard: 'HIPAA', control: '5.1 - Audit logging', resourceId: 'vm-001', resourceName: 'app-svc-east', resourceType: 'azurerm_virtual_machine', provider: 'azure', baseStatus: 'fail', severity: 'high', description: 'Diagnostic logs not enabled for virtual machine', remediation: 'Enable Azure Diagnostics extension and configure log analytics' },
  { standard: 'SOC 2', control: 'CC6.1 - Network security', resourceId: 'i-0e4f5g6h', resourceName: 'web-server-02', resourceType: 'aws_instance', provider: 'aws', baseStatus: 'fail', severity: 'critical', description: 'Security group allows unrestricted inbound SSH (0.0.0.0/0)', remediation: 'Restrict SSH inbound rule to specific IP ranges' },
  { standard: 'GDPR', control: '17 - Data retention', resourceId: 'vm-002', resourceName: 'cache-cluster', resourceType: 'azurerm_redis_cache', provider: 'azure', baseStatus: 'na', severity: 'low', description: 'Data retention policy not applicable to Redis cache', remediation: 'N/A' },
  { standard: 'CIS GCP Foundations', control: '3.1 - VM serial ports', resourceId: 'gcp-01', resourceName: 'compute-engine-a', resourceType: 'google_compute_instance', provider: 'gcp', baseStatus: 'pass', severity: 'medium', description: 'Serial port access is disabled on compute instances', remediation: 'N/A' },
  { standard: 'CIS AWS Foundations', control: '4.3 - Security groups', resourceId: 'i-0m0n1o2p', resourceName: 'load-balancer', resourceType: 'aws_lb', provider: 'aws', baseStatus: 'fail', severity: 'medium', description: 'Load balancer security group allows HTTP from 0.0.0.0/0', remediation: 'Restrict HTTP access to known IP ranges' },
  { standard: 'HIPAA', control: '7.2 - Access control', resourceId: 'gcp-02', resourceName: 'compute-engine-b', resourceType: 'google_compute_instance', provider: 'gcp', baseStatus: 'fail', severity: 'high', description: 'VM has public IP without IAM restriction', remediation: 'Remove public IP or restrict with IAM conditions' },
  { standard: 'PCI DSS', control: '10.2 - Log monitoring', resourceId: 'i-0a1b2c3d', resourceName: 'web-server-01', resourceType: 'aws_instance', provider: 'aws', baseStatus: 'pass', severity: 'medium', description: 'CloudTrail logging is enabled for the account', remediation: 'N/A' },
  { standard: 'SOC 2', control: 'CC7.2 - Incident response', resourceId: 'vm-001', resourceName: 'app-svc-east', resourceType: 'azurerm_virtual_machine', provider: 'azure', baseStatus: 'fail', severity: 'critical', description: 'No alert rule configured for VM shutdown events', remediation: 'Configure Azure Monitor alert for VM deallocation events' },
  { standard: 'CIS AWS Foundations', control: '1.20 - IAM password policy', resourceId: 'i-0i7j8k9l', resourceName: 'db-primary', resourceType: 'aws_rds_instance', provider: 'aws', baseStatus: 'na', severity: 'medium', description: 'IAM password policy is not applicable to RDS instances', remediation: 'N/A' },
];

const INCIDENTS: Array<{
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  description: string;
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  duration?: number;
}> = [
  { resourceName: 'compute-engine-b', resourceType: 'google_compute_instance', provider: 'gcp', severity: 'critical', status: 'open', title: 'CPU Critical Threshold Breach', description: 'CPU utilization exceeded 95% for 15 minutes on compute-engine-b', detectedAt: new Date(Date.now() - 1800000).toISOString() },
  { resourceName: 'web-server-01', resourceType: 'aws_instance', provider: 'aws', severity: 'high', status: 'acknowledged', title: 'Network Throughput Spike', description: 'Network outbound traffic spiked to 850 Mbps on web-server-01', detectedAt: new Date(Date.now() - 7200000).toISOString(), acknowledgedAt: new Date(Date.now() - 3600000).toISOString(), acknowledgedBy: 'ops-team@company.com' },
  { resourceName: 'db-primary', resourceType: 'aws_rds_instance', provider: 'aws', severity: 'medium', status: 'resolved', title: 'Disk Space Warning', description: 'Disk utilization exceeded 80% on db-primary, auto-scaling triggered', detectedAt: new Date(Date.now() - 86400000).toISOString(), resolvedAt: new Date(Date.now() - 43200000).toISOString(), duration: 43200000 },
  { resourceName: 'cache-cluster', resourceType: 'azurerm_redis_cache', provider: 'azure', severity: 'high', status: 'resolved', title: 'Redis Out-of-Memory', description: 'Redis cache evicted 12k keys due to memory pressure', detectedAt: new Date(Date.now() - 172800000).toISOString(), resolvedAt: new Date(Date.now() - 129600000).toISOString(), duration: 43200000 },
  { resourceName: 'web-server-02', resourceType: 'aws_instance', provider: 'aws', severity: 'low', status: 'resolved', title: 'Minor Network Jitter', description: 'Network latency increased by 40ms for 5 minutes, auto-recovered', detectedAt: new Date(Date.now() - 259200000).toISOString(), resolvedAt: new Date(Date.now() - 250200000).toISOString(), duration: 9000000 },
  { resourceName: 'app-svc-east', resourceType: 'azurerm_virtual_machine', provider: 'azure', severity: 'medium', status: 'acknowledged', title: 'VM Restart Detected', description: 'app-svc-east was restarted unexpectedly, investigating root cause', detectedAt: new Date(Date.now() - 3600000).toISOString(), acknowledgedAt: new Date(Date.now() - 1800000).toISOString(), acknowledgedBy: 'sre-team@company.com' },
];

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { id: 'rule-1', metric: 'cpu', condition: 'gt', threshold: 85, duration: 300, severity: 'critical', enabled: true, label: 'High CPU Utilization' },
  { id: 'rule-2', metric: 'memory', condition: 'gt', threshold: 90, duration: 300, severity: 'critical', enabled: true, label: 'High Memory Utilization' },
  { id: 'rule-3', metric: 'disk', condition: 'gt', threshold: 85, duration: 600, severity: 'high', enabled: true, label: 'High Disk Utilization' },
  { id: 'rule-4', metric: 'network', condition: 'gt', threshold: 80, duration: 300, severity: 'high', enabled: false, label: 'High Network Utilization' },
  { id: 'rule-5', metric: 'cpu', condition: 'gt', threshold: 95, duration: 60, severity: 'critical', enabled: true, label: 'CPU Critical Emergency' },
  { id: 'rule-6', metric: 'disk', condition: 'gt', threshold: 95, duration: 120, severity: 'critical', enabled: true, label: 'Disk Critical Emergency' },
];

export function generateComplianceChecks(): ComplianceCheck[] {
  return COMPLIANCE_CHECKS.map((c, i) => ({
    id: `comp-${i}-${Date.now()}`,
    ...c,
    status: Math.random() < 0.15 && c.baseStatus === 'pass' ? 'fail' : c.baseStatus,
    checkedAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
  }));
}

export function generateComplianceSummary(checks: ComplianceCheck[]): ComplianceSummary {
  const totalChecks = checks.length;
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const na = checks.filter(c => c.status === 'na').length;
  const score = totalChecks - na > 0 ? Math.round((passed / (totalChecks - na)) * 100) : 100;
  return { totalChecks, passed, failed, na, score };
}

function generateTrendDataPoints(baseValue: number, volatile: boolean, count: number): TrendDataPoint[] {
  const points: TrendDataPoint[] = [];
  let cpu = baseValue;
  let mem = baseValue * 0.8;
  let disk = baseValue * 0.5;
  let net = baseValue * 0.3;
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const range = volatile ? 25 : 12;
    cpu = Math.max(0, Math.min(100, cpu + (Math.random() - 0.5) * range));
    mem = Math.max(0, Math.min(100, mem + (Math.random() - 0.5) * (range * 0.8)));
    disk = Math.max(0, Math.min(100, disk + (Math.random() - 0.5) * (range * 0.6)));
    net = Math.max(0, Math.min(100, net + (Math.random() - 0.5) * (range * 1.2)));
    points.push({
      timestamp: new Date(now - i * 3600000).toISOString(),
      cpu: Math.round(cpu),
      memory: Math.round(mem),
      disk: Math.round(disk),
      network: Math.round(net),
    });
  }
  return points;
}

export function generateResourceTrends(): ResourceTrend[] {
  return MOCK_RESOURCES.map(r => ({
    resourceId: r.id,
    resourceName: r.name,
    resourceType: r.type,
    provider: r.provider,
    dataPoints: generateTrendDataPoints(r.baseCpu, r.baseCpu > 60, 24),
  }));
}

export function generateIncidents(): Incident[] {
  return INCIDENTS.map((inc, i) => ({
    id: `inc-${i}-${Date.now()}`,
    ...inc,
  }));
}

export function generateIncidentSummary(incidents: Incident[]): IncidentSummary {
  const resolved = incidents.filter(i => i.status === 'resolved');
  const totalMttr = resolved.reduce((sum, i) => sum + (i.duration || 0), 0);
  return {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open').length,
    acknowledged: incidents.filter(i => i.status === 'acknowledged').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
    mttr: resolved.length > 0 ? Math.round(totalMttr / resolved.length / 60000) : 0,
  };
}

export function evaluateAlertRules(metric: HealthMetric, rules: AlertRule[]): AlertRule[] {
  const values: Record<string, number> = {
    cpu: metric.cpu,
    memory: metric.memory,
    disk: metric.disk,
    network: metric.network,
  };
  return rules.filter(r => {
    if (!r.enabled) return false;
    const val = values[r.metric];
    if (val === undefined) return false;
    switch (r.condition) {
      case 'gt': return val > r.threshold;
      case 'lt': return val < r.threshold;
      case 'gte': return val >= r.threshold;
      case 'lte': return val <= r.threshold;
      default: return false;
    }
  });
}

export function generateMonitoringSummary(healthMetrics: HealthMetric[], driftAlerts: DriftAlert[]): MonitoringSummary {
  return {
    totalResources: healthMetrics.length,
    healthyResources: healthMetrics.filter(h => h.status === 'healthy').length,
    warningResources: healthMetrics.filter(h => h.status === 'warning').length,
    criticalResources: healthMetrics.filter(h => h.status === 'critical').length,
    driftCount: driftAlerts.length,
  };
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm-1', name: 'Prathmesh', role: 'SRE Lead',        email: 'prathmesh@infrastudio.io', initials: 'PR', color: '#818cf8' },
  { id: 'tm-2', name: 'Apurv',     role: 'Cloud Engineer',  email: 'apurv@infrastudio.io',     initials: 'AP', color: '#34d399' },
  { id: 'tm-3', name: 'Pradip',    role: 'DevOps Engineer', email: 'pradip@infrastudio.io',    initials: 'PD', color: '#fbbf24' },
  { id: 'tm-4', name: 'Shweta',    role: 'Security Eng',    email: 'shweta@infrastudio.io',    initials: 'SH', color: '#f87171' },
  { id: 'tm-5', name: 'Amol',      role: 'Platform Eng',    email: 'amol@infrastudio.io',      initials: 'AM', color: '#60a5fa' },
  { id: 'tm-6', name: 'Renuka',    role: 'DevOps Engineer', email: 'renuka@infrastudio.io',    initials: 'RE', color: '#a78bfa' },
];

const TICKET_SEED: Array<{
  title: string; description: string; severity: Ticket['severity']; status: Ticket['status'];
  source: string; resourceName: string; resourceType: string; provider: Ticket['provider'];
  assigneeIdx?: number; resolution?: string;
}> = [
  { title: 'CPU Critical Breach — compute-engine-b', description: 'CPU utilization exceeded 95% for 15 minutes. Instance is throttling and impacting application latency.', severity: 'critical', status: 'open', source: 'CPU Alert Rule', resourceName: 'compute-engine-b', resourceType: 'google_compute_instance', provider: 'gcp' },
  { title: 'Memory Pressure — db-primary', description: 'Memory utilization at 91% on db-primary. Database query performance degrading. Investigate connection pool and query optimization.', severity: 'critical', status: 'open', source: 'Memory Alert Rule', resourceName: 'db-primary', resourceType: 'aws_rds_instance', provider: 'aws' },
  { title: 'Network Spike — web-server-01', description: 'Network outbound traffic spiked to 850 Mbps. Possible data exfiltration or misconfigured service.', severity: 'high', status: 'in_progress', source: 'Network Alert Rule', resourceName: 'web-server-01', resourceType: 'aws_instance', provider: 'aws', assigneeIdx: 0 },
  { title: 'Disk Space Warning — db-primary', description: 'Disk utilization at 82% and growing 2%/day. Estimate full in 9 days. Plan storage resize or cleanup.', severity: 'high', status: 'open', source: 'Disk Alert Rule', resourceName: 'db-primary', resourceType: 'aws_rds_instance', provider: 'aws' },
  { title: 'VM Restart Detected — app-svc-east', description: 'Unexpected VM restart on app-svc-east. Check Azure VM health events and guest OS logs.', severity: 'medium', status: 'open', source: 'Health Event', resourceName: 'app-svc-east', resourceType: 'azurerm_virtual_machine', provider: 'azure' },
  { title: 'S3 Bucket Public Access', description: 'Security compliance: S3 bucket web-server-02-logs allows public read access. Restrict immediately.', severity: 'critical', status: 'in_progress', source: 'Compliance Scan', resourceName: 'web-server-02', resourceType: 'aws_s3_bucket', provider: 'aws', assigneeIdx: 3 },
  { title: 'Redis Memory Pressure', description: 'Cache cluster evicted 12k keys due to memory pressure. Consider scaling up or enabling clustering.', severity: 'medium', status: 'resolved', source: 'Memory Alert Rule', resourceName: 'cache-cluster', resourceType: 'azurerm_redis_cache', provider: 'azure', assigneeIdx: 1, resolution: 'Scaled Redis from Standard_B2s to Standard_B4ms. Memory headroom restored.' },
  { title: 'SSH Inbound Rule Open', description: 'Security group sg-web allows SSH (0.0.0.0/0). Remove public SSH access and use SSM Session Manager.', severity: 'critical', status: 'open', source: 'Compliance Scan', resourceName: 'web-server-02', resourceType: 'aws_security_group', provider: 'aws' },
];

export function generateTickets(): Ticket[] {
  return TICKET_SEED.map((t, i) => ({
    id: `ticket-${i}-${Date.now()}`,
    ...t,
    assignee: t.assigneeIdx !== undefined ? TEAM_MEMBERS[t.assigneeIdx] : undefined,
    createdBy: 'Monitoring System',
    createdAt: new Date(Date.now() - Math.random() * 86400000 * 2).toISOString(),
    assignedAt: t.assigneeIdx !== undefined ? new Date(Date.now() - 3600000).toISOString() : undefined,
    resolvedAt: t.status === 'resolved' ? new Date(Date.now() - 1800000).toISOString() : undefined,
    priority: t.severity === 'critical' ? 1 : t.severity === 'high' ? 2 : 3,
  }));
}

export function generateTicketSummary(tickets: Ticket[]): TicketSummary {
  return {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    critical: tickets.filter(t => t.severity === 'critical').length,
    unassigned: tickets.filter(t => !t.assignee).length,
  };
}
