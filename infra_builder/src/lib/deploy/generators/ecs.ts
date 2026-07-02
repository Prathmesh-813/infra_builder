import type { DetectedApp } from "../types";

export function generateEcsFargate(app: DetectedApp): { filename: string; content: string }[] {
  const { repoName, port } = app;
  const name = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  return [
    { filename: "task-definition.json", content: taskDefinition(name, port, app) },
    { filename: "service.json",         content: serviceConfig(name) },
    { filename: "ecr-push.sh",          content: ecrPushScript(name) },
    { filename: "deploy.sh",            content: deployScript(name) },
    { filename: "appspec.yaml",         content: appSpec(name) },
  ];
}

function taskDefinition(name: string, port: number, app: DetectedApp): string {
  const { language } = app;
  const memory = language === "java" ? 1024 : 512;
  const cpu    = language === "java" ? 512 : 256;

  const env = buildEcsEnv(app);

  return JSON.stringify({
    family: name,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: String(cpu),
    memory: String(memory),
    executionRoleArn: `arn:aws:iam::YOUR_ACCOUNT_ID:role/${name}-task-execution-role`,
    taskRoleArn:      `arn:aws:iam::YOUR_ACCOUNT_ID:role/${name}-task-role`,
    containerDefinitions: [
      {
        name,
        image: `YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/${name}:latest`,
        essential: true,
        portMappings: [
          { containerPort: port, hostPort: port, protocol: "tcp" },
        ],
        environment: env,
        secrets: [
          { name: "DATABASE_URL", valueFrom: `arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:${name}/database-url` },
          { name: "SECRET_KEY",   valueFrom: `arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:${name}/secret-key` },
        ],
        logConfiguration: {
          logDriver: "awslogs",
          options: {
            "awslogs-group":         `/ecs/${name}`,
            "awslogs-region":        "us-east-1",
            "awslogs-stream-prefix": "ecs",
            "awslogs-create-group":  "true",
          },
        },
        healthCheck: {
          command: ["CMD-SHELL", `curl -f http://localhost:${port}/health || exit 1`],
          interval: 30,
          timeout: 5,
          retries: 3,
          startPeriod: 60,
        },
        readonlyRootFilesystem: true,
        user: "1001:1001",
        linuxParameters: {
          initProcessEnabled: true,
        },
      },
    ],
    tags: [
      { key: "Project",     value: name },
      { key: "Environment", value: "production" },
      { key: "ManagedBy",   value: "TechAtlas" },
    ],
  }, null, 2);
}

function buildEcsEnv(app: DetectedApp): { name: string; value: string }[] {
  const env: { name: string; value: string }[] = [
    { name: "NODE_ENV", value: "production" },
    { name: "PORT",     value: String(app.port) },
  ];

  if (app.language === "nodejs" && app.framework === "nextjs") {
    env.push({ name: "NEXT_TELEMETRY_DISABLED", value: "1" });
  }
  if (app.language === "java") {
    env.push({ name: "SPRING_PROFILES_ACTIVE", value: "prod" });
    env.push({ name: "JAVA_OPTS", value: "-Xmx512m -Xms256m" });
    // Remove NODE_ENV for java
    env.splice(0, 1);
  }
  if (app.language === "python") {
    env.splice(0, 1);
    env.push({ name: "PYTHONUNBUFFERED", value: "1" });
    env.push({ name: "PYTHON_ENV", value: "production" });
  }
  if (app.language === "go") {
    env.splice(0, 1);
    env.push({ name: "GIN_MODE", value: "release" });
  }

  return env;
}

function serviceConfig(name: string): string {
  return JSON.stringify({
    cluster: `${name}-cluster`,
    serviceName: `${name}-service`,
    taskDefinition: name,
    desiredCount: 2,
    launchType: "FARGATE",
    platformVersion: "LATEST",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: [
          "subnet-XXXXXXXXXXXXXXXXX",  // replace with your private subnet IDs
          "subnet-YYYYYYYYYYYYYYYYY",
        ],
        securityGroups: [
          "sg-XXXXXXXXXXXXXXXXX",      // replace with your security group ID
        ],
        assignPublicIp: "DISABLED",    // use private subnets with NAT Gateway
      },
    },
    loadBalancers: [
      {
        targetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/${name}/XXXXXXXXXXXXXXXX`,
        containerName: name,
        containerPort: 3000,
      },
    ],
    deploymentConfiguration: {
      maximumPercent: 200,
      minimumHealthyPercent: 100,
      deploymentCircuitBreaker: {
        enable: true,
        rollback: true,
      },
    },
    enableECSManagedTags: true,
    propagateTags: "SERVICE",
    tags: [
      { key: "Project",     value: name },
      { key: "Environment", value: "production" },
    ],
  }, null, 2);
}

function ecrPushScript(name: string): string {
  return `#!/usr/bin/env bash
# ECR Push Script — builds, tags, and pushes your Docker image to Amazon ECR
set -euo pipefail

AWS_ACCOUNT_ID="\${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}"
AWS_REGION="\${AWS_REGION:-us-east-1}"
IMAGE_TAG="\${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
ECR_REPO="${name}"

ECR_URI="\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/\${ECR_REPO}"

echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region "\${AWS_REGION}" | \\
  docker login --username AWS --password-stdin "\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com"

echo "🏗️  Creating ECR repository (safe to run if it already exists)..."
aws ecr create-repository --repository-name "\${ECR_REPO}" --region "\${AWS_REGION}" 2>/dev/null || true

echo "🐳 Building Docker image..."
docker buildx build \\
  --platform linux/amd64 \\
  --tag "\${ECR_URI}:\${IMAGE_TAG}" \\
  --tag "\${ECR_URI}:latest" \\
  --push \\
  .

echo "✅ Pushed \${ECR_URI}:\${IMAGE_TAG}"
echo "   and   \${ECR_URI}:latest"
`;
}

function deployScript(name: string): string {
  return `#!/usr/bin/env bash
# ECS Deploy Script — updates the task definition and forces a new deployment
set -euo pipefail

AWS_REGION="\${AWS_REGION:-us-east-1}"
IMAGE_TAG="\${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
CLUSTER="${name}-cluster"
SERVICE="${name}-service"
AWS_ACCOUNT_ID="\${AWS_ACCOUNT_ID:-YOUR_ACCOUNT_ID}"
ECR_URI="\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com/${name}"

echo "📋 Registering new task definition..."
TASK_DEF=\$(cat task-definition.json | \\
  sed "s|:latest|:\${IMAGE_TAG}|g")

NEW_TASK_DEF_ARN=\$(echo "\$TASK_DEF" | \\
  aws ecs register-task-definition \\
    --region "\${AWS_REGION}" \\
    --cli-input-json file:///dev/stdin \\
  | jq -r '.taskDefinition.taskDefinitionArn')

echo "✅ New task definition: \${NEW_TASK_DEF_ARN}"

echo "🚀 Updating ECS service..."
aws ecs update-service \\
  --cluster "\${CLUSTER}" \\
  --service "\${SERVICE}" \\
  --task-definition "\${NEW_TASK_DEF_ARN}" \\
  --force-new-deployment \\
  --region "\${AWS_REGION}"

echo "⏳ Waiting for service to stabilise..."
aws ecs wait services-stable \\
  --cluster "\${CLUSTER}" \\
  --services "\${SERVICE}" \\
  --region "\${AWS_REGION}"

echo "🎉 Deploy complete!"
`;
}

function appSpec(name: string): string {
  return `# AWS CodeDeploy AppSpec for Blue/Green ECS deployments
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION>
        LoadBalancerInfo:
          ContainerName: "${name}"
          ContainerPort: 3000
        PlatformVersion: "LATEST"
        NetworkConfiguration:
          AwsvpcConfiguration:
            Subnets:
              - "subnet-XXXXXXXXXXXXXXXXX"
              - "subnet-YYYYYYYYYYYYYYYYY"
            SecurityGroups:
              - "sg-XXXXXXXXXXXXXXXXX"
            AssignPublicIp: "DISABLED"
Hooks:
  - BeforeInstall: "LambdaFunctionToValidateBeforeInstall"
  - AfterInstall:  "LambdaFunctionToValidateAfterInstall"
  - AfterAllowTestTraffic: "LambdaFunctionToValidateTestTraffic"
  - BeforeAllowTraffic: "LambdaFunctionToValidateBeforeAllowTraffic"
  - AfterAllowTraffic:  "LambdaFunctionToValidateAfterAllowTraffic"
`;
}
