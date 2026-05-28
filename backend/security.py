"""
Nexume — security primitives.

Provides:
  - get_client_ip(): honest client-IP extraction behind Render's reverse proxy
  - RateLimiter:    in-memory sliding-window per-IP rate limiter (memory-bounded)
  - Predefined limiters + FastAPI dependencies for the three tiers
  - require_admin:  X-Admin-Token guard for mutating routes
  - security_headers_middleware:  adds security headers to every response

Design notes:
  - In-memory means each Render worker has its own counter. That's fine for now
    (Render free tier = 1 worker). Upgrade to Redis when you scale horizontally.
  - The limiter is memory-bounded — caps at MAX_TRACKED_IPS to prevent a memory
    leak from millions of unique IPs.
  - Admin endpoints return 404 (not 403) on missing/bad token so probing reveals
    nothing about route existence.
"""

from __future__ import annotations

import asyncio
import os
import time
from collections import deque
from typing import Deque, Dict

from fastapi import HTTPException, Request


# ── Client-IP extraction ─────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    """
    Render and Vercel sit behind reverse proxies. The trustworthy client IP is
    in the leftmost entry of X-Forwarded-For. Fall back to direct peer address.
    """
    xff = request.headers.get("x-forwarded-for", "").strip()
    if xff:
        return xff.split(",")[0].strip() or "unknown"
    real = request.headers.get("x-real-ip", "").strip()
    if real:
        return real
    return request.client.host if request.client else "unknown"


# ── Rate limiter ─────────────────────────────────────────────────────────────

class RateLimiter:
    """
    Sliding-window per-IP rate limiter.

    Example:
        limit = RateLimiter(requests_per_window=10, window_seconds=60)
        limit.check(request)  # raises HTTPException(429) when exceeded

    Bounded memory: when more than MAX_TRACKED_IPS unique IPs are seen, the
    oldest entries are dropped. A garbage-collection pass also runs every N
    operations to prune stale buckets.
    """

    MAX_TRACKED_IPS = 50_000
    GC_INTERVAL = 1_000  # operations between cleanup sweeps

    def __init__(self, requests_per_window: int, window_seconds: int = 60, name: str = ""):
        self.limit = requests_per_window
        self.window = window_seconds
        self.name = name or f"{requests_per_window}/{window_seconds}s"
        self._buckets: Dict[str, Deque[float]] = {}
        self._ops = 0

    def check(self, request: Request) -> None:
        ip = get_client_ip(request)
        now = time.time()
        bucket = self._buckets.get(ip)
        if bucket is None:
            bucket = deque()
            self._buckets[ip] = bucket
        cutoff = now - self.window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            retry_after = max(1, int(bucket[0] + self.window - now)) if bucket else self.window
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)

        # Periodic cleanup + memory cap
        self._ops += 1
        if self._ops >= self.GC_INTERVAL:
            self._ops = 0
            self._gc(now)

    def _gc(self, now: float) -> None:
        cutoff = now - self.window
        # Drop empty / stale buckets
        for ip in list(self._buckets.keys()):
            bucket = self._buckets[ip]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if not bucket:
                del self._buckets[ip]
        # Memory cap: if still oversized, drop oldest entries
        if len(self._buckets) > self.MAX_TRACKED_IPS:
            excess = len(self._buckets) - self.MAX_TRACKED_IPS
            for ip in list(self._buckets.keys())[:excess]:
                del self._buckets[ip]


# ── Tier limiters (instantiated once at module load) ─────────────────────────

# LLM endpoints — most expensive (~$0.005-0.05 each). Tight cap.
LIMIT_EXPENSIVE = RateLimiter(requests_per_window=10, window_seconds=60, name="expensive")

# OpenAI TTS — cheaper but still costs. Looser cap.
LIMIT_TTS = RateLimiter(requests_per_window=30, window_seconds=60, name="tts")

# Read-only DB-backed endpoints. Generous cap — the frontend polls /jobs/stats
# every 30s, and a single user can have multiple tabs open.
LIMIT_READ = RateLimiter(requests_per_window=120, window_seconds=60, name="read")

# Default for anything not otherwise classified.
LIMIT_DEFAULT = RateLimiter(requests_per_window=60, window_seconds=60, name="default")

# Admin endpoints — token-guarded AND rate-limited (defense in depth).
LIMIT_ADMIN = RateLimiter(requests_per_window=20, window_seconds=60, name="admin")


# ── FastAPI dependencies ─────────────────────────────────────────────────────
# Use as: @app.post("/foo/", dependencies=[Depends(rate_limit_expensive)])

async def rate_limit_expensive(request: Request):
    LIMIT_EXPENSIVE.check(request)


async def rate_limit_tts(request: Request):
    LIMIT_TTS.check(request)


async def rate_limit_read(request: Request):
    LIMIT_READ.check(request)


async def rate_limit_default(request: Request):
    LIMIT_DEFAULT.check(request)


async def rate_limit_admin(request: Request):
    LIMIT_ADMIN.check(request)


# ── Admin auth ───────────────────────────────────────────────────────────────

_ADMIN_TOKEN_ENV = "NEXUME_ADMIN_TOKEN"


def _admin_token() -> str:
    """
    Resolve the admin token.
      1. If NEXUME_ADMIN_TOKEN is explicitly set, use that.
      2. Otherwise, derive deterministically from SUPABASE_KEY so admin
         endpoints are still gated even when no explicit env var is set.
         An attacker who can read SUPABASE_KEY already has full DB access,
         so deriving from it adds no new attack surface.
      3. If neither is available, fail closed (return empty → 404 to all callers).
    """
    explicit = os.getenv(_ADMIN_TOKEN_ENV, "").strip()
    if explicit:
        return explicit
    supabase_key = os.getenv("SUPABASE_KEY", "")
    if supabase_key:
        import hashlib
        return hashlib.sha256(f"nexume-admin-v1:{supabase_key}".encode()).hexdigest()
    return ""


async def require_admin(request: Request):
    """
    Guards mutating internal endpoints. Returns 404 (not 403) on auth failure
    so probing reveals nothing about whether the route exists.
    Also small async delay to discourage timing-based brute force.
    """
    expected = _admin_token()
    if not expected:
        # Not configured — fail closed. Better to break /jobs/refresh in dev
        # than to leave an unauthenticated mutating route on the internet.
        await asyncio.sleep(0.3)
        raise HTTPException(status_code=404, detail="Not Found")
    provided = request.headers.get("x-admin-token", "")
    # Constant-time compare to dodge timing oracles
    if not _constant_time_eq(expected, provided):
        await asyncio.sleep(0.3)
        raise HTTPException(status_code=404, detail="Not Found")


def _constant_time_eq(a: str, b: str) -> bool:
    if len(a) != len(b):
        # Still iterate to keep timing roughly constant for short inputs
        x = b + " " * (len(a) - len(b)) if len(a) > len(b) else b[: len(a)]
        result = 0
        for ca, cb in zip(a, x):
            result |= ord(ca) ^ ord(cb)
        return False
    result = 0
    for ca, cb in zip(a, b):
        result |= ord(ca) ^ ord(cb)
    return result == 0


# ── Security headers middleware ──────────────────────────────────────────────

# Origins allowed to call the API. Production + local dev. Vercel preview
# branches are matched via regex in main.py's CORSMiddleware config.
ALLOWED_ORIGINS = [
    "https://nexume-ai.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
ALLOWED_ORIGIN_REGEX = r"^https://nexume-ai[a-z0-9-]*\.vercel\.app$"


async def security_headers_middleware(request: Request, call_next):
    """
    Apply baseline security headers to every API response.

    Why these:
      X-Content-Type-Options: nosniff       — block MIME confusion attacks
      X-Frame-Options: DENY                  — block clickjacking
      Referrer-Policy: strict-origin-when-cross-origin
                                              — leak less referrer data
      Permissions-Policy                     — disable camera/geo, allow mic for ourselves
      Strict-Transport-Security              — force HTTPS for 2 years
      Server: Nexume                         — strip uvicorn/python version fingerprint
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = (
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), "
        "microphone=(self), payment=(), usb=()"
    )
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["Server"] = "Nexume"
    return response


# ── Upload validation ────────────────────────────────────────────────────────

PDF_MAGIC = b"%PDF-"
MAX_PDF_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_pdf_bytes(data: bytes) -> None:
    """Magic-byte check + size guard. Raises HTTPException on failure."""
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")
    if not data.startswith(PDF_MAGIC):
        raise HTTPException(status_code=400, detail="File is not a valid PDF (bad magic bytes)")
