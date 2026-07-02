import { Node, Edge } from 'reactflow';
import { ResourceNodeData, ResourceDefinition, ResourceType } from '../types/resources';
import { RESOURCE_DEFINITIONS } from '../data/resourceDefinitions';
import { AZURE_DEFINITIONS } from '../data/azureDefinitions';
import { GCP_DEFINITIONS } from '../data/gcpDefinitions';

export interface DiscoveredResource {
  id: string;
  resourceType: string;
  resourceName: string;
  provider: 'aws' | 'azure' | 'gcp';
  attributes: Record<string, string>;
  tags: Record<string, string>;
  region: string;
}

export interface ResourceDependency {
  from: string; // resource id
  to: string;   // resource id
  reason: string;
}







let resourceIdCounter = 1;

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_|_$/g, '') || 'resource';
}

function sanitiseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ── AWS XML → JS key mappings ─────────────────────────────────────────────
// Maps AWS Query API XML tag names to the JS property names expected by discoverAWSResources
const AWS_TAG_MAP: Record<string, string> = {
  // EC2 wrapper tags
  reservationSet: 'Reservations',
  instancesSet: 'Instances',
  vpcSet: 'Vpcs',
  subnetSet: 'Subnets',
  securityGroupInfo: 'SecurityGroups',
  internetGatewaySet: 'InternetGateways',
  addressesSet: 'Addresses',
  natGatewaySet: 'NatGateways',
  routeTableSet: 'RouteTables',
  tagSet: 'Tags',
  attachmentSet: 'Attachments',
  natGatewayAddressSet: 'NatGatewayAddresses',
  groupSet: 'Groups',
  ipPermissionsSet: 'IpPermissions',
  ipPermissionsEgressSet: 'IpPermissionsEgress',
  // ELB
  loadBalancerDescriptions: 'LoadBalancers',
  // RDS
  dBInstances: 'DBInstances',
  vpcSecurityGroups: 'VpcSecurityGroups',
  dBSubnetGroup: 'DBSubnetGroup',
  // Route53
  hostedZones: 'HostedZones',
  resourceRecordSets: 'ResourceRecordSets',
  // Field-level mappings (AWS Query API uses lowerCamelCase)
  instanceId: 'InstanceId',
  imageId: 'ImageId',
  instanceType: 'InstanceType',
  subnetId: 'SubnetId',
  vpcId: 'VpcId',
  keyName: 'KeyName',
  publicIpAddress: 'PublicIpAddress',
  groupId: 'GroupId',
  groupName: 'GroupName',
  cidrBlock: 'CidrBlock',
  availabilityZone: 'AvailabilityZone',
  mapPublicIpOnLaunch: 'MapPublicIpOnLaunch',
  internetGatewayId: 'InternetGatewayId',
  allocationId: 'AllocationId',
  natGatewayId: 'NatGatewayId',
  routeTableId: 'RouteTableId',
  loadBalancerName: 'LoadBalancerName',
  dBInstanceIdentifier: 'DBInstanceIdentifier',
  dBInstanceClass: 'DBInstanceClass',
  allocatedStorage: 'AllocatedStorage',
  masterUsername: 'MasterUsername',
  storageType: 'StorageType',
  publiclyAccessible: 'PubliclyAccessible',
  dBName: 'DBName',
  dBSubnetGroupName: 'DBSubnetGroupName',
  functionName: 'FunctionName',
  memorySize: 'MemorySize',
  vpcConfig: 'VpcConfig',
  subnetIds: 'SubnetIds',
  securityGroupIds: 'SecurityGroupIds',
  roleArn: 'roleArn',
  resourcesVpcConfig: 'resourcesVpcConfig',
  role: 'Role',
  runtime: 'Runtime',
  handler: 'Handler',
  timeout: 'Timeout',
  description: 'Description',
};

/** Recursively remap keys on a parsed object using a tag map */
function remapKeys(
  obj: Record<string, unknown>,
  map: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = map[key] ?? key;
    if (Array.isArray(value)) {
      result[newKey] = value.map(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return remapKeys(item as Record<string, unknown>, map);
        }
        return item;
      });
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[newKey] = remapKeys(value as Record<string, unknown>, map);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

function findResourceDef(resourceType: string, provider: string): ResourceDefinition | undefined {
  if (provider === 'aws') return RESOURCE_DEFINITIONS.find(d => d.type === resourceType) as ResourceDefinition | undefined;
  if (provider === 'azure') return AZURE_DEFINITIONS.find(d => d.type === resourceType) as ResourceDefinition | undefined;
  if (provider === 'gcp') return GCP_DEFINITIONS.find(d => d.type === resourceType) as ResourceDefinition | undefined;
  return undefined;
}



// ── AWS SigV4 Signer ─────────────────────────────────────────────────────────

const API_VERSION: Record<string, string> = {
  ec2: '2016-11-15',
  elasticloadbalancing: '2015-12-01',
  rds: '2014-10-31',
  lambda: '2015-03-31',
  dynamodb: '2012-08-10',
  eks: '2017-11-01',
  sts: '2011-06-15',
};

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(
  key: string, dateStamp: string, region: string, service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function sha256Hash(payload: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)).then(hexEncode);
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

async function awsSigV4Sign(
  method: string,
  service: string,
  region: string,
  path: string,
  queryString: string,
  payload: string,
  creds: { accessKey: string; secretKey: string },
  signedHeaders: string[],
  action?: string,
  contentType?: string,
): Promise<SignedRequest> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const host = service === 's3'
    ? `s3.${region}.amazonaws.com`
    : `${service}.${region}.amazonaws.com`;

  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    ...(action ? { 'x-amz-target': action } : {}),
    ...(contentType ? { 'content-type': contentType } : {}),
  };

  for (const h of signedHeaders) {
    if (!headers[h] && h !== 'host') headers[h] = '';
  }

  const canonicalHeaders = signedHeaders
    .map(h => `${h}:${headers[h] || ''}\n`)
    .join('');

  const payloadHash = await sha256Hash(payload);

  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeaders,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hash(canonicalRequest),
  ].join('\n');

  const signingKey = await getSignatureKey(creds.secretKey, dateStamp, region, service);
  const signature = hexEncode(await hmacSha256(signingKey, stringToSign));

  const authHeader = [
    `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders.join(';')}`,
    `Signature=${signature}`,
  ].join(', ');

  headers['authorization'] = authHeader;
  delete headers['host'];

  const url = `https://${host}${path}${queryString ? '?' + queryString : ''}`;

  return { url, headers, body: payload };
}

// ── AWS Query API (EC2, ELB, RDS) ─────────────────────────────────────────────

async function awsQueryRequest(
  service: string,
  action: string,
  region: string,
  creds: { accessKey?: string; secretKey?: string },
  tagMap?: Record<string, string>,
): Promise<Record<string, unknown>> {
  if (!creds.accessKey || !creds.secretKey) return {};

  const payload = `Action=${action}&Version=${API_VERSION[service] || '2016-11-15'}`;

  try {
    const signed = await awsSigV4Sign(
      'POST', service, region, '/', '', payload,
      { accessKey: creds.accessKey, secretKey: creds.secretKey },
      ['host', 'x-amz-date'],
      undefined,
      'application/x-www-form-urlencoded; charset=utf-8',
    );
    signed.headers['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';

    const res = await fetch(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    });

    if (!res.ok) return {};
    const text = await res.text();

    // Extract the response wrapper
    const resultMatch = text.match(/<(\w+(?:Result|Response))[^>]*>([\s\S]*?)<\/\1>/);
    if (!resultMatch) return {};
    const body = resultMatch[2];

    const result: Record<string, unknown> = {};
    const arrayRegex = /<(\w+)>(\s*<(?:item|member)>[\s\S]*?<\/(?:item|member)>\s*)<\/\1>/g;
    let arrMatch: RegExpExecArray | null;
    while ((arrMatch = arrayRegex.exec(body)) !== null) {
      const [, wrapperTag, wrapperContent] = arrMatch;
      const items = Array.from(wrapperContent.matchAll(/<(?:item|member)>([\s\S]*?)<\/(?:item|member)>/g))
        .map(([, c]) => extractXmlTags(c));
      if (items.length > 0) result[wrapperTag] = items;
    }

    // Apply tag map to rename XML-style keys to JS-style keys
    if (tagMap) {
      return remapKeys(result, tagMap);
    }

    return result;
  } catch {
    return {};
  }
}

// ── AWS JSON API (Lambda, DynamoDB, EKS) ──────────────────────────────────────

async function awsJsonRequest(
  service: string,
  action: string,
  region: string,
  creds: { accessKey?: string; secretKey?: string },
  targetPrefix?: string,
): Promise<Record<string, unknown>> {
  if (!creds.accessKey || !creds.secretKey) return {};

  const target = targetPrefix
    ? `${targetPrefix}.${action}`
    : action;
  const payload = '{}';

  try {
    const signed = await awsSigV4Sign(
      'POST', service, region, '/', '', payload,
      { accessKey: creds.accessKey, secretKey: creds.secretKey },
      ['host', 'x-amz-date', 'x-amz-target'],
      target,
      'application/x-amz-json-1.1',
    );
    signed.headers['content-type'] = 'application/x-amz-json-1.1';

    const res = await fetch(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    });

    if (!res.ok) return {};
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ── XML → JSON converter for AWS Query API responses ────────────────────────

function extractXmlTags(xml: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, key, val] = match;
    const trimmed = val.trim();
    if (/<(?:item|member)>/.test(trimmed)) {
      // Check if member/item children contain plain text or nested XML
      const items = Array.from(trimmed.matchAll(/<(?:item|member)>([\s\S]*?)<\/(?:item|member)>/g))
        .map(([, c]) => {
          const inner = c.trim();
          // If the inner content has XML tags, parse it; otherwise treat as plain text
          if (/<\w+>/.test(inner)) return extractXmlTags(inner);
          return inner;
        });
      obj[key] = items;
    } else if (/<\w+>/.test(trimmed)) {
      obj[key] = extractXmlTags(trimmed);
    } else {
      obj[key] = trimmed;
    }
  }
  return obj;
}

// ── AWS API Convenience ───────────────────────────────────────────────────────

async function awsQuery(service: string, action: string, region: string, creds: { accessKey?: string; secretKey?: string }, tagMap?: Record<string, string>) {
  return awsQueryRequest(service, action, region, creds, tagMap);
}

async function awsJson(service: string, action: string, region: string, creds: { accessKey?: string; secretKey?: string }, prefix?: string) {
  return awsJsonRequest(service, action, region, creds, prefix);
}

// ── S3 API via SigV4 ──────────────────────────────────────────────────────────

async function awsS3Request(
  region: string,
  creds: { accessKey?: string; secretKey?: string },
): Promise<{ Buckets?: Array<Record<string, unknown>> }> {
  if (!creds.accessKey || !creds.secretKey) return {};

  try {
    const signed = await awsSigV4Sign(
      'GET', 's3', region, '/', '', '',
      { accessKey: creds.accessKey, secretKey: creds.secretKey },
      ['host', 'x-amz-date'],
    );

    const res = await fetch(signed.url, { method: 'GET', headers: signed.headers });
    if (!res.ok) return {};

    const text = await res.text();
    const buckets = Array.from(text.matchAll(/<Bucket>([\s\S]*?)<\/Bucket>/g)).map(([, content]) => {
      const name = content.match(/<Name>([^<]+)<\/Name>/);
      return { Name: name?.[1] ?? '' };
    });

    return { Buckets: buckets.length > 0 ? buckets : undefined };
  } catch {
    return {};
  }
}

// ── AWS API wrapper ───────────────────────────────────────────────────────────

// Per-service tag maps for AWS Query API XML → JS key mapping
const AWS_SERVICE_TAG_MAPS: Record<string, Record<string, string>> = {
  ec2: AWS_TAG_MAP,
  elasticloadbalancing: AWS_TAG_MAP,
  rds: AWS_TAG_MAP,
};

async function fetchAWSJson(
  service: string,
  action: string,
  region: string,
  creds: { accessKey?: string; secretKey?: string },
): Promise<Record<string, unknown>> {
  // Determine API type based on service
  const jsonServices: Record<string, { prefix?: string }> = {
    lambda: { prefix: 'AWSLambda_2015_03_31' },
    dynamodb: {},
    eks: {},
  };

  if (service === 's3') return awsS3Request(region, creds);
  if (service in jsonServices) {
    const cfg = jsonServices[service];
    return awsJson(service, action, region, creds, cfg.prefix);
  }
  const tagMap = AWS_SERVICE_TAG_MAPS[service];
  return awsQuery(service, action, region, creds, tagMap);
}

async function discoverAWSResources(
  region: string,
  creds: { accessKey?: string; secretKey?: string },
): Promise<DiscoveredResource[]> {
  const resources: DiscoveredResource[] = [];

  // EC2 Instances
  const ec2Data = await fetchAWSJson('ec2', 'DescribeInstances', region, creds);
  if (ec2Data.Reservations) {
    const reservations = ec2Data.Reservations as Array<{ Instances: Array<Record<string, unknown>> }>;
    for (const r of reservations) {
      for (const inst of (r.Instances ?? [])) {
        const tags = extractTags(inst);
        resources.push({
          id: `aws_instance_${resourceIdCounter++}`,
          resourceType: 'aws_instance',
          resourceName: tags['Name'] || (inst.InstanceId as string) || `instance_${resourceIdCounter}`,
          provider: 'aws',
          region,
          attributes: {
            _id: String(inst.InstanceId ?? ''),
            ami: String(inst.ImageId ?? ''),
            instance_type: String(inst.InstanceType ?? 't2.micro'),
            subnet_id: String(inst.SubnetId ?? ''),
            vpc_security_group_ids: extractSGs(inst),
            associate_public_ip_address: inst.PublicIpAddress ? 'true' : 'false',
            key_name: String(inst.KeyName ?? ''),
          },
          tags,
        });
      }
    }
  }

  // VPCs
  const vpcData = await fetchAWSJson('ec2', 'DescribeVpcs', region, creds);
  if (vpcData.Vpcs) {
    for (const vpc of (vpcData.Vpcs as Array<Record<string, unknown>>)) {
      const tags = extractTags(vpc);
      const vpcId = vpc.VpcId as string;
      resources.push({
        id: `aws_vpc_${resourceIdCounter++}`,
        resourceType: 'aws_vpc',
        resourceName: tags['Name'] || vpcId || `vpc_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(vpc.VpcId ?? ''),
          cidr_block: String(vpc.CidrBlock ?? '10.0.0.0/16'),
          enable_dns_support: 'true',
          enable_dns_hostnames: 'true',
        },
        tags,
      });
    }
  }

  // Subnets
  const subnetData = await fetchAWSJson('ec2', 'DescribeSubnets', region, creds);
  if (subnetData.Subnets) {
    for (const s of (subnetData.Subnets as Array<Record<string, unknown>>)) {
      const tags = extractTags(s);
      resources.push({
        id: `aws_subnet_${resourceIdCounter++}`,
        resourceType: 'aws_subnet',
        resourceName: tags['Name'] || (s.SubnetId as string) || `subnet_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(s.SubnetId ?? ''),
          vpc_id: String(s.VpcId ?? ''),
          cidr_block: String(s.CidrBlock ?? ''),
          availability_zone: String(s.AvailabilityZone ?? ''),
          map_public_ip_on_launch: String(s.MapPublicIpOnLaunch ?? 'false'),
        },
        tags,
      });
    }
  }

  // Security Groups
  const sgData = await fetchAWSJson('ec2', 'DescribeSecurityGroups', region, creds);
  if (sgData.SecurityGroups) {
    for (const sg of (sgData.SecurityGroups as Array<Record<string, unknown>>)) {
      const tags = extractTags(sg);
      resources.push({
        id: `aws_security_group_${resourceIdCounter++}`,
        resourceType: 'aws_security_group',
        resourceName: tags['Name'] || (sg.GroupName as string) || `sg_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(sg.GroupId ?? ''),
          vpc_id: String(sg.VpcId ?? ''),
          description: String(sg.Description ?? 'Managed by Terraform'),
          name: String(sg.GroupName ?? ''),
        },
        tags,
      });
    }
  }

  // Internet Gateways
  const igwData = await fetchAWSJson('ec2', 'DescribeInternetGateways', region, creds);
  if (igwData.InternetGateways) {
    for (const igw of (igwData.InternetGateways as Array<Record<string, unknown>>)) {
      const tags = extractTags(igw);
      const attachments = igw.Attachments as Array<Record<string, unknown>> | undefined;
      resources.push({
        id: `aws_internet_gateway_${resourceIdCounter++}`,
        resourceType: 'aws_internet_gateway',
        resourceName: tags['Name'] || (igw.InternetGatewayId as string) || `igw_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(igw.InternetGatewayId ?? ''),
          vpc_id: String(attachments?.[0]?.VpcId ?? ''),
        },
        tags,
      });
    }
  }

  // Elastic IPs
  const eipData = await fetchAWSJson('ec2', 'DescribeAddresses', region, creds);
  if (eipData.Addresses) {
    for (const eip of (eipData.Addresses as Array<Record<string, unknown>>)) {
      const tags = extractTags(eip);
      resources.push({
        id: `aws_eip_${resourceIdCounter++}`,
        resourceType: 'aws_eip',
        resourceName: tags['Name'] || (eip.AllocationId as string) || `eip_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(eip.AllocationId ?? ''),
          domain: String(eip.Domain ?? 'vpc'),
          instance: String(eip.InstanceId ?? ''),
        },
        tags,
      });
    }
  }

  // NAT Gateways
  const natData = await fetchAWSJson('ec2', 'DescribeNatGateways', region, creds);
  if (natData.NatGateways) {
    for (const nat of (natData.NatGateways as Array<Record<string, unknown>>)) {
      const tags = extractTags(nat);
      const natAddrs = nat.NatGatewayAddresses as Array<Record<string, unknown>> | undefined;
      resources.push({
        id: `aws_nat_gateway_${resourceIdCounter++}`,
        resourceType: 'aws_nat_gateway',
        resourceName: tags['Name'] || (nat.NatGatewayId as string) || `nat_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(nat.NatGatewayId ?? ''),
          subnet_id: String(nat.SubnetId ?? ''),
          allocation_id: String(natAddrs?.[0]?.AllocationId ?? ''),
        },
        tags,
      });
    }
  }

  // Route Tables
  const rtData = await fetchAWSJson('ec2', 'DescribeRouteTables', region, creds);
  if (rtData.RouteTables) {
    for (const rt of (rtData.RouteTables as Array<Record<string, unknown>>)) {
      const tags = extractTags(rt);
      resources.push({
        id: `aws_route_table_${resourceIdCounter++}`,
        resourceType: 'aws_route_table',
        resourceName: tags['Name'] || (rt.RouteTableId as string) || `rt_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(rt.RouteTableId ?? ''),
          vpc_id: String(rt.VpcId ?? ''),
        },
        tags,
      });
    }
  }

  // Load Balancers
  const elbData = await fetchAWSJson('elasticloadbalancing', 'DescribeLoadBalancers', region, creds);
  if (elbData.LoadBalancers) {
    for (const lb of (elbData.LoadBalancers as Array<Record<string, unknown>>)) {
      const tags = extractTags(lb);
      const sgIds = (lb.SecurityGroups as string[] | undefined) ?? [];
      resources.push({
        id: `aws_lb_${resourceIdCounter++}`,
        resourceType: 'aws_lb',
        resourceName: tags['Name'] || (lb.LoadBalancerName as string) || `lb_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(lb.LoadBalancerName ?? ''),
          name: (lb.LoadBalancerName as string) ?? '',
          internal: lb.Scheme === 'internal' ? 'true' : 'false',
          load_balancer_type: String(lb.Type ?? 'application'),
          subnets: (lb.Subnets as string[] | undefined)?.join(',') ?? '',
          security_groups: sgIds.join(','),
        },
        tags,
      });
    }
  }

  // S3 Buckets
  const s3Data = await fetchAWSJson('s3', 'ListBuckets', region, creds);
  if (s3Data.Buckets) {
    for (const bucket of (s3Data.Buckets as Array<Record<string, unknown>>)) {
      resources.push({
        id: `aws_s3_bucket_${resourceIdCounter++}`,
        resourceType: 'aws_s3_bucket',
        resourceName: String(bucket.Name ?? `bucket_${resourceIdCounter}`),
        provider: 'aws',
        region,
        attributes: {
          _id: String(bucket.Name ?? ''),
          bucket: String(bucket.Name ?? ''),
          acl: 'private',
        },
        tags: {},
      });
    }
  }

  // RDS Instances
  const rdsData = await fetchAWSJson('rds', 'DescribeDBInstances', region, creds);
  if (rdsData.DBInstances) {
    for (const rds of (rdsData.DBInstances as Array<Record<string, unknown>>)) {
      const tags = extractTags(rds);
      resources.push({
        id: `aws_rds_instance_${resourceIdCounter++}`,
        resourceType: 'aws_rds_instance',
        resourceName: tags['Name'] || (rds.DBInstanceIdentifier as string) || `rds_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(rds.DBInstanceIdentifier ?? ''),
          engine: String(rds.Engine ?? 'mysql'),
          engine_version: String(rds.EngineVersion ?? '8.0'),
          instance_class: String(rds.DBInstanceClass ?? 'db.t3.micro'),
          allocated_storage: String(rds.AllocatedStorage ?? '20'),
          db_name: String(rds.DBName ?? ''),
          username: String(rds.MasterUsername ?? 'admin'),
          storage_type: String(rds.StorageType ?? 'gp3'),
          skip_final_snapshot: 'true',
          publicly_accessible: String(rds.PubliclyAccessible ?? 'false'),
          db_subnet_group_name: (rds.DBSubnetGroup as Record<string, unknown>)?.DBSubnetGroupName as string ?? '',
          vpc_security_group_ids: extractSGs(rds),
        },
        tags,
      });
    }
  }

  // Lambda Functions
  const lambdaData = await fetchAWSJson('lambda', 'ListFunctions', region, creds);
  if (lambdaData.Functions) {
    for (const fn of (lambdaData.Functions as Array<Record<string, unknown>>)) {
      const tags = extractTags(fn);
      const vpcConfig = fn.VpcConfig as Record<string, unknown> | undefined;
      resources.push({
        id: `aws_lambda_function_${resourceIdCounter++}`,
        resourceType: 'aws_lambda_function',
        resourceName: (fn.FunctionName as string) || `lambda_${resourceIdCounter}`,
        provider: 'aws',
        region,
        attributes: {
          _id: String(fn.FunctionName ?? ''),
          function_name: String(fn.FunctionName ?? ''),
          role: String(fn.Role ?? ''),
          runtime: String(fn.Runtime ?? 'nodejs18.x'),
          handler: String(fn.Handler ?? 'index.handler'),
          memory_size: String(fn.MemorySize ?? '128'),
          timeout: String(fn.Timeout ?? '3'),
          ...(vpcConfig?.SubnetIds ? { subnet_ids: (vpcConfig.SubnetIds as string[]).join(',') } : {}),
          ...(vpcConfig?.SecurityGroupIds ? { security_group_ids: (vpcConfig.SecurityGroupIds as string[]).join(',') } : {}),
        },
        tags,
      });
    }
  }

  // DynamoDB Tables
  const dynamoData = await fetchAWSJson('dynamodb', 'ListTables', region, creds);
  if (dynamoData.TableNames) {
    for (const tableName of (dynamoData.TableNames as string[])) {
      resources.push({
        id: `aws_dynamodb_table_${resourceIdCounter++}`,
        resourceType: 'aws_dynamodb_table',
        resourceName: `dynamodb_${tableName}`,
        provider: 'aws',
        region,
        attributes: {
          _id: tableName,
          name: tableName,
          billing_mode: 'PAY_PER_REQUEST',
          hash_key: 'id',
        },
        tags: {},
      });
    }
  }

  // EKS Clusters
  const eksData = await fetchAWSJson('eks', 'ListClusters', region, creds);
  if (eksData.clusters) {
    for (const clusterName of (eksData.clusters as string[])) {
      resources.push({
        id: `aws_eks_cluster_${resourceIdCounter++}`,
        resourceType: 'aws_eks_cluster',
        resourceName: clusterName,
        provider: 'aws',
        region,
        attributes: {
          _id: clusterName,
          name: clusterName,
          role_arn: '',
          version: '1.29',
        },
        tags: {},
      });
    }
  }

  // Route53 Hosted Zones
  const route53Data = await discoverRoute53(creds);
  resources.push(...route53Data);

  return resources;
}

// ── Route53 Discovery ─────────────────────────────────────────────────────────

async function discoverRoute53(
  creds: { accessKey?: string; secretKey?: string },
): Promise<DiscoveredResource[]> {
  if (!creds.accessKey || !creds.secretKey) return [];

  const resources: DiscoveredResource[] = [];
  const service = 'route53';
  const region = 'us-east-1';
  const action = 'ListHostedZones';
  const version = '2013-04-01';
  const payload = `Action=${action}&Version=${version}`;

  try {
    const signed = await awsSigV4Sign(
      'POST', service, region, '/', '', payload,
      { accessKey: creds.accessKey, secretKey: creds.secretKey },
      ['host', 'x-amz-date'],
      undefined,
      'application/x-www-form-urlencoded; charset=utf-8',
    );
    signed.headers['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';

    const res = await fetch(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    });

    if (!res.ok) return resources;
    const text = await res.text();

    const hostedZones = Array.from(text.matchAll(/<HostedZone>([\s\S]*?)<\/HostedZone>/g));
    for (const [, zoneXml] of hostedZones) {
      const idMatch = zoneXml.match(/<Id>([^<]+)<\/Id>/);
      const nameMatch = zoneXml.match(/<Name>([^<]+)<\/Name>/);
      const privateZoneMatch = zoneXml.match(/<Config>[\s\S]*?<PrivateZone>([^<]+)<\/PrivateZone>[\s\S]*?<\/Config>/);

      const zoneId = idMatch?.[1]?.replace('/hostedzone/', '') ?? '';
      const zoneName = nameMatch?.[1]?.replace(/\.$/, '') ?? '';

      resources.push({
        id: `aws_route53_zone_${resourceIdCounter++}`,
        resourceType: 'aws_route53_zone',
        resourceName: zoneName || zoneId || `zone_${resourceIdCounter}`,
        provider: 'aws',
        region: 'global',
        attributes: {
          _id: zoneId,
          name: zoneName,
          private_zone: privateZoneMatch?.[1] ?? 'false',
        },
        tags: {},
      });
    }
  } catch {
    // silently fail
  }

  return resources;
}

function extractTags(obj: Record<string, unknown>): Record<string, string> {
  const tags: Record<string, string> = {};
  const rawTags = obj.Tags;
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      if (t && typeof t === 'object') {
        const entry = t as Record<string, unknown>;
        const key = (entry.Key ?? entry.key) as string | undefined;
        const val = (entry.Value ?? entry.value) as string | undefined;
        if (key) tags[key] = String(val ?? '');
      }
    }
  }
  return tags;
}

function extractSGs(obj: Record<string, unknown>): string {
  const rawGroups = obj.SecurityGroups as string[] | undefined;
  if (rawGroups && rawGroups.length > 0) return rawGroups.join(',');

  const vpcGroups = obj.VpcSecurityGroups as Array<{ VpcSecurityGroupId: string }> | undefined;
  if (vpcGroups && vpcGroups.length > 0) return vpcGroups.map(s => s.VpcSecurityGroupId).join(',');

  // Handle EC2 groupSet → Groups after tag remapping
  const ec2Groups = obj.Groups as Array<{ GroupId: string }> | undefined;
  if (ec2Groups && ec2Groups.length > 0) return ec2Groups.map(s => s.GroupId).join(',');

  return '';
}

// ── Azure API Discovery ───────────────────────────────────────────────────────

async function fetchAzureJson(
  url: string,
  token: string,
): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return {};
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function discoverAzureResources(
  creds: { subscriptionId?: string; apiKey?: string },
): Promise<DiscoveredResource[]> {
  const resources: DiscoveredResource[] = [];
  const subId = creds.subscriptionId ?? '';
  const token = creds.apiKey ?? '';
  if (!subId || !token) return resources;

  const base = `https://management.azure.com/subscriptions/${subId}`;

  // VMs
  const vmData = await fetchAzureJson(`${base}/providers/Microsoft.Compute/virtualMachines?api-version=2024-03-01`, token);
  for (const vm of ((vmData.value as Array<Record<string, unknown>>) ?? [])) {
    const props = (vm.properties ?? {}) as Record<string, unknown>;
    const hw = (props.hardwareProfile ?? {}) as Record<string, unknown>;
    const osProfile = (props.osProfile ?? {}) as Record<string, unknown>;
    const tags = (vm.tags as Record<string, string>) ?? {};
    resources.push({
      id: `azurerm_linux_virtual_machine_${resourceIdCounter++}`,
      resourceType: 'azurerm_linux_virtual_machine',
      resourceName: tags.Name || (vm.name as string) || `vm_${resourceIdCounter}`,
      provider: 'azure',
      region: String(vm.location ?? ''),
      attributes: {
        name: String(vm.name ?? ''),
        resource_group_name: extractRG(vm.id as string),
        location: String(vm.location ?? ''),
        size: String(hw.vmSize ?? 'Standard_B2s'),
        admin_username: String((osProfile as Record<string, unknown>).adminUsername ?? 'azureuser'),
      },
      tags,
    });
  }

  // Storage Accounts
  const stData = await fetchAzureJson(`${base}/providers/Microsoft.Storage/storageAccounts?api-version=2023-01-01`, token);
  for (const sa of ((stData.value as Array<Record<string, unknown>>) ?? [])) {
    const tags = (sa.tags as Record<string, string>) ?? {};
    resources.push({
      id: `azurerm_storage_account_${resourceIdCounter++}`,
      resourceType: 'azurerm_storage_account',
      resourceName: tags.Name || (sa.name as string) || `storage_${resourceIdCounter}`,
      provider: 'azure',
      region: String(sa.location ?? ''),
      attributes: {
        name: String(sa.name ?? ''),
        resource_group_name: extractRG(sa.id as string),
        location: String(sa.location ?? ''),
        account_tier: 'Standard',
        account_replication_type: 'LRS',
      },
      tags,
    });
  }

  // AKS Clusters
  const aksData = await fetchAzureJson(`${base}/providers/Microsoft.ContainerService/managedClusters?api-version=2024-02-01`, token);
  for (const aks of ((aksData.value as Array<Record<string, unknown>>) ?? [])) {
    const tags = (aks.tags as Record<string, string>) ?? {};
    resources.push({
      id: `azurerm_kubernetes_cluster_${resourceIdCounter++}`,
      resourceType: 'azurerm_kubernetes_cluster',
      resourceName: tags.Name || (aks.name as string) || `aks_${resourceIdCounter}`,
      provider: 'azure',
      region: String(aks.location ?? ''),
      attributes: {
        name: String(aks.name ?? ''),
        resource_group_name: extractRG(aks.id as string),
        location: String(aks.location ?? ''),
        kubernetes_version: '1.29',
        node_count: '3',
        node_vm_size: 'Standard_D2s_v3',
      },
      tags,
    });
  }

  // Cosmos DB
  const cosmosData = await fetchAzureJson(`${base}/providers/Microsoft.DocumentDB/databaseAccounts?api-version=2024-05-15`, token);
  for (const db of ((cosmosData.value as Array<Record<string, unknown>>) ?? [])) {
    const tags = (db.tags as Record<string, string>) ?? {};
    resources.push({
      id: `azurerm_cosmosdb_account_${resourceIdCounter++}`,
      resourceType: 'azurerm_cosmosdb_account' as any,
      resourceName: tags.Name || (db.name as string) || `cosmos_${resourceIdCounter}`,
      provider: 'azure',
      region: String(db.location ?? ''),
      attributes: {
        name: String(db.name ?? ''),
        resource_group_name: extractRG(db.id as string),
        location: String(db.location ?? ''),
        offer_type: 'Standard',
        kind: 'GlobalDocumentDB',
      },
      tags,
    });
  }

  return resources;
}

function extractRG(id: string): string {
  const match = id?.match(/resourceGroups\/([^/]+)/i);
  return match?.[1] ?? 'unknown';
}

// ── GCP API Discovery ─────────────────────────────────────────────────────────

async function fetchGCPJson(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function discoverGCPResources(
  creds: { projectId?: string; apiKey?: string },
): Promise<DiscoveredResource[]> {
  const resources: DiscoveredResource[] = [];
  const project = creds.projectId ?? '';
  const key = creds.apiKey ?? '';
  if (!project || !key) return resources;

  // Compute Engine VMs
  const gceData = await fetchGCPJson(
    `https://compute.googleapis.com/compute/v1/projects/${project}/aggregated/instances?key=${key}`,
  );
  if (gceData.items) {
    const items = gceData.items as Record<string, { instances: Array<Record<string, unknown>> }>;
    for (const [, zoneData] of Object.entries(items)) {
      for (const inst of (zoneData.instances ?? [])) {
        const tags = (inst.metadata as Record<string, unknown>)?.items as Array<{ key: string; value: string }> | undefined;
        const tagMap: Record<string, string> = {};
        if (tags) for (const t of tags) tagMap[t.key] = t.value;
        const networkInterfaces = inst.networkInterfaces as Array<Record<string, unknown>> | undefined;
        resources.push({
          id: `google_compute_instance_${resourceIdCounter++}`,
          resourceType: 'google_compute_instance',
          resourceName: tagMap['Name'] || (inst.name as string) || `gce_${resourceIdCounter}`,
          provider: 'gcp',
          region: creds.projectId ?? '',
          attributes: {
            name: String(inst.name ?? ''),
            project,
            zone: String(String(inst.zone ?? '').split('/').pop() ?? 'us-central1-a'),
            machine_type: String(String(inst.machineType ?? '').split('/').pop() ?? 'e2-medium'),
            network: String(String((networkInterfaces?.[0]?.network as string) ?? '').split('/').pop() ?? 'default'),
            subnetwork: String(String((networkInterfaces?.[0]?.subnetwork as string) ?? '').split('/').pop() ?? ''),
          },
          tags: tagMap,
        });
      }
    }
  }

  // GKE Clusters
  const gkeData = await fetchGCPJson(
    `https://container.googleapis.com/v1/projects/${project}/locations/-/clusters?key=${key}`,
  );
  if (gkeData.clusters) {
    for (const cluster of (gkeData.clusters as Array<Record<string, unknown>>)) {
      const rLabels = cluster.resourceLabels as Record<string, string> | undefined;
      resources.push({
        id: `google_container_cluster_${resourceIdCounter++}`,
        resourceType: 'google_container_cluster',
        resourceName: rLabels?.['Name'] || (cluster.name as string) || `gke_${resourceIdCounter}`,
        provider: 'gcp',
        region: creds.projectId ?? '',
        attributes: {
          name: String(cluster.name ?? ''),
          project,
          location: String(cluster.location ?? 'us-central1'),
          network: String(String((cluster.networkConfig as Record<string, unknown>)?.network ?? '').split('/').pop() ?? 'default'),
          subnetwork: String(String((cluster.networkConfig as Record<string, unknown>)?.subnetwork ?? '').split('/').pop() ?? ''),
          node_count: '3',
          machine_type: 'e2-medium',
        },
        tags: rLabels ?? {},
      });
    }
  }

  // Cloud Storage Buckets
  const gcsData = await fetchGCPJson(
    `https://storage.googleapis.com/storage/v1/b?project=${project}&key=${key}`,
  );
  if (gcsData.items) {
    for (const bucket of (gcsData.items as Array<Record<string, unknown>>)) {
      resources.push({
        id: `google_storage_bucket_${resourceIdCounter++}`,
        resourceType: 'google_storage_bucket',
        resourceName: String(bucket.name ?? `bucket_${resourceIdCounter}`),
        provider: 'gcp',
        region: creds.projectId ?? '',
        attributes: {
          name: String(bucket.name ?? ''),
          project,
          location: String(bucket.location ?? 'US'),
          storage_class: String(bucket.storageClass ?? 'STANDARD'),
        },
        tags: {},
      });
    }
  }

  // Cloud SQL Instances
  const sqlData = await fetchGCPJson(
    `https://sqladmin.googleapis.com/v1/projects/${project}/instances?key=${key}`,
  );
  if (sqlData.items) {
    for (const sql of (sqlData.items as Array<Record<string, unknown>>)) {
      const settings = sql.settings as Record<string, unknown> | undefined;
      resources.push({
        id: `google_sql_database_instance_${resourceIdCounter++}`,
        resourceType: 'google_sql_database_instance',
        resourceName: String(sql.name ?? `sql_${resourceIdCounter}`),
        provider: 'gcp',
        region: creds.projectId ?? '',
        attributes: {
          name: String(sql.name ?? ''),
          project,
          database_version: String(sql.databaseVersion ?? 'POSTGRES_15'),
          region: String(sql.region ?? 'us-central1'),
          tier: String((settings?.tier as string) ?? 'db-f1-micro'),
        },
        tags: {},
      });
    }
  }

  return resources;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function discoverCloudResources(
  provider: 'aws' | 'azure' | 'gcp',
  region: string,
  credentials: { accessKey?: string; secretKey?: string; subscriptionId?: string; apiKey?: string; projectId?: string },
): Promise<DiscoveredResource[]> {
  switch (provider) {
    case 'aws':
      return discoverAWSResources(region, credentials);
    case 'azure':
      return discoverAzureResources(credentials);
    case 'gcp':
      return discoverGCPResources(credentials);
  }
}

// ── Dependency Inference ──────────────────────────────────────────────────────

export function inferDependencies(resources: DiscoveredResource[]): ResourceDependency[] {
  const deps: ResourceDependency[] = [];
  const idToName = new Map<string, string>();
  for (const r of resources) {
    idToName.set(r.id, r.resourceName);
  }

  // VPC → Subnet
  const vpcs = resources.filter(r => r.resourceType === 'aws_vpc');
  const subnets = resources.filter(r => r.resourceType === 'aws_subnet');
  for (const subnet of subnets) {
    const vpcId = subnet.attributes.vpc_id;
    if (vpcId) {
      const matchingVpc = vpcs.find(v =>
        v.attributes.vpc_id === vpcId ||
        v.id.includes(vpcId) ||
        vpcId.includes(v.id),
      );
      if (matchingVpc) {
        deps.push({ from: subnet.id, to: matchingVpc.id, reason: 'Subnet belongs to VPC' });
      }
    }
  }

  // VPC → Security Group
  const sgs = resources.filter(r => r.resourceType === 'aws_security_group');
  for (const sg of sgs) {
    const vpcId = sg.attributes.vpc_id;
    if (vpcId) {
      const matchingVpc = vpcs.find(v =>
        v.attributes.vpc_id === vpcId ||
        v.id.includes(vpcId) ||
        vpcId.includes(v.id),
      );
      if (matchingVpc) {
        deps.push({ from: sg.id, to: matchingVpc.id, reason: 'Security Group belongs to VPC' });
      }
    }
  }

  // VPC → Internet Gateway
  const igws = resources.filter(r => r.resourceType === 'aws_internet_gateway');
  for (const igw of igws) {
    const vpcId = igw.attributes.vpc_id;
    if (vpcId) {
      const matchingVpc = vpcs.find(v =>
        v.attributes.vpc_id === vpcId ||
        v.id.includes(vpcId) ||
        vpcId.includes(v.id),
      );
      if (matchingVpc) {
        deps.push({ from: igw.id, to: matchingVpc.id, reason: 'Internet Gateway attached to VPC' });
      }
    }
  }

  // VPC → Route Table
  const rts = resources.filter(r => r.resourceType === 'aws_route_table');
  for (const rt of rts) {
    const vpcId = rt.attributes.vpc_id;
    if (vpcId) {
      const matchingVpc = vpcs.find(v => v.attributes.vpc_id === vpcId || v.id.includes(vpcId));
      if (matchingVpc) {
        deps.push({ from: rt.id, to: matchingVpc.id, reason: 'Route Table belongs to VPC' });
      }
    }
  }

  // Subnet → EC2
  const ec2s = resources.filter(r => r.resourceType === 'aws_instance');
  for (const ec2 of ec2s) {
    const subnetId = ec2.attributes.subnet_id;
    if (subnetId) {
      const matchingSubnet = subnets.find(s =>
        s.attributes.subnet_id === subnetId ||
        s.id.includes(subnetId) ||
        subnetId.includes(s.id),
      );
      if (matchingSubnet) {
        deps.push({ from: ec2.id, to: matchingSubnet.id, reason: 'EC2 instances run in Subnet' });
      }
    }

    const sgId = ec2.attributes.vpc_security_group_ids;
    if (sgId) {
      const matchingSg = sgs.find(s =>
        s.attributes.name === sgId ||
        s.resourceName === sgId ||
        sgId.includes(s.resourceName),
      );
      if (matchingSg) {
        deps.push({ from: ec2.id, to: matchingSg.id, reason: 'EC2 uses Security Group' });
      }
    }
  }

  // Subnet → NAT Gateway
  const nats = resources.filter(r => r.resourceType === 'aws_nat_gateway');
  for (const nat of nats) {
    const subnetId = nat.attributes.subnet_id;
    if (subnetId) {
      const matchingSubnet = subnets.find(s => s.id.includes(subnetId) || subnetId.includes(s.id));
      if (matchingSubnet) {
        deps.push({ from: nat.id, to: matchingSubnet.id, reason: 'NAT Gateway in Subnet' });
      }
    }
  }

  // Subnet → RDS
  const rdss = resources.filter(r => r.resourceType === 'aws_rds_instance');
  for (const rds of rdss) {
    const sgId = rds.attributes.vpc_security_group_ids;
    if (sgId) {
      const matchingSg = sgs.find(s => sgId.includes(s.resourceName) || s.resourceName.includes(sgId));
      if (matchingSg) {
        deps.push({ from: rds.id, to: matchingSg.id, reason: 'RDS uses Security Group' });
      }
    }
  }

  // Subnet → ELB
  const lbs = resources.filter(r => r.resourceType === 'aws_lb');
  for (const lb of lbs) {
    const subnetIds = lb.attributes.subnets;
    if (subnetIds) {
      const matchingSubnet = subnets.find(s => subnetIds.includes(s.attributes.subnet_id || ''));
      if (matchingSubnet) {
        deps.push({ from: lb.id, to: matchingSubnet.id, reason: 'LB spans Subnet' });
      }
    }
  }

  return deps;
}

// ── HCL Generation ───────────────────────────────────────────────────────────

export function generateImportHCL(
  resources: DiscoveredResource[],
  selectedIds: string[],
  region: string,
  provider: 'aws' | 'azure' | 'gcp',
): string {
  const selected = resources.filter(r => selectedIds.includes(r.id));
  if (selected.length === 0) return '# No resources selected\n';

  const sections: string[] = [];
  const deps = inferDependencies(selected);

  sections.push(`# ============================================================
# Terraform — Imported from ${provider.toUpperCase()} cloud account
# Region    : ${region}
# Resources : ${selected.length}
# Generated by InfraStudio
# ============================================================
`);

  // Terraform & Provider block
  if (provider === 'aws') {
    sections.push(`terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${region}"
}
`);
  } else if (provider === 'azure') {
    sections.push(`terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}
`);
  } else if (provider === 'gcp') {
    sections.push(`terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "${resources[0]?.attributes.project || "YOUR_PROJECT_ID"}"
  region  = "${region}"
}
`);
  }

  // Resource blocks sorted by type for readability
  const sorted = [...selected].sort((a, b) => a.resourceType.localeCompare(b.resourceType));

  for (const res of sorted) {
    const tfName = sanitiseName(res.resourceName);
    const block = genResourceBlock(res, tfName, deps, selected);
    if (block) sections.push(block);
  }

  // terraform import commands
  sections.push(`\n# ── Import Commands ────────────────────────────────────`);
  sections.push(`# Run these to import existing resources into Terraform state:`);
  for (const res of sorted) {
    const tfName = sanitiseName(res.resourceName);
    const importId = generateImportId(res);
    if (importId) {
      sections.push(`# terraform import ${res.resourceType}.${tfName} ${importId}`);
    }
  }

  return sections.join('\n\n');
}

function genResourceBlock(
  res: DiscoveredResource,
  tfName: string,
  deps: ResourceDependency[],
  allResources: DiscoveredResource[],
): string {
  const L: string[] = [`resource "${res.resourceType}" "${tfName}" {`];
  const myDeps = deps.filter(d => d.from === res.id);

  // Add depends_on if there are dependencies
  if (myDeps.length > 0) {
    const depRefs = myDeps.map(d => {
      const target = allResources.find(r => r.id === d.to);
      if (target) return `${target.resourceType}.${sanitiseName(target.resourceName)}`;
      return '';
    }).filter(Boolean);

    if (depRefs.length > 0) {
      L.push(`  depends_on = [`);
      for (const ref of depRefs) L.push(`    ${ref},`);
      L.push(`  ]`);
    }
  }

  // Generate attributes based on type
  const attrs = generateAttrs(res);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== '' && v !== null) {
      L.push(`  ${k} = ${v}`);
    }
  }

  // Tags
  const hasTags = Object.keys(res.tags).length > 0;
  if (hasTags) {
    L.push(`  tags = {`);
    for (const [k, v] of Object.entries(res.tags)) {
      L.push(`    ${k} = "${v}"`);
    }
    L.push(`  }`);
  }

  L.push('}');
  return L.join('\n');
}

function generateAttrs(res: DiscoveredResource): Record<string, string | undefined> {
  const a = res.attributes;
  const type = res.resourceType;

  if (type === 'aws_instance') {
    return {
      ami: `"${a.ami || 'ami-0c55b159cbfafe1f0'}"`,
      instance_type: `"${a.instance_type || 't2.micro'}"`,
      ...(a.subnet_id ? { subnet_id: `aws_subnet.${sanitiseName(findNameForId(a.subnet_id, res))}.id` } : {}),
      ...(a.key_name ? { key_name: `"${a.key_name}"` } : {}),
      associate_public_ip_address: a.associate_public_ip_address || 'false',
    };
  }

  if (type === 'aws_vpc') {
    return {
      cidr_block: `"${a.cidr_block || '10.0.0.0/16'}"`,
      enable_dns_support: a.enable_dns_support || 'true',
      enable_dns_hostnames: a.enable_dns_hostnames || 'true',
    };
  }

  if (type === 'aws_subnet') {
    return {
      vpc_id: `aws_vpc.${sanitiseName(findNameForId(a.vpc_id, res))}.id`,
      cidr_block: `"${a.cidr_block || '10.0.1.0/24'}"`,
      availability_zone: a.availability_zone ? `"${a.availability_zone}"` : undefined,
      map_public_ip_on_launch: a.map_public_ip_on_launch || 'false',
    };
  }

  if (type === 'aws_security_group') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      description: `"${a.description || 'Managed by Terraform'}"`,
      vpc_id: a.vpc_id ? `aws_vpc.${sanitiseName(findNameForId(a.vpc_id, res))}.id` : undefined,
    };
  }

  if (type === 'aws_internet_gateway') {
    return {
      vpc_id: a.vpc_id ? `aws_vpc.${sanitiseName(findNameForId(a.vpc_id, res))}.id` : undefined,
    };
  }

  if (type === 'aws_eip') {
    return {
      domain: `"${a.domain || 'vpc'}"`,
    };
  }

  if (type === 'aws_nat_gateway') {
    return {
      allocation_id: a.allocation_id ? `aws_eip.${sanitiseName(findNameForId(a.allocation_id, res))}.id` : undefined,
      subnet_id: a.subnet_id ? `aws_subnet.${sanitiseName(findNameForId(a.subnet_id, res))}.id` : undefined,
    };
  }

  if (type === 'aws_route_table') {
    return {
      vpc_id: a.vpc_id ? `aws_vpc.${sanitiseName(findNameForId(a.vpc_id, res))}.id` : undefined,
    };
  }

  if (type === 'aws_lb') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      internal: a.internal || 'false',
      load_balancer_type: `"${a.load_balancer_type || 'application'}"`,
      subnets: a.subnets ? splitAttr(a.subnets) : undefined,
      security_groups: a.security_groups ? splitAttr(a.security_groups) : undefined,
    };
  }

  if (type === 'aws_s3_bucket') {
    return {
      bucket: `"${a.bucket || sanitiseName(res.resourceName)}"`,
      acl: `"${a.acl || 'private'}"`,
    };
  }

  if (type === 'aws_rds_instance') {
    return {
      engine: `"${a.engine || 'mysql'}"`,
      engine_version: `"${a.engine_version || '8.0'}"`,
      instance_class: `"${a.instance_class || 'db.t3.micro'}"`,
      allocated_storage: a.allocated_storage || '20',
      db_name: a.db_name ? `"${a.db_name}"` : undefined,
      username: a.username ? `"${a.username}"` : undefined,
      storage_type: `"${a.storage_type || 'gp3'}"`,
      skip_final_snapshot: 'true',
      publicly_accessible: a.publicly_accessible || 'false',
    };
  }

  if (type === 'aws_lambda_function') {
    return {
      function_name: `"${a.function_name || sanitiseName(res.resourceName)}"`,
      role: `"${a.role || 'arn:aws:iam::000000000000:role/lambda-role'}"`,
      runtime: `"${a.runtime || 'nodejs18.x'}"`,
      handler: `"${a.handler || 'index.handler'}"`,
      memory_size: a.memory_size || '128',
      timeout: a.timeout || '3',
      ...(a.subnet_ids ? { vpc_config: undefined } : {}),
    };
  }

  if (type === 'aws_dynamodb_table') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      billing_mode: `"${a.billing_mode || 'PAY_PER_REQUEST'}"`,
      hash_key: `"${a.hash_key || 'id'}"`,
    };
  }

  if (type === 'aws_eks_cluster') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      role_arn: `"${a.role_arn || 'arn:aws:iam::000000000000:role/eks-role'}"`,
      version: `"${a.version || '1.29'}"`,
    };
  }

  if (type === 'aws_route53_zone') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      private_zone: a.private_zone || 'false',
    };
  }

  // Azure types
  if (type === 'azurerm_linux_virtual_machine') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      resource_group_name: `"${a.resource_group_name || 'my-resource-group'}"`,
      location: `"${a.location || 'East US'}"`,
      size: `"${a.size || 'Standard_B2s'}"`,
      admin_username: `"${a.admin_username || 'azureuser'}"`,
      admin_password: `"<password>"`,
      network_interface_ids: `[]`,
      os_disk: `{
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
  }`,
      source_image_reference: `{
    publisher = "Canonical"
    offer     = "UbuntuServer"
    sku       = "18.04-LTS"
    version   = "latest"
  }`,
    };
  }

  if (type === 'azurerm_storage_account') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      resource_group_name: `"${a.resource_group_name || 'my-resource-group'}"`,
      location: `"${a.location || 'East US'}"`,
      account_tier: `"${a.account_tier || 'Standard'}"`,
      account_replication_type: `"${a.account_replication_type || 'LRS'}"`,
    };
  }

  if (type === 'azurerm_kubernetes_cluster') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      resource_group_name: `"${a.resource_group_name || 'my-resource-group'}"`,
      location: `"${a.location || 'East US'}"`,
      dns_prefix: `"${sanitiseName(res.resourceName).substring(0, 20)}"`,
      default_node_pool: `{
    name       = "default"
    node_count = ${a.node_count || 3}
    vm_size    = "${a.node_vm_size || 'Standard_D2s_v3'}"
  }`,
      identity: `{
    type = "SystemAssigned"
  }`,
    };
  }

  if (type === 'azurerm_cosmosdb_account') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      resource_group_name: `"${a.resource_group_name || 'my-resource-group'}"`,
      location: `"${a.location || 'East US'}"`,
      offer_type: `"${a.offer_type || 'Standard'}"`,
      kind: `"${a.kind || 'GlobalDocumentDB'}"`,
      consistency_policy: `{
    consistency_level = "Session"
  }`,
      geo_location: `{
    location          = "${a.location || 'East US'}"
    failover_priority = 0
  }`,
    };
  }

  // GCP types
  if (type === 'google_compute_instance') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      project: `"${a.project || 'my-project'}"`,
      zone: `"${a.zone || 'us-central1-a'}"`,
      machine_type: `"${a.machine_type || 'e2-medium'}"`,
      boot_disk: `{
    initialize_params {
      image = "debian-cloud/debian-11"
    }
  }`,
      network_interface: `{
    network = "${a.network || 'default'}"
    ${a.subnetwork ? `subnetwork = "${a.subnetwork}"` : ''}
  }`,
    };
  }

  if (type === 'google_container_cluster') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      project: `"${a.project || 'my-project'}"`,
      location: `"${a.location || 'us-central1'}"`,
      network: `"${a.network || 'default'}"`,
      subnetwork: `"${a.subnetwork || 'default'}"`,
      initial_node_count: a.node_count || '3',
      node_config: `{
    machine_type = "${a.machine_type || 'e2-medium'}"
  }`,
    };
  }

  if (type === 'google_storage_bucket') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      project: `"${a.project || 'my-project'}"`,
      location: `"${a.location || 'US'}"`,
      storage_class: `"${a.storage_class || 'STANDARD'}"`,
      force_destroy: 'true',
    };
  }

  if (type === 'google_sql_database_instance') {
    return {
      name: `"${a.name || sanitiseName(res.resourceName)}"`,
      project: `"${a.project || 'my-project'}"`,
      database_version: `"${a.database_version || 'POSTGRES_15'}"`,
      region: `"${a.region || 'us-central1'}"`,
      settings: `{
    tier = "${a.tier || 'db-f1-micro'}"
  }`,
    };
  }

  return {};
}

function splitAttr(val: string): string {
  const parts = val.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return '[]';
  return `[${parts.map(p => `aws_subnet.${sanitiseName(p)}.id`).join(', ')}]`;
}

function findNameForId(id: string, _context: DiscoveredResource): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function generateImportId(res: DiscoveredResource): string {
  const type = res.resourceType;
  const a = res.attributes;

  if (type === 'aws_instance') return a['_id'] || '';
  if (type === 'aws_vpc') return a['_id'] || '';
  if (type === 'aws_subnet') return a['_id'] || '';
  if (type === 'aws_security_group') return `${a['vpc_id'] || ''}/${a['name'] || sanitiseName(res.resourceName)}`;
  if (type === 'aws_internet_gateway') return a['_id'] || '';
  if (type === 'aws_eip') return a['_id'] || '';
  if (type === 'aws_nat_gateway') return a['_id'] || '';
  if (type === 'aws_route_table') return a['_id'] || '';
  if (type === 'aws_s3_bucket') return a['_id'] || '';
  if (type === 'aws_lb') return a['_id'] || '';
  if (type === 'aws_rds_instance') return a['_id'] || '';
  if (type === 'aws_lambda_function') return a['_id'] || '';
  if (type === 'aws_dynamodb_table') return a['_id'] || '';
  if (type === 'aws_eks_cluster') return a['_id'] || '';
  if (type === 'aws_route53_zone') return a['_id'] || '';

  return `# TODO: import ID for ${res.resourceType}`;
}

// ── Canvas Node Generation ───────────────────────────────────────────────────

export function resourcesToCanvasNodes(
  resources: DiscoveredResource[],
  selectedIds: string[],
): { nodes: Node<ResourceNodeData>[]; edges: Edge[] } {
  const selected = resources.filter(r => selectedIds.includes(r.id));
  const nodes: Node<ResourceNodeData>[] = [];
  const edges: Edge[] = [];
  const deps = inferDependencies(selected);
  let idCounter = 1;
  const xSpacing = 250;
  const ySpacing = 80;

  const typeMap = new Map<string, DiscoveredResource[]>();
  for (const r of selected) {
    const existing = typeMap.get(r.resourceType) ?? [];
    existing.push(r);
    typeMap.set(r.resourceType, existing);
  }

  let yPos = 50;
  for (const [, group] of typeMap) {
    let xPos = 50;
    for (const res of group) {
      const def = findResourceDef(res.resourceType, res.provider);
      if (!def) continue;

      const nodeId = `import_${idCounter}_${res.id}`;
      const cleanName = slug(res.resourceName);

      const defaultConfig: Record<string, string | number | boolean> = {};
      for (const field of def.fields) {
        if (field.default !== undefined) {
          defaultConfig[field.key] = field.default;
        }
        const attrVal = res.attributes[field.key];
        if (attrVal !== undefined) {
          defaultConfig[field.key] = attrVal;
        }
      }

      nodes.push({
        id: nodeId,
        type: 'resourceNode',
        position: { x: xPos, y: yPos },
        data: {
          resourceType: res.resourceType as ResourceType,
          resourceName: cleanName,
          config: defaultConfig,
          definition: def,
        },
      });

      idCounter++;
      xPos += xSpacing;
    }
    yPos += ySpacing;
  }

  // Create edges from dependencies
  let edgeId = 1;
  for (const dep of deps) {
    const sourceNode = nodes.find(n => n.data.resourceName === slug(
      selected.find(r => r.id === dep.from)?.resourceName ?? '',
    ));
    const targetNode = nodes.find(n => n.data.resourceName === slug(
      selected.find(r => r.id === dep.to)?.resourceName ?? '',
    ));

    if (sourceNode && targetNode) {
      edges.push({
        id: `import_edge_${edgeId++}`,
        source: targetNode.id,
        target: sourceNode.id,
        type: 'smoothstep',
        animated: true,
        label: dep.reason.substring(0, 30),
      });
    }
  }

  return { nodes, edges };
}
