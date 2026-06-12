import { GraphNode } from '../types/graph';

function alarmGenerator(node: GraphNode, resourceType: string): string {
  const name = node.data.fields?.name || node.data.label;
  const threshold = node.data.fields?.threshold ?? 80;
  const period = node.data.fields?.period ?? 300;
  const evaluationPeriods = node.data.fields?.evaluationPeriods ?? 2;
  const statistic = node.data.fields?.statistic ?? 'Average';
  const snsTopicArn = node.data.fields?.snsTopicArn ?? '';
  const alarmDescription = node.data.fields?.alarmDescription ?? '';
  const comparisonOperator = node.data.fields?.comparisonOperator ?? 'GreaterThanThreshold';

  let dimensions = '';
  let metricName = '';
  let namespace = '';

  if (resourceType === 'mon_cw_cpu_alarm') {
    dimensions = '    dimensions = {\n      InstanceId = aws_instance.${replace(node.data.label, "-", "_")}.id\n    }\n';
    metricName = 'CPUUtilization';
    namespace = 'AWS/EC2';
  } else if (resourceType === 'mon_cw_memory_alarm') {
    dimensions = '    dimensions = {\n      InstanceId = aws_instance.${replace(node.data.label, "-", "_")}.id\n    }\n';
    metricName = 'mem_used_percent';
    namespace = 'CWAgent';
  } else if (resourceType === 'mon_cw_status_alarm') {
    dimensions = '    dimensions = {\n      InstanceId = aws_instance.${replace(node.data.label, "-", "_")}.id\n    }\n';
    metricName = 'StatusCheckFailed';
    namespace = 'AWS/EC2';
  }

  const snsBlock = snsTopicArn ? `\n  alarm_actions = ["${snsTopicArn}"]` : '';
  const descBlock = alarmDescription ? `\n  alarm_description = "${alarmDescription}"` : '';

  return `resource "aws_cloudwatch_metric_alarm" "${name}" {
  alarm_name          = "${name}"
  comparison_operator = "${comparisonOperator}"
  evaluation_periods  = "${evaluationPeriods}"
  metric_name         = "${metricName}"
  namespace           = "${namespace}"
  period              = "${period}"
  statistic           = "${statistic}"
  threshold           = "${threshold}"${snsBlock}${descBlock}
${dimensions}}`;
}

function compositeAlarmGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const alarmRule = node.data.fields?.alarmRule ?? '';
  const snsTopicArn = node.data.fields?.snsTopicArn ?? '';
  const alarmDescription = node.data.fields?.alarmDescription ?? '';

  const snsBlock = snsTopicArn ? `\n  alarm_actions = ["${snsTopicArn}"]` : '';
  const descBlock = alarmDescription ? `\n  alarm_description = "${alarmDescription}"` : '';

  return `resource "aws_cloudwatch_composite_alarm" "${name}" {
  alarm_name          = "${name}"
  alarm_rule          = "${alarmRule}"${snsBlock}${descBlock}
}`;
}

function dashboardGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const displayName = node.data.fields?.displayName ?? 'Infrastructure Overview';
  const period = node.data.fields?.period ?? 300;
  const timezone = node.data.fields?.timezone ?? 'UTC';

  const widgets = [
    {
      type: 'metric',
      properties: {
        metrics: [['AWS/EC2', 'CPUUtilization', { period, stat: 'Average' }]],
        period,
        stat: 'Average',
        region: 'us-east-1',
        title: 'EC2 CPU Utilization',
      },
    },
  ];

  return `resource "aws_cloudwatch_dashboard" "${name}" {
  dashboard_name = "${name}"
  dashboard_body = jsonencode({
    widgets = ${JSON.stringify(widgets, null, 4)}
    start = "-PT${Math.round(period / 60)}M"
    periodOverride = "auto"
    timezone = "${timezone}"
  })
}`;
}

function snsTopicGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const displayName = node.data.fields?.displayName ?? '';
  const kmsMasterKeyId = node.data.fields?.kmsMasterKeyId ?? '';

  const dispBlock = displayName ? `\n  display_name = "${displayName}"` : '';
  const kmsBlock = kmsMasterKeyId ? `\n  kms_master_key_id = "${kmsMasterKeyId}"` : '';

  return `resource "aws_sns_topic" "${name}" {${dispBlock}${kmsBlock}
}`;
}

function snsEmailGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const email = node.data.fields?.email ?? '';
  const topicArn = node.data.fields?.topicArn ?? '';
  const protocol = node.data.fields?.protocol ?? 'email';

  const topicBlock = topicArn ? `\n  topic_arn = "${topicArn}"` : '';

  return `resource "aws_sns_topic_subscription" "${name}" {
  protocol   = "${protocol}"
  endpoint   = "${email}"${topicBlock}
}`;
}

function logGroupGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const retention = node.data.fields?.retentionInDays ?? 30;
  const kmsKeyId = node.data.fields?.kmsKeyId ?? '';
  const skipDestroy = node.data.fields?.skipDestroy ?? false;

  const kmsBlock = kmsKeyId ? `\n  kms_key_id = "${kmsKeyId}"` : '';

  return `resource "aws_cloudwatch_log_group" "${name}" {
  name              = "/aws/${name}"
  retention_in_days = ${retention}${kmsBlock}
  skip_destroy      = ${skipDestroy}
}`;
}

function logMetricFilterGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const pattern = node.data.fields?.pattern ?? '[ERROR]';
  const metricName = node.data.fields?.metricName ?? 'ErrorCount';
  const metricNamespace = node.data.fields?.metricNamespace ?? 'AppMetrics';
  const metricValue = node.data.fields?.metricValue ?? '1';
  const defaultValue = node.data.fields?.defaultValue ?? 0;
  const unit = node.data.fields?.unit ?? 'Count';

  return `resource "aws_cloudwatch_log_metric_filter" "${name}" {
  name           = "${name}"
  pattern        = "${pattern}"
  log_group_name = aws_cloudwatch_log_group.${name}.name

  metric_transformation {
    name          = "${metricName}"
    namespace     = "${metricNamespace}"
    value         = "${metricValue}"
    default_value = ${defaultValue}
    unit          = "${unit}"
  }
}`;
}

function syntheticsCanaryGenerator(node: GraphNode): string {
  const name = node.data.fields?.name || node.data.label;
  const url = node.data.fields?.url ?? '';
  const scheduleFrequency = node.data.fields?.scheduleFrequency ?? 5;
  const runtime = node.data.fields?.runtime ?? 'syn-nodejs-puppeteer-4.0';
  const memorySize = node.data.fields?.memorySize ?? 1000;
  const activeTracing = node.data.fields?.activeTracing ?? false;
  const s3Bucket = node.data.fields?.s3Bucket ?? '';
  const alarmSnsTopicArn = node.data.fields?.alarmSnsTopicArn ?? '';

  const script = `const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const pageLoadBlueprint = async function() {
  const page = await synthetics.getPage();
  const url = '${url}';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitFor(1500);
  await synthetics.takeScreenshot('loaded', 'screenshot');
};

exports.handler = async () => {
  return await pageLoadBlueprint();
};`;

  const s3Block = s3Bucket ? `  s3_bucket = "${s3Bucket}"\n` : '';
  const alarmBlock = alarmSnsTopicArn ? `\n  alarm_sns_topic_arn = "${alarmSnsTopicArn}"` : '';

  return `resource "aws_synthetics_canary" "${name}" {
  name                 = "${name}"
  artifact_s3_location = "${s3Bucket || name}-artifacts"
  execution_role_arn   = aws_iam_role.${name}_canary.arn
  handler              = "pageLoadBlueprint.handler"
  runtime_version      = "${runtime}"
  start_canary         = true
${s3Block}  schedule {
    frequency_in_minutes = ${scheduleFrequency}
  }
  run_config {
    timeout_in_minutes = 15
    memory_in_mb       = ${memorySize}
    active_tracing     = ${activeTracing}
  }${alarmBlock}
}`;
}

export function generateMonitoringHCL(node: GraphNode): string {
  const resourceType = node.data.type;

  switch (resourceType) {
    case 'mon_cw_cpu_alarm':
    case 'mon_cw_memory_alarm':
    case 'mon_cw_status_alarm':
      return alarmGenerator(node, resourceType);

    case 'mon_cw_composite_alarm':
      return compositeAlarmGenerator(node);

    case 'mon_cw_dashboard':
      return dashboardGenerator(node);

    case 'mon_sns_topic':
      return snsTopicGenerator(node);

    case 'mon_sns_email':
      return snsEmailGenerator(node);

    case 'mon_cw_loggroup':
      return logGroupGenerator(node);

    case 'mon_cw_log_metric':
      return logMetricFilterGenerator(node);

    case 'mon_cw_synthetics':
      return syntheticsCanaryGenerator(node);

    default:
      throw new Error(`Unknown monitoring resource type: ${resourceType}`);
  }
}
