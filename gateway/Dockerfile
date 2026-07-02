# Unified gateway for the single-suite product.
# Stage 1 builds the InfraStudio React SPA — now the ONE product UI, served at
# the gateway root `/`. Stage 2 is a single nginx that serves the SPA and
# reverse-proxies the three backends:
#   /api         -> Oz control plane
#   /studio-api  -> InfraStudio pricing/AI backend
#   /leon        -> Leon assistant (x-api-key injected here)
#
# Build context is the repo root. See the root .dockerignore for exclusions.

# ---- Stage 1: build the unified SPA ----
FROM node:20-alpine AS studio
WORKDIR /studio
COPY infra_builder/package.json infra_builder/package-lock.json ./
RUN npm ci
COPY infra_builder/ ./
# Gateway-relative API bases baked into the bundle.
ENV VITE_API_BASE=/studio-api \
    VITE_OZ_API_BASE=/api \
    VITE_LEON_BASE=/leon
RUN npm run build

# ---- Stage 2: nginx gateway ----
FROM nginx:alpine
# The unified InfraStudio SPA is the web root.
COPY --from=studio /studio/dist/ /usr/share/nginx/html/
# Gateway routing config.
COPY gateway/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
