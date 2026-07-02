import type { DetectedApp, DeployBundle, GeneratedFile } from "../types";
import { generateDockerfile }          from "./dockerfile";
import { generateDockerCompose }       from "./docker-compose";
import {
  generatePodmanCompose,
  generatePodmanKube,
  generatePodmanQuadlet,
  generatePodmanRunScript,
}                                      from "./podman";
import { generateKubernetesManifests } from "./kubernetes";
import { generateHelmChart }           from "./helm";
import {
  generateEksSetup,
  generateEksKubectl,
  generateEksctlConfig,
  generateEksIamPolicy,
}                                      from "./eks";
import { generateEcsFargate }          from "./ecs";
import { generateCloudRun }            from "./cloud-run";
import { generateAzureAca }            from "./azure";
import {
  generateGithubActions,
  generateGitlabCi,
  generateJenkins,
  generateCircleCI,
  generateAzureDevOps,
  generateBitbucketPipelines,
  generateBamboo,
  generateTravisCI,
  generateDroneCI,
  generateTeamCity,
} from "./cicd";
import {
  generateBashScript,
  generatePowerShellScript,
  generatePythonScript,
  generateMakefile,
} from "./scripts";

function toFile(filename: string, content: string): GeneratedFile {
  const ext = filename.split(".").pop() ?? "";
  const langMap: Record<string, string> = {
    yaml: "yaml", yml: "yaml", json: "json",
    sh:   "bash", ps1: "powershell", py: "python",
    ts:   "typescript", js: "javascript",
    tf:   "hcl", tpl: "go-template",
    kts:  "kotlin", xml: "xml", toml: "toml",
    groovy: "groovy",
  };
  return {
    filename,
    filepath: filename,
    content,
    lang: langMap[ext]
      ?? (filename === "Dockerfile"   ? "dockerfile"
        : filename === "Jenkinsfile"  ? "groovy"
        : filename === "Makefile"     ? "makefile"
        : "text"),
  };
}

export function generateAllBundles(app: DetectedApp): DeployBundle[] {
  const bundles: DeployBundle[] = [];

  // ── DEPLOY TARGETS ──────────────────────────────────────────────────────────

  bundles.push({
    category: "deploy",
    target: "dockerfile",
    label: "Dockerfile",
    icon: "🐳",
    color: "blue",
    description: "Optimised multi-stage Dockerfile for production",
    files: [toFile("Dockerfile", generateDockerfile(app))],
  });

  bundles.push({
    category: "deploy",
    target: "docker-compose",
    label: "Docker Compose",
    icon: "📦",
    color: "sky",
    description: "Full local stack with DB, Redis, and app service",
    files: [toFile("docker-compose.yml", generateDockerCompose(app))],
  });

  bundles.push({
    category: "deploy",
    target: "podman",
    label: "Podman",
    icon: "🦭",
    color: "purple",
    description: "Rootless containers — Compose, Kube pod spec, Quadlet systemd unit & run script",
    files: [
      toFile("podman-compose.yml",       generatePodmanCompose(app)),
      toFile("pod.yaml",                 generatePodmanKube(app)),
      toFile("quadlet/app.container",    generatePodmanQuadlet(app)),
      toFile("podman-run.sh",            generatePodmanRunScript(app)),
    ],
  });

  const k8sFiles = generateKubernetesManifests(app).map(f =>
    toFile(`k8s/${f.filename}`, f.content)
  );
  bundles.push({
    category: "deploy",
    target: "kubernetes",
    label: "Kubernetes",
    icon: "☸️",
    color: "indigo",
    description: "Production-ready K8s manifests with HPA, Ingress, and secrets",
    files: k8sFiles,
  });

  const helmFiles = generateHelmChart(app).map(f =>
    toFile(`helm/${f.filename}`, f.content)
  );
  bundles.push({
    category: "deploy",
    target: "helm",
    label: "Helm Chart",
    icon: "⛵",
    color: "violet",
    description: "Parameterised Helm chart for any Kubernetes cluster",
    files: helmFiles,
  });

  bundles.push({
    category: "deploy",
    target: "eks",
    label: "AWS EKS",
    icon: "☸️",
    color: "amber",
    description: "Full EKS cluster setup, eksctl config, ECR push, kubectl deploy, and IAM policy",
    files: [
      toFile("eks-setup.sh",           generateEksSetup(app)),
      toFile("eks-kubectl-deploy.sh",  generateEksKubectl(app)),
      toFile("eksctl-cluster.yaml",    generateEksctlConfig(app)),
      toFile("eks-iam-policy.json",    generateEksIamPolicy(app)),
    ],
  });

  const ecsFiles = generateEcsFargate(app).map(f =>
    toFile(`ecs/${f.filename}`, f.content)
  );
  bundles.push({
    category: "deploy",
    target: "ecs-fargate",
    label: "AWS ECS Fargate",
    icon: "🟠",
    color: "amber",
    description: "Serverless containers on AWS with ECR push & CodeDeploy scripts",
    files: ecsFiles,
  });

  const crFiles = generateCloudRun(app).map(f =>
    toFile(`cloudrun/${f.filename}`, f.content)
  );
  bundles.push({
    category: "deploy",
    target: "cloud-run",
    label: "Google Cloud Run",
    icon: "🔵",
    color: "cyan",
    description: "Fully managed serverless containers on GCP",
    files: crFiles,
  });

  const azFiles = generateAzureAca(app).map(f =>
    toFile(`azure/${f.filename}`, f.content)
  );
  bundles.push({
    category: "deploy",
    target: "azure-aca",
    label: "Azure Container Apps",
    icon: "🔷",
    color: "blue",
    description: "Serverless Kubernetes on Azure with ACR integration",
    files: azFiles,
  });

  // ── CI/CD PLATFORMS ──────────────────────────────────────────────────────────

  bundles.push({
    category: "cicd",
    target: "github-actions",
    label: "GitHub Actions",
    icon: "⚙️",
    color: "gray",
    description: "Native GitHub CI/CD with GHCR push and environment gates",
    files: [toFile(".github/workflows/deploy.yml", generateGithubActions(app))],
  });

  bundles.push({
    category: "cicd",
    target: "gitlab-ci",
    label: "GitLab CI",
    icon: "🦊",
    color: "orange",
    description: "Multi-stage GitLab pipeline with GitLab Container Registry",
    files: [toFile(".gitlab-ci.yml", generateGitlabCi(app))],
  });

  bundles.push({
    category: "cicd",
    target: "jenkins",
    label: "Jenkins",
    icon: "🔧",
    color: "red",
    description: "Declarative Jenkinsfile pipeline with Docker & kubectl steps",
    files: [toFile("Jenkinsfile", generateJenkins(app))],
  });

  bundles.push({
    category: "cicd",
    target: "circleci",
    label: "CircleCI",
    icon: "🔵",
    color: "green",
    description: "CircleCI 2.1 config with orbs, caching, and workflow gates",
    files: [toFile(".circleci/config.yml", generateCircleCI(app))],
  });

  bundles.push({
    category: "cicd",
    target: "azure-devops",
    label: "Azure DevOps",
    icon: "☁️",
    color: "blue",
    description: "Azure Pipelines multi-stage YAML with AKS deployment task",
    files: [toFile("azure-pipelines.yml", generateAzureDevOps(app))],
  });

  bundles.push({
    category: "cicd",
    target: "bitbucket-pipelines",
    label: "Bitbucket Pipelines",
    icon: "🪣",
    color: "indigo",
    description: "Bitbucket Pipelines with Docker service and reusable step anchors",
    files: [toFile("bitbucket-pipelines.yml", generateBitbucketPipelines(app))],
  });

  bundles.push({
    category: "cicd",
    target: "bamboo",
    label: "Bamboo",
    icon: "🎋",
    color: "green",
    description: "Atlassian Bamboo Specs YAML with test, build, and deploy stages",
    files: [toFile("bamboo-specs/bamboo.yaml", generateBamboo(app))],
  });

  bundles.push({
    category: "cicd",
    target: "travis-ci",
    label: "Travis CI",
    icon: "🚀",
    color: "yellow",
    description: "Travis CI pipeline with language-native caching and Docker push",
    files: [toFile(".travis.yml", generateTravisCI(app))],
  });

  bundles.push({
    category: "cicd",
    target: "drone-ci",
    label: "Drone CI",
    icon: "🛸",
    color: "purple",
    description: "Drone CI pipeline with Docker plugin and kubectl deploy step",
    files: [toFile(".drone.yml", generateDroneCI(app))],
  });

  bundles.push({
    category: "cicd",
    target: "teamcity",
    label: "TeamCity",
    icon: "🏗️",
    color: "pink",
    description: "TeamCity Kotlin DSL with test, build, and deploy build types",
    files: [toFile(".teamcity/settings.kts", generateTeamCity(app))],
  });

  // ── DEPLOY SCRIPTS ───────────────────────────────────────────────────────────

  bundles.push({
    category: "script",
    target: "bash",
    label: "Bash Script",
    icon: "💻",
    color: "green",
    description: "POSIX shell deploy script with pre-flight checks (Linux / macOS)",
    files: [toFile("deploy.sh", generateBashScript(app))],
  });

  bundles.push({
    category: "script",
    target: "powershell",
    label: "PowerShell",
    icon: "🔵",
    color: "blue",
    description: "PowerShell 7 deploy script with -DryRun and coloured output (Windows)",
    files: [toFile("deploy.ps1", generatePowerShellScript(app))],
  });

  bundles.push({
    category: "script",
    target: "python",
    label: "Python Script",
    icon: "🐍",
    color: "yellow",
    description: "Python 3 deploy script using subprocess — cross-platform",
    files: [toFile("deploy.py", generatePythonScript(app))],
  });

  bundles.push({
    category: "script",
    target: "makefile",
    label: "Makefile",
    icon: "⚙️",
    color: "gray",
    description: "GNU Makefile with build, push, deploy, rollback, and logs targets",
    files: [toFile("Makefile", generateMakefile(app))],
  });

  return bundles;
}
