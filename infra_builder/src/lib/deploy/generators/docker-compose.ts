import type { DetectedApp } from "../types";

export function generateDockerCompose(app: DetectedApp): string {
  const { repoName, port, language, framework } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "-");

  const dbService = language === "python" || language === "nodejs" || language === "java" || language === "ruby" || language === "php"
    ? `
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${slug}_db
      POSTGRES_USER: ${slug}_user
      POSTGRES_PASSWORD: changeme_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${slug}_user -d ${slug}_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5`
    : "";

  const appDependsOn = dbService
    ? `    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy`
    : "";

  const envBlock = buildEnvBlock(app);

  const nginxService = framework === "nextjs" || framework === "react" || framework === "vite"
    ? `
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app`
    : "";

  const volumes = dbService
    ? `\nvolumes:\n  postgres_data:\n  redis_data:`
    : "";

  return `# Docker Compose — ${repoName}
# Usage:
#   docker compose up -d           # start all services
#   docker compose logs -f app     # stream app logs
#   docker compose down -v         # stop + remove volumes

version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${port}:${port}"
    environment:
${envBlock}
    env_file:
      - .env
${appDependsOn}
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:${port}/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"${dbService}${nginxService}${volumes}

networks:
  app-network:
    driver: bridge
`;
}

function buildEnvBlock(app: DetectedApp): string {
  const lines: string[] = [];
  const { language, framework, repoName, port } = app;
  const slug = repoName.toLowerCase().replace(/[^a-z0-9]/g, "_");

  lines.push(`      NODE_ENV: production`);
  lines.push(`      PORT: "${port}"`);

  if (language === "nodejs") {
    if (framework === "nextjs") {
      lines.push(`      NEXT_TELEMETRY_DISABLED: "1"`);
      lines.push(`      NEXTAUTH_URL: http://localhost:${port}`);
      lines.push(`      NEXTAUTH_SECRET: "change-me-in-production"`);
    }
    lines.push(`      DATABASE_URL: "postgresql://${slug}_user:changeme_password@postgres:5432/${slug}_db"`);
    lines.push(`      REDIS_URL: "redis://redis:6379"`);
  }

  if (language === "python") {
    lines.splice(0, 1); // remove NODE_ENV
    lines.push(`      PYTHON_ENV: production`);
    lines.push(`      DATABASE_URL: "postgresql://${slug}_user:changeme_password@postgres:5432/${slug}_db"`);
    lines.push(`      REDIS_URL: "redis://redis:6379"`);
    lines.push(`      SECRET_KEY: "change-me-in-production"`);
  }

  if (language === "java") {
    lines.splice(0, 1);
    lines.push(`      SPRING_PROFILES_ACTIVE: prod`);
    lines.push(`      SPRING_DATASOURCE_URL: "jdbc:postgresql://postgres:5432/${slug}_db"`);
    lines.push(`      SPRING_DATASOURCE_USERNAME: ${slug}_user`);
    lines.push(`      SPRING_DATASOURCE_PASSWORD: changeme_password`);
  }

  if (language === "go") {
    lines.splice(0, 1);
    lines.push(`      GIN_MODE: release`);
    lines.push(`      DATABASE_URL: "postgresql://${slug}_user:changeme_password@postgres:5432/${slug}_db"`);
  }

  return lines.join("\n");
}
