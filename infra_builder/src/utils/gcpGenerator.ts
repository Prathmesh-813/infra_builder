import { Node } from 'reactflow';
import { ResourceNodeData } from '../types/resources';

type Cfg = Record<string, string | number | boolean>;
function str(k: string, c: Cfg, fb = '') { const v = c[k]; return v !== undefined && v !== '' ? String(v) : fb; }
function n(v: unknown, fb = 0) { return Number(v ?? fb); }
function b(v: unknown, fb = false) { return v !== undefined ? Boolean(v) : fb; }

export function generateGCPTerraform(nodes: Node<ResourceNodeData>[], region: string, _profile: string): string {
  if (nodes.length === 0) return '# Drag GCP resources onto the canvas to generate Terraform code\n';

  const sections: string[] = [];

  sections.push(`terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = "${region}"
}

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "YOUR_PROJECT_ID"
}`);

  for (const node of nodes) {
    const { resourceName, config: c } = node.data;
    const name = (resourceName || 'main').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    const label = node.data.definition.label;
    let block = '';

    if (label === 'Compute Engine VM') {
      block = `resource "google_compute_instance" "${name}" {
  name         = "${str('name', c, name)}"
  project      = "${str('project', c, 'my-project')}"
  zone         = "${str('zone', c, 'us-central1-a')}"
  machine_type = "${str('machine_type', c, 'e2-medium')}"

  boot_disk {
    initialize_params {
      image = "${str('image', c, 'debian-cloud/debian-11')}"
      size  = ${n(c.disk_size_gb, 50)}
      type  = "${str('disk_type', c, 'pd-balanced')}"
    }
  }

  network_interface {
    network    = "${str('network', c, 'default')}"
    subnetwork = "${str('subnetwork', c, '')}"
    access_config {}
  }

  labels = {
    name = "${str('tags_name', c, name)}"
  }
}`;
    } else if (label === 'GKE Cluster') {
      block = `resource "google_container_cluster" "${name}" {
  name     = "${str('name', c, name)}"
  project  = "${str('project', c, 'my-project')}"
  location = "${str('location', c, 'us-central1')}"
  network  = "${str('network', c, 'default')}"
  subnetwork = "${str('subnetwork', c, 'default')}"

  remove_default_node_pool = true
  initial_node_count       = 1

  min_master_version = "${str('min_master_version', c, 'latest')}"
}

resource "google_container_node_pool" "${name}_nodes" {
  name       = "${name}-node-pool"
  project    = "${str('project', c, 'my-project')}"
  location   = "${str('location', c, 'us-central1')}"
  cluster    = google_container_cluster.${name}.name
  node_count = ${n(c.node_count, 3)}

  node_config {
    machine_type = "${str('machine_type', c, 'e2-medium')}"
    disk_size_gb = ${n(c.disk_size_gb, 100)}
    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }
}`;
    } else if (label === 'Cloud Run Service') {
      block = `resource "google_cloud_run_v2_service" "${name}" {
  name     = "${str('name', c, name)}"
  project  = "${str('project', c, 'my-project')}"
  location = "${str('location', c, 'us-central1')}"

  template {
    containers {
      image = "${str('image', c, 'gcr.io/my-project/my-image:latest')}"
      ports { container_port = ${n(c.container_port, 8080)} }
      resources {
        limits = {
          cpu    = "${str('cpu', c, '1')}"
          memory = "${str('memory', c, '512Mi')}"
        }
      }
    }
    scaling {
      min_instance_count = ${n(c.min_instances, 0)}
      max_instance_count = ${n(c.max_instances, 10)}
    }
  }
}

${b(c.allow_unauthenticated, false) ? `resource "google_cloud_run_v2_service_iam_member" "${name}_public" {
  project  = "${str('project', c, 'my-project')}"
  location = "${str('location', c, 'us-central1')}"
  name     = google_cloud_run_v2_service.${name}.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}` : '# Set allow_unauthenticated = true to make this service public'}`;
    } else if (label === 'Cloud Storage Bucket') {
      block = `resource "google_storage_bucket" "${name}" {
  name          = "${str('name', c, name)}"
  project       = "${str('project', c, 'my-project')}"
  location      = "${str('location', c, 'US')}"
  storage_class = "${str('storage_class', c, 'STANDARD')}"
  force_destroy = ${b(c.force_destroy, false)}

  uniform_bucket_level_access = ${b(c.uniform_bucket_level_access, true)}

  ${b(c.versioning_enabled, false) ? 'versioning { enabled = true }' : '# versioning { enabled = true }'}

  labels = {
    name = "${str('tags_name', c, name)}"
  }
}`;
    } else if (label === 'VPC Network') {
      block = `resource "google_compute_network" "${name}" {
  name                    = "${str('name', c, name)}"
  project                 = "${str('project', c, 'my-project')}"
  auto_create_subnetworks = ${b(c.auto_create_subnetworks, false)}
  routing_mode            = "${str('routing_mode', c, 'REGIONAL')}"
  mtu                     = ${n(c.mtu, 1460)}
}`;
    } else if (label === 'Subnetwork') {
      block = `resource "google_compute_subnetwork" "${name}" {
  name                     = "${str('name', c, name)}"
  project                  = "${str('project', c, 'my-project')}"
  region                   = "${str('region', c, 'us-central1')}"
  network                  = "${str('network', c, 'my-vpc')}"
  ip_cidr_range            = "${str('ip_cidr_range', c, '10.0.1.0/24')}"
  private_ip_google_access = ${b(c.private_ip_google_access, true)}
}`;
    } else if (label === 'Firewall Rule') {
      const ports = str('ports', c, '80, 443').split(',').map(p => p.trim()).filter(Boolean);
      block = `resource "google_compute_firewall" "${name}" {
  name    = "${str('name', c, name)}"
  project = "${str('project', c, 'my-project')}"
  network = "${str('network', c, 'my-vpc')}"
  direction = "${str('direction', c, 'INGRESS')}"
  priority  = ${n(c.priority, 1000)}

  allow {
    protocol = "${str('protocol', c, 'tcp')}"
    ports    = [${ports.map(p => `"${p}"`).join(', ')}]
  }

  source_ranges = ["${str('source_ranges', c, '0.0.0.0/0')}"]
  ${str('target_tags', c) ? `target_tags   = ["${str('target_tags', c)}"]` : ''}
}`;
    } else if (label === 'Cloud Load Balancing') {
      block = `resource "google_compute_forwarding_rule" "${name}" {
  name                  = "${str('name', c, name)}"
  project               = "${str('project', c, 'my-project')}"
  load_balancing_scheme = "${str('scheme', c, 'EXTERNAL')}"
  port_range            = "${str('port_range', c, '80')}"
  ip_protocol           = "${str('protocol', c, 'TCP')}"
  target                = google_compute_target_pool.${name}_pool.id
}

resource "google_compute_target_pool" "${name}_pool" {
  name    = "${name}-pool"
  project = "${str('project', c, 'my-project')}"
}`;
    } else if (label === 'Cloud SQL') {
      block = `resource "google_sql_database_instance" "${name}" {
  name             = "${str('name', c, name)}"
  project          = "${str('project', c, 'my-project')}"
  region           = "${str('region', c, 'us-central1')}"
  database_version = "${str('database_version', c, 'MYSQL_8_0')}"
  deletion_protection = ${b(c.deletion_protection, false)}

  settings {
    tier              = "${str('tier', c, 'db-f1-micro')}"
    availability_type = "${str('availability_type', c, 'ZONAL')}"
    disk_size         = ${n(c.disk_size, 20)}
    disk_type         = "${str('disk_type', c, 'PD_SSD')}"

    backup_configuration {
      enabled = ${b(c.backup_enabled, true)}
    }
  }
}`;
    } else if (label === 'Firestore') {
      block = `resource "google_firestore_database" "${name}" {
  project     = "${str('project', c, 'my-project')}"
  name        = "(default)"
  location_id = "${str('location_id', c, 'us-central')}"
  type        = "${str('type', c, 'FIRESTORE_NATIVE')}"
  concurrency_mode = "${str('concurrency_mode', c, 'OPTIMISTIC')}"
}`;
    } else if (label === 'Cloud Function') {
      block = `resource "google_cloudfunctions2_function" "${name}" {
  name     = "${str('name', c, name)}"
  project  = "${str('project', c, 'my-project')}"
  location = "${str('location', c, 'us-central1')}"

  build_config {
    runtime     = "${str('runtime', c, 'nodejs18')}"
    entry_point = "${str('entry_point', c, 'helloWorld')}"
    source {
      storage_source {
        bucket = "REPLACE_WITH_SOURCE_BUCKET"
        object = "function-source.zip"
      }
    }
  }

  service_config {
    available_memory      = "${str('available_memory', c, '256M')}"
    timeout_seconds       = ${n(c.timeout_seconds, 60)}
    max_instance_count    = ${n(c.max_instance_count, 10)}
    min_instance_count    = ${n(c.min_instance_count, 0)}
    ingress_settings      = "${str('ingress_settings', c, 'ALLOW_ALL')}"
  }

  labels = {
    name = "${str('tags_name', c, name)}"
  }
}`;
    } else if (label === 'IAM Service Account') {
      block = `resource "google_service_account" "${name}" {
  account_id   = "${str('account_id', c, name)}"
  project      = "${str('project', c, 'my-project')}"
  display_name = "${str('display_name', c, name)}"
  description  = "${str('description', c, '')}"
}

resource "google_project_iam_member" "${name}_binding" {
  project = "${str('project', c, 'my-project')}"
  role    = "${str('role', c, 'roles/viewer')}"
  member  = "serviceAccount:\${google_service_account.${name}.email}"
}`;
    } else if (label === 'Cloud Logging') {
      block = `resource "google_logging_project_sink" "${name}" {
  name        = "${str('name', c, name)}"
  project     = "${str('project', c, 'my-project')}"
  destination = "${str('destination', c, 'storage.googleapis.com/my-bucket')}"
  filter      = "${str('filter', c, '')}"
}`;
    } else if (label === 'Artifact Registry') {
      block = `resource "google_artifact_registry_repository" "${name}" {
  repository_id = "${str('repository_id', c, name)}"
  project       = "${str('project', c, 'my-project')}"
  location      = "${str('location', c, 'us-central1')}"
  format        = "${str('format', c, 'DOCKER')}"
  description   = "${str('description', c, '')}"

  labels = {
    name = "${str('tags_name', c, name)}"
  }
}`;
    }

    if (block) sections.push(block);
  }

  return sections.join('\n\n') + '\n';
}
