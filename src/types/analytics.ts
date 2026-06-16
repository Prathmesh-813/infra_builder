export interface ResourceStat {
  type: string;
  label: string;
  count: number;
  cost: number;
  icon: string;
  color: string;
  category: string;
  provider: string;
}

export interface CategoryStat {
  category: string;
  count: number;
  cost: number;
  color: string;
  icon: string;
}

export interface ProviderStat {
  provider: string;
  label: string;
  count: number;
  cost: number;
  color: string;
  icon: string;
  percentage: number;
}

export interface CostBreakdown {
  service: string;
  provider: string;
  monthly: number;
  yearly: number;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
}

export interface ActivityEvent {
  id: string;
  action: string;
  resourceType: string;
  resourceName: string;
  timestamp: string;
  user: string;
  provider: string;
}

export interface ComplexityMetric {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: string;
  description: string;
}

export interface AnalyticsSummary {
  totalResources: number;
  totalCost: number;
  totalProjects: number;
  complexityScore: number;
  healthScore: number;
  securityScore: number;
  resourceStats: ResourceStat[];
  categoryStats: CategoryStat[];
  providerStats: ProviderStat[];
  costBreakdown: CostBreakdown[];
  recentActivity: ActivityEvent[];
  complexityMetrics: ComplexityMetric[];
}
