import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';

// ── helpers ───────────────────────────────────────────────────────────────────
function yamlStr(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const s = String(val);
  if (/[:{}\[\],&*#?|<>=!%@`]/.test(s) || s.includes('\n') || s.trim() !== s) {
    return JSON.stringify(s);
  }
  return s || '""';
}

function tagsBlock(cfg: Record<string, unknown>, prefix = '    '): string {
  const lines: string[] = [];
  if (cfg['tags_name']) lines.push(`${prefix}Name: ${yamlStr(cfg['tags_name'])}`);
  lines.push(`${prefix}managed-by: crossplane`);
  return lines.join('\n');
}

function labelsBlock(cfg: Record<string, unknown>, prefix = '    '): string {
  const lines: string[] = [];
  if (cfg['tags_name']) lines.push(`${prefix}name: ${yamlStr(cfg['tags_name'])}`);
  lines.push(`${prefix}managed-by: crossplane`);
  return lines.join('\n');
}

function dp(cfg: Record<string, unknown>): string {
  return String(cfg['deletionPolicy'] ?? 'Delete');
}

function boolVal(v: unknown): string {
  return v === true || v === 'true' ? 'true' : 'false';
}

// ── AWS generators ────────────────────────────────────────────────────────────
function genAwsInstance(name: string, cfg: Record<string, unknown>): string {
  const lines = [
    `apiVersion: ec2.aws.upbound.io/v1beta1`,
    `kind: Instance`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `  labels:`,
    `    app: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    ami: ${yamlStr(cfg['ami'] ?? 'ami-0c55b159cbfafe1f0')}`,
    `    instanceType: ${yamlStr(cfg['instanceType'] ?? 't3.micro')}`,
  ];
  if (cfg['keyName']) lines.push(`    keyName: ${yamlStr(cfg['keyName'])}`);
  if (cfg['subnetId']) lines.push(`    subnetId: ${yamlStr(cfg['subnetId'])}`);
  lines.push(`    tags:`);
  lines.push(tagsBlock(cfg));
  lines.push(`  providerConfigRef:`);
  lines.push(`    name: aws-provider-config`);
  return lines.join('\n');
}

function genAwsS3Bucket(name: string, cfg: Record<string, unknown>): string {
  const lines = [
    `apiVersion: s3.aws.upbound.io/v1beta1`,
    `kind: Bucket`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    acl: ${yamlStr(cfg['acl'] ?? 'private')}`,
  ];
  if (cfg['versioning'] === true || cfg['versioning'] === 'true') {
    lines.push(`    versioningConfiguration:`);
    lines.push(`      - status: Enabled`);
  }
  lines.push(`    tags:`);
  lines.push(tagsBlock(cfg));
  lines.push(`  providerConfigRef:`);
  lines.push(`    name: aws-provider-config`);
  return lines.join('\n');
}

function genAwsRds(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: rds.aws.upbound.io/v1beta1`,
    `kind: Instance`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    engine: ${yamlStr(cfg['engine'] ?? 'mysql')}`,
    `    engineVersion: ${yamlStr(cfg['engineVersion'] ?? '8.0')}`,
    `    instanceClass: ${yamlStr(cfg['instanceClass'] ?? 'db.t3.micro')}`,
    `    allocatedStorage: ${Number(cfg['allocatedStorage'] ?? 20)}`,
    `    username: ${yamlStr(cfg['masterUsername'] ?? 'admin')}`,
    `    multiAz: ${boolVal(cfg['multiAZ'])}`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: aws-provider-config`,
  ].join('\n');
}

function genAwsVpc(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: ec2.aws.upbound.io/v1beta1`,
    `kind: VPC`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    cidrBlock: ${yamlStr(cfg['cidrBlock'] ?? '10.0.0.0/16')}`,
    `    enableDnsHostnames: ${cfg['enableDnsHostnames'] === false || cfg['enableDnsHostnames'] === 'false' ? 'false' : 'true'}`,
    `    enableDnsSupport: ${cfg['enableDnsSupport'] === false || cfg['enableDnsSupport'] === 'false' ? 'false' : 'true'}`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: aws-provider-config`,
  ].join('\n');
}

function genAwsEks(name: string, cfg: Record<string, unknown>): string {
  const cluster = [
    `apiVersion: eks.aws.upbound.io/v1beta1`,
    `kind: Cluster`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    version: ${yamlStr(cfg['version'] ?? '1.29')}`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: aws-provider-config`,
  ].join('\n');

  const ng = [
    `apiVersion: eks.aws.upbound.io/v1beta1`,
    `kind: NodeGroup`,
    `metadata:`,
    `  name: ${yamlStr(name + '-ng')}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    clusterNameRef:`,
    `      name: ${yamlStr(name)}`,
    `    instanceTypes:`,
    `      - ${yamlStr(cfg['nodeInstanceType'] ?? 't3.medium')}`,
    `    scalingConfig:`,
    `      - desiredSize: ${Number(cfg['nodeCount'] ?? 2)}`,
    `        minSize: ${Number(cfg['minNodes'] ?? 1)}`,
    `        maxSize: ${Number(cfg['maxNodes'] ?? 5)}`,
    `  providerConfigRef:`,
    `    name: aws-provider-config`,
  ].join('\n');

  return cluster + '\n---\n' + ng;
}

function genAwsLambda(name: string, cfg: Record<string, unknown>): string {
  const lines = [
    `apiVersion: lambda.aws.upbound.io/v1beta1`,
    `kind: Function`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    runtime: ${yamlStr(cfg['runtime'] ?? 'nodejs18.x')}`,
    `    handler: ${yamlStr(cfg['handler'] ?? 'index.handler')}`,
    `    memorySize: ${Number(cfg['memorySize'] ?? 128)}`,
    `    timeout: ${Number(cfg['timeout'] ?? 30)}`,
  ];
  if (cfg['s3Bucket']) lines.push(`    s3Bucket: ${yamlStr(cfg['s3Bucket'])}`);
  if (cfg['s3Key']) lines.push(`    s3Key: ${yamlStr(cfg['s3Key'])}`);
  lines.push(`    tags:`);
  lines.push(tagsBlock(cfg));
  lines.push(`  providerConfigRef:`);
  lines.push(`    name: aws-provider-config`);
  return lines.join('\n');
}

function genAwsIamRole(name: string, cfg: Record<string, unknown>): string {
  const lines = [
    `apiVersion: iam.aws.upbound.io/v1beta1`,
    `kind: Role`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    path: ${yamlStr(cfg['path'] ?? '/')}`,
  ];
  if (cfg['description']) lines.push(`    description: ${yamlStr(cfg['description'])}`);
  lines.push(`    tags:`);
  lines.push(tagsBlock(cfg));
  lines.push(`  providerConfigRef:`);
  lines.push(`    name: aws-provider-config`);
  return lines.join('\n');
}

function genAwsDynamodb(name: string, cfg: Record<string, unknown>): string {
  const hashKey = String(cfg['hashKey'] ?? 'id');
  const hashKeyType = String(cfg['hashKeyType'] ?? 'S');
  return [
    `apiVersion: dynamodb.aws.upbound.io/v1beta1`,
    `kind: Table`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
    `    billingMode: ${yamlStr(cfg['billingMode'] ?? 'PAY_PER_REQUEST')}`,
    `    hashKey: ${yamlStr(hashKey)}`,
    `    attribute:`,
    `      - name: ${yamlStr(hashKey)}`,
    `        type: ${yamlStr(hashKeyType)}`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: aws-provider-config`,
  ].join('\n');
}

function genAwsSns(name: string, cfg: Record<string, unknown>): string {
  const lines = [
    `apiVersion: sns.aws.upbound.io/v1beta1`,
    `kind: Topic`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
  ];
  if (cfg['fifoTopic'] === true || cfg['fifoTopic'] === 'true') {
    lines.push(`    fifoTopic: true`);
  }
  lines.push(`    tags:`);
  lines.push(tagsBlock(cfg));
  lines.push(`  providerConfigRef:`);
  lines.push(`    name: aws-provider-config`);
  return lines.join('\n');
}

function genAwsSqs(name: string, cfg: Record<string, unknown>): string {
  const lines = [
    `apiVersion: sqs.aws.upbound.io/v1beta1`,
    `kind: Queue`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-east-1')}`,
  ];
  if (cfg['fifoQueue'] === true || cfg['fifoQueue'] === 'true') {
    lines.push(`    fifoQueue: true`);
  }
  lines.push(`    visibilityTimeoutSeconds: ${Number(cfg['visibilityTimeoutSeconds'] ?? 30)}`);
  lines.push(`    messageRetentionSeconds: ${Number(cfg['messageRetentionSeconds'] ?? 345600)}`);
  lines.push(`    tags:`);
  lines.push(tagsBlock(cfg));
  lines.push(`  providerConfigRef:`);
  lines.push(`    name: aws-provider-config`);
  return lines.join('\n');
}

// ── Azure generators ──────────────────────────────────────────────────────────
function genAzResourceGroup(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: azure.upbound.io/v1beta1`,
    `kind: ResourceGroup`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    location: ${yamlStr(cfg['location'] ?? 'East US')}`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: azure-provider-config`,
  ].join('\n');
}

function genAzVm(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: compute.azure.upbound.io/v1beta1`,
    `kind: LinuxVirtualMachine`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    location: ${yamlStr(cfg['location'] ?? 'East US')}`,
    `    resourceGroupName: ${yamlStr(cfg['resourceGroupName'] ?? '')}`,
    `    size: ${yamlStr(cfg['vmSize'] ?? 'Standard_B2s')}`,
    `    adminUsername: ${yamlStr(cfg['adminUsername'] ?? 'azureuser')}`,
    `    osDisk:`,
    `      - storageAccountType: ${yamlStr(cfg['osDiskType'] ?? 'Premium_LRS')}`,
    `        caching: ReadWrite`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: azure-provider-config`,
  ].join('\n');
}

function genAzAks(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: containerservice.azure.upbound.io/v1beta1`,
    `kind: KubernetesCluster`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    location: ${yamlStr(cfg['location'] ?? 'East US')}`,
    `    resourceGroupName: ${yamlStr(cfg['resourceGroupName'] ?? '')}`,
    `    kubernetesVersion: ${yamlStr(cfg['kubernetesVersion'] ?? '1.29')}`,
    `    defaultNodePool:`,
    `      - name: default`,
    `        nodeCount: ${Number(cfg['nodeCount'] ?? 3)}`,
    `        vmSize: ${yamlStr(cfg['vmSize'] ?? 'Standard_D2s_v3')}`,
    `    identity:`,
    `      - type: SystemAssigned`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: azure-provider-config`,
  ].join('\n');
}

function genAzStorage(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: storage.azure.upbound.io/v1beta1`,
    `kind: Account`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    location: ${yamlStr(cfg['location'] ?? 'East US')}`,
    `    resourceGroupName: ${yamlStr(cfg['resourceGroupName'] ?? '')}`,
    `    accountTier: ${yamlStr(cfg['accountTier'] ?? 'Standard')}`,
    `    accountReplicationType: ${yamlStr(cfg['replicationType'] ?? 'LRS')}`,
    `    accountKind: StorageV2`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: azure-provider-config`,
  ].join('\n');
}

function genAzSql(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: sql.azure.upbound.io/v1beta1`,
    `kind: MSSQLDatabase`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    resourceGroupName: ${yamlStr(cfg['resourceGroupName'] ?? '')}`,
    `    skuName: ${yamlStr(cfg['skuName'] ?? 'S1')}`,
    `    maxSizeGb: ${Number(cfg['maxSizeGb'] ?? 32)}`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: azure-provider-config`,
  ].join('\n');
}

function genAzKeyVault(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: keyvault.azure.upbound.io/v1beta1`,
    `kind: Vault`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    location: ${yamlStr(cfg['location'] ?? 'East US')}`,
    `    resourceGroupName: ${yamlStr(cfg['resourceGroupName'] ?? '')}`,
    `    skuName: ${yamlStr(cfg['skuName'] ?? 'standard')}`,
    `    softDeleteRetentionDays: ${Number(cfg['softDeleteRetentionDays'] ?? 90)}`,
    `    purgeProtectionEnabled: true`,
    `    tags:`,
    tagsBlock(cfg),
    `  providerConfigRef:`,
    `    name: azure-provider-config`,
  ].join('\n');
}

// ── GCP generators ────────────────────────────────────────────────────────────
function genGcpInstance(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: compute.gcp.upbound.io/v1beta1`,
    `kind: Instance`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    project: ${yamlStr(cfg['project'] ?? '')}`,
    `    zone: ${yamlStr(cfg['zone'] ?? 'us-central1-a')}`,
    `    machineType: ${yamlStr(cfg['machineType'] ?? 'e2-medium')}`,
    `    bootDisk:`,
    `      - initializeParams:`,
    `          - image: ${yamlStr(cfg['image'] ?? 'debian-cloud/debian-11')}`,
    `            size: ${Number(cfg['diskSizeGb'] ?? 50)}`,
    `    networkInterface:`,
    `      - network: default`,
    `    labels:`,
    labelsBlock(cfg),
    `  providerConfigRef:`,
    `    name: gcp-provider-config`,
  ].join('\n');
}

function genGcpGke(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: container.gcp.upbound.io/v1beta1`,
    `kind: Cluster`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    project: ${yamlStr(cfg['project'] ?? '')}`,
    `    location: ${yamlStr(cfg['location'] ?? 'us-central1')}`,
    `    initialNodeCount: ${Number(cfg['initialNodeCount'] ?? 3)}`,
    `    nodeConfig:`,
    `      - machineType: ${yamlStr(cfg['machineType'] ?? 'e2-medium')}`,
    `        diskSizeGb: ${Number(cfg['diskSizeGb'] ?? 100)}`,
    `    labels:`,
    labelsBlock(cfg),
    `  providerConfigRef:`,
    `    name: gcp-provider-config`,
  ].join('\n');
}

function genGcpBucket(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: storage.gcp.upbound.io/v1beta1`,
    `kind: Bucket`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    project: ${yamlStr(cfg['project'] ?? '')}`,
    `    location: ${yamlStr(cfg['location'] ?? 'US')}`,
    `    storageClass: ${yamlStr(cfg['storageClass'] ?? 'STANDARD')}`,
    `    uniformBucketLevelAccess: ${boolVal(cfg['uniformBucketLevelAccess'] ?? true)}`,
    `    labels:`,
    labelsBlock(cfg),
    `  providerConfigRef:`,
    `    name: gcp-provider-config`,
  ].join('\n');
}

function genGcpSql(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: sql.gcp.upbound.io/v1beta1`,
    `kind: DatabaseInstance`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    project: ${yamlStr(cfg['project'] ?? '')}`,
    `    region: ${yamlStr(cfg['region'] ?? 'us-central1')}`,
    `    databaseVersion: ${yamlStr(cfg['databaseVersion'] ?? 'MYSQL_8_0')}`,
    `    settings:`,
    `      - tier: ${yamlStr(cfg['tier'] ?? 'db-f1-micro')}`,
    `        diskSize: ${Number(cfg['diskSize'] ?? 20)}`,
    `    labels:`,
    labelsBlock(cfg),
    `  providerConfigRef:`,
    `    name: gcp-provider-config`,
  ].join('\n');
}

function genGcpVpc(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: compute.gcp.upbound.io/v1beta1`,
    `kind: Network`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    project: ${yamlStr(cfg['project'] ?? '')}`,
    `    autoCreateSubnetworks: ${boolVal(cfg['autoCreateSubnetworks'])}`,
    `    routingMode: ${yamlStr(cfg['routingMode'] ?? 'REGIONAL')}`,
    `    labels:`,
    labelsBlock(cfg),
    `  providerConfigRef:`,
    `    name: gcp-provider-config`,
  ].join('\n');
}

function genGcpCloudRun(name: string, cfg: Record<string, unknown>): string {
  return [
    `apiVersion: cloudrun.gcp.upbound.io/v1beta1`,
    `kind: Service`,
    `metadata:`,
    `  name: ${yamlStr(name)}`,
    `  annotations:`,
    `    crossplane.io/external-name: ${yamlStr(name)}`,
    `spec:`,
    `  deletionPolicy: ${dp(cfg)}`,
    `  forProvider:`,
    `    project: ${yamlStr(cfg['project'] ?? '')}`,
    `    location: ${yamlStr(cfg['location'] ?? 'us-central1')}`,
    `    template:`,
    `      - containers:`,
    `          - image: ${yamlStr(cfg['image'] ?? 'gcr.io/my-project/my-image:latest')}`,
    `            ports:`,
    `              - containerPort: ${Number(cfg['containerPort'] ?? 8080)}`,
    `        scaling:`,
    `          - minInstanceCount: ${Number(cfg['minInstances'] ?? 0)}`,
    `            maxInstanceCount: ${Number(cfg['maxInstances'] ?? 10)}`,
    `    labels:`,
    labelsBlock(cfg),
    `  providerConfigRef:`,
    `    name: gcp-provider-config`,
  ].join('\n');
}

// ── Node dispatcher ───────────────────────────────────────────────────────────
function generateNodeYaml(node: Node<ResourceNodeData>): string | null {
  const name = node.data.resourceName ?? 'unnamed';
  const cfg = (node.data.config ?? {}) as Record<string, unknown>;
  const type = node.data.definition?.type ?? node.data.resourceType;

  switch (String(type)) {
    // AWS
    case 'xp_aws_instance':  return genAwsInstance(name, cfg);
    case 'xp_aws_s3bucket':  return genAwsS3Bucket(name, cfg);
    case 'xp_aws_rds':       return genAwsRds(name, cfg);
    case 'xp_aws_vpc':       return genAwsVpc(name, cfg);
    case 'xp_aws_eks':       return genAwsEks(name, cfg);
    case 'xp_aws_lambda':    return genAwsLambda(name, cfg);
    case 'xp_aws_iamrole':   return genAwsIamRole(name, cfg);
    case 'xp_aws_dynamodb':  return genAwsDynamodb(name, cfg);
    case 'xp_aws_sns':       return genAwsSns(name, cfg);
    case 'xp_aws_sqs':       return genAwsSqs(name, cfg);
    // Azure
    case 'xp_az_resourcegroup': return genAzResourceGroup(name, cfg);
    case 'xp_az_vm':            return genAzVm(name, cfg);
    case 'xp_az_aks':           return genAzAks(name, cfg);
    case 'xp_az_storage':       return genAzStorage(name, cfg);
    case 'xp_az_sql':           return genAzSql(name, cfg);
    case 'xp_az_keyvault':      return genAzKeyVault(name, cfg);
    // GCP
    case 'xp_gcp_instance':  return genGcpInstance(name, cfg);
    case 'xp_gcp_gke':       return genGcpGke(name, cfg);
    case 'xp_gcp_bucket':    return genGcpBucket(name, cfg);
    case 'xp_gcp_sql':       return genGcpSql(name, cfg);
    case 'xp_gcp_vpc':       return genGcpVpc(name, cfg);
    case 'xp_gcp_cloudrun':  return genGcpCloudRun(name, cfg);
    default: return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate Kubernetes YAML manifests for all Crossplane managed resources on the canvas.
 */
export function generateCrossplane(
  nodes: Node<ResourceNodeData>[],
  _region: string,
  _profile: string,
): string {
  const header = [
    `# ============================================================`,
    `# Crossplane Managed Resources`,
    `# Generated by InfraStudio`,
    `# `,
    `# Prerequisites:`,
    `#   1. Install Crossplane: helm install crossplane crossplane-stable/crossplane -n crossplane-system`,
    `#   2. Install provider packages (see install.yaml)`,
    `#   3. Configure ProviderConfig with cloud credentials`,
    `# `,
    `# Apply: kubectl apply -f managed-resources.yaml`,
    `# ============================================================`,
  ].join('\n');

  if (nodes.length === 0) {
    return header + '\n\n# No resources on canvas. Drag resources from the sidebar to get started.\n';
  }

  const manifests: string[] = [];
  for (const node of nodes) {
    const yaml = generateNodeYaml(node);
    if (yaml) manifests.push(yaml);
  }

  if (manifests.length === 0) {
    return header + '\n\n# No Crossplane resources found on canvas.\n';
  }

  return header + '\n---\n' + manifests.join('\n---\n') + '\n';
}

/**
 * Generate Crossplane installation manifests and ProviderConfig for the selected cloud provider(s).
 */
export function generateCrossplaneInstallManifest(
  provider: 'aws' | 'azure' | 'gcp' | 'all',
): string {
  const lines: string[] = [
    `# ============================================================`,
    `# Crossplane Installation & Provider Configuration`,
    `# ============================================================`,
    `#`,
    `# Step 1: Add the Crossplane Helm repository`,
    `#   helm repo add crossplane-stable https://charts.crossplane.io/stable`,
    `#   helm repo update`,
    `#`,
    `# Step 2: Install Crossplane`,
    `#   kubectl create namespace crossplane-system`,
    `#   helm install crossplane crossplane-stable/crossplane \\`,
    `#     --namespace crossplane-system \\`,
    `#     --set args='{--enable-composition-revisions}'`,
    `#`,
    `# Step 3: Apply this file`,
    `#   kubectl apply -f install.yaml`,
    `#`,
    `# ============================================================`,
    ``,
  ];

  const includeAws = provider === 'aws' || provider === 'all';
  const includeAzure = provider === 'azure' || provider === 'all';
  const includeGcp = provider === 'gcp' || provider === 'all';

  if (includeAws) {
    lines.push(
      `# ── AWS Provider ─────────────────────────────────────────────`,
      `apiVersion: pkg.crossplane.io/v1`,
      `kind: Provider`,
      `metadata:`,
      `  name: upbound-provider-aws`,
      `spec:`,
      `  package: xpkg.upbound.io/upbound/provider-aws:v0.47.0`,
      `  controllerConfigRef:`,
      `    name: provider-config`,
      `---`,
      `# Create a Kubernetes secret with AWS credentials first:`,
      `#   kubectl create secret generic aws-creds \\`,
      `#     --from-file=creds=./aws-credentials.txt \\`,
      `#     -n crossplane-system`,
      `#`,
      `# aws-credentials.txt format:`,
      `#   [default]`,
      `#   aws_access_key_id = AKIAIOSFODNN7EXAMPLE`,
      `#   aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`,
      `apiVersion: aws.upbound.io/v1beta1`,
      `kind: ProviderConfig`,
      `metadata:`,
      `  name: aws-provider-config`,
      `spec:`,
      `  credentials:`,
      `    source: Secret`,
      `    secretRef:`,
      `      namespace: crossplane-system`,
      `      name: aws-creds`,
      `      key: creds`,
      ``,
    );
  }

  if (includeAzure) {
    lines.push(
      `# ── Azure Provider ───────────────────────────────────────────`,
      `apiVersion: pkg.crossplane.io/v1`,
      `kind: Provider`,
      `metadata:`,
      `  name: upbound-provider-azure`,
      `spec:`,
      `  package: xpkg.upbound.io/upbound/provider-azure:v0.42.0`,
      `---`,
      `# Create a Kubernetes secret with Azure credentials first:`,
      `#   az ad sp create-for-rbac --sdk-auth > azure-credentials.json`,
      `#   kubectl create secret generic azure-creds \\`,
      `#     --from-file=creds=./azure-credentials.json \\`,
      `#     -n crossplane-system`,
      `apiVersion: azure.upbound.io/v1beta1`,
      `kind: ProviderConfig`,
      `metadata:`,
      `  name: azure-provider-config`,
      `spec:`,
      `  credentials:`,
      `    source: Secret`,
      `    secretRef:`,
      `      namespace: crossplane-system`,
      `      name: azure-creds`,
      `      key: creds`,
      ``,
    );
  }

  if (includeGcp) {
    lines.push(
      `# ── GCP Provider ─────────────────────────────────────────────`,
      `apiVersion: pkg.crossplane.io/v1`,
      `kind: Provider`,
      `metadata:`,
      `  name: upbound-provider-gcp`,
      `spec:`,
      `  package: xpkg.upbound.io/upbound/provider-gcp:v0.41.0`,
      `---`,
      `# Create a Kubernetes secret with GCP credentials first:`,
      `#   gcloud iam service-accounts keys create gcp-credentials.json \\`,
      `#     --iam-account=<sa-name>@<project>.iam.gserviceaccount.com`,
      `#   kubectl create secret generic gcp-creds \\`,
      `#     --from-file=creds=./gcp-credentials.json \\`,
      `#     -n crossplane-system`,
      `apiVersion: gcp.upbound.io/v1beta1`,
      `kind: ProviderConfig`,
      `metadata:`,
      `  name: gcp-provider-config`,
      `spec:`,
      `  projectID: my-gcp-project`,
      `  credentials:`,
      `    source: Secret`,
      `    secretRef:`,
      `      namespace: crossplane-system`,
      `      name: gcp-creds`,
      `      key: creds`,
      ``,
    );
  }

  return lines.join('\n');
}

/**
 * Generate a Crossplane Composite Resource Definition (XRD) and Composition
 * that wraps the resources on the canvas into a reusable composite resource.
 */
export function generateCrossplaneCompositeResource(
  nodes: Node<ResourceNodeData>[],
  name: string,
): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const group = 'infra.example.io';
  const version = 'v1alpha1';
  const kind = safeName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const xrd = [
    `# ============================================================`,
    `# Crossplane Composite Resource Definition (XRD)`,
    `# This defines a reusable composite resource that wraps`,
    `# the resources on your canvas.`,
    `# ============================================================`,
    `apiVersion: apiextensions.crossplane.io/v1`,
    `kind: CompositeResourceDefinition`,
    `metadata:`,
    `  name: x${safeName}s.${group}`,
    `spec:`,
    `  group: ${group}`,
    `  names:`,
    `    kind: X${kind}`,
    `    plural: x${safeName}s`,
    `  claimNames:`,
    `    kind: ${kind}`,
    `    plural: ${safeName}s`,
    `  versions:`,
    `    - name: ${version}`,
    `      served: true`,
    `      referenceable: true`,
    `      schema:`,
    `        openAPIV3Schema:`,
    `          type: object`,
    `          properties:`,
    `            spec:`,
    `              type: object`,
    `              properties:`,
    `                parameters:`,
    `                  type: object`,
    `                  properties:`,
    `                    region:`,
    `                      type: string`,
    `                      default: us-east-1`,
    `                    environment:`,
    `                      type: string`,
    `                      enum: [dev, staging, prod]`,
    `                      default: dev`,
    `                  required:`,
    `                    - region`,
    `              required:`,
    `                - parameters`,
  ].join('\n');

  const resourcePatches = nodes.slice(0, 10).map((node) => {
    const rName = node.data.resourceName ?? 'unnamed';
    const rType = String(node.data.definition?.type ?? node.data.resourceType ?? '');
    const isAzure = rType.startsWith('xp_az_');
    const isGcp = rType.startsWith('xp_gcp_');

    let apiVersion = 'ec2.aws.upbound.io/v1beta1';
    let kind = 'Instance';
    if (rType === 'xp_aws_s3bucket') { apiVersion = 's3.aws.upbound.io/v1beta1'; kind = 'Bucket'; }
    else if (rType === 'xp_aws_rds') { apiVersion = 'rds.aws.upbound.io/v1beta1'; kind = 'Instance'; }
    else if (rType === 'xp_aws_vpc') { apiVersion = 'ec2.aws.upbound.io/v1beta1'; kind = 'VPC'; }
    else if (rType === 'xp_aws_eks') { apiVersion = 'eks.aws.upbound.io/v1beta1'; kind = 'Cluster'; }
    else if (rType === 'xp_aws_lambda') { apiVersion = 'lambda.aws.upbound.io/v1beta1'; kind = 'Function'; }
    else if (rType === 'xp_aws_iamrole') { apiVersion = 'iam.aws.upbound.io/v1beta1'; kind = 'Role'; }
    else if (rType === 'xp_aws_dynamodb') { apiVersion = 'dynamodb.aws.upbound.io/v1beta1'; kind = 'Table'; }
    else if (rType === 'xp_aws_sns') { apiVersion = 'sns.aws.upbound.io/v1beta1'; kind = 'Topic'; }
    else if (rType === 'xp_aws_sqs') { apiVersion = 'sqs.aws.upbound.io/v1beta1'; kind = 'Queue'; }
    else if (rType === 'xp_az_resourcegroup') { apiVersion = 'azure.upbound.io/v1beta1'; kind = 'ResourceGroup'; }
    else if (rType === 'xp_az_vm') { apiVersion = 'compute.azure.upbound.io/v1beta1'; kind = 'LinuxVirtualMachine'; }
    else if (rType === 'xp_az_aks') { apiVersion = 'containerservice.azure.upbound.io/v1beta1'; kind = 'KubernetesCluster'; }
    else if (rType === 'xp_az_storage') { apiVersion = 'storage.azure.upbound.io/v1beta1'; kind = 'Account'; }
    else if (rType === 'xp_az_sql') { apiVersion = 'sql.azure.upbound.io/v1beta1'; kind = 'MSSQLDatabase'; }
    else if (rType === 'xp_az_keyvault') { apiVersion = 'keyvault.azure.upbound.io/v1beta1'; kind = 'Vault'; }
    else if (rType === 'xp_gcp_instance') { apiVersion = 'compute.gcp.upbound.io/v1beta1'; kind = 'Instance'; }
    else if (rType === 'xp_gcp_gke') { apiVersion = 'container.gcp.upbound.io/v1beta1'; kind = 'Cluster'; }
    else if (rType === 'xp_gcp_bucket') { apiVersion = 'storage.gcp.upbound.io/v1beta1'; kind = 'Bucket'; }
    else if (rType === 'xp_gcp_sql') { apiVersion = 'sql.gcp.upbound.io/v1beta1'; kind = 'DatabaseInstance'; }
    else if (rType === 'xp_gcp_vpc') { apiVersion = 'compute.gcp.upbound.io/v1beta1'; kind = 'Network'; }
    else if (rType === 'xp_gcp_cloudrun') { apiVersion = 'cloudrun.gcp.upbound.io/v1beta1'; kind = 'Service'; }

    const providerRef = isAzure ? 'azure-provider-config' : isGcp ? 'gcp-provider-config' : 'aws-provider-config';
    const regionField = isAzure ? 'location' : 'region';

    return [
      `      - name: ${rName}`,
      `        base:`,
      `          apiVersion: ${apiVersion}`,
      `          kind: ${kind}`,
      `          spec:`,
      `            forProvider:`,
      `              ${regionField}: us-east-1`,
      `            providerConfigRef:`,
      `              name: ${providerRef}`,
      `        patches:`,
      `          - type: FromCompositeFieldPath`,
      `            fromFieldPath: spec.parameters.region`,
      `            toFieldPath: spec.forProvider.${regionField}`,
    ].join('\n');
  });

  const composition = [
    ``,
    `---`,
    `# ============================================================`,
    `# Crossplane Composition`,
    `# ============================================================`,
    `apiVersion: apiextensions.crossplane.io/v1`,
    `kind: Composition`,
    `metadata:`,
    `  name: ${safeName}-composition`,
    `  labels:`,
    `    crossplane.io/xrd: x${safeName}s.${group}`,
    `spec:`,
    `  compositeTypeRef:`,
    `    apiVersion: ${group}/${version}`,
    `    kind: X${kind}`,
    `  resources:`,
    resourcePatches.join('\n'),
  ].join('\n');

  const claimExample = [
    ``,
    `---`,
    `# ============================================================`,
    `# Example Claim (create this to provision the composite resource)`,
    `# ============================================================`,
    `apiVersion: ${group}/${version}`,
    `kind: ${kind}`,
    `metadata:`,
    `  name: my-${safeName}`,
    `  namespace: default`,
    `spec:`,
    `  parameters:`,
    `    region: us-east-1`,
    `    environment: dev`,
    `  compositionRef:`,
    `    name: ${safeName}-composition`,
  ].join('\n');

  return xrd + composition + claimExample + '\n';
}
