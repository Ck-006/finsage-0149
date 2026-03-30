# backend/services/redis_client.py
"""
Redis caching layer with graceful degradation.
If Redis is not available, all cache operations are no-ops and
the app continues to function normally without caching.
"""

import json
import os
from typing import Any, Optional

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_pool = None
_redis_available = True  # optimistic; set False on first connection failure


async def _get_client():
    """Return a Redis client, or None if Redis is unavailable."""
    global _pool, _redis_available

    if not _redis_available:
        return None

    try:
        import redis.asyncio as redis  # type: ignore

        if _pool is None:
            _pool = redis.ConnectionPool.from_url(
                REDIS_URL,
                decode_responses=True,
                max_connections=20,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        client = redis.Redis(connection_pool=_pool)
        # Quick ping to verify connectivity
        await client.ping()
        return client

    except ImportError:
        _redis_available = False
        return None
    except Exception:
        _redis_available = False
        return None


async def get_redis():
    """Alias — returns Redis client or None."""
    return await _get_client()


# ── Cache primitives ──────────────────────────────────────────────────────────

async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Cache any JSON-serialisable value. TTL in seconds. Returns True on success."""
    client = await _get_client()
    if client is None:
        return False
    try:
        await client.setex(key, ttl, json.dumps(value))
        return True
    except Exception:
        return False


async def cache_get(key: str) -> Optional[Any]:
    """Return cached value or None if expired/missing."""
    client = await _get_client()
    if client is None:
        return None
    try:
        data = await client.get(key)
        if data is None:
            return None
        return json.loads(data)
    except Exception:
        return None


async def cache_delete(key: str) -> None:
    client = await _get_client()
    if client is None:
        return
    try:
        await client.delete(key)
    except Exception:
        pass


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern, e.g. 'user:123:*'."""
    client = await _get_client()
    if client is None:
        return
    try:
        async for key in client.scan_iter(pattern):
            await client.delete(key)
    except Exception:
        pass


# ── Session helpers ───────────────────────────────────────────────────────────

async def user_session_set(user_id: str, data: dict, ttl: int = 3600) -> None:
    await cache_set(f"session:{user_id}", data, ttl)


async def user_session_get(user_id: str) -> Optional[dict]:
    return await cache_get(f"session:{user_id}")


async def user_data_invalidate(user_id: str) -> None:
    """Call after any write operation to clear all of a user's cached data."""
    await cache_delete_pattern(f"user:{user_id}:*")
    await cache_delete_pattern(f"session:{user_id}*")


# ── Convenience key builders ──────────────────────────────────────────────────
# Use these to avoid typos across endpoints.

def key_dashboard(uid: str)    -> str: return f"user:{uid}:dashboard"
def key_transactions(uid: str) -> str: return f"user:{uid}:transactions"
def key_debts(uid: str)        -> str: return f"user:{uid}:debts"
def key_goals(uid: str)        -> str: return f"user:{uid}:goals"
def key_savings(uid: str)      -> str: return f"user:{uid}:savings"
def key_analysis(uid: str)     -> str: return f"user:{uid}:analysis"
def key_credit_tips(uid: str)  -> str: return f"user:{uid}:credit-tips"
def key_goal_insights(uid: str)-> str: return f"user:{uid}:goal-insights"
def key_savings_insights(uid: str) -> str: return f"user:{uid}:savings-insights"
