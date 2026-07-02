import type { DetectedApp } from "../types";

const NODE_BASE_IMAGE: Record<string, string> = {
  "18": "node:18-alpine",
  "20": "node:20-alpine",
  "21": "node:21-alpine",
  "22": "node:22-alpine",
};

export function generateDockerfile(app: DetectedApp): string {
  const { language, framework, languageVersion, port, packageManager: pm } = app;

  // ── Node.js ────────────────────────────────────────────────────────────────
  if (language === "nodejs") {
    const base = NODE_BASE_IMAGE[languageVersion] ?? "node:20-alpine";
    const installCmd =
      pm === "pnpm" ? "RUN corepack enable && corepack prepare pnpm@latest --activate\nRUN pnpm install --frozen-lockfile --prod"
      : pm === "yarn" ? "RUN yarn install --frozen-lockfile --production"
      : pm === "bun"  ? "RUN bun install --production"
      : "RUN npm ci --only=production";

    const buildInstall =
      pm === "pnpm" ? "RUN pnpm install --frozen-lockfile"
      : pm === "yarn" ? "RUN yarn install --frozen-lockfile"
      : pm === "bun"  ? "RUN bun install"
      : "RUN npm ci";

    const buildCmd =
      pm === "pnpm" ? "RUN pnpm run build"
      : pm === "yarn" ? "RUN yarn build"
      : pm === "bun"  ? "RUN bun run build"
      : "RUN npm run build";

    const lockFile =
      pm === "pnpm" ? "pnpm-lock.yaml"
      : pm === "yarn" ? "yarn.lock"
      : pm === "bun"  ? "bun.lockb"
      : "package-lock.json";

    if (framework === "nextjs") {
      return `# ── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM ${base} AS deps
WORKDIR /app
COPY package.json ${lockFile} ./
${buildInstall}

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM ${base} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.js should enable output: "standalone" for optimal Docker images
${buildCmd}

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM ${base} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \\
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

USER nextjs
EXPOSE ${port}
ENV PORT=${port}
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
`;
    }

    if (framework === "nestjs") {
      return `# ── Stage 1: Dependencies ─────────────────────────────────────────────────
FROM ${base} AS deps
WORKDIR /app
COPY package.json ${lockFile} ./
${buildInstall}

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM ${base} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
${buildCmd}

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM ${base} AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \\
    adduser  --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/dist         ./dist
COPY --from=deps    --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY package.json ./

USER nestjs
EXPOSE ${port}
CMD ["node", "dist/main.js"]
`;
    }

    // Generic Node.js (express / fastify / hono / etc.)
    return `# ── Stage 1: Production dependencies ─────────────────────────────────────────
FROM ${base} AS deps
WORKDIR /app
COPY package.json ${lockFile} ./
${installCmd}

# ── Stage 2: Build (if TypeScript) ────────────────────────────────────────────
FROM ${base} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
${buildCmd}

# ── Stage 3: Runner ───────────────────────────────────────────────────────────
FROM ${base} AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \\
    adduser  --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist         ./dist
COPY --from=deps    --chown=appuser:nodejs /app/node_modules ./node_modules
COPY package.json ./

USER appuser
EXPOSE ${port}
CMD ["node", "dist/index.js"]
`;
  }

  // ── Python ─────────────────────────────────────────────────────────────────
  if (language === "python") {
    const poetryInstall = app.packageManager === "poetry"
      ? `RUN pip install poetry && \\
    poetry config virtualenvs.create false && \\
    poetry install --only main --no-interaction`
      : `COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt`;

    const uvInstall = app.packageManager === "uv"
      ? `RUN pip install uv && uv sync --frozen`
      : poetryInstall;

    const installBlock = app.packageManager === "uv" ? uvInstall : poetryInstall;

    const startCmd = app.startCmd || `uvicorn main:app --host 0.0.0.0 --port ${port} --workers 4`;

    return `# ── Stage 1: Build wheels ─────────────────────────────────────────────────
FROM python:${languageVersion}-slim AS builder
WORKDIR /app
RUN pip install --upgrade pip
${app.packageManager === "pip" ? `COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt` : installBlock}

# ── Stage 2: Runner ────────────────────────────────────────────────────────────
FROM python:${languageVersion}-slim
WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && \\
    adduser  --system --uid 1001 appuser --ingroup appgroup

${app.packageManager === "pip" ? `COPY --from=builder /wheels /wheels
RUN pip install --no-cache /wheels/*` : `COPY --from=builder /app .`}
COPY . .

USER appuser
EXPOSE ${port}
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PORT=${port}

CMD ${JSON.stringify(startCmd.split(" "))}
`;
  }

  // ── Go ─────────────────────────────────────────────────────────────────────
  if (language === "go") {
    return `# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM golang:${languageVersion}-alpine AS builder
WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \\
    go build -ldflags="-w -s" -o /app/server .

# ── Stage 2: Minimal runner ────────────────────────────────────────────────────
FROM scratch
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/server /server

EXPOSE ${port}
ENV PORT=${port}
ENTRYPOINT ["/server"]
`;
  }

  // ── Java / Spring Boot ─────────────────────────────────────────────────────
  if (language === "java") {
    const buildTool = app.packageManager === "gradle";
    return `# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM eclipse-temurin:${languageVersion}-jdk-alpine AS builder
WORKDIR /app

${buildTool ? `COPY gradlew build.gradle* settings.gradle* ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test` : `COPY mvnw pom.xml ./
COPY .mvn ./.mvn
RUN chmod +x mvnw && ./mvnw dependency:go-offline
COPY src ./src
RUN ./mvnw package -DskipTests --no-transfer-progress`}

# ── Stage 2: Layered runner ────────────────────────────────────────────────────
FROM eclipse-temurin:${languageVersion}-jre-alpine
WORKDIR /app

RUN addgroup --system --gid 1001 spring && \\
    adduser  --system --uid 1001 spring --ingroup spring

${buildTool
  ? `COPY --from=builder --chown=spring:spring /app/build/libs/*.jar app.jar`
  : `COPY --from=builder --chown=spring:spring /app/target/*.jar app.jar`}

USER spring
EXPOSE ${port}
ENV JAVA_OPTS="-Xmx512m -Xms256m"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
`;
  }

  // ── Rust ──────────────────────────────────────────────────────────────────
  if (language === "rust") {
    return `# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM rust:1-alpine AS builder
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
# Cache dependencies by building a dummy main first
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm src/main.rs
COPY src ./src
RUN touch src/main.rs && cargo build --release

# ── Stage 2: Minimal runner ────────────────────────────────────────────────────
FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/target/release/app ./app
EXPOSE ${port}
ENV PORT=${port}
CMD ["./app"]
`;
  }

  // ── Ruby / Rails ──────────────────────────────────────────────────────────
  if (language === "ruby") {
    return `FROM ruby:${languageVersion}-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \\
    build-essential libpq-dev nodejs yarn curl && \\
    rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3 --without development test

COPY . .
${framework === "rails" ? "RUN bundle exec rails assets:precompile" : ""}
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE ${port}
ENV RAILS_ENV=production \\
    PORT=${port}

CMD ${JSON.stringify(app.startCmd.split(" "))}
`;
  }

  // ── PHP / Laravel ─────────────────────────────────────────────────────────
  if (language === "php") {
    return `FROM php:8.3-fpm-alpine
WORKDIR /var/www

RUN apk add --no-cache nginx supervisor curl zip unzip git && \\
    docker-php-ext-install pdo pdo_mysql opcache

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

COPY . .
RUN chown -R www-data:www-data /var/www && \\
    chmod -R 755 /var/www/storage

${framework === "laravel" ? "RUN php artisan key:generate --force && php artisan config:cache && php artisan route:cache" : ""}

EXPOSE ${port}
CMD ["php-fpm"]
`;
  }

  // ── .NET ──────────────────────────────────────────────────────────────────
  if (language === "csharp") {
    return `# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:${languageVersion} AS builder
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# ── Stage 2: Runner ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:${languageVersion}
WORKDIR /app
COPY --from=builder /app/publish .

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser /app
USER appuser

EXPOSE ${port}
ENV ASPNETCORE_URLS=http://+:${port}
ENTRYPOINT ["dotnet", "*.dll"]
`;
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  return `# Generic Dockerfile — adjust to your language/framework
FROM ubuntu:22.04
WORKDIR /app

# Install your runtime here, e.g.:
# RUN apt-get update && apt-get install -y <your-runtime>

COPY . .

EXPOSE ${port}
CMD ["echo", "Replace this with your start command"]
`;
}
