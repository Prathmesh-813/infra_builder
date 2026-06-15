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

export interface MonitoringSummary {
  totalResources: number;
  healthyResources: number;
  warningResources: number;
  criticalResources: number;
  driftCount: number;
}

export interface ComplianceCheck {
  id: string;
  standard: string;
  control: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  status: 'pass' | 'fail' | 'na' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
  checkedAt: string;
}

export interface ComplianceSummary {
  totalChecks: number;
  passed: number;
  failed: number;
  na: number;
  score: number;
}

export interface TrendDataPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface ResourceTrend {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  dataPoints: TrendDataPoint[];
}

export interface Incident {
  id: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  description: string;
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  duration?: number;
  acknowledgedBy?: string;
}

export interface IncidentSummary {
  total: number;
  open: number;
  acknowledged: number;
  resolved: number;
  mttr: number;
}

export interface AlertRule {
  id: string;
  metric: string;
  condition: 'gt' | 'lt' | 'gte' | 'lte';
  threshold: number;
  duration: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  label: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  initials: string;
  color: string;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: TicketStatus;
  source: string;
  resourceName: string;
  resourceType: string;
  provider: 'aws' | 'azure' | 'gcp';
  assignee?: TeamMember;
  createdBy?: string;
  createdAt: string;
  assignedAt?: string;
  resolvedAt?: string;
  resolution?: string;
  priority: number;
}

export interface TicketSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
  unassigned: number;
}
