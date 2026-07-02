export interface LanguageConfig {
  id: string;
  label: string;
  accent: string;
  optimizedBase: string;
  dockerfile: string;
  buildCmd: string;
  defaultPort: number;
}

export const LANGUAGES: LanguageConfig[] = [
  {
    id: "node",
    label: "Node.js",
    accent: "#16a34a",
    optimizedBase: "node:20-alpine (or gcr.io/distroless/nodejs20 for the smallest, most locked-down final stage)",
    dockerfile: `FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["node", "server.js"]`,
    buildCmd: "docker build -t orders-api:1.0 .",
    defaultPort: 8080,
  },
  {
    id: "python",
    label: "Python",
    accent: "#326ce5",
    optimizedBase: "python:3.12-slim (avoid the full python:3.12 image — it's 4-5x larger for the same runtime)",
    dockerfile: `FROM python:3.12-slim AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim AS runtime
WORKDIR /app
COPY --from=deps /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
ENTRYPOINT ["python", "app.py"]`,
    buildCmd: "docker build -t orders-api:1.0 .",
    defaultPort: 8000,
  },
  {
    id: "java",
    label: "Java (Spring Boot)",
    accent: "#ea580c",
    optimizedBase: "eclipse-temurin:21-jre-alpine for the runtime stage — never ship the full JDK in production",
    dockerfile: `FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]`,
    buildCmd: "docker build -t orders-api:1.0 .",
    defaultPort: 8080,
  },
  {
    id: "go",
    label: "Go",
    accent: "#06b6d4",
    optimizedBase: "scratch or distroless/static — Go compiles to one static binary with no runtime dependency at all",
    dockerfile: `FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM scratch
COPY --from=build /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]`,
    buildCmd: "docker build -t orders-api:1.0 .",
    defaultPort: 8080,
  },
  {
    id: "dotnet",
    label: ".NET",
    accent: "#c026d3",
    optimizedBase: "mcr.microsoft.com/dotnet/aspnet:8.0-alpine for the runtime stage — the SDK image is only needed to build",
    dockerfile: `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app
COPY . .
RUN dotnet publish -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runtime
WORKDIR /app
COPY --from=build /out .
EXPOSE 8080
ENTRYPOINT ["dotnet", "OrdersApi.dll"]`,
    buildCmd: "docker build -t orders-api:1.0 .",
    defaultPort: 8080,
  },
];
