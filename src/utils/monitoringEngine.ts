import { HealthMetric, DriftAlert, CostAnomaly, MonitoringSummary } from '../types/monitoring';

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

const COST_ANOMALIES: Array<{
  serviceName: string;
  provider: 'aws' | 'azure' | 'gcp';
  estimatedCost: number;
  actualCost: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = [
  { serviceName: 'EC2 - Compute',       provider: 'aws',   estimatedCost: 420, actualCost: 680,   severity: 'high' },
  { serviceName: 'RDS - Database',      provider: 'aws',   estimatedCost: 250, actualCost: 310,   severity: 'medium' },
  { serviceName: 'Virtual Machines',    provider: 'azure', estimatedCost: 380, actualCost: 395,   severity: 'low' },
  { serviceName: 'Cloud Storage',       provider: 'gcp',   estimatedCost: 120, actualCost: 210,   severity: 'medium' },
  { serviceName: 'Load Balancer',       provider: 'aws',   estimatedCost: 85,  actualCost: 92,    severity: 'low' },
  { serviceName: 'Kubernetes Engine',   provider: 'gcp',   estimatedCost: 510, actualCost: 890,   severity: 'critical' },
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

export function generateCostAnomalies(): CostAnomaly[] {
  return COST_ANOMALIES.map((a, i) => {
    const deviation = a.actualCost - a.estimatedCost;
    const deviationPct = a.estimatedCost > 0
      ? Math.round((deviation / a.estimatedCost) * 100)
      : 0;
    return {
      id: `anomaly-${i}-${Date.now()}`,
      ...a,
      deviation,
      deviationPct,
      period: 'Last 30 days',
      detectedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    };
  });
}

export function generateMonitoringSummary(healthMetrics: HealthMetric[], driftAlerts: DriftAlert[], costAnomalies: CostAnomaly[]): MonitoringSummary {
  return {
    totalResources: healthMetrics.length,
    healthyResources: healthMetrics.filter(h => h.status === 'healthy').length,
    warningResources: healthMetrics.filter(h => h.status === 'warning').length,
    criticalResources: healthMetrics.filter(h => h.status === 'critical').length,
    driftCount: driftAlerts.length,
    anomalyCount: costAnomalies.length,
    potentialSavings: Math.round(
      costAnomalies.reduce((sum, a) => {
        const overpay = a.actualCost - a.estimatedCost;
        return sum + (overpay > 0 ? overpay * 0.6 : 0);
      }, 0)
    ),
  };
}
