"""
AI-powered infrastructure generation endpoint.

POST /api/ai/generate-infra
  Accepts natural language description -> returns structured nodes + edges
  Supports providers: aws, azure, gcp, ansible, crossplane
"""
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["ai"])


# ── Request / Response models ──────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    provider: str = "aws"  # aws, azure, gcp, ansible, crossplane
    use_llm: bool = False


class NodeData(BaseModel):
    id: str
    type: str = "resourceNode"
    position: Dict[str, float]
    data: Dict[str, Any]


class EdgeData(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: str
    targetHandle: str
    type: str = "smoothstep"
    animated: bool = True
    style: Optional[Dict[str, Any]] = None
    markerEnd: Optional[Dict[str, Any]] = None
    label: Optional[str] = None


class GenerateResponse(BaseModel):
    nodes: List[NodeData]
    edges: List[EdgeData]
    explanation: str
    warning: str = ""


# ── Resource definitions ───────────────────────────────────────────────────────

PORT_COLORS = {
    "bg-cyan-400": "#22d3ee", "bg-red-400": "#f87171", "bg-pink-400": "#f472b6",
    "bg-blue-400": "#60a5fa", "bg-orange-400": "#fb923c", "bg-purple-400": "#c084fc",
    "bg-yellow-400": "#facc15", "bg-green-400": "#4ade80", "bg-teal-400": "#2dd4bf",
    "bg-indigo-400": "#818cf8",
}

# ── AWS / Cloud Resources ──────────────────────────────────────────────────────

AWS_RESOURCES = {
    "vpc": {
        "type": "aws_vpc",
        "label": "VPC",
        "icon": "🌐",
        "color": "text-green-400",
        "bgColor": "bg-green-950",
        "borderColor": "border-green-500",
        "category": "Network",
        "description": "Virtual Private Cloud",
        "defaultConfig": {"cidr_block": "10.0.0.0/16", "enable_dns_support": True, "enable_dns_hostnames": True, "tags_name": "main-vpc"},
        "fields": [],
        "ports": [
            {"id": "subnet-out", "label": "Subnet", "side": "right", "type": "source", "color": "bg-cyan-400", "accepts": ["aws_subnet"]},
            {"id": "sg-out", "label": "Security Group", "side": "right", "type": "source", "color": "bg-red-400", "accepts": ["aws_security_group"]},
            {"id": "igw-out", "label": "Internet Gateway", "side": "right", "type": "source", "color": "bg-teal-400", "accepts": ["aws_internet_gateway"]},
        ],
    },
    "subnet": {
        "type": "aws_subnet",
        "label": "Subnet",
        "icon": "🔀",
        "color": "text-cyan-400",
        "bgColor": "bg-cyan-950",
        "borderColor": "border-cyan-500",
        "category": "Network",
        "description": "Subnet within a VPC",
        "defaultConfig": {"cidr_block": "10.0.1.0/24", "map_public_ip_on_launch": True, "tags_name": "main-subnet"},
        "fields": [],
        "ports": [
            {"id": "vpc-in", "label": "VPC", "side": "left", "type": "target", "color": "bg-cyan-400", "accepts": ["aws_vpc"]},
            {"id": "ec2-out", "label": "EC2", "side": "right", "type": "source", "color": "bg-orange-400", "accepts": ["aws_instance"]},
            {"id": "lb-out", "label": "LB", "side": "right", "type": "source", "color": "bg-indigo-400", "accepts": ["aws_lb"]},
            {"id": "rds-out", "label": "RDS", "side": "right", "type": "source", "color": "bg-purple-400", "accepts": ["aws_rds_instance"]},
        ],
    },
    "ec2": {
        "type": "aws_instance",
        "label": "EC2 Instance",
        "icon": "🖥️",
        "color": "text-orange-400",
        "bgColor": "bg-orange-950",
        "borderColor": "border-orange-500",
        "category": "Compute",
        "description": "Virtual server in the AWS cloud",
        "defaultConfig": {"ami": "ami-0c55b159cbfafe1f0", "instance_type": "t3.micro", "associate_public_ip_address": True, "root_volume_size": 20, "tags_name": "web-server"},
        "fields": [],
        "ports": [
            {"id": "subnet-in", "label": "Subnet", "side": "left", "type": "target", "color": "bg-cyan-400", "accepts": ["aws_subnet"]},
            {"id": "sg-in", "label": "Security Group", "side": "left", "type": "target", "color": "bg-red-400", "accepts": ["aws_security_group"]},
            {"id": "iam-in", "label": "IAM Role", "side": "left", "type": "target", "color": "bg-pink-400", "accepts": ["aws_iam_role"]},
            {"id": "lb-out", "label": "Load Balancer", "side": "right", "type": "source", "color": "bg-indigo-400", "accepts": ["aws_lb"]},
        ],
    },
    "security group": {
        "type": "aws_security_group",
        "label": "Security Group",
        "icon": "🛡️",
        "color": "text-red-400",
        "bgColor": "bg-red-950",
        "borderColor": "border-red-500",
        "category": "Security",
        "description": "Virtual firewall for EC2 instances",
        "defaultConfig": {"name": "main-sg", "description": "Managed by InfraStudio", "ingress_from_port": 443, "ingress_to_port": 443, "ingress_protocol": "tcp", "ingress_cidr_blocks": "0.0.0.0/0", "tags_name": "main-sg"},
        "fields": [],
        "ports": [
            {"id": "vpc-in", "label": "VPC", "side": "left", "type": "target", "color": "bg-red-400", "accepts": ["aws_vpc"]},
            {"id": "ec2-out", "label": "EC2", "side": "right", "type": "source", "color": "bg-red-400", "accepts": ["aws_instance"]},
            {"id": "lb-out", "label": "LB", "side": "right", "type": "source", "color": "bg-red-400", "accepts": ["aws_lb"]},
            {"id": "rds-out", "label": "RDS", "side": "right", "type": "source", "color": "bg-red-400", "accepts": ["aws_rds_instance"]},
        ],
    },
    "internet gateway": {
        "type": "aws_internet_gateway",
        "label": "Internet Gateway",
        "icon": "🚪",
        "color": "text-teal-400",
        "bgColor": "bg-teal-950",
        "borderColor": "border-teal-500",
        "category": "Network",
        "description": "Internet gateway for VPC",
        "defaultConfig": {"tags_name": "main-igw"},
        "fields": [],
        "ports": [
            {"id": "inet-out", "label": "VPC", "side": "right", "type": "source", "color": "bg-teal-400", "accepts": ["aws_vpc"]},
        ],
    },
    "load balancer": {
        "type": "aws_lb",
        "label": "Load Balancer",
        "icon": "⚖️",
        "color": "text-indigo-400",
        "bgColor": "bg-indigo-950",
        "borderColor": "border-indigo-500",
        "category": "Network",
        "description": "Elastic Load Balancer",
        "defaultConfig": {"name": "app-alb", "load_balancer_type": "application", "tags_name": "app-alb"},
        "fields": [],
        "ports": [
            {"id": "subnet-in", "label": "Subnet", "side": "left", "type": "target", "color": "bg-indigo-400", "accepts": ["aws_subnet"]},
            {"id": "sg-in", "label": "Security Group", "side": "left", "type": "target", "color": "bg-red-400", "accepts": ["aws_security_group"]},
            {"id": "ec2-out", "label": "EC2", "side": "right", "type": "source", "color": "bg-orange-400", "accepts": ["aws_instance"]},
        ],
    },
    "iam role": {
        "type": "aws_iam_role",
        "label": "IAM Role",
        "icon": "🔑",
        "color": "text-pink-400",
        "bgColor": "bg-pink-950",
        "borderColor": "border-pink-500",
        "category": "Security",
        "description": "IAM role for AWS services",
        "defaultConfig": {"name": "ec2-role", "assume_role_service": "ec2.amazonaws.com", "tags_name": "ec2-role"},
        "fields": [],
        "ports": [
            {"id": "ec2-out", "label": "EC2", "side": "right", "type": "source", "color": "bg-pink-400", "accepts": ["aws_instance"]},
            {"id": "lambda-out", "label": "Lambda", "side": "right", "type": "source", "color": "bg-pink-400", "accepts": ["aws_lambda_function"]},
        ],
    },
    "rds": {
        "type": "aws_rds_instance",
        "label": "RDS Instance",
        "icon": "🗄️",
        "color": "text-purple-400",
        "bgColor": "bg-purple-950",
        "borderColor": "border-purple-500",
        "category": "Database",
        "description": "Relational Database Service instance",
        "defaultConfig": {"identifier": "main-db", "engine": "mysql", "instance_class": "db.t3.micro", "allocated_storage": 20, "username": "admin", "password": "changeme123!", "tags_name": "main-db"},
        "fields": [],
        "ports": [
            {"id": "subnet-in", "label": "Subnet", "side": "left", "type": "target", "color": "bg-purple-400", "accepts": ["aws_subnet"]},
            {"id": "sg-in", "label": "Security Group", "side": "left", "type": "target", "color": "bg-red-400", "accepts": ["aws_security_group"]},
        ],
    },
    "s3": {
        "type": "aws_s3_bucket",
        "label": "S3 Bucket",
        "icon": "🪣",
        "color": "text-green-400",
        "bgColor": "bg-green-950",
        "borderColor": "border-green-500",
        "category": "Storage",
        "description": "Simple Storage Service bucket",
        "defaultConfig": {"bucket": "my-bucket", "acl": "private", "tags_name": "my-bucket"},
        "fields": [],
        "ports": [
            {"id": "data-out", "label": "Data Source", "side": "right", "type": "source", "color": "bg-green-400", "accepts": ["aws_lambda_function"]},
        ],
    },
    "lambda": {
        "type": "aws_lambda_function",
        "label": "Lambda Function",
        "icon": "⚡",
        "color": "text-yellow-400",
        "bgColor": "bg-yellow-950",
        "borderColor": "border-yellow-500",
        "category": "Serverless",
        "description": "Serverless compute function",
        "defaultConfig": {"function_name": "my-function", "runtime": "nodejs18.x", "handler": "index.handler", "memory_size": 256, "timeout": 30, "tags_name": "my-function"},
        "fields": [],
        "ports": [
            {"id": "iam-in", "label": "IAM Role", "side": "left", "type": "target", "color": "bg-pink-400", "accepts": ["aws_iam_role"]},
            {"id": "sg-in", "label": "Security Group", "side": "left", "type": "target", "color": "bg-red-400", "accepts": ["aws_security_group"]},
            {"id": "subnet-in", "label": "Subnet", "side": "left", "type": "target", "color": "bg-cyan-400", "accepts": ["aws_subnet"]},
            {"id": "s3-out", "label": "S3", "side": "right", "type": "source", "color": "bg-green-400", "accepts": ["aws_s3_bucket"]},
        ],
    },
}

# ── Ansible Resources ──────────────────────────────────────────────────────────

ANSIBLE_RESOURCES = {
    "host group": {
        "type": "ansible_host_group",
        "label": "Host Group",
        "icon": "🖥️",
        "color": "text-blue-400",
        "bgColor": "bg-blue-950",
        "borderColor": "border-blue-500",
        "category": "Inventory",
        "description": "Group of target hosts",
        "defaultConfig": {"name": "web_servers", "hosts": ["web01", "web02"], "vars": {"ansible_user": "ubuntu"}},
        "fields": [],
        "ports": [
            {"id": "out", "label": "Tasks", "side": "right", "type": "source", "color": "bg-blue-400", "accepts": ["ansible_package", "ansible_service", "ansible_copy"]},
        ],
    },
    "package": {
        "type": "ansible_package",
        "label": "Package",
        "icon": "📦",
        "color": "text-green-400",
        "bgColor": "bg-green-950",
        "borderColor": "border-green-500",
        "category": "Packages",
        "description": "Install/remove packages via apt/yum/dnf",
        "defaultConfig": {"name": "nginx", "state": "present", "package_manager": "apt"},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-green-400", "accepts": ["ansible_service", "ansible_copy", "ansible_shell"]},
        ],
    },
    "service": {
        "type": "ansible_service",
        "label": "Service",
        "icon": "⚙️",
        "color": "text-yellow-400",
        "bgColor": "bg-yellow-950",
        "borderColor": "border-yellow-500",
        "category": "Services",
        "description": "Manage systemd services",
        "defaultConfig": {"name": "nginx", "state": "started", "enabled": True},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-yellow-400", "accepts": ["ansible_copy", "ansible_shell", "ansible_template"]},
        ],
    },
    "copy": {
        "type": "ansible_copy",
        "label": "Copy File",
        "icon": "📄",
        "color": "text-cyan-400",
        "bgColor": "bg-cyan-950",
        "borderColor": "border-cyan-500",
        "category": "Files",
        "description": "Copy files to remote hosts",
        "defaultConfig": {"src": "files/nginx.conf", "dest": "/etc/nginx/nginx.conf", "owner": "root", "mode": "0644"},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-cyan-400", "accepts": ["ansible_service", "ansible_shell"]},
        ],
    },
    "template": {
        "type": "ansible_template",
        "label": "Template",
        "icon": "📝",
        "color": "text-purple-400",
        "bgColor": "bg-purple-950",
        "borderColor": "border-purple-500",
        "category": "Files",
        "description": "Jinja2 template rendering",
        "defaultConfig": {"src": "templates/app.conf.j2", "dest": "/etc/app.conf", "owner": "root", "mode": "0644"},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-purple-400", "accepts": ["ansible_service", "ansible_shell"]},
        ],
    },
    "git": {
        "type": "ansible_git",
        "label": "Git Clone",
        "icon": "🔀",
        "color": "text-orange-400",
        "bgColor": "bg-orange-950",
        "borderColor": "border-orange-500",
        "category": "Source Control",
        "description": "Clone Git repositories",
        "defaultConfig": {"repo": "https://github.com/example/app.git", "dest": "/opt/app", "version": "main"},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-orange-400", "accepts": ["ansible_shell", "ansible_service"]},
        ],
    },
    "shell": {
        "type": "ansible_shell",
        "label": "Shell Command",
        "icon": "💻",
        "color": "text-indigo-400",
        "bgColor": "bg-indigo-950",
        "borderColor": "border-indigo-500",
        "category": "Commands",
        "description": "Run shell commands/scripts",
        "defaultConfig": {"command": "npm install && npm run build", "chdir": "/opt/app", "becomes": True},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-indigo-400", "accepts": ["ansible_service", "ansible_copy"]},
        ],
    },
    "docker container": {
        "type": "ansible_docker_container",
        "label": "Docker Container",
        "icon": "🐳",
        "color": "text-blue-400",
        "bgColor": "bg-blue-950",
        "borderColor": "border-blue-500",
        "category": "Containers",
        "description": "Manage Docker containers",
        "defaultConfig": {"name": "web-app", "image": "nginx:latest", "state": "started", "restart_policy": "always", "ports": ["80:80"]},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
        ],
    },
    "ufw": {
        "type": "ansible_ufw",
        "label": "Firewall Rule",
        "icon": "🔥",
        "color": "text-red-400",
        "bgColor": "bg-red-950",
        "borderColor": "border-red-500",
        "category": "Security",
        "description": "UFW firewall rules",
        "defaultConfig": {"rule": "allow", "port": 80, "proto": "tcp"},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-red-400", "accepts": ["ansible_service", "ansible_shell"]},
        ],
    },
    "user": {
        "type": "ansible_user",
        "label": "User",
        "icon": "👤",
        "color": "text-pink-400",
        "bgColor": "bg-pink-950",
        "borderColor": "border-pink-500",
        "category": "Users",
        "description": "Manage system users",
        "defaultConfig": {"name": "deploy", "state": "present", "groups": ["sudo"], "shell": "/bin/bash"},
        "fields": [],
        "ports": [
            {"id": "in", "label": "Group", "side": "left", "type": "target", "color": "bg-blue-400", "accepts": ["ansible_host_group"]},
            {"id": "out", "label": "Next Task", "side": "right", "type": "source", "color": "bg-pink-400", "accepts": ["ansible_copy", "ansible_shell"]},
        ],
    },
}

# Map provider names to their resource dicts + layout order
PROVIDER_RESOURCES = {
    "aws": (AWS_RESOURCES, ["vpc", "internet gateway", "subnet", "security group", "iam role", "load balancer", "ec2", "lambda", "rds", "s3"]),
    "azure": (AWS_RESOURCES, ["vpc", "internet gateway", "subnet", "security group", "iam role", "load balancer", "ec2", "lambda", "rds", "s3"]),
    "gcp": (AWS_RESOURCES, ["vpc", "internet gateway", "subnet", "security group", "iam role", "load balancer", "ec2", "lambda", "rds", "s3"]),
    "crossplane": (AWS_RESOURCES, ["vpc", "internet gateway", "subnet", "security group", "iam role", "load balancer", "ec2", "lambda", "rds", "s3"]),
    "ansible": (ANSIBLE_RESOURCES, ["host group", "user", "package", "copy", "template", "git", "shell", "service", "docker container", "ufw"]),
}


# ── Pattern-based parser ───────────────────────────────────────────────────────

KNOWN_PATTERNS = {
    "web application": ["vpc", "internet gateway", "subnet", "security group", "ec2", "load balancer"],
    "web app": ["vpc", "internet gateway", "subnet", "security group", "ec2", "load balancer"],
    "three-tier": ["vpc", "internet gateway", "subnet", "security group", "load balancer", "ec2", "rds"],
    "3-tier": ["vpc", "internet gateway", "subnet", "security group", "load balancer", "ec2", "rds"],
    "vpc": ["vpc"],
    "ec2": ["ec2"],
    "ec2 with vpc": ["vpc", "internet gateway", "subnet", "security group", "ec2"],
    "serverless": ["lambda", "iam role", "s3"],
    "lambda": ["lambda", "iam role"],
    "database": ["vpc", "subnet", "security group", "rds"],
    "rds": ["vpc", "subnet", "security group", "rds"],
    "load balancer": ["vpc", "internet gateway", "subnet", "security group", "load balancer", "ec2"],
    "s3": ["s3"],
}

ANSIBLE_PATTERNS = {
    "nginx": ["host group", "package", "copy", "service"],
    "web server": ["host group", "package", "copy", "service"],
    "lamp": ["host group", "package", "service", "copy"],
    "wordpress": ["host group", "package", "service", "copy"],
    "docker": ["host group", "docker container"],
    "container": ["host group", "docker container"],
    "install": ["host group", "package"],
    "deploy": ["host group", "git", "shell", "service"],
    "firewall": ["host group", "ufw"],
    "user": ["host group", "user"],
    "config": ["host group", "copy", "template"],
    "monitoring": ["host group", "package", "service", "copy"],
    "complete": ["host group", "package", "copy", "service", "git", "shell", "docker container"],
    "playbook": ["host group", "package", "service"],
}


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _find_resources(prompt: str, provider: str) -> List[str]:
    norm = _normalize(prompt)
    pattern_map = ANSIBLE_PATTERNS if provider == "ansible" else KNOWN_PATTERNS
    resource_map = PROVIDER_RESOURCES.get(provider, (AWS_RESOURCES, []))[0]

    for pattern, resources in sorted(pattern_map.items(), key=lambda x: -len(x[0])):
        if pattern in norm:
            return list(resources)
    detected = []
    for keyword in resource_map:
        if keyword in norm:
            detected.append(keyword)
    if not detected:
        if provider == "ansible":
            detected = ["host group", "package", "service"]
        else:
            detected = ["vpc", "subnet", "ec2"]
    return detected


def _layout_resources(resource_keys: List[str], provider: str) -> tuple:
    resource_map, order = PROVIDER_RESOURCES.get(provider, (AWS_RESOURCES, ["vpc", "subnet", "ec2"]))
    nodes = []
    edges = []
    counter = 1
    bx = 80
    by = 200
    spacing = 260
    prev_id = None
    prev_port = None

    ordered_keys = [k for k in order if k in resource_keys]
    for k in resource_keys:
        if k not in ordered_keys:
            ordered_keys.append(k)

    for idx, key in enumerate(ordered_keys):
        res = resource_map.get(key)
        if not res:
            continue
        node_id = f"ai_node_{counter}"
        res_name = f"{key.replace(' ', '_')}_{counter}"
        definition = {
            "type": res["type"],
            "label": res["label"],
            "icon": res["icon"],
            "color": res["color"],
            "bgColor": res["bgColor"],
            "borderColor": res["borderColor"],
            "category": res["category"],
            "description": res["description"],
            "fields": res["fields"],
            "ports": res["ports"],
        }

        nodes.append(NodeData(
            id=node_id,
            type="resourceNode",
            position={"x": float(bx + idx * spacing), "y": float(by)},
            data={
                "resourceType": res["type"],
                "resourceName": res_name,
                "config": dict(res["defaultConfig"]),
                "definition": definition,
            },
        ))

        if prev_id and prev_port:
            target_port = None
            for port in res["ports"]:
                if port["side"] == "left":
                    target_port = port["id"]
                    break
            if target_port:
                color = PORT_COLORS.get(
                    # derive color from the target port
                    next((p["color"] for p in res["ports"] if p["side"] == "left"), "#6b7280"),
                    "#6b7280"
                )
                edges.append(EdgeData(
                    id=f"ai_edge_{counter}",
                    source=prev_id,
                    target=node_id,
                    sourceHandle=prev_port,
                    targetHandle=target_port,
                    style={"stroke": color, "strokeWidth": 2},
                    markerEnd={"type": "arrowclosed", "color": color},
                ))

        next_port = None
        for port in res["ports"]:
            if port["side"] == "right":
                next_port = port["id"]
                break
        prev_id = node_id
        prev_port = next_port
        counter += 1

    return nodes, edges


def _generate_llm(prompt: str, provider: str) -> tuple:
    """Try to use OpenAI if configured, fall back to pattern-based."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        logger.info("No OPENAI_API_KEY set, using pattern-based generation")
        return _generate_fallback(prompt, provider)

    try:
        import httpx
        system_prompt = _build_llm_system_prompt(provider)
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{
                    "role": "system",
                    "content": system_prompt,
                }, {
                    "role": "user",
                    "content": f"Create {provider} infrastructure: {prompt}",
                }],
                "temperature": 0.3,
                "max_tokens": 3000,
            },
            timeout=30,
        )
        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        data = json.loads(content)
        nodes = [NodeData(**n) for n in data.get("nodes", [])]
        edges = [EdgeData(**e) for e in data.get("edges", [])]
        return nodes, edges
    except Exception as e:
        logger.warning(f"LLM generation failed: {e}, falling back to pattern-based")
        return _generate_fallback(prompt, provider)


def _build_llm_system_prompt(provider: str) -> str:
    if provider == "ansible":
        return (
            "You generate Ansible playbook diagrams in JSON. "
            "Given a user's automation description, output a JSON object with "
            '"nodes" (array of {id, type: "resourceNode", position: {x, y}, data: {resourceType, resourceName, config, definition}}) '
            'and "edges" (array of {id, source, target, sourceHandle, targetHandle, style, markerEnd}). '
            "Use Ansible resource types like ansible_host_group, ansible_package, ansible_service, "
            "ansible_copy, ansible_template, ansible_git, ansible_shell, ansible_docker_container, ansible_ufw, ansible_user. "
            "Position nodes in a left-to-right flow from 100px to 1000px x coordinates. "
            "Output ONLY valid JSON, no markdown."
        )
    elif provider == "crossplane":
        return (
            "You generate Crossplane composition diagrams in JSON. "
            "Given a user's infrastructure description, output a JSON object with "
            '"nodes" (array of {id, type: "resourceNode", position: {x, y}, data: {resourceType, resourceName, config, definition}}) '
            'and "edges" (array of {id, source, target, sourceHandle, targetHandle, style, markerEnd}). '
            "Use resource types like aws_vpc, aws_subnet, aws_instance, aws_security_group, etc. "
            "Position nodes in a left-to-right flow from 100px to 1000px x coordinates. "
            "Output ONLY valid JSON, no markdown."
        )
    else:
        return (
            "You generate infrastructure diagrams in JSON. "
            "Given a user's infrastructure description, output a JSON object with "
            '"nodes" (array of {id, type: "resourceNode", position: {x, y}, data: {resourceType, resourceName, config, definition}}) '
            'and "edges" (array of {id, source, target, sourceHandle, targetHandle, style, markerEnd}). '
            f"Use {provider.upper()} resource types. "
            "Position nodes in a left-to-right flow from 100px to 1000px x coordinates. "
            "Output ONLY valid JSON, no markdown."
        )


def _generate_fallback(prompt: str, provider: str) -> tuple:
    resources = _find_resources(prompt, provider)
    return _layout_resources(resources, provider)


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/generate-infra", response_model=GenerateResponse)
def generate_infra(req: GenerateRequest):
    try:
        if req.use_llm:
            nodes, edges = _generate_llm(req.prompt, req.provider)
        else:
            nodes, edges = _generate_fallback(req.prompt, req.provider)

        if not nodes:
            nodes, edges = _generate_fallback(req.prompt, req.provider)

        resource_names = [n.data.get("resourceName", "") for n in nodes]

        if req.provider == "ansible":
            explanation = (
                f"I detected {len(nodes)} Ansible tasks for your playbook: "
                f"{', '.join(resource_names)}. "
                f"The playbook follows a standard Ansible workflow."
            )
        elif req.provider == "crossplane":
            explanation = (
                f"I detected {len(nodes)} Crossplane-managed resources: "
                f"{', '.join(resource_names)}. "
                f"The composition follows a standard Crossplane pattern."
            )
        else:
            explanation = (
                f"I detected {len(nodes)} resources for your infrastructure: "
                f"{', '.join(resource_names)}. "
                f"The architecture follows a standard {req.provider.upper()} pattern."
            )

        return GenerateResponse(
            nodes=nodes,
            edges=edges,
            explanation=explanation,
            warning="" if nodes else "Could not parse your request. Try being more specific.",
        )
    except Exception as e:
        logger.exception("AI generation failed")
        raise HTTPException(status_code=500, detail=str(e))
