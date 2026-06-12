export type ResourceType =
  // ── Compute ──────────────────────────────────────────────────────────────
  | 'aws_instance'
  | 'aws_autoscaling_group'
  | 'aws_launch_template'
  | 'aws_eks_cluster'
  | 'aws_eks_node_group'
  | 'aws_ecs_cluster'
  | 'aws_ecs_task_definition'
  | 'aws_ecs_service'
  | 'aws_elastic_beanstalk_environment'
  // ── Storage ──────────────────────────────────────────────────────────────
  | 'aws_s3_bucket'
  | 'aws_ebs_volume'
  | 'aws_efs_file_system'
  | 'aws_fsx_lustre_file_system'
  | 'aws_glacier_vault'
  // ── Network ──────────────────────────────────────────────────────────────
  | 'aws_vpc'
  | 'aws_subnet'
  | 'aws_security_group'
  | 'aws_internet_gateway'
  | 'aws_lb'
  | 'aws_route_table'
  | 'aws_nat_gateway'
  | 'aws_eip'
  | 'aws_vpc_peering_connection'
  | 'aws_cloudfront_distribution'
  | 'aws_route53_zone'
  | 'aws_route53_record'
  | 'aws_api_gateway_rest_api'
  | 'aws_apigatewayv2_api'
  | 'aws_vpn_gateway'
  | 'aws_dx_connection'
  // ── Database ─────────────────────────────────────────────────────────────
  | 'aws_rds_instance'
  | 'aws_rds_cluster'
  | 'aws_dynamodb_table'
  | 'aws_elasticache_cluster'
  | 'aws_elasticache_replication_group'
  | 'aws_redshift_cluster'
  | 'aws_neptune_cluster'
  | 'aws_docdb_cluster'
  | 'aws_timestream_database'
  // ── Serverless / Messaging ────────────────────────────────────────────────
  | 'aws_lambda_function'
  | 'aws_sns_topic'
  | 'aws_sqs_queue'
  | 'aws_kinesis_stream'
  | 'aws_kinesis_firehose_delivery_stream'
  | 'aws_eventbridge_rule'
  | 'aws_sfn_state_machine'
  | 'aws_mq_broker'
  // ── Security / IAM ────────────────────────────────────────────────────────
  | 'aws_iam_role'
  | 'aws_iam_policy'
  | 'aws_iam_user'
  | 'aws_iam_group'
  | 'aws_kms_key'
  | 'aws_secretsmanager_secret'
  | 'aws_ssm_parameter'
  | 'aws_wafv2_web_acl'
  | 'aws_shield_protection'
  | 'aws_cognito_user_pool'
  | 'aws_acm_certificate'
  // ── Monitoring / DevOps ───────────────────────────────────────────────────
  | 'aws_cloudwatch_log_group'
  | 'aws_cloudwatch_metric_alarm'
  | 'aws_cloudtrail'
  | 'aws_config_configuration_recorder'
  | 'aws_codepipeline'
  | 'aws_codebuild_project'
  | 'aws_codecommit_repository'
  | 'aws_ecr_repository'
  // ── AI / ML ───────────────────────────────────────────────────────────────
  | 'aws_sagemaker_endpoint'
  | 'aws_sagemaker_model'
  // ── Analytics ─────────────────────────────────────────────────────────────
  | 'aws_athena_workgroup'
  | 'aws_glue_job'
  | 'aws_emr_cluster';

export interface ResourceField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean' | 'textarea';
  default?: string | number | boolean;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

/** A named connection port on a node */
export interface ResourcePort {
  id: string;
  label: string;
  side: 'left' | 'right';
  type: 'target' | 'source';
  color: string;
  accepts?: ResourceType[];
}

export interface ResourceDefinition {
  type: ResourceType;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  category: 'Compute' | 'Storage' | 'Network' | 'Database' | 'Serverless' | 'Security' | 'Monitoring' | 'Analytics' | 'AI/ML' | 'DevOps' | 'Messaging' | 'Inventory' | 'Packages' | 'Services' | 'Files' | 'Commands' | 'Users' | 'Deployment' | 'Docker' | 'Control';
  fields: ResourceField[];
  description: string;
  ports: ResourcePort[];
}

export interface ResourceNodeData {
  resourceType: ResourceType;
  resourceName: string;
  config: Record<string, string | number | boolean>;
  definition: ResourceDefinition;
}

export interface CostCompareNodeData {
  nodeType: 'costCompare';
  serviceId: string;
  serviceName: string;
  icon: string;
  color: string;
  bgColor: string;
  category: string;
  providerConfigs: Record<string, Record<string, string | number | boolean>>;
  resourceName?: string;
  config?: Record<string, string | number | boolean>;
  definition?: ResourceDefinition;
}
