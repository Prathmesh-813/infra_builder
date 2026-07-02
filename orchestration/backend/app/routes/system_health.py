"""Aggregated system-health checks for the Oz control plane.

Each check is time-boxed and failure-isolated so the endpoint always returns
quickly with a per-component status. Exposed unauthenticated (like /api/health)
but returns only coarse status — never secret values.
"""
import asyncio
import os
import time

import httpx
from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import async_session

router = APIRouter(prefix="/api/health", tags=["health"])

OK, DEGRADED, DOWN, UNCONFIGURED = "ok", "degraded", "down", "unconfigured"


def _comp(name, category, status, latency_ms=None, message=""):
    return {"name": name, "category": category, "status": status,
            "latency_ms": latency_ms, "message": message}


async def _check_db():
    start = time.perf_counter()
    try:
        async with async_session() as s:
            await s.execute(text("SELECT 1"))
        return _comp("PostgreSQL", "Datastores", OK, round((time.perf_counter() - start) * 1000), "Connected")
    except Exception as e:  # noqa: BLE001
        return _comp("PostgreSQL", "Datastores", DOWN, None, str(e)[:120])


async def _check_redis():
    start = time.perf_counter()
    try:
        import redis.asyncio as aioredis  # redis>=4 ships asyncio client
        client = aioredis.from_url(get_settings().redis_url)
        try:
            await asyncio.wait_for(client.ping(), timeout=3)
        finally:
            await client.aclose()
        return _comp("Redis", "Datastores", OK, round((time.perf_counter() - start) * 1000), "PONG")
    except Exception as e:  # noqa: BLE001
        return _comp("Redis", "Datastores", DOWN, None, str(e)[:120])


async def _check_docker():
    start = time.perf_counter()

    def _ping():
        import docker
        client = docker.DockerClient(base_url=get_settings().docker_host)
        try:
            return client.ping()
        finally:
            client.close()

    try:
        loop = asyncio.get_event_loop()
        await asyncio.wait_for(loop.run_in_executor(None, _ping), timeout=4)
        return _comp("Docker engine", "Runtime", OK, round((time.perf_counter() - start) * 1000), "Reachable")
    except Exception as e:  # noqa: BLE001
        return _comp("Docker engine", "Runtime", DOWN, None, str(e)[:120])


async def _http(name, category, url, headers=None, timeout=4):
    # Empty OR protocol-less values mean "not wired up" — not a failure.
    if not url or not str(url).startswith(("http://", "https://")):
        return _comp(name, category, UNCONFIGURED, None, "Not configured")
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, headers=headers or {})
        ms = round((time.perf_counter() - start) * 1000)
        # Any non-5xx response means the endpoint is reachable.
        return _comp(name, category, OK if r.status_code < 500 else DEGRADED, ms, f"HTTP {r.status_code}")
    except Exception as e:  # noqa: BLE001
        return _comp(name, category, DOWN, None, str(e)[:120])


async def _check_openrouter():
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        return _comp("OpenRouter", "AI providers", UNCONFIGURED, None, "No API key set")
    return await _http("OpenRouter", "AI providers", "https://openrouter.ai/api/v1/models",
                       headers={"Authorization": f"Bearer {key}"})


@router.get("/system")
async def system_health():
    s = get_settings()
    results = await asyncio.gather(
        _check_db(),
        _check_redis(),
        _check_docker(),
        _http("Leon assistant", "Services", s.leon_http_url),
        _http("Cloudflare · Docker agent", "Edge (Cloudflare)", s.cf_docker_agent_url),
        _http("Cloudflare · Health agent", "Edge (Cloudflare)", s.cf_server_health_agent_url),
        _http("Cloudflare · Proxmox agent", "Edge (Cloudflare)", s.cf_proxmox_agent_url),
        _check_openrouter(),
        return_exceptions=False,
    )
    components = [_comp("Oz API", "Core", OK, 0, "Operational"), *results]
    return {"service": "oz", "components": components}
