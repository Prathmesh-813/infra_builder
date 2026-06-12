export type ResourceHealth = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface HealthMetric {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  status: ResourceHealth;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  uptime: number;
  lastChecked: string;
}

export interface DriftAlert {
  id: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  status: 'drifted' | 'synced' | 'missing' | 'untracked';
  changedFields: string[];
  detectedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CostAnomaly {
  id: string;
  serviceName: string;
  provider: 'aws' | 'azure' | 'gcp';
  estimatedCost: number;
  actualCost: number;
  deviation: number;
  deviationPct: number;
  period: string;
  detectedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MonitoringSummary {
  totalResources: number;
  healthyResources: number;
  warningResources: number;
  criticalResources: number;
  driftCount: number;
  anomalyCount: number;
  potentialSavings: number;
}
