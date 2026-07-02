import type { DetectedApp } from "../types";

// ── EKS cluster setup + deployment commands ───────────────────────────────────

export function generateEksSetup(app: DetectedApp): string {
  const { repoName, repoOwner, port } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return `#!/usr/bin/env bash
# eks-setup.sh — Provision an AWS EKS cluster and deploy ${repoName}
# Prerequisites:
#   - AWS CLI v2  (aws --version)
#   - eksctl      (eksctl version)
#   - kubectl     (kubectl version --client)
#   - helm        (helm version)
#   - Docker / Podman for building the image
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
CLUSTER_NAME="\${CLUSTER_NAME:-${slug}-cluster}"
AWS_REGION="\${AWS_REGION:-us-east-1}"
NODE_TYPE="\${NODE_TYPE:-t3.medium}"
NODE_COUNT="\${NODE_COUNT:-3}"
AWS_ACCOUNT_ID="\$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/${slug}"
IMAGE="\${ECR_REPO}:\${IMAGE_TAG:-\$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
NAMESPACE="\${NAMESPACE:-${slug}}"
APP_PORT="${port}"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
step() { echo; log "──────────────────────────────────────────"; log "  $*"; log "──────────────────────────────────────────"; }
die()  { log "ERROR: $*" >&2; exit 1; }

command -v aws     >/dev/null || die "aws-cli not installed"
command -v eksctl  >/dev/null || die "eksctl not installed — https://eksctl.io"
command -v kubectl >/dev/null || die "kubectl not installed"
command -v helm    >/dev/null || die "helm not installed"

step "1. Create EKS Cluster"
if eksctl get cluster --name "\$CLUSTER_NAME" --region "\$AWS_REGION" &>/dev/null; then
  log "Cluster '\$CLUSTER_NAME' already exists — skipping creation"
else
  eksctl create cluster \\
    --name "\$CLUSTER_NAME" \\
    --region "\$AWS_REGION" \\
    --nodegroup-name workers \\
    --node-type "\$NODE_TYPE" \\
    --nodes "\$NODE_COUNT" \\
    --nodes-min 2 \\
    --nodes-max 6 \\
    --managed \\
    --with-oidc \\
    --ssh-access=false \\
    --asg-access \\
    --full-ecr-access \\
    --alb-ingress-access \\
    --enable-ssm
  log "Cluster created ✓"
fi

step "2. Update kubeconfig"
aws eks update-kubeconfig \\
  --name "\$CLUSTER_NAME" \\
  --region "\$AWS_REGION"
kubectl cluster-info

step "3. Install AWS Load Balancer Controller"
helm repo add eks https://aws.github.io/eks-charts --force-update

# Create IAM policy for LBC (idempotent)
aws iam create-policy \\
  --policy-name AWSLoadBalancerControllerIAMPolicy \\
  --policy-document "$(curl -s https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json)" \\
  2>/dev/null || log "IAM policy already exists — skipping"

eksctl create iamserviceaccount \\
  --cluster="\$CLUSTER_NAME" \\
  --namespace=kube-system \\
  --name=aws-load-balancer-controller \\
  --role-name "AmazonEKSLoadBalancerControllerRole" \\
  --attach-policy-arn "arn:aws:iam::\${AWS_ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy" \\
  --approve \\
  --override-existing-serviceaccounts \\
  2>/dev/null || true

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \\
  -n kube-system \\
  --set clusterName="\$CLUSTER_NAME" \\
  --set serviceAccount.create=false \\
  --set serviceAccount.name=aws-load-balancer-controller \\
  --wait
log "Load Balancer Controller installed ✓"

step "4. Create ECR Repository"
aws ecr describe-repositories --repository-names "${slug}" --region "\$AWS_REGION" &>/dev/null || \\
  aws ecr create-repository \\
    --repository-name "${slug}" \\
    --region "\$AWS_REGION" \\
    --image-scanning-configuration scanOnPush=true \\
    --encryption-configuration encryptionType=AES256
log "ECR repository ready ✓"

step "5. Build & Push Docker Image"
aws ecr get-login-password --region "\$AWS_REGION" | \\
  docker login --username AWS --password-stdin "\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com"

docker build --pull -t "${slug}:build" .
docker tag "${slug}:build" "\$IMAGE"
docker tag "${slug}:build" "\${ECR_REPO}:latest"
docker push "\$IMAGE"
docker push "\${ECR_REPO}:latest"
log "Image pushed: \$IMAGE ✓"

step "6. Deploy to EKS"
kubectl create namespace "\$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "\$NAMESPACE" create secret generic ${slug}-secrets \\
  --from-literal=DATABASE_URL="postgresql://user:pass@postgres:5432/${slug.replace(/-/g, "_")}_db" \\
  --dry-run=client -o yaml | kubectl apply -f -

# Apply manifests (assumes k8s/ folder from Kubernetes generator)
if [ -d k8s ]; then
  kubectl apply -f k8s/ --recursive
else
  # Inline deployment if k8s/ folder doesn't exist
  kubectl -n "\$NAMESPACE" apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${slug}
  namespace: \$NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${slug}
  template:
    metadata:
      labels:
        app: ${slug}
    spec:
      containers:
        - name: ${slug}
          image: \$IMAGE
          ports:
            - containerPort: \$APP_PORT
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "\$APP_PORT"
          resources:
            requests: { memory: "128Mi", cpu: "100m" }
            limits:   { memory: "512Mi", cpu: "500m" }
          readinessProbe:
            httpGet: { path: /health, port: \$APP_PORT }
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet: { path: /health, port: \$APP_PORT }
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: ${slug}
  namespace: \$NAMESPACE
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: external
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: ip
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
spec:
  type: LoadBalancer
  selector:
    app: ${slug}
  ports:
    - port: 80
      targetPort: \$APP_PORT
EOF
fi

step "7. Wait for rollout"
kubectl -n "\$NAMESPACE" rollout status deployment/${slug} --timeout=5m

step "8. Verify deployment"
kubectl -n "\$NAMESPACE" get pods -l app=${slug}
kubectl -n "\$NAMESPACE" get svc ${slug}

LB_HOST=\$(kubectl -n "\$NAMESPACE" get svc ${slug} \\
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
log ""
log "✅ Deployment complete!"
log "   Image     : \$IMAGE"
log "   Namespace : \$NAMESPACE"
log "   Cluster   : \$CLUSTER_NAME (\$AWS_REGION)"
log "   LB Host   : \$LB_HOST  (may take 2–3 min to provision)"
log ""
`;
}

// ── kubectl-only quick deploy (assumes cluster already exists) ─────────────────

export function generateEksKubectl(app: DetectedApp): string {
  const { repoName, port } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return `#!/usr/bin/env bash
# eks-kubectl-deploy.sh — Deploy ${repoName} to an EXISTING EKS cluster
# Prerequisites: aws-cli, kubectl, docker
# Run eks-setup.sh first to provision the cluster.
set -euo pipefail

AWS_REGION="\${AWS_REGION:-us-east-1}"
CLUSTER_NAME="\${CLUSTER_NAME:-${slug}-cluster}"
AWS_ACCOUNT_ID="\$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/${slug}"
TAG="\${TAG:-\$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
IMAGE="\${ECR_REPO}:\${TAG}"
NAMESPACE="\${NAMESPACE:-${slug}}"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
step() { log "── $*"; }

step "Updating kubeconfig for cluster '\$CLUSTER_NAME'"
aws eks update-kubeconfig --name "\$CLUSTER_NAME" --region "\$AWS_REGION"

step "Logging in to ECR"
aws ecr get-login-password --region "\$AWS_REGION" | \\
  docker login --username AWS --password-stdin "\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com"

step "Building image: \$IMAGE"
docker build --pull -t "\$IMAGE" .

step "Pushing image to ECR"
docker push "\$IMAGE"

step "Rolling out new image"
kubectl -n "\$NAMESPACE" set image deployment/${slug} ${slug}="\$IMAGE"
kubectl -n "\$NAMESPACE" rollout status deployment/${slug} --timeout=5m

step "Pod status"
kubectl -n "\$NAMESPACE" get pods -l app=${slug}

log "✅ Done — \$IMAGE deployed to \$NAMESPACE"
`;
}

// ── eksctl cluster config YAML ────────────────────────────────────────────────

export function generateEksctlConfig(app: DetectedApp): string {
  const { repoName } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return `# eksctl cluster config — ${repoName}
# Apply with: eksctl create cluster -f eksctl-cluster.yaml
#
# Docs: https://eksctl.io/usage/schema/

apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${slug}-cluster
  region: us-east-1
  version: "1.30"
  tags:
    project: ${repoName}
    managed-by: eksctl

iam:
  withOIDC: true

addons:
  - name: vpc-cni
    version: latest
    resolveConflicts: overwrite
  - name: coredns
    version: latest
    resolveConflicts: overwrite
  - name: kube-proxy
    version: latest
    resolveConflicts: overwrite
  - name: aws-ebs-csi-driver
    version: latest
    resolveConflicts: overwrite

managedNodeGroups:
  - name: workers
    instanceType: t3.medium
    minSize: 2
    desiredCapacity: 3
    maxSize: 6
    amiFamily: AmazonLinux2023
    labels:
      role: workers
    tags:
      nodegroup-role: workers
    iam:
      attachPolicyARNs:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
    privateNetworking: true
    ssh:
      allow: false

  - name: spot-workers
    instanceTypes:
      - t3.medium
      - t3.large
      - t3a.medium
    spot: true
    minSize: 0
    desiredCapacity: 0
    maxSize: 10
    labels:
      role: spot
      workload-type: non-critical
    taints:
      - key: workload-type
        value: spot
        effect: NoSchedule

vpc:
  clusterEndpoints:
    privateAccess: true
    publicAccess: true
  publicAccessCIDRs:
    - 0.0.0.0/0

cloudWatch:
  clusterLogging:
    enable:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler
    logRetentionInDays: 30
`;
}

// ── IAM trust policy for EKS service account ─────────────────────────────────

export function generateEksIamPolicy(app: DetectedApp): string {
  const { repoName } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  return `{
  "_comment": "IAM policy for ${repoName} pods running on EKS",
  "_usage": "aws iam create-policy --policy-name ${slug}-pod-policy --policy-document file://eks-iam-policy.json",
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRReadAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3AppAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${slug}-*",
        "arn:aws:s3:::${slug}-*/*"
      ]
    },
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:${slug}/*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/eks/${slug}/*"
    }
  ]
}
`;
}
