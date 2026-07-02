// Central API endpoint configuration for the merged InfraStudio + Oz product.
//
// When served behind the unified gateway the SPA lives under `/studio/`, its own
// FastAPI backend is reachable at `/studio-api/*` (gateway rewrites that prefix to
// the backend's native `/api/*`), and the Oz control-plane API is at `/api/*`.
//
// Both bases are overridable at build time via Vite env vars so the same bundle
// can run behind the gateway, in local `vite dev`, or on a custom domain.
const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

// InfraStudio's own pricing / AI / stripe / settings backend.
export const API_BASE = stripTrailingSlash(
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/studio-api',
);

// Oz control-plane API (auth, agents, servers, secrets) used by the deploy bridge.
export const OZ_API_BASE = stripTrailingSlash(
  (import.meta.env.VITE_OZ_API_BASE as string | undefined) ?? '/api',
);

// Leon AI assistant — gateway proxies `/leon/*` to leon:5366 and injects the
// x-api-key header, so the browser never holds the Leon key.
export const LEON_BASE = stripTrailingSlash(
  (import.meta.env.VITE_LEON_BASE as string | undefined) ?? '/leon',
);
