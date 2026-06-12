import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';

type Cfg = Record<string, string | number | boolean>;
function str(k: string, c: Cfg, fb = '') { const v = c[k]; return v !== undefined && v !== '' ? String(v) : fb; }
function n(v: unknown, fb = 0) { return Number(v ?? fb); }
function b(v: unknown, fb = false) { return v !== undefined ? Boolean(v) : fb; }
function tags(cfg: Cfg) {
  if (!cfg.tags_name) return '';
  return `  tags = {\n    Name = "${cfg.tags_name}"\n  }\n`;
}

export function generateAzureTerraform(nodes: Node<ResourceNodeData>[], _region: string, _profile: string): string {
  if (nodes.length === 0) return '# Drag Azure resources onto the canvas to generate Terraform code\n';

  const sections: string[] = [];

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
  subscription_id = var.subscription_id
}

variable "subscription_id" {
  description = "Azure Subscription ID"
  type        = string
  default     = "YOUR_SUBSCRIPTION_ID"
}`);

  // Collect unique resource groups
  const rgs = new Set<string>();
  nodes.forEach(n => { const rg = str('resource_group_name', n.data.config); if (rg) rgs.add(rg); });
  rgs.forEach(rg => {
    sections.push(`resource "azurerm_resource_group" "${rg.replace(/-/g,'_')}" {
  name     = "${rg}"
  location = "East US"
}`);
  });

  for (const node of nodes) {
    const { resourceName, config: c } = node.data;
    const name = (resourceName || 'main').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const label = node.data.definition.label;
    let block = '';

    if (label === 'Virtual Machine') {
      block = `resource "azurerm_linux_virtual_machine" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  size                = "${str('size', c, 'Standard_B2s')}"
  admin_username      = "${str('admin_username', c, 'azureuser')}"
  admin_password      = "${str('admin_password', c, 'P@ssw0rd123!')}"
  disable_password_authentication = false

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "${str('os_disk_type', c, 'Premium_LRS')}"
    disk_size_gb         = ${n(c.os_disk_size_gb, 30)}
  }

  source_image_reference {
    publisher = "${str('image_publisher', c, 'Canonical')}"
    offer     = "${str('image_offer', c, 'UbuntuServer')}"
    sku       = "${str('image_sku', c, '18.04-LTS')}"
    version   = "latest"
  }

  network_interface_ids = []
${tags(c)}}`;
    } else if (label === 'AKS Cluster') {
      block = `resource "azurerm_kubernetes_cluster" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  dns_prefix          = "${str('dns_prefix', c, name)}"
  kubernetes_version  = "${str('kubernetes_version', c, '1.29')}"

  default_node_pool {
    name       = "default"
    node_count = ${n(c.node_count, 3)}
    vm_size    = "${str('node_vm_size', c, 'Standard_D2s_v3')}"
    os_disk_size_gb = ${n(c.os_disk_size_gb, 50)}
  }

  identity {
    type = "SystemAssigned"
  }
${tags(c)}}`;
    } else if (label === 'Storage Account') {
      block = `resource "azurerm_storage_account" "${name}" {
  name                     = "${str('name', c, name)}"
  resource_group_name      = "${str('resource_group_name', c, 'my-rg')}"
  location                 = "${str('location', c, 'East US')}"
  account_tier             = "${str('account_tier', c, 'Standard')}"
  account_replication_type = "${str('account_replication_type', c, 'LRS')}"
  account_kind             = "${str('account_kind', c, 'StorageV2')}"
  enable_https_traffic_only = ${b(c.enable_https_traffic_only, true)}
  min_tls_version          = "${str('min_tls_version', c, 'TLS1_2')}"
${tags(c)}}`;
    } else if (label === 'Virtual Network') {
      block = `resource "azurerm_virtual_network" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  address_space       = ["${str('address_space', c, '10.0.0.0/16')}"]
${tags(c)}}`;
    } else if (label === 'Subnet') {
      block = `resource "azurerm_subnet" "${name}" {
  name                 = "${str('name', c, name)}"
  resource_group_name  = "${str('resource_group_name', c, 'my-rg')}"
  virtual_network_name = "${str('virtual_network_name', c, 'my-vnet')}"
  address_prefixes     = ["${str('address_prefixes', c, '10.0.1.0/24')}"]
}`;
    } else if (label === 'Network Security Group') {
      block = `resource "azurerm_network_security_group" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"

  security_rule {
    name                       = "${str('rule_name', c, 'allow-http')}"
    priority                   = ${n(c.rule_priority, 100)}
    direction                  = "${str('rule_direction', c, 'Inbound')}"
    access                     = "${str('rule_access', c, 'Allow')}"
    protocol                   = "${str('rule_protocol', c, 'Tcp')}"
    source_port_range          = "${str('rule_source_port', c, '*')}"
    destination_port_range     = "${str('rule_dest_port', c, '80')}"
    source_address_prefix      = "${str('rule_source_address', c, '*')}"
    destination_address_prefix = "${str('rule_dest_address', c, '*')}"
  }
${tags(c)}}`;
    } else if (label === 'Load Balancer') {
      block = `resource "azurerm_lb" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  sku                 = "${str('sku', c, 'Standard')}"

  frontend_ip_configuration {
    name                 = "${str('frontend_ip_name', c, 'frontend-ip')}"
    public_ip_address_id = azurerm_public_ip.${name}_pip.id
  }
${tags(c)}}

resource "azurerm_public_ip" "${name}_pip" {
  name                = "${str('name', c, name)}-pip"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  allocation_method   = "${str('allocation_method', c, 'Static')}"
  sku                 = "${str('sku', c, 'Standard')}"
}`;
    } else if (label === 'Azure SQL Database') {
      block = `resource "azurerm_mssql_server" "${name}_server" {
  name                         = "${str('server_name', c, name + '-server')}"
  resource_group_name          = "${str('resource_group_name', c, 'my-rg')}"
  location                     = "${str('location', c, 'East US')}"
  version                      = "12.0"
  administrator_login          = "${str('administrator_login', c, 'sqladmin')}"
  administrator_login_password = "${str('administrator_login_password', c, 'P@ssw0rd123!')}"
${tags(c)}}

resource "azurerm_mssql_database" "${name}" {
  name         = "${str('name', c, name)}"
  server_id    = azurerm_mssql_server.${name}_server.id
  sku_name     = "${str('sku_name', c, 'S1')}"
  max_size_gb  = ${n(c.max_size_gb, 32)}
  collation    = "${str('collation', c, 'SQL_Latin1_General_CP1_CI_AS')}"
${tags(c)}}`;
    } else if (label === 'Cosmos DB') {
      block = `resource "azurerm_cosmosdb_account" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  offer_type          = "${str('offer_type', c, 'Standard')}"
  kind                = "${str('kind', c, 'GlobalDocumentDB')}"

  consistency_policy {
    consistency_level = "${str('consistency_level', c, 'Session')}"
  }

  geo_location {
    location          = "${str('geo_location', c, 'East US')}"
    failover_priority = ${n(c.failover_priority, 0)}
  }
${tags(c)}}`;
    } else if (label === 'Azure Function') {
      block = `resource "azurerm_linux_function_app" "${name}" {
  name                       = "${str('name', c, name)}"
  resource_group_name        = "${str('resource_group_name', c, 'my-rg')}"
  location                   = "${str('location', c, 'East US')}"
  storage_account_name       = "${str('storage_account_name', c, 'REPLACE_WITH_STORAGE')}"
  storage_account_access_key = "REPLACE_WITH_ACCESS_KEY"
  service_plan_id            = "REPLACE_WITH_SERVICE_PLAN_ID"

  site_config {
    application_stack {
      ${str('runtime', c, 'node') === 'node' ? `node_version = "${str('runtime_version', c, '18')}"` : `${str('runtime', c, 'node')}_version = "${str('runtime_version', c, '1')}"`}
    }
  }
${tags(c)}}`;
    } else if (label === 'Key Vault') {
      block = `resource "azurerm_key_vault" "${name}" {
  name                        = "${str('name', c, name)}"
  resource_group_name         = "${str('resource_group_name', c, 'my-rg')}"
  location                    = "${str('location', c, 'East US')}"
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "${str('sku_name', c, 'standard')}"
  soft_delete_retention_days  = ${n(c.soft_delete_retention_days, 90)}
  purge_protection_enabled    = ${b(c.purge_protection_enabled, true)}
${tags(c)}}

data "azurerm_client_config" "current" {}`;
    } else if (label === 'Container Registry') {
      block = `resource "azurerm_container_registry" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  sku                 = "${str('sku', c, 'Standard')}"
  admin_enabled       = ${b(c.admin_enabled, false)}
${tags(c)}}`;
    } else if (label === 'Log Analytics Workspace') {
      block = `resource "azurerm_log_analytics_workspace" "${name}" {
  name                = "${str('name', c, name)}"
  resource_group_name = "${str('resource_group_name', c, 'my-rg')}"
  location            = "${str('location', c, 'East US')}"
  sku                 = "${str('sku', c, 'PerGB2018')}"
  retention_in_days   = ${n(c.retention_in_days, 30)}
${tags(c)}}`;
    }

    if (block) sections.push(block);
  }

  return sections.join('\n\n') + '\n';
}
