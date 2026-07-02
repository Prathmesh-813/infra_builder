// ─── TechAtlas Deploy Wizard — CI/CD Pipeline Generators ─────────────────────
// Generates pipeline configs for 10 CI/CD platforms.

import type { DetectedApp } from "../types";

// ── 1. GitHub Actions ─────────────────────────────────────────────────────────

export function generateGithubActions(app: DetectedApp): string {
  const pkgInstall =
    app.packageManager === "yarn"  ? "yarn install --frozen-lockfile"
    : app.packageManager === "pnpm" ? "pnpm install --frozen-lockfile"
    : app.packageManager === "bun"  ? "bun install"
    : app.language === "python"     ? "pip install -r requirements.txt"
    : app.language === "go"         ? "go mod download"
    : app.language === "java"       ? "mvn dependency:resolve -q"
    : app.language === "rust"       ? "cargo fetch"
    : "npm ci";

  const testCmd =
    app.language === "python" ? "pytest --tb=short -q"
    : app.language === "go"   ? "go test ./..."
    : app.language === "java" ? "mvn test -q"
    : app.language === "rust" ? "cargo test"
    : "npm test --if-present";

  return `# GitHub Actions — Deploy pipeline for ${app.repoName}
name: CI/CD

on:
  push:
    branches: [ main, master, ${app.defaultBranch} ]
  pull_request:
    branches: [ main, master ]

env:
  REGISTRY: ghcr.io
  IMAGE: ghcr.io/\${{ github.repository }}

jobs:
  test:
    name: Test
    runs-on: ubuntu-22.04
    steps:
      - uses: actions/checkout@v4

      - name: Set up runtime
        uses: ${
          app.language === "python" ? "actions/setup-python@v5\n        with:\n          python-version: '3.12'\n          cache: pip"
          : app.language === "go"   ? "actions/setup-go@v5\n        with:\n          go-version: '1.22'\n          cache: true"
          : app.language === "java" ? "actions/setup-java@v4\n        with:\n          distribution: temurin\n          java-version: '21'\n          cache: maven"
          : app.language === "rust" ? "dtolnay/rust-toolchain@stable"
          : `actions/setup-node@v4\n        with:\n          node-version: '20'\n          cache: '${app.packageManager ?? "npm"}'`
        }

      - name: Install dependencies
        run: ${pkgInstall}

      - name: Run tests
        run: ${testCmd}

  build-and-push:
    name: Build & Push
    needs: test
    runs-on: ubuntu-22.04
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.IMAGE }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    name: Deploy
    needs: build-and-push
    runs-on: ubuntu-22.04
    environment: production
    steps:
      - name: Deploy to production
        run: |
          echo "Deploy image: \${{ env.IMAGE }}:sha-\${{ github.sha }}"
          # Add your deployment command here:
          # kubectl set image deployment/${app.repoName} app=\${{ env.IMAGE }}:sha-\${{ github.sha }}
          # or: helm upgrade ${app.repoName} ./chart --set image.tag=sha-\${{ github.sha }}
`;
}

// ── 2. GitLab CI ──────────────────────────────────────────────────────────────

export function generateGitlabCi(app: DetectedApp): string {
  return `# GitLab CI/CD — ${app.repoName}
image: docker:24

variables:
  DOCKER_TLS_CERTDIR: "/certs"
  IMAGE: \${CI_REGISTRY_IMAGE}:\${CI_COMMIT_SHORT_SHA}

stages:
  - test
  - build
  - deploy

# ── Test ──────────────────────────────────────────────────────────────────────
test:
  stage: test
  image: ${
    app.language === "python" ? "python:3.12-slim"
    : app.language === "go"   ? "golang:1.22-alpine"
    : app.language === "java" ? "maven:3.9-eclipse-temurin-21"
    : app.language === "rust" ? "rust:1.77-slim"
    : "node:20-alpine"
  }
  script:
    - ${
      app.language === "python" ? "pip install -r requirements.txt && pytest -q"
      : app.language === "go"   ? "go test ./..."
      : app.language === "java" ? "mvn test -q"
      : app.language === "rust" ? "cargo test"
      : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
    }
  cache:
    key: \${CI_COMMIT_REF_SLUG}
    paths:
      - ${app.language === "python" ? ".cache/pip" : app.language === "go" ? "$GOPATH/pkg/mod" : "node_modules/"}

# ── Build ─────────────────────────────────────────────────────────────────────
build:
  stage: build
  services:
    - docker:24-dind
  before_script:
    - docker login -u \$CI_REGISTRY_USER -p \$CI_REGISTRY_PASSWORD \$CI_REGISTRY
  script:
    - docker build --pull -t \$IMAGE -t \${CI_REGISTRY_IMAGE}:latest .
    - docker push \$IMAGE
    - docker push \${CI_REGISTRY_IMAGE}:latest
  only:
    - main
    - master

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://\${PRODUCTION_URL}
  script:
    - kubectl set image deployment/${app.repoName} app=\$IMAGE
    - kubectl rollout status deployment/${app.repoName}
  only:
    - main
    - master
  when: manual
`;
}

// ── 3. Jenkins (Declarative Pipeline) ─────────────────────────────────────────

export function generateJenkins(app: DetectedApp): string {
  return `// Jenkinsfile — ${app.repoName}
pipeline {
  agent {
    docker {
      image 'docker:24-dind'
      args  '-v /var/run/docker.sock:/var/run/docker.sock'
    }
  }

  environment {
    REGISTRY    = 'your-registry.example.com'
    IMAGE       = "\${REGISTRY}/${app.repoOwner}/${app.repoName}"
    KUBE_CONFIG = credentials('kubeconfig-prod')
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Test') {
      agent {
        docker {
          image '${
            app.language === "python" ? "python:3.12-slim"
            : app.language === "go"   ? "golang:1.22-alpine"
            : app.language === "java" ? "maven:3.9-eclipse-temurin-21"
            : "node:20-alpine"
          }'
          reuseNode true
        }
      }
      steps {
        sh '''
          ${
            app.language === "python" ? "pip install -r requirements.txt && pytest -q"
            : app.language === "go"   ? "go test ./..."
            : app.language === "java" ? "mvn test -q"
            : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
          }
        '''
      }
    }

    stage('Build & Push Docker') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'registry-creds',
          usernameVariable: 'DOCKER_USER',
          passwordVariable: 'DOCKER_PASS'
        )]) {
          sh """
            docker login -u \${DOCKER_USER} -p \${DOCKER_PASS} \${REGISTRY}
            docker build -t \${IMAGE}:\${GIT_COMMIT[0..7]} -t \${IMAGE}:latest .
            docker push \${IMAGE}:\${GIT_COMMIT[0..7]}
            docker push \${IMAGE}:latest
          """
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig-prod', variable: 'KUBECONFIG')]) {
          sh """
            kubectl set image deployment/${app.repoName} app=\${IMAGE}:\${GIT_COMMIT[0..7]}
            kubectl rollout status deployment/${app.repoName} --timeout=5m
          """
        }
      }
    }
  }

  post {
    success { echo "Pipeline succeeded! Image: \${IMAGE}:\${GIT_COMMIT[0..7]}" }
    failure { emailext subject: "BUILD FAILED: ${app.repoName}", body: "Check \${BUILD_URL}", to: '$DEFAULT_RECIPIENTS' }
  }
}
`;
}

// ── 4. CircleCI ───────────────────────────────────────────────────────────────

export function generateCircleCI(app: DetectedApp): string {
  return `# CircleCI — ${app.repoName}
version: 2.1

orbs:
  docker: circleci/docker@2.6.0

executors:
  app-executor:
    docker:
      - image: cimg/${
          app.language === "python" ? "python:3.12"
          : app.language === "go"   ? "go:1.22"
          : app.language === "java" ? "openjdk:21"
          : "node:20.11"
        }
    working_directory: ~/repo

jobs:
  test:
    executor: app-executor
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-deps-{{ checksum "${
              app.language === "python" ? "requirements.txt"
              : app.language === "go"   ? "go.sum"
              : app.language === "java" ? "pom.xml"
              : "package-lock.json"
            }" }}
      - run:
          name: Install dependencies
          command: |
            ${
              app.language === "python" ? "pip install -r requirements.txt"
              : app.language === "go"   ? "go mod download"
              : app.language === "java" ? "mvn dependency:resolve -q"
              : `${app.packageManager ?? "npm"} ci`
            }
      - save_cache:
          key: v1-deps-{{ checksum "${
            app.language === "python" ? "requirements.txt"
            : app.language === "go"   ? "go.sum"
            : app.language === "java" ? "pom.xml"
            : "package-lock.json"
          }" }}
          paths:
            - ${app.language === "python" ? "~/.cache/pip" : app.language === "go" ? "~/go/pkg/mod" : "node_modules"}
      - run:
          name: Run tests
          command: |
            ${
              app.language === "python" ? "pytest -q"
              : app.language === "go"   ? "go test ./..."
              : app.language === "java" ? "mvn test -q"
              : `${app.packageManager ?? "npm"} test --if-present`
            }

  build-push:
    executor: docker/machine
    steps:
      - checkout
      - docker/build:
          image: $DOCKER_USERNAME/${app.repoName}
          tag:   $CIRCLE_SHA1
      - docker/push:
          image: $DOCKER_USERNAME/${app.repoName}
          tag:   $CIRCLE_SHA1

  deploy:
    executor: app-executor
    steps:
      - run:
          name: Deploy to Kubernetes
          command: |
            kubectl set image deployment/${app.repoName} \\
              app=$DOCKER_USERNAME/${app.repoName}:$CIRCLE_SHA1
            kubectl rollout status deployment/${app.repoName}

workflows:
  ci-cd:
    jobs:
      - test
      - build-push:
          requires: [ test ]
          filters:
            branches:
              only: [ main, master ]
      - deploy:
          requires: [ build-push ]
          filters:
            branches:
              only: [ main, master ]
`;
}

// ── 5. Azure DevOps ───────────────────────────────────────────────────────────

export function generateAzureDevOps(app: DetectedApp): string {
  return `# Azure Pipelines — ${app.repoName}
trigger:
  branches:
    include: [ main, master ]

pr:
  branches:
    include: [ main, master ]

pool:
  vmImage: ubuntu-22.04

variables:
  REGISTRY:       $(containerRegistry)
  IMAGE:          $(REGISTRY)/${app.repoOwner}/${app.repoName}
  TAG:            $(Build.SourceVersion)

stages:

# ── Test ──────────────────────────────────────────────────────────────────────
- stage: Test
  jobs:
  - job: RunTests
    container: ${
      app.language === "python" ? "python:3.12-slim"
      : app.language === "go"   ? "golang:1.22-alpine"
      : app.language === "java" ? "maven:3.9-eclipse-temurin-21-alpine"
      : "node:20-alpine"
    }
    steps:
    - script: |
        ${
          app.language === "python" ? "pip install -r requirements.txt && pytest -q"
          : app.language === "go"   ? "go test ./..."
          : app.language === "java" ? "mvn test -q"
          : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
        }
      displayName: Run tests

# ── Build ─────────────────────────────────────────────────────────────────────
- stage: Build
  dependsOn: Test
  condition: and(succeeded(), ne(variables['Build.Reason'], 'PullRequest'))
  jobs:
  - job: DockerBuild
    steps:
    - task: Docker@2
      displayName: Build and push image
      inputs:
        command:          buildAndPush
        containerRegistry: $(containerRegistryServiceConnection)
        repository:       ${app.repoOwner}/${app.repoName}
        tags:             |
          $(TAG)
          latest

# ── Deploy ────────────────────────────────────────────────────────────────────
- stage: Deploy
  dependsOn: Build
  jobs:
  - deployment: DeployProd
    environment: production
    strategy:
      runOnce:
        deploy:
          steps:
          - task: KubernetesManifest@1
            displayName: Deploy to AKS
            inputs:
              action:         deploy
              kubernetesServiceConnection: $(aksServiceConnection)
              namespace:       ${app.repoName}
              manifests:       k8s/*.yaml
              containers:      $(IMAGE):$(TAG)
`;
}

// ── 6. Bitbucket Pipelines ────────────────────────────────────────────────────

export function generateBitbucketPipelines(app: DetectedApp): string {
  return `# Bitbucket Pipelines — ${app.repoName}
image: atlassian/default-image:4

definitions:
  services:
    docker:
      memory: 2048

  caches:
    ${app.language === "python" ? "pip: ~/.cache/pip" : app.language === "go" ? "gomodcache: ~/go/pkg/mod" : "npm: node_modules"}

  steps:
    - step: &test
        name: Test
        image: ${
          app.language === "python" ? "python:3.12-slim"
          : app.language === "go"   ? "golang:1.22-alpine"
          : app.language === "java" ? "maven:3.9-eclipse-temurin-21-alpine"
          : "node:20-alpine"
        }
        caches:
          - ${app.language === "python" ? "pip" : app.language === "go" ? "gomodcache" : "npm"}
        script:
          - ${
            app.language === "python" ? "pip install -r requirements.txt && pytest -q"
            : app.language === "go"   ? "go test ./..."
            : app.language === "java" ? "mvn test -q"
            : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
          }

    - step: &build-push
        name: Build & Push
        services: [ docker ]
        script:
          - docker login -u $DOCKER_USER -p $DOCKER_PASS
          - docker build -t $DOCKER_USER/${app.repoName}:$BITBUCKET_COMMIT .
          - docker push $DOCKER_USER/${app.repoName}:$BITBUCKET_COMMIT

    - step: &deploy
        name: Deploy
        deployment: production
        script:
          - pipe: atlassian/kubectl-run:2.3.0
            variables:
              KUBE_CONFIG:   $KUBE_CONFIG
              KUBECTL_COMMAND: >-
                set image deployment/${app.repoName}
                app=$DOCKER_USER/${app.repoName}:$BITBUCKET_COMMIT

pipelines:
  default:
    - step: *test

  branches:
    main:
      - step: *test
      - step: *build-push
      - step: *deploy
`;
}

// ── 7. Bamboo ─────────────────────────────────────────────────────────────────

export function generateBamboo(app: DetectedApp): string {
  return `---
# Bamboo Specs — ${app.repoName}
version: 2

plan:
  project-key: OPS
  key:         ${app.repoName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)}
  name:        ${app.repoName} CI/CD

stages:

  - Test:
      jobs:
        - Run Tests:
            key:  TEST
            tasks:
              - script:
                  interpreter: SHELL
                  scripts:
                    - |
                      ${
                        app.language === "python" ? "pip install -r requirements.txt && pytest -q"
                        : app.language === "go"   ? "go test ./..."
                        : app.language === "java" ? "mvn test -q"
                        : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
                      }

  - Build:
      jobs:
        - Docker Build:
            key:  DOCKER
            tasks:
              - script:
                  interpreter: SHELL
                  scripts:
                    - |
                      docker build \\
                        -t \${bamboo.REGISTRY}/${app.repoOwner}/${app.repoName}:\${bamboo.planKey}-\${bamboo.buildNumber} \\
                        -t \${bamboo.REGISTRY}/${app.repoOwner}/${app.repoName}:latest .
                      docker push \${bamboo.REGISTRY}/${app.repoOwner}/${app.repoName}:\${bamboo.planKey}-\${bamboo.buildNumber}

  - Deploy:
      jobs:
        - Deploy to Prod:
            key:  DEPLOY
            tasks:
              - script:
                  interpreter: SHELL
                  scripts:
                    - |
                      kubectl set image deployment/${app.repoName} \\
                        app=\${bamboo.REGISTRY}/${app.repoOwner}/${app.repoName}:\${bamboo.planKey}-\${bamboo.buildNumber}
                      kubectl rollout status deployment/${app.repoName}

triggers:
  - polling:
      period: "* * * * *"

branches:
  create: for-pull-request
  delete:
    after-deleted-days: 1
    after-inactive-days: 30

branch-overrides:
  - main:
      triggers:
        - polling:
            period: "* * * * *"
`;
}

// ── 8. Travis CI ──────────────────────────────────────────────────────────────

export function generateTravisCI(app: DetectedApp): string {
  const lang =
    app.language === "python" ? "python"
    : app.language === "go"   ? "go"
    : app.language === "java" ? "java"
    : app.language === "rust" ? "rust"
    : "node_js";

  return `# Travis CI — ${app.repoName}
language: ${lang}

${
  lang === "node_js" ? "node_js:\n  - '20'"
  : lang === "python" ? "python:\n  - '3.12'"
  : lang === "go"     ? "go:\n  - '1.22.x'"
  : lang === "java"   ? "jdk:\n  - openjdk21"
  : lang === "rust"   ? "rust:\n  - stable"
  : ""
}

services:
  - docker

cache:
  directories:
    - ${
        app.language === "python" ? "~/.cache/pip"
        : app.language === "go"   ? "$GOPATH/pkg/mod"
        : "$HOME/.npm"
      }

install:
  - ${
    app.language === "python" ? "pip install -r requirements.txt"
    : app.language === "go"   ? "go mod download"
    : app.language === "java" ? "mvn dependency:resolve -q"
    : app.language === "rust" ? "cargo fetch"
    : `${app.packageManager ?? "npm"} ci`
  }

script:
  - ${
    app.language === "python" ? "pytest -q"
    : app.language === "go"   ? "go test ./..."
    : app.language === "java" ? "mvn test -q"
    : app.language === "rust" ? "cargo test"
    : `${app.packageManager ?? "npm"} test --if-present`
  }

before_deploy:
  - docker login -u "\$DOCKER_USER" -p "\$DOCKER_PASS"
  - docker build -t \$DOCKER_USER/${app.repoName}:\$TRAVIS_COMMIT .
  - docker push \$DOCKER_USER/${app.repoName}:\$TRAVIS_COMMIT

deploy:
  provider: script
  script: |
    kubectl set image deployment/${app.repoName} \\
      app=\$DOCKER_USER/${app.repoName}:\$TRAVIS_COMMIT && \\
    kubectl rollout status deployment/${app.repoName}
  on:
    branch: main
`;
}

// ── 9. Drone CI ───────────────────────────────────────────────────────────────

export function generateDroneCI(app: DetectedApp): string {
  return `# Drone CI — ${app.repoName}
kind: pipeline
type: docker
name: default

steps:

  - name: test
    image: ${
      app.language === "python" ? "python:3.12-slim"
      : app.language === "go"   ? "golang:1.22-alpine"
      : app.language === "java" ? "maven:3.9-eclipse-temurin-21-alpine"
      : "node:20-alpine"
    }
    commands:
      - ${
        app.language === "python" ? "pip install -r requirements.txt && pytest -q"
        : app.language === "go"   ? "go test ./..."
        : app.language === "java" ? "mvn test -q"
        : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
      }

  - name: build-push
    image: plugins/docker
    settings:
      repo:     \${DRONE_REPO_OWNER}/${app.repoName}
      tags:
        - \${DRONE_COMMIT_SHA:0:7}
        - latest
      username:
        from_secret: docker_username
      password:
        from_secret: docker_password
    when:
      branch: [ main, master ]

  - name: deploy
    image: bitnami/kubectl
    environment:
      KUBECONFIG_DATA:
        from_secret: kubeconfig
    commands:
      - echo "\$KUBECONFIG_DATA" | base64 -d > /tmp/kubeconfig
      - export KUBECONFIG=/tmp/kubeconfig
      - |
        kubectl set image deployment/${app.repoName} \\
          app=\${DRONE_REPO_OWNER}/${app.repoName}:\${DRONE_COMMIT_SHA:0:7}
      - kubectl rollout status deployment/${app.repoName}
    when:
      branch: [ main, master ]
      event:  [ push ]
`;
}

// ── 10. TeamCity ─────────────────────────────────────────────────────────────

export function generateTeamCity(app: DetectedApp): string {
  return `// TeamCity Kotlin DSL — ${app.repoName}
// Place this file in .teamcity/settings.kts

import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildSteps.dockerCommand
import jetbrains.buildServer.configs.kotlin.buildSteps.script
import jetbrains.buildServer.configs.kotlin.triggers.vcs

version = "2024.03"

project {
  buildType(Test)
  buildType(BuildPush)
  buildType(Deploy)
}

object Test : BuildType({
  name = "Test"
  vcs {
    root(DslContext.settingsRoot)
  }
  steps {
    script {
      name = "Run tests"
      scriptContent = """
        ${
          app.language === "python" ? "pip install -r requirements.txt && pytest -q"
          : app.language === "go"   ? "go test ./..."
          : app.language === "java" ? "mvn test -q"
          : `${app.packageManager ?? "npm"} ci && ${app.packageManager ?? "npm"} test --if-present`
        }
      """.trimIndent()
      dockerImage = "${
        app.language === "python" ? "python:3.12-slim"
        : app.language === "go"   ? "golang:1.22-alpine"
        : app.language === "java" ? "maven:3.9-eclipse-temurin-21-alpine"
        : "node:20-alpine"
      }"
    }
  }
  triggers { vcs { branchFilter = "+:<default>" } }
})

object BuildPush : BuildType({
  name = "Build & Push"
  dependencies { snapshot(Test) {} }
  steps {
    script {
      name = "Docker build and push"
      scriptContent = """
        docker build -t %env.REGISTRY%/${app.repoOwner}/${app.repoName}:%build.vcs.number% .
        docker push %env.REGISTRY%/${app.repoOwner}/${app.repoName}:%build.vcs.number%
      """.trimIndent()
    }
  }
  params {
    param("env.REGISTRY", "your-registry.example.com")
  }
})

object Deploy : BuildType({
  name = "Deploy to Production"
  dependencies { snapshot(BuildPush) {} }
  steps {
    script {
      name = "kubectl rollout"
      scriptContent = """
        kubectl set image deployment/${app.repoName} \\
          app=%env.REGISTRY%/${app.repoOwner}/${app.repoName}:%build.vcs.number%
        kubectl rollout status deployment/${app.repoName}
      """.trimIndent()
    }
  }
  params {
    param("env.REGISTRY", "your-registry.example.com")
  }
})
`;
}
