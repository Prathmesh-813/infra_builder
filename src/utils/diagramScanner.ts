/**
 * diagramScanner.ts
 *
 * Scans architecture diagrams and extracts cloud resources → Terraform HCL.
 *
 * Strategies by file type:
 *  - Draw.io (.drawio/.xml) : parse XML shapes + labels  → high confidence
 *  - PNG / JPEG             : Tesseract.js OCR            → medium confidence
 *  - PDF                    : pdfjs-dist text extraction  → medium confidence
 *
 * Also generates a complete environment-based Terraform project (dev/staging/prod)
 * with proper folder structure from detected resources.
 */

import { RESOURCE_GENERATORS } from './terraformGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectedResource {
  id: string;
  label: string;
  terraformType: string;
  provider: 'aws' | 'azure' | 'gcp' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  suggestedName: string;
  config: Record<string, string | number | boolean>;
}

export interface ScanResult {
  provider: 'aws' | 'azure' | 'gcp' | 'unknown';
  resources: DetectedResource[];
  rawLabels: string[];
  warnings: string[];
  fileName: string;
  fileType: 'image' | 'drawio' | 'pdf';
  extractedText?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resource mapping dictionary
// ─────────────────────────────────────────────────────────────────────────────

interface ResourceMapping {
  keywords: string[];
  terraformType: string;
  provider: 'aws' | 'azure' | 'gcp';
  defaultConfig: Record<string, string | number | boolean>;
}

const RESOURCE_MAPPINGS: ResourceMapping[] = [
  // AWS Compute
  { keywords: ['ec2','amazon ec2','elastic compute','virtual machine','vm instance','web server','app server','application server','compute instance','t2.micro','t3.micro','t3.small','m5.large'],
    terraformType: 'aws_instance', provider: 'aws',
    defaultConfig: { ami: 'ami-0c55b159cbfafe1f0', instance_type: 't3.micro' } },
  { keywords: ['auto scaling','autoscaling','asg','auto scale group','scaling group'],
    terraformType: 'aws_autoscaling_group', provider: 'aws',
    defaultConfig: { min_size: 1, max_size: 3, desired_capacity: 2 } },
  { keywords: ['eks','elastic kubernetes','kubernetes cluster','k8s cluster','amazon eks'],
    terraformType: 'aws_eks_cluster', provider: 'aws',
    defaultConfig: { version: '1.29' } },
  { keywords: ['ecs','elastic container service','fargate','container service','amazon ecs'],
    terraformType: 'aws_ecs_cluster', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['lambda','aws lambda','serverless function','function as a service','faas'],
    terraformType: 'aws_lambda_function', provider: 'aws',
    defaultConfig: { runtime: 'nodejs18.x', handler: 'index.handler', memory_size: 128, timeout: 30 } },
  { keywords: ['elastic beanstalk','beanstalk','paas'],
    terraformType: 'aws_elastic_beanstalk_environment', provider: 'aws',
    defaultConfig: {} },
  // AWS Storage
  { keywords: ['s3','amazon s3','simple storage service','s3 bucket','object storage','bucket'],
    terraformType: 'aws_s3_bucket', provider: 'aws',
    defaultConfig: { force_destroy: false } },
  { keywords: ['ebs','elastic block store','block storage','ebs volume'],
    terraformType: 'aws_ebs_volume', provider: 'aws',
    defaultConfig: { size: 20, type: 'gp3' } },
  { keywords: ['efs','elastic file system','file storage','nfs','shared storage'],
    terraformType: 'aws_efs_file_system', provider: 'aws',
    defaultConfig: { performance_mode: 'generalPurpose' } },
  { keywords: ['glacier','archive storage','cold storage','long term storage'],
    terraformType: 'aws_glacier_vault', provider: 'aws',
    defaultConfig: {} },
  // AWS Network
  { keywords: ['vpc','virtual private cloud','private network','isolated network'],
    terraformType: 'aws_vpc', provider: 'aws',
    defaultConfig: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true } },
  { keywords: ['subnet','private subnet','public subnet','sub network','availability zone'],
    terraformType: 'aws_subnet', provider: 'aws',
    defaultConfig: { cidr_block: '10.0.1.0/24' } },
  { keywords: ['security group','sg','firewall rules','inbound rules','outbound rules','network acl'],
    terraformType: 'aws_security_group', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['internet gateway','igw','internet access','public gateway'],
    terraformType: 'aws_internet_gateway', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['load balancer','alb','nlb','elb','elastic load balancer','application load balancer','network load balancer','lb'],
    terraformType: 'aws_lb', provider: 'aws',
    defaultConfig: { load_balancer_type: 'application', internal: false } },
  { keywords: ['nat gateway','nat','network address translation','private internet'],
    terraformType: 'aws_nat_gateway', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['cloudfront','cdn','content delivery network','edge location','distribution'],
    terraformType: 'aws_cloudfront_distribution', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['route 53','route53','dns','hosted zone','domain name','dns resolution'],
    terraformType: 'aws_route53_zone', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['api gateway','apigw','rest api','http api','api management','api endpoint'],
    terraformType: 'aws_api_gateway_rest_api', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['vpn gateway','vpn','virtual private network','site to site'],
    terraformType: 'aws_vpn_gateway', provider: 'aws',
    defaultConfig: {} },
  // AWS Database
  { keywords: ['rds','relational database','amazon rds','mysql','postgres','postgresql','aurora','mariadb','sql database','database server','db instance'],
    terraformType: 'aws_rds_instance', provider: 'aws',
    defaultConfig: { engine: 'mysql', engine_version: '8.0', instance_class: 'db.t3.micro', allocated_storage: 20 } },
  { keywords: ['dynamodb','dynamo db','nosql','key value store','document database','amazon dynamodb'],
    terraformType: 'aws_dynamodb_table', provider: 'aws',
    defaultConfig: { billing_mode: 'PAY_PER_REQUEST' } },
  { keywords: ['elasticache','redis','memcached','cache','in memory','amazon elasticache'],
    terraformType: 'aws_elasticache_cluster', provider: 'aws',
    defaultConfig: { engine: 'redis', node_type: 'cache.t3.micro', num_cache_nodes: 1 } },
  { keywords: ['redshift','data warehouse','amazon redshift','analytics database','olap'],
    terraformType: 'aws_redshift_cluster', provider: 'aws',
    defaultConfig: { node_type: 'dc2.large', cluster_type: 'single-node' } },
  // AWS Messaging
  { keywords: ['sns','simple notification service','notification','pub sub','topic','amazon sns'],
    terraformType: 'aws_sns_topic', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['sqs','simple queue service','message queue','queue','amazon sqs'],
    terraformType: 'aws_sqs_queue', provider: 'aws',
    defaultConfig: { visibility_timeout_seconds: 30 } },
  { keywords: ['kinesis','data stream','streaming','amazon kinesis','real time stream'],
    terraformType: 'aws_kinesis_stream', provider: 'aws',
    defaultConfig: { shard_count: 1 } },
  { keywords: ['eventbridge','event bus','event driven','amazon eventbridge','events'],
    terraformType: 'aws_eventbridge_rule', provider: 'aws',
    defaultConfig: {} },
  // AWS Security
  { keywords: ['iam role','iam','identity access management','service role','execution role','role'],
    terraformType: 'aws_iam_role', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['kms','key management service','encryption key','customer managed key','cmk'],
    terraformType: 'aws_kms_key', provider: 'aws',
    defaultConfig: { deletion_window_in_days: 30 } },
  { keywords: ['secrets manager','aws secrets','secret store','credentials store'],
    terraformType: 'aws_secretsmanager_secret', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['cognito','user pool','identity pool','authentication','user authentication','login'],
    terraformType: 'aws_cognito_user_pool', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['waf','web application firewall','wafv2','ddos protection'],
    terraformType: 'aws_wafv2_web_acl', provider: 'aws',
    defaultConfig: { scope: 'REGIONAL' } },
  // AWS Monitoring / DevOps
  { keywords: ['cloudwatch','cloud watch','monitoring','log group','metrics','alarms','aws logs'],
    terraformType: 'aws_cloudwatch_log_group', provider: 'aws',
    defaultConfig: { retention_in_days: 30 } },
  { keywords: ['cloudtrail','audit log','cloud trail','api audit'],
    terraformType: 'aws_cloudtrail', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['ecr','elastic container registry','container registry','docker registry','image registry'],
    terraformType: 'aws_ecr_repository', provider: 'aws',
    defaultConfig: { image_tag_mutability: 'MUTABLE' } },
  { keywords: ['codepipeline','code pipeline','ci cd','cicd','pipeline','continuous integration','continuous deployment'],
    terraformType: 'aws_codepipeline', provider: 'aws',
    defaultConfig: {} },
  { keywords: ['sagemaker','machine learning','ml','artificial intelligence','ai model','amazon sagemaker'],
    terraformType: 'aws_sagemaker_endpoint', provider: 'aws',
    defaultConfig: {} },
  // Azure
  { keywords: ['azure vm','azure virtual machine','windows vm','linux vm','azure compute'],
    terraformType: 'azurerm_linux_virtual_machine', provider: 'azure',
    defaultConfig: { size: 'Standard_B2s', admin_username: 'azureuser' } },
  { keywords: ['aks','azure kubernetes service','azure k8s','azure container'],
    terraformType: 'azurerm_kubernetes_cluster', provider: 'azure',
    defaultConfig: { node_count: 3, node_vm_size: 'Standard_D2s_v3' } },
  { keywords: ['azure storage','storage account','blob storage','azure blob','azure files'],
    terraformType: 'azurerm_storage_account', provider: 'azure',
    defaultConfig: { account_tier: 'Standard', account_replication_type: 'LRS' } },
  { keywords: ['vnet','azure vnet','virtual network','azure virtual network'],
    terraformType: 'azurerm_virtual_network', provider: 'azure',
    defaultConfig: { address_space: '10.0.0.0/16' } },
  { keywords: ['azure sql','sql database','azure database','mssql','azure db'],
    terraformType: 'azurerm_mssql_database', provider: 'azure',
    defaultConfig: { sku_name: 'S1' } },
  { keywords: ['cosmos db','cosmosdb','azure cosmos','cosmos','globally distributed'],
    terraformType: 'azurerm_cosmosdb_account', provider: 'azure',
    defaultConfig: { offer_type: 'Standard', kind: 'GlobalDocumentDB' } },
  { keywords: ['azure function','function app','azure functions','serverless azure'],
    terraformType: 'azurerm_linux_function_app', provider: 'azure',
    defaultConfig: {} },
  { keywords: ['key vault','azure key vault','azure secrets','azure encryption'],
    terraformType: 'azurerm_key_vault', provider: 'azure',
    defaultConfig: { sku_name: 'standard' } },
  { keywords: ['azure load balancer','azure lb','azure alb','azure traffic'],
    terraformType: 'azurerm_lb', provider: 'azure',
    defaultConfig: { sku: 'Standard' } },
  { keywords: ['acr','azure container registry','azure docker','azure images'],
    terraformType: 'azurerm_container_registry', provider: 'azure',
    defaultConfig: { sku: 'Standard' } },
  // GCP
  { keywords: ['compute engine','gce','google compute','gcp vm','google vm'],
    terraformType: 'google_compute_instance', provider: 'gcp',
    defaultConfig: { machine_type: 'e2-medium' } },
  { keywords: ['gke','google kubernetes engine','google k8s','gcp kubernetes'],
    terraformType: 'google_container_cluster', provider: 'gcp',
    defaultConfig: { node_count: 3, machine_type: 'e2-medium' } },
  { keywords: ['cloud run','google cloud run','gcp serverless','run service'],
    terraformType: 'google_cloud_run_v2_service', provider: 'gcp',
    defaultConfig: { min_instances: 0, max_instances: 10 } },
  { keywords: ['cloud storage','gcs','google storage','gcp bucket','google bucket'],
    terraformType: 'google_storage_bucket', provider: 'gcp',
    defaultConfig: { storage_class: 'STANDARD' } },
  { keywords: ['cloud sql','gcp sql','google sql','gcp database','google database'],
    terraformType: 'google_sql_database_instance', provider: 'gcp',
    defaultConfig: { database_version: 'MYSQL_8_0', tier: 'db-f1-micro' } },
  { keywords: ['firestore','google firestore','gcp nosql','cloud firestore'],
    terraformType: 'google_firestore_database', provider: 'gcp',
    defaultConfig: {} },
  { keywords: ['cloud functions','google cloud functions','gcp function','cloud function'],
    terraformType: 'google_cloudfunctions2_function', provider: 'gcp',
    defaultConfig: { runtime: 'nodejs18' } },
  { keywords: ['google vpc','gcp vpc','google network','compute network','gcp network'],
    terraformType: 'google_compute_network', provider: 'gcp',
    defaultConfig: { auto_create_subnetworks: false } },
  { keywords: ['artifact registry','google artifact','gcp registry','google container registry'],
    terraformType: 'google_artifact_registry_repository', provider: 'gcp',
    defaultConfig: { format: 'DOCKER' } },
  { keywords: ['bigquery','big query','gcp analytics','google analytics','data warehouse gcp'],
    terraformType: 'google_bigquery_dataset', provider: 'gcp',
    defaultConfig: { location: 'US' } },
  { keywords: ['pub sub','pubsub','google pubsub','gcp messaging','cloud pub sub'],
    terraformType: 'google_pubsub_topic', provider: 'gcp',
    defaultConfig: {} },
];


// ─────────────────────────────────────────────────────────────────────────────
// Provider detection
// ─────────────────────────────────────────────────────────────────────────────

function detectProvider(text: string): 'aws' | 'azure' | 'gcp' | 'unknown' {
  const t = text.toLowerCase();
  const awsScore = (t.match(/\b(aws|amazon|ec2|s3|rds|lambda|vpc|iam|eks|ecs|sqs|sns|cloudwatch|cloudfront|route\s*53|dynamodb|elasticache|redshift|kinesis|fargate|beanstalk|cognito|kms|waf|cloudtrail|sagemaker|glue|athena|emr|ecr|codepipeline|aurora|elastic)\b/g) || []).length;
  const azureScore = (t.match(/\b(azure|azurerm|microsoft|aks|vnet|blob|cosmos|keyvault|mssql|acr|function\s*app|logic\s*app|service\s*bus|azure\s*sql|azure\s*storage|azure\s*vm)\b/g) || []).length;
  const gcpScore = (t.match(/\b(gcp|google|gke|gce|gcs|bigquery|pubsub|cloud\s*run|cloud\s*sql|firestore|spanner|dataflow|artifact\s*registry|cloud\s*function|compute\s*engine)\b/g) || []).length;

  const max = Math.max(awsScore, azureScore, gcpScore);
  if (max === 0) return 'unknown';
  if (awsScore === max) return 'aws';
  if (azureScore === max) return 'azure';
  return 'gcp';
}

// ─────────────────────────────────────────────────────────────────────────────
// Label → resource matching
// ─────────────────────────────────────────────────────────────────────────────

function matchLabel(label: string): ResourceMapping | null {
  const lower = label.toLowerCase().trim();
  if (!lower || lower.length < 2) return null;

  let best: { mapping: ResourceMapping; score: number } | null = null;

  for (const mapping of RESOURCE_MAPPINGS) {
    for (const kw of mapping.keywords) {
      if (lower.includes(kw) || kw.includes(lower)) {
        const score = kw.length + (lower === kw ? 100 : 0);
        if (!best || score > best.score) best = { mapping, score };
      }
    }
  }
  return best?.mapping ?? null;
}

function toSafeName(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || `resource_${index}`;
  return `${base}_${index + 1}`;
}

function buildDetectedResource(
  label: string,
  mapping: ResourceMapping,
  index: number,
  confidence: 'high' | 'medium' | 'low',
): DetectedResource {
  return {
    id: `detected_${index}`,
    label,
    terraformType: mapping.terraformType,
    provider: mapping.provider,
    confidence,
    suggestedName: toSafeName(label, index),
    config: { ...mapping.defaultConfig, tags_name: toSafeName(label, index) },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text → resources (shared by all file types after text extraction)
// ─────────────────────────────────────────────────────────────────────────────

function extractResourcesFromText(
  text: string,
  fileType: 'image' | 'drawio' | 'pdf',
): { resources: DetectedResource[]; rawLabels: string[] } {
  // Split text into candidate labels: lines, comma-separated, slash-separated
  const rawCandidates = text
    .split(/[\n\r,;|/\\]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 120);

  // Also try sliding window of 1-4 words for multi-word service names
  const words = text.toLowerCase().split(/\s+/);
  const windowCandidates: string[] = [];
  for (let i = 0; i < words.length; i++) {
    for (let len = 1; len <= 4; len++) {
      if (i + len <= words.length) {
        windowCandidates.push(words.slice(i, i + len).join(' '));
      }
    }
  }

  const allCandidates = [...rawCandidates, ...windowCandidates];
  const rawLabels = [...new Set(rawCandidates)];

  const seen = new Set<string>();
  const resources: DetectedResource[] = [];
  let idx = 0;

  for (const candidate of allCandidates) {
    const mapping = matchLabel(candidate);
    if (!mapping) continue;

    const key = mapping.terraformType;
    if (seen.has(key)) continue;
    seen.add(key);

    const lower = candidate.toLowerCase();
    const isHighConf = mapping.keywords.some(
      (kw) => lower === kw || lower.startsWith(kw + ' ') || lower.endsWith(' ' + kw),
    );
    const confidence: 'high' | 'medium' | 'low' =
      isHighConf ? (fileType === 'drawio' ? 'high' : 'medium')
      : fileType === 'drawio' ? 'medium'
      : 'low';

    resources.push(buildDetectedResource(candidate, mapping, idx++, confidence));
  }

  return { resources, rawLabels };
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw.io XML parser
// ─────────────────────────────────────────────────────────────────────────────

function parseDrawio(xmlText: string): string {
  const labels: string[] = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    doc.querySelectorAll('mxCell').forEach((cell) => {
      const value = cell.getAttribute('value') ?? '';
      const style = cell.getAttribute('style') ?? '';
      const clean = value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (clean.length > 1) labels.push(clean);

      // Extract shape name from style (e.g. shape=mxgraph.aws4.ec2)
      const shapeMatch = style.match(/shape=([^;]+)/);
      if (shapeMatch) {
        const shapeName = shapeMatch[1]
          .replace(/mxgraph\.[^.]+\./g, '')
          .replace(/[._]/g, ' ')
          .trim();
        if (shapeName.length > 1) labels.push(shapeName);
      }
    });

    doc.querySelectorAll('UserObject').forEach((obj) => {
      const label = obj.getAttribute('label') ?? '';
      const clean = label.replace(/<[^>]+>/g, ' ').trim();
      if (clean.length > 1) labels.push(clean);
    });
  } catch { /* ignore */ }

  return [...new Set(labels)].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Image OCR via Tesseract.js
// ─────────────────────────────────────────────────────────────────────────────

async function ocrImage(file: File): Promise<string> {
  // Dynamic import so Tesseract worker is only loaded when needed
  const Tesseract = await import('tesseract.js');

  const worker = await Tesseract.createWorker('eng', 1, {
    // Suppress verbose Tesseract logs
    logger: () => {},
  });

  try {
    // Convert File to object URL for Tesseract
    const url = URL.createObjectURL(file);
    const result = await worker.recognize(url);
    URL.revokeObjectURL(url);
    return result.data.text ?? '';
  } finally {
    await worker.terminate();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF text extraction via pdfjs-dist
// ─────────────────────────────────────────────────────────────────────────────

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Point the worker at the bundled worker file
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Terraform HCL generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateTerraformFromDetected(
  resources: DetectedResource[],
  provider: 'aws' | 'azure' | 'gcp' | 'unknown',
  region: string,
): string {
  if (resources.length === 0) {
    return [
      '# No cloud resources were detected in the diagram.',
      '# Tips:',
      '#  - For images: make sure service names are clearly visible as text',
      '#  - For PDFs: ensure the PDF contains selectable text (not a scanned image)',
      '#  - For Draw.io: label each shape with the service name',
    ].join('\n') + '\n';
  }

  const sections: string[] = [];

  // ── Header ───────────────────────────────────────────────────────────────────
  sections.push(`# ============================================================
# Terraform — generated from architecture diagram scan
# Provider  : ${provider.toUpperCase()}
# Resources : ${resources.length}
# ⚠  Review all placeholder values before applying
# ============================================================
`);

  // ── Terraform + Provider blocks ──────────────────────────────────────────────
  if (provider === 'aws') {
    sections.push(`terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "${region}"

  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = "dev"
      Source      = "diagram-scan"
    }
  }
}
`);
  } else if (provider === 'azure') {
    sections.push(`terraform {
  required_version = ">= 1.5.0"

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
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "YOUR_PROJECT_ID"
  region  = "${region}"
}
`);
  } else {
    sections.push(`# Provider could not be determined — defaulting to AWS
terraform {
  required_version = ">= 1.5.0"

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
  }

  // ── Resource blocks (using full generators from terraformGenerator.ts) ───────
  if (provider === 'aws' || provider === 'unknown') {
    for (const res of resources) {
      const name = res.suggestedName;
      const genFn = RESOURCE_GENERATORS[res.terraformType];

      if (genFn) {
        // Use the full resource generator — merge default config with extras
        const fullConfig = { ...res.config, tags_name: name };
        let block = genFn(name, fullConfig as Record<string, string | number | boolean>);

        // Prepend detection comment
        block = `# Detected: "${res.label}" (confidence: ${res.confidence})\n${block}`;
        sections.push(block);
      } else {
        // Fallback for unknown resource types
        const lines: string[] = [];
        lines.push(`# Detected: "${res.label}" (confidence: ${res.confidence})`);
        lines.push(`resource "${res.terraformType}" "${name}" {`);
        for (const [key, val] of Object.entries(res.config)) {
          if (key === 'tags_name') continue;
          if (typeof val === 'string') lines.push(`  ${key} = "${val}"`);
          else if (typeof val === 'boolean') lines.push(`  ${key} = ${val}`);
          else lines.push(`  ${key} = ${val}`);
        }
        lines.push(`  tags = { Name = "${name}" ManagedBy = "Terraform" Source = "diagram-scan" }`);
        lines.push(`}`);
        sections.push(lines.join('\n'));
      }
    }
  } else {
    // Azure / GCP: use the original simple template approach
    for (const res of resources) {
      const lines: string[] = [];
      lines.push(`# Detected: "${res.label}" (confidence: ${res.confidence})`);
      lines.push(`resource "${res.terraformType}" "${res.suggestedName}" {`);
      for (const [key, val] of Object.entries(res.config)) {
        if (key === 'tags_name') continue;
        if (typeof val === 'string') lines.push(`  ${key} = "${val}"`);
        else if (typeof val === 'boolean') lines.push(`  ${key} = ${val}`);
        else lines.push(`  ${key} = ${val}`);
      }
      lines.push(`}`);
      sections.push(lines.join('\n'));
    }
  }

  return sections.join('\n\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scan entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function scanDiagram(file: File): Promise<ScanResult> {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const warnings: string[] = [];
  let extractedText = '';
  let fileType: 'image' | 'drawio' | 'pdf' = 'image';

  // ── Extract text by file type ──────────────────────────────────────────
  if (ext === 'drawio' || ext === 'xml') {
    fileType = 'drawio';
    const xmlText = await file.text();
    extractedText = parseDrawio(xmlText);
    if (!extractedText.trim()) {
      warnings.push('No labelled shapes found in the Draw.io file. Make sure shapes have text labels.');
    }

  } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
    fileType = 'image';
    try {
      extractedText = await ocrImage(file);
      if (!extractedText.trim()) {
        warnings.push('OCR found no readable text. The image may be too low-resolution or contain only icons without labels.');
      }
    } catch (err) {
      warnings.push(`OCR failed: ${err instanceof Error ? err.message : String(err)}. Falling back to filename analysis.`);
      extractedText = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    }

  } else if (ext === 'pdf') {
    fileType = 'pdf';
    try {
      extractedText = await extractPdfText(file);
      if (!extractedText.trim()) {
        warnings.push('No text found in PDF. It may be a scanned image PDF — try exporting as PNG first.');
      }
    } catch (err) {
      warnings.push(`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}.`);
      extractedText = '';
    }

  } else {
    warnings.push(`Unsupported file type ".${ext}". Please upload PNG, JPEG, PDF, or .drawio files.`);
    return { provider: 'unknown', resources: [], rawLabels: [], warnings, fileName, fileType: 'image' };
  }

  // ── Detect provider ────────────────────────────────────────────────────
  const provider = detectProvider(extractedText);

  // ── Match resources ────────────────────────────────────────────────────
  const { resources, rawLabels } = extractResourcesFromText(extractedText, fileType);

  // ── Fallback for images/PDFs with no matches ───────────────────────────
  if (resources.length === 0) {
    if (fileType === 'image' || fileType === 'pdf') {
      warnings.push(
        'Could not detect specific services from the extracted text. ' +
        'Generating a standard 3-tier AWS architecture as a starting template.',
      );
      const fallback = ['vpc', 'public subnet', 'private subnet', 'load balancer', 'ec2', 'rds', 'security group', 'internet gateway'];
      let idx = 0;
      for (const lbl of fallback) {
        const mapping = matchLabel(lbl);
        if (mapping) resources.push(buildDetectedResource(lbl, mapping, idx++, 'low'));
      }
    } else {
      warnings.push('No recognisable cloud resources detected. Make sure shapes are labelled with service names.');
    }
  }

  return { provider, resources, rawLabels, warnings, fileName, fileType, extractedText };
}

// ═════════════════════════════════════════════════════════════════════════════
// Environment-based Terraform project generation from detected resources
// ═════════════════════════════════════════════════════════════════════════════

export interface DetectedResourceProject {
  'main.tf': string;
  'providers.tf': string;
  'variables.tf': string;
  'outputs.tf': string;
  'envs/dev.tfvars': string;
  'envs/staging.tfvars': string;
  'envs/prod.tfvars': string;
  'README.md': string;
}

// ── Env size tiers matching best practice ───────────────────────────────────

interface EnvTier {
  instanceSize: string;
  minCount: number;
  maxCount: number;
  deletionProtection: boolean;
  highAvailability: boolean;
  logRetentionDays: number;
  backupRetentionDays: number;
}

const ENV_TIERS: Record<string, EnvTier> = {
  dev:     { instanceSize: 't3.micro', minCount: 1, maxCount: 2,  deletionProtection: false, highAvailability: false, logRetentionDays: 7,  backupRetentionDays: 1  },
  staging: { instanceSize: 't3.small', minCount: 1, maxCount: 4,  deletionProtection: false, highAvailability: false, logRetentionDays: 14, backupRetentionDays: 7  },
  prod:    { instanceSize: 't3.medium',minCount: 2, maxCount: 10, deletionProtection: true,  highAvailability: true,  logRetentionDays: 90, backupRetentionDays: 30 },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectedHeader(env: string, provider: string): string {
  const label = { dev: 'Development', staging: 'Staging', prod: 'Production' }[env] ?? env;
  return `# ============================================================
# Environment : ${label.toUpperCase()} (${env})
# Provider    : ${provider}
# Generated by Terraform Visual Builder — Diagram Scan
# ============================================================
`;
}

function detectedToSafeName(label: string, index: number): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30) || `resource_${index}`;
  return `${base}_${index + 1}`;
}

// ── Providers ────────────────────────────────────────────────────────────────

function detectedProvidersTf(provider: string, region: string): string {
  if (provider === 'aws') {
    return `terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use remote state per environment:
  # backend "s3" {
  #   bucket = "my-terraform-state-\${var.environment}"
  #   key    = "\${var.environment}/terraform.tfstate"
  #   region = "${region}"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
      Project     = var.project_name
    }
  }
}
`;
  }

  if (provider === 'azure') {
    return `terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  # backend "azurerm" {
  #   resource_group_name  = "terraform-state-rg"
  #   storage_account_name = "tfstate\${var.environment}"
  #   container_name       = "tfstate"
  #   key                  = "\${var.environment}.terraform.tfstate"
  # }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
`;
  }

  if (provider === 'gcp') {
    return `terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # backend "gcs" {
  #   bucket = "my-terraform-state-\${var.environment}"
  #   prefix = "\${var.environment}/terraform.tfstate"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
`;
  }

  return '# No provider configuration\n';
}

// ── Variables ────────────────────────────────────────────────────────────────

function detectedVariablesTf(resources: DetectedResource[], provider: string): string {
  const lines: string[] = [
    '# ============================================================',
    `# variables.tf — ${provider.toUpperCase()}`,
    '# All environment-specific values are supplied via .tfvars files',
    '# ============================================================',
    '',
    'variable "environment" {',
    '  description = "Deployment environment"',
    '  type        = string',
    '',
    '  validation {',
    '    condition     = contains(["dev", "staging", "prod"], var.environment)',
    '    error_message = "environment must be one of: dev, staging, prod."',
    '  }',
    '}',
    '',
    'variable "project_name" {',
    '  description = "Project name used for resource naming and tagging"',
    '  type        = string',
    '}',
    '',
  ];

  if (provider === 'aws') {
    lines.push(`variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile"
  type        = string
  default     = "default"
}

variable "instance_type" {
  description = "EC2 / compute instance type"
  type        = string
}

variable "min_count" {
  description = "Minimum number of instances / nodes"
  type        = number
}

variable "max_count" {
  description = "Maximum number of instances / nodes"
  type        = number
}

variable "deletion_protection" {
  description = "Enable deletion protection on stateful resources"
  type        = bool
}

variable "high_availability" {
  description = "Enable multi-AZ / high-availability mode"
  type        = bool
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
}

variable "backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
}
`);
  } else if (provider === 'azure') {
    lines.push(`variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
  sensitive   = true
}

variable "location" {
  description = "Azure region / location"
  type        = string
  default     = "East US"
}

variable "vm_size" {
  description = "Azure VM size"
  type        = string
}

variable "node_count" {
  description = "Default node / instance count"
  type        = number
}

variable "deletion_protection" {
  description = "Enable deletion protection on stateful resources"
  type        = bool
}

variable "high_availability" {
  description = "Enable zone-redundant / high-availability mode"
  type        = bool
}

variable "log_retention_days" {
  description = "Log Analytics retention in days"
  type        = number
}

variable "backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
}

variable "admin_password" {
  description = "Default admin password for VMs and databases"
  type        = string
  sensitive   = true
}
`);
  } else if (provider === 'gcp') {
    lines.push(`variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "machine_type" {
  description = "GCP Compute Engine machine type"
  type        = string
}

variable "min_count" {
  description = "Minimum number of instances / nodes"
  type        = number
}

variable "max_count" {
  description = "Maximum number of instances / nodes"
  type        = number
}

variable "deletion_protection" {
  description = "Enable deletion protection on stateful resources"
  type        = bool
}

variable "high_availability" {
  description = "Enable regional / high-availability mode"
  type        = bool
}

variable "log_retention_days" {
  description = "Log retention in days"
  type        = number
}

variable "backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
}
`);
  }

  // Resource-specific variables
  const seen = new Set<string>();
  for (const res of resources) {
    const safe = detectedToSafeName(res.label, resources.indexOf(res));

    if (res.terraformType === 'aws_instance' && res.config.ami && !seen.has('ami_id')) {
      seen.add('ami_id');
      lines.push(`variable "ami_id" {
  description = "AMI ID for EC2 instances"
  type        = string
}
`);
    }

    if ((res.terraformType === 'aws_rds_instance' || res.terraformType === 'azurerm_mssql_database' || res.terraformType === 'google_sql_database_instance') && !seen.has(`${safe}_db_password`)) {
      seen.add(`${safe}_db_password`);
      lines.push(`variable "${safe}_db_password" {
  description = "Master password for ${res.label} database"
  type        = string
  sensitive   = true
}
`);
    }

    if (res.terraformType === 'aws_s3_bucket' && res.config.bucket && !seen.has(`${safe}_bucket_name`)) {
      seen.add(`${safe}_bucket_name`);
      lines.push(`variable "${safe}_bucket_name" {
  description = "S3 bucket name for ${res.label}"
  type        = string
}
`);
    }

    if (res.terraformType === 'aws_vpc' && res.config.cidr_block && !seen.has(`${safe}_cidr`)) {
      seen.add(`${safe}_cidr`);
      lines.push(`variable "${safe}_cidr" {
  description = "CIDR block for ${res.label} VPC"
  type        = string
}
`);
    }
  }

  return lines.join('\n');
}

// ── Outputs ──────────────────────────────────────────────────────────────────

function detectedOutputsTf(resources: DetectedResource[]): string {
  const lines: string[] = ['# ============================================================',
    '# outputs.tf',
    '# Useful outputs from your infrastructure',
    '# ============================================================',
    '',
  ];

  for (const res of resources) {
    const name = detectedToSafeName(res.label, resources.indexOf(res));

    switch (res.terraformType) {
      case 'aws_instance':
        lines.push(`output "${name}_instance_id" {
  description = "ID of EC2 instance ${res.label}"
  value       = aws_instance.${name}.id
}

output "${name}_public_ip" {
  description = "Public IP of EC2 instance ${res.label}"
  value       = aws_instance.${name}.public_ip
}
`);
        break;
      case 'aws_vpc':
        lines.push(`output "${name}_vpc_id" {
  description = "ID of VPC ${res.label}"
  value       = aws_vpc.${name}.id
}

output "${name}_vpc_cidr" {
  description = "CIDR block of VPC ${res.label}"
  value       = aws_vpc.${name}.cidr_block
}
`);
        break;
      case 'aws_subnet':
        lines.push(`output "${name}_subnet_id" {
  description = "ID of subnet ${res.label}"
  value       = aws_subnet.${name}.id
}
`);
        break;
      case 'aws_lb':
        lines.push(`output "${name}_lb_dns" {
  description = "DNS name of load balancer ${res.label}"
  value       = aws_lb.${name}.dns_name
}

output "${name}_lb_arn" {
  description = "ARN of load balancer ${res.label}"
  value       = aws_lb.${name}.arn
}
`);
        break;
      case 'aws_rds_instance':
        lines.push(`output "${name}_db_endpoint" {
  description = "Endpoint of RDS instance ${res.label}"
  value       = aws_db_instance.${name}.endpoint
}

output "${name}_db_port" {
  description = "Port of RDS instance ${res.label}"
  value       = aws_db_instance.${name}.port
}
`);
        break;
      case 'aws_s3_bucket':
        lines.push(`output "${name}_bucket_name" {
  description = "Name of S3 bucket ${res.label}"
  value       = aws_s3_bucket.${name}.bucket
}

output "${name}_bucket_arn" {
  description = "ARN of S3 bucket ${res.label}"
  value       = aws_s3_bucket.${name}.arn
}
`);
        break;
      case 'aws_lambda_function':
        lines.push(`output "${name}_lambda_arn" {
  description = "ARN of Lambda function ${res.label}"
  value       = aws_lambda_function.${name}.arn
}

output "${name}_lambda_invoke_arn" {
  description = "Invoke ARN of Lambda function ${res.label}"
  value       = aws_lambda_function.${name}.invoke_arn
}
`);
        break;
      case 'aws_iam_role':
        lines.push(`output "${name}_role_arn" {
  description = "ARN of IAM role ${res.label}"
  value       = aws_iam_role.${name}.arn
}
`);
        break;
      case 'aws_eks_cluster':
        lines.push(`output "${name}_cluster_endpoint" {
  description = "Endpoint of EKS cluster ${res.label}"
  value       = aws_eks_cluster.${name}.endpoint
}

output "${name}_cluster_name" {
  description = "Name of EKS cluster ${res.label}"
  value       = aws_eks_cluster.${name}.name
}
`);
        break;
      case 'aws_ecr_repository':
        lines.push(`output "${name}_ecr_url" {
  description = "URL of ECR repository ${res.label}"
  value       = aws_ecr_repository.${name}.repository_url
}
`);
        break;
      case 'aws_api_gateway_rest_api':
        lines.push(`output "${name}_api_id" {
  description = "ID of API Gateway ${res.label}"
  value       = aws_api_gateway_rest_api.${name}.id
}
`);
        break;
      case 'aws_cloudfront_distribution':
        lines.push(`output "${name}_cf_domain" {
  description = "Domain name of CloudFront distribution ${res.label}"
  value       = aws_cloudfront_distribution.${name}.domain_name
}
`);
        break;
    }
  }

  if (lines.length <= 2) {
    lines.push('# No outputs defined\n');
  }

  return lines.join('\n');
}

// ── Per-environment .tfvars ──────────────────────────────────────────────────

function detectedTfvars(env: string, resources: DetectedResource[], provider: string): string {
  const tier = ENV_TIERS[env] ?? ENV_TIERS.dev;
  const lines: string[] = [detectedHeader(env, provider)];

  if (provider === 'aws') {
    lines.push(`environment           = "${env}"`);
    lines.push(`aws_region            = "us-east-1"`);
    lines.push(`aws_profile           = "default"`);
    lines.push(`project_name          = "my-project-${env}"`);
    lines.push(`instance_type         = "${tier.instanceSize}"`);
    lines.push(`min_count             = ${tier.minCount}`);
    lines.push(`max_count             = ${tier.maxCount}`);
    lines.push(`deletion_protection   = ${tier.deletionProtection}`);
    lines.push(`high_availability     = ${tier.highAvailability}`);
    lines.push(`log_retention_days    = ${tier.logRetentionDays}`);
    lines.push(`backup_retention_days = ${tier.backupRetentionDays}`);
    lines.push('');

    const seen = new Set<string>();
    for (const res of resources) {
      const safe = detectedToSafeName(res.label, resources.indexOf(res));

      if (res.terraformType === 'aws_instance' && res.config.ami && !seen.has('ami_id')) {
        seen.add('ami_id');
        lines.push(`ami_id = "${res.config.ami}"`);
      }
      if ((res.terraformType === 'aws_rds_instance') && !seen.has(`${safe}_db_password`)) {
        seen.add(`${safe}_db_password`);
        const envSuffix = env === 'prod' ? 'CHANGE_ME_PROD' : env === 'staging' ? 'CHANGE_ME_STAGING' : 'CHANGE_ME_DEV';
        lines.push(`${safe}_db_password = "${envSuffix}"`);
      }
      if (res.terraformType === 'aws_s3_bucket' && res.config.bucket && !seen.has(`${safe}_bucket_name`)) {
        seen.add(`${safe}_bucket_name`);
        lines.push(`${safe}_bucket_name = "${res.config.bucket}-${env}"`);
      }
      if (res.terraformType === 'aws_vpc' && res.config.cidr_block && !seen.has(`${safe}_cidr`)) {
        seen.add(`${safe}_cidr`);
        const shift = env === 'dev' ? 0 : env === 'staging' ? 1 : 2;
        const cidr = String(res.config.cidr_block).replace(/^(\d+\.)(\d+)(\..*)$/, (_, a, b, c) => `${a}${Number(b) + shift}${c}`);
        lines.push(`${safe}_cidr = "${cidr}"`);
      }
    }
  } else if (provider === 'azure') {
    lines.push(`environment           = "${env}"`);
    lines.push(`subscription_id       = "YOUR_SUBSCRIPTION_ID"`);
    lines.push(`location              = "East US"`);
    lines.push(`project_name          = "my-project-${env}"`);
    lines.push(`vm_size               = "${env === 'prod' ? 'Standard_D4s_v3' : env === 'staging' ? 'Standard_B2s' : 'Standard_B1s'}"`);
    lines.push(`node_count            = ${tier.minCount}`);
    lines.push(`deletion_protection   = ${tier.deletionProtection}`);
    lines.push(`high_availability     = ${tier.highAvailability}`);
    lines.push(`log_retention_days    = ${tier.logRetentionDays}`);
    lines.push(`backup_retention_days = ${tier.backupRetentionDays}`);
    lines.push(`admin_password        = "CHANGE_ME_${env.toUpperCase()}"`);
  } else if (provider === 'gcp') {
    lines.push(`environment           = "${env}"`);
    lines.push(`project_id            = "YOUR_PROJECT_ID_${env.toUpperCase()}"`);
    lines.push(`region                = "us-central1"`);
    lines.push(`project_name          = "my-project-${env}"`);
    lines.push(`machine_type          = "${env === 'prod' ? 'e2-standard-4' : env === 'staging' ? 'e2-small' : 'e2-micro'}"`);
    lines.push(`min_count             = ${tier.minCount}`);
    lines.push(`max_count             = ${tier.maxCount}`);
    lines.push(`deletion_protection   = ${tier.deletionProtection}`);
    lines.push(`high_availability     = ${tier.highAvailability}`);
    lines.push(`log_retention_days    = ${tier.logRetentionDays}`);
    lines.push(`backup_retention_days = ${tier.backupRetentionDays}`);
  }

  return lines.join('\n') + '\n';
}

// ── README ───────────────────────────────────────────────────────────────────

function detectedReadme(resources: DetectedResource[], provider: string): string {
  const providerName = provider === 'aws' ? 'AWS' : provider === 'azure' ? 'Azure' : provider === 'gcp' ? 'GCP' : provider.toUpperCase();

  const resourceList = resources
    .map(r => `- **${r.terraformType}** — \`${r.label}\``)
    .join('\n');

  return `# Terraform Infrastructure — ${providerName}

> Generated by [Terraform Visual Builder](https://github.com/your-repo) — Diagram Scan

## Architecture Overview

This Terraform project was generated from an uploaded architecture diagram and
provisions the following resources in **us-east-1**:

${resourceList || '- No resources detected'}

## Project Structure

\`\`\`
.
├── main.tf               # Resource definitions (shared across all envs)
├── providers.tf          # Provider + backend configuration
├── variables.tf          # Variable declarations (set via tfvars)
├── outputs.tf            # Output values
├── README.md             # This file
└── envs/
    ├── dev.tfvars        # Development environment values
    ├── staging.tfvars    # Staging environment values
    └── prod.tfvars       # Production environment values
\`\`\`

## Quick Start

\`\`\`bash
# 1. Initialise
terraform init

# 2. Plan for a specific environment
terraform plan -var-file="envs/dev.tfvars"
terraform plan -var-file="envs/staging.tfvars"
terraform plan -var-file="envs/prod.tfvars"

# 3. Apply
terraform apply -var-file="envs/dev.tfvars"

# 4. Destroy
terraform destroy -var-file="envs/dev.tfvars"
\`\`\`

## Environment Differences

| Variable              | dev          | staging      | prod              |
|-----------------------|--------------|--------------|-------------------|
| instance_type / size  | small        | medium       | large             |
| min_count             | 1            | 1            | 2                 |
| max_count             | 2            | 4            | 10                |
| deletion_protection   | false        | false        | true              |
| high_availability     | false        | false        | true              |
| log_retention_days    | 7            | 14           | 90                |
| backup_retention_days | 1            | 7            | 30                |

## Security Notes

- ⚠️  Never commit \`envs/prod.tfvars\` with real credentials — use a secrets manager.
- ⚠️  Sensitive variables (passwords) are marked \`sensitive = true\`.
- ✅  All resources are tagged with \`Environment\` and \`Project\`.
- ✅  Remote state backend config is included (commented out) in \`providers.tf\`.
`;
}

// ── Main builder ─────────────────────────────────────────────────────────────

/**
 * Strip the terraform{} and provider{} blocks from the single-file output
 * so they don't duplicate what's in providers.tf / variables.tf.
 */
function stripBlocks(tf: string): string {
  const lines = tf.split('\n');
  const result: string[] = [];
  let depth = 0;
  let skipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (depth === 0) {
      if (
        trimmed.startsWith('terraform {') ||
        trimmed.startsWith('provider "') ||
        trimmed.startsWith('variable "')
      ) {
        skipping = true;
      }
    }

    if (skipping) {
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth === 0) {
        skipping = false;
        if (i + 1 < lines.length && lines[i + 1].trim() === '') i++;
      }
      continue;
    }

    result.push(line);
  }

  while (result.length > 0 && result[0].trim() === '') result.shift();
  return result.join('\n');
}

/**
 * Build a complete environment-based Terraform project from detected resources.
 * Returns an object keyed by filename (including nested paths like envs/dev.tfvars).
 */
export function buildEnvProjectFromScan(
  resources: DetectedResource[],
  provider: 'aws' | 'azure' | 'gcp' | 'unknown',
  region: string,
): DetectedResourceProject {
  // Generate the single-file terraform, then strip the top-level blocks
  const fullTf = generateTerraformFromDetected(resources, provider, region);
  const cleanMain = stripBlocks(fullTf);

  const projectProvider = provider === 'unknown' ? 'aws' : provider;

  return {
    'main.tf':              cleanMain || '# No resources\n',
    'providers.tf':         detectedProvidersTf(projectProvider, region),
    'variables.tf':         detectedVariablesTf(resources, projectProvider),
    'outputs.tf':           detectedOutputsTf(resources),
    'envs/dev.tfvars':      detectedTfvars('dev',     resources, projectProvider),
    'envs/staging.tfvars':  detectedTfvars('staging', resources, projectProvider),
    'envs/prod.tfvars':     detectedTfvars('prod',    resources, projectProvider),
    'README.md':            detectedReadme(resources, projectProvider),
  };
}

/**
 * Download the env-based project as a ZIP file.
 */
export async function downloadScanProjectAsZip(
  project: DetectedResourceProject,
  projectName = 'terraform-diagram-scan',
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const folder = zip.folder(projectName)!;

  for (const [filename, content] of Object.entries(project)) {
    folder.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
