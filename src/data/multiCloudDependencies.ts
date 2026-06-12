
// ── Azure Dependencies ────────────────────────────────────────────────────────
export interface MultiCloudDependency {
  resourceType: string;   // the azure/gcp type string
  label: string;
  icon: string;
  reason: string;
  required: boolean;
  sourcePortId: string;
  targetPortId: string;
  portColor: string;
  defaultConfig?: Record<string, string | number | boolean>;
}

export interface MultiCloudResourceDependencies {
  resourceType: string;
  deps: MultiCloudDependency[];
}

export const AZURE_DEPENDENCIES: MultiCloudResourceDependencies[] = [
  {
    resourceType: 'azurerm_linux_virtual_machine',
    deps: [
      { resourceType: 'azurerm_virtual_network', label: 'Virtual Network', icon: '🌐', reason: 'VM must be deployed inside a VNet', required: true, sourcePortId: 'subnet-out', targetPortId: 'vnet-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'main-vnet', resource_group_name: 'my-rg', location: 'East US', address_space: '10.0.0.0/16', tags_name: 'main-vnet' } },
      { resourceType: 'azurerm_subnet', label: 'Subnet', icon: '🔗', reason: 'VM needs a subnet for its network interface', required: true, sourcePortId: 'vm-out', targetPortId: 'vnet-in', portColor: 'bg-teal-400', defaultConfig: { name: 'main-subnet', resource_group_name: 'my-rg', virtual_network_name: 'main-vnet', address_prefixes: '10.0.1.0/24', tags_name: 'main-subnet' } },
      { resourceType: 'azurerm_network_security_group', label: 'Network Security Group', icon: '🛡️', reason: 'Controls inbound/outbound traffic to the VM', required: true, sourcePortId: 'vm-out', targetPortId: 'subnet-in', portColor: 'bg-red-400', defaultConfig: { name: 'vm-nsg', resource_group_name: 'my-rg', location: 'East US', rule_name: 'allow-ssh', rule_priority: 100, rule_direction: 'Inbound', rule_access: 'Allow', rule_protocol: 'Tcp', rule_dest_port: '22', tags_name: 'vm-nsg' } },
      { resourceType: 'azurerm_lb', label: 'Load Balancer', icon: '⚖️', reason: 'Distribute traffic across multiple VMs', required: false, sourcePortId: 'vm-in', targetPortId: 'lb-out', portColor: 'bg-indigo-400', defaultConfig: { name: 'vm-lb', resource_group_name: 'my-rg', location: 'East US', sku: 'Standard', tags_name: 'vm-lb' } },
    ],
  },
  {
    resourceType: 'azurerm_kubernetes_cluster',
    deps: [
      { resourceType: 'azurerm_virtual_network', label: 'Virtual Network', icon: '🌐', reason: 'AKS cluster must be deployed inside a VNet', required: true, sourcePortId: 'subnet-out', targetPortId: 'vnet-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'aks-vnet', resource_group_name: 'my-rg', location: 'East US', address_space: '10.0.0.0/8', tags_name: 'aks-vnet' } },
      { resourceType: 'azurerm_container_registry', label: 'Container Registry', icon: '🐋', reason: 'ACR stores container images for AKS workloads', required: false, sourcePortId: 'aks-out', targetPortId: 'acr-in', portColor: 'bg-blue-400', defaultConfig: { name: 'myacr', resource_group_name: 'my-rg', location: 'East US', sku: 'Standard', tags_name: 'my-acr' } },
    ],
  },
  {
    resourceType: 'azurerm_mssql_database',
    deps: [
      { resourceType: 'azurerm_virtual_network', label: 'Virtual Network', icon: '🌐', reason: 'SQL Database should be in a private VNet', required: false, sourcePortId: 'subnet-out', targetPortId: 'vnet-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'db-vnet', resource_group_name: 'my-rg', location: 'East US', address_space: '10.1.0.0/16', tags_name: 'db-vnet' } },
      { resourceType: 'azurerm_network_security_group', label: 'Network Security Group', icon: '🛡️', reason: 'Restrict access to SQL port 1433', required: true, sourcePortId: 'vm-out', targetPortId: 'subnet-in', portColor: 'bg-red-400', defaultConfig: { name: 'db-nsg', resource_group_name: 'my-rg', location: 'East US', rule_name: 'allow-sql', rule_priority: 100, rule_dest_port: '1433', tags_name: 'db-nsg' } },
    ],
  },
  {
    resourceType: 'azurerm_linux_function_app',
    deps: [
      { resourceType: 'azurerm_storage_account', label: 'Storage Account', icon: '🪣', reason: 'Azure Functions require a storage account for state', required: true, sourcePortId: 'data-out', targetPortId: 'storage-in', portColor: 'bg-green-400', defaultConfig: { name: 'funcstorageacct', resource_group_name: 'my-rg', location: 'East US', account_tier: 'Standard', account_replication_type: 'LRS', tags_name: 'func-storage' } },
      { resourceType: 'azurerm_key_vault', label: 'Key Vault', icon: '🔑', reason: 'Store function secrets and connection strings securely', required: false, sourcePortId: 'app-out', targetPortId: 'storage-in', portColor: 'bg-yellow-400', defaultConfig: { name: 'func-keyvault', resource_group_name: 'my-rg', location: 'East US', sku_name: 'standard', tags_name: 'func-kv' } },
    ],
  },
  {
    resourceType: 'azurerm_lb',
    deps: [
      { resourceType: 'azurerm_virtual_network', label: 'Virtual Network', icon: '🌐', reason: 'Load Balancer needs a VNet for backend pool', required: true, sourcePortId: 'subnet-out', targetPortId: 'vnet-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'lb-vnet', resource_group_name: 'my-rg', location: 'East US', address_space: '10.0.0.0/16', tags_name: 'lb-vnet' } },
      { resourceType: 'azurerm_network_security_group', label: 'Network Security Group', icon: '🛡️', reason: 'Control traffic allowed into the load balancer', required: true, sourcePortId: 'vm-out', targetPortId: 'subnet-in', portColor: 'bg-red-400', defaultConfig: { name: 'lb-nsg', resource_group_name: 'my-rg', location: 'East US', rule_name: 'allow-http', rule_priority: 100, rule_dest_port: '80', tags_name: 'lb-nsg' } },
    ],
  },
  {
    resourceType: 'azurerm_cosmosdb_account',
    deps: [
      { resourceType: 'azurerm_key_vault', label: 'Key Vault', icon: '🔑', reason: 'Store Cosmos DB connection strings securely', required: false, sourcePortId: 'app-out', targetPortId: 'data-out', portColor: 'bg-yellow-400', defaultConfig: { name: 'cosmos-kv', resource_group_name: 'my-rg', location: 'East US', sku_name: 'standard', tags_name: 'cosmos-kv' } },
    ],
  },
  {
    resourceType: 'azurerm_virtual_network',
    deps: [
      { resourceType: 'azurerm_subnet', label: 'Subnet', icon: '🔗', reason: 'VNets need subnets to place resources in', required: true, sourcePortId: 'vm-out', targetPortId: 'vnet-in', portColor: 'bg-teal-400', defaultConfig: { name: 'main-subnet', resource_group_name: 'my-rg', virtual_network_name: 'main-vnet', address_prefixes: '10.0.1.0/24', tags_name: 'main-subnet' } },
      { resourceType: 'azurerm_network_security_group', label: 'Network Security Group', icon: '🛡️', reason: 'Attach an NSG to control traffic in the VNet', required: false, sourcePortId: 'vm-out', targetPortId: 'subnet-in', portColor: 'bg-red-400', defaultConfig: { name: 'main-nsg', resource_group_name: 'my-rg', location: 'East US', rule_name: 'allow-http', rule_priority: 100, rule_dest_port: '80', tags_name: 'main-nsg' } },
    ],
  },
];

export const GCP_DEPENDENCIES: MultiCloudResourceDependencies[] = [
  {
    resourceType: 'google_compute_instance',
    deps: [
      { resourceType: 'google_compute_network', label: 'VPC Network', icon: '🌐', reason: 'VM must be deployed inside a VPC network', required: true, sourcePortId: 'subnet-out', targetPortId: 'vpc-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'main-vpc', project: 'my-gcp-project', auto_create_subnetworks: false, routing_mode: 'REGIONAL', tags_name: 'main-vpc' } },
      { resourceType: 'google_compute_subnetwork', label: 'Subnetwork', icon: '🔗', reason: 'VM needs a subnetwork for its network interface', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-teal-400', defaultConfig: { name: 'main-subnet', project: 'my-gcp-project', region: 'us-central1', network: 'main-vpc', ip_cidr_range: '10.0.1.0/24', tags_name: 'main-subnet' } },
      { resourceType: 'google_compute_firewall', label: 'Firewall Rule', icon: '🛡️', reason: 'Controls inbound/outbound traffic to the VM', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-red-400', defaultConfig: { name: 'allow-ssh', project: 'my-gcp-project', network: 'main-vpc', direction: 'INGRESS', protocol: 'tcp', ports: '22', source_ranges: '0.0.0.0/0', tags_name: 'allow-ssh' } },
      { resourceType: 'google_service_account', label: 'IAM Service Account', icon: '👤', reason: 'Grants the VM permissions to call GCP APIs', required: false, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-pink-400', defaultConfig: { account_id: 'vm-service-account', project: 'my-gcp-project', display_name: 'VM Service Account', role: 'roles/viewer', tags_name: 'vm-sa' } },
      { resourceType: 'google_compute_forwarding_rule', label: 'Load Balancer', icon: '⚖️', reason: 'Distribute traffic across multiple VMs', required: false, sourcePortId: 'vm-in', targetPortId: 'lb-out', portColor: 'bg-indigo-400', defaultConfig: { name: 'vm-lb', project: 'my-gcp-project', scheme: 'EXTERNAL', protocol: 'TCP', port_range: '80', tags_name: 'vm-lb' } },
    ],
  },
  {
    resourceType: 'google_container_cluster',
    deps: [
      { resourceType: 'google_compute_network', label: 'VPC Network', icon: '🌐', reason: 'GKE cluster must be deployed inside a VPC', required: true, sourcePortId: 'subnet-out', targetPortId: 'vpc-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'gke-vpc', project: 'my-gcp-project', auto_create_subnetworks: false, tags_name: 'gke-vpc' } },
      { resourceType: 'google_compute_subnetwork', label: 'Subnetwork', icon: '🔗', reason: 'GKE nodes need a subnetwork', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-teal-400', defaultConfig: { name: 'gke-subnet', project: 'my-gcp-project', region: 'us-central1', network: 'gke-vpc', ip_cidr_range: '10.0.1.0/24', tags_name: 'gke-subnet' } },
      { resourceType: 'google_service_account', label: 'IAM Service Account', icon: '👤', reason: 'GKE nodes need a service account for GCP API access', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-pink-400', defaultConfig: { account_id: 'gke-node-sa', project: 'my-gcp-project', display_name: 'GKE Node Service Account', role: 'roles/container.nodeServiceAccount', tags_name: 'gke-sa' } },
      { resourceType: 'google_artifact_registry_repository', label: 'Artifact Registry', icon: '🐋', reason: 'Store container images for GKE workloads', required: false, sourcePortId: 'gke-out', targetPortId: 'gcr-in', portColor: 'bg-blue-400', defaultConfig: { repository_id: 'my-repo', project: 'my-gcp-project', location: 'us-central1', format: 'DOCKER', tags_name: 'my-repo' } },
    ],
  },
  {
    resourceType: 'google_sql_database_instance',
    deps: [
      { resourceType: 'google_compute_network', label: 'VPC Network', icon: '🌐', reason: 'Cloud SQL should use private IP inside a VPC', required: false, sourcePortId: 'subnet-out', targetPortId: 'vpc-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'db-vpc', project: 'my-gcp-project', auto_create_subnetworks: false, tags_name: 'db-vpc' } },
      { resourceType: 'google_compute_firewall', label: 'Firewall Rule', icon: '🛡️', reason: 'Restrict access to database port', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-red-400', defaultConfig: { name: 'allow-db', project: 'my-gcp-project', network: 'db-vpc', direction: 'INGRESS', protocol: 'tcp', ports: '3306', source_ranges: '10.0.0.0/8', tags_name: 'allow-db' } },
    ],
  },
  {
    resourceType: 'google_cloudfunctions2_function',
    deps: [
      { resourceType: 'google_storage_bucket', label: 'Cloud Storage Bucket', icon: '🪣', reason: 'Store function source code ZIP in GCS', required: true, sourcePortId: 'data-out', targetPortId: 'storage-in', portColor: 'bg-green-400', defaultConfig: { name: 'my-function-source', project: 'my-gcp-project', location: 'US', storage_class: 'STANDARD', tags_name: 'function-source' } },
      { resourceType: 'google_service_account', label: 'IAM Service Account', icon: '👤', reason: 'Cloud Function needs a service account to run as', required: true, sourcePortId: 'fn-out', targetPortId: 'storage-in', portColor: 'bg-pink-400', defaultConfig: { account_id: 'function-sa', project: 'my-gcp-project', display_name: 'Cloud Function SA', role: 'roles/cloudfunctions.invoker', tags_name: 'function-sa' } },
    ],
  },
  {
    resourceType: 'google_cloud_run_v2_service',
    deps: [
      { resourceType: 'google_service_account', label: 'IAM Service Account', icon: '👤', reason: 'Cloud Run service needs a service account identity', required: true, sourcePortId: 'fn-out', targetPortId: 'api-out', portColor: 'bg-pink-400', defaultConfig: { account_id: 'cloudrun-sa', project: 'my-gcp-project', display_name: 'Cloud Run SA', role: 'roles/run.invoker', tags_name: 'cloudrun-sa' } },
      { resourceType: 'google_artifact_registry_repository', label: 'Artifact Registry', icon: '🐋', reason: 'Store the container image for Cloud Run', required: false, sourcePortId: 'gke-out', targetPortId: 'api-out', portColor: 'bg-blue-400', defaultConfig: { repository_id: 'cloudrun-images', project: 'my-gcp-project', location: 'us-central1', format: 'DOCKER', tags_name: 'cloudrun-images' } },
    ],
  },
  {
    resourceType: 'google_compute_network',
    deps: [
      { resourceType: 'google_compute_subnetwork', label: 'Subnetwork', icon: '🔗', reason: 'VPCs need subnets to place resources in', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-teal-400', defaultConfig: { name: 'main-subnet', project: 'my-gcp-project', region: 'us-central1', network: 'main-vpc', ip_cidr_range: '10.0.1.0/24', tags_name: 'main-subnet' } },
      { resourceType: 'google_compute_firewall', label: 'Firewall Rule', icon: '🛡️', reason: 'Add firewall rules to control VPC traffic', required: false, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-red-400', defaultConfig: { name: 'allow-internal', project: 'my-gcp-project', network: 'main-vpc', direction: 'INGRESS', protocol: 'tcp', ports: '80, 443', source_ranges: '10.0.0.0/8', tags_name: 'allow-internal' } },
    ],
  },
  {
    resourceType: 'google_compute_forwarding_rule',
    deps: [
      { resourceType: 'google_compute_network', label: 'VPC Network', icon: '🌐', reason: 'Load Balancer needs a VPC for backend instances', required: true, sourcePortId: 'subnet-out', targetPortId: 'vpc-in', portColor: 'bg-cyan-400', defaultConfig: { name: 'lb-vpc', project: 'my-gcp-project', auto_create_subnetworks: false, tags_name: 'lb-vpc' } },
      { resourceType: 'google_compute_firewall', label: 'Firewall Rule', icon: '🛡️', reason: 'Allow health check traffic to backend instances', required: true, sourcePortId: 'vm-out', targetPortId: 'vpc-in', portColor: 'bg-red-400', defaultConfig: { name: 'allow-health-check', project: 'my-gcp-project', network: 'lb-vpc', direction: 'INGRESS', protocol: 'tcp', ports: '80', source_ranges: '130.211.0.0/22, 35.191.0.0/16', tags_name: 'allow-hc' } },
    ],
  },
];

export const ANSIBLE_DEPENDENCIES: MultiCloudResourceDependencies[] = [
  {
    resourceType: 'ansible_package',
    deps: [
      { resourceType: 'ansible_host_group', label: 'Host Group', icon: '🖥️', reason: 'Package installation needs a target host group', required: true, sourcePortId: 'task-out', targetPortId: 'host-in', portColor: 'bg-orange-400', defaultConfig: { group_name: 'servers', hosts: '192.168.1.10', ansible_user: 'ubuntu', become: true } },
    ],
  },
  {
    resourceType: 'ansible_service',
    deps: [
      { resourceType: 'ansible_host_group', label: 'Host Group', icon: '🖥️', reason: 'Service management needs a target host group', required: true, sourcePortId: 'task-out', targetPortId: 'host-in', portColor: 'bg-orange-400', defaultConfig: { group_name: 'servers', hosts: '192.168.1.10', ansible_user: 'ubuntu', become: true } },
      { resourceType: 'ansible_package', label: 'Install Package', icon: '📦', reason: 'Install the package before managing its service', required: false, sourcePortId: 'next-out', targetPortId: 'host-in', portColor: 'bg-green-400', defaultConfig: { task_name: 'Install service package', package_name: 'nginx', state: 'present', become: true } },
    ],
  },
  {
    resourceType: 'ansible_copy',
    deps: [
      { resourceType: 'ansible_host_group', label: 'Host Group', icon: '🖥️', reason: 'File copy needs a target host group', required: true, sourcePortId: 'task-out', targetPortId: 'host-in', portColor: 'bg-orange-400', defaultConfig: { group_name: 'servers', hosts: '192.168.1.10', ansible_user: 'ubuntu', become: true } },
    ],
  },
  {
    resourceType: 'ansible_shell',
    deps: [
      { resourceType: 'ansible_host_group', label: 'Host Group', icon: '🖥️', reason: 'Shell commands need a target host group', required: true, sourcePortId: 'task-out', targetPortId: 'host-in', portColor: 'bg-orange-400', defaultConfig: { group_name: 'servers', hosts: '192.168.1.10', ansible_user: 'ubuntu', become: false } },
    ],
  },
  {
    resourceType: 'ansible_docker_container',
    deps: [
      { resourceType: 'ansible_host_group', label: 'Host Group', icon: '🖥️', reason: 'Docker tasks need a target host group', required: true, sourcePortId: 'task-out', targetPortId: 'host-in', portColor: 'bg-orange-400', defaultConfig: { group_name: 'docker-hosts', hosts: '192.168.1.10', ansible_user: 'ubuntu', become: true } },
      { resourceType: 'ansible_package', label: 'Install Docker', icon: '📦', reason: 'Docker must be installed before running containers', required: true, sourcePortId: 'next-out', targetPortId: 'host-in', portColor: 'bg-green-400', defaultConfig: { task_name: 'Install Docker', package_name: 'docker.io', state: 'present', become: true } },
    ],
  },
  {
    resourceType: 'ansible_git',
    deps: [
      { resourceType: 'ansible_host_group', label: 'Host Group', icon: '🖥️', reason: 'Git operations need a target host group', required: true, sourcePortId: 'task-out', targetPortId: 'host-in', portColor: 'bg-orange-400', defaultConfig: { group_name: 'app-servers', hosts: '192.168.1.10', ansible_user: 'ubuntu', become: false } },
      { resourceType: 'ansible_package', label: 'Install Git', icon: '📦', reason: 'Git must be installed on the target host', required: true, sourcePortId: 'next-out', targetPortId: 'host-in', portColor: 'bg-green-400', defaultConfig: { task_name: 'Install git', package_name: 'git', state: 'present', become: true } },
    ],
  },
];
