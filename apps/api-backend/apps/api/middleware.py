import time
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

try:
    from core.ip_utils import get_client_ip
except ImportError:
    # Fallback if core package not on path
    def get_client_ip(request: Request) -> str | None:  # type: ignore[misc]
        xff = request.headers.get("x-forwarded-for")
        if xff:
            ip = xff.split(",")[0].strip()
            if ip:
                return ip
        xri = request.headers.get("x-real-ip")
        if xri and xri.strip():
            return xri.strip()
        client = getattr(request, "client", None)
        return client.host if client and getattr(client, "host", None) else None

logger = structlog.get_logger()


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Add a unique request ID to each request."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response


class LoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests with timing information."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Get request ID
        request_id = getattr(request.state, "request_id", "unknown")
        
        # Log request
        logger.info(
            "request_started",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            client=request.client.host if request.client else None,
        )
        
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "request_failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error=str(exc),
                duration_ms=int((time.time() - start_time) * 1000),
            )
            raise
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        # Log response
        logger.info(
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting with in-memory or Redis backends."""

    # per-endpoint rate_limits (requests/min)
    rate_limits = {"default": 60, "/api/v1/auth/login": 10}

    def __init__(self, app, rate_limit: int = 60, backend: str = "memory", redis_url: str = ""):
        super().__init__(app)
        self.rate_limit = rate_limit
        self.backend = backend
        self.requests = {}  # {ip: [(timestamp, count)]}
        self.redis = None
        self.redis_url = redis_url
        if self.backend == "redis":
            try:
                import redis.asyncio as redis
                if not self.redis_url:
                    raise ValueError("Redis URL not configured")
                self.redis = redis.from_url(self.redis_url, decode_responses=True)
            except Exception as exc:
                logger.error("rate_limit_redis_init_failed", error=str(exc))
                self.backend = "memory"
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for health check
        if request.url.path == "/health":
            return await call_next(request)

        client_ip = get_client_ip(request) or (request.client.host if request.client else "unknown")
        # Skip rate limiting for localhost/docker internal
        if client_ip in ("127.0.0.1", "localhost", "0.0.0.0", "172.30.0.1"):
            return await call_next(request)

        if self.backend == "redis":
            if self.redis is None:
                return await call_next(request)

            try:
                current_time = time.time()
                window = int(current_time // 60)
                key = f"rate:{client_ip}:{window}"
                count = await self.redis.incr(key)
                if count == 1:
                    await self.redis.expire(key, 70)
                effective_limit = self.rate_limits.get(request.url.path, self.rate_limit)
                if count > effective_limit:
                    from fastapi import HTTPException
                    detail = ("Too many login attempts" if "/login" in request.url.path
                              else "Rate limit exceeded. Please try again later.")
                    raise HTTPException(status_code=429, detail=detail)
            except Exception as exc:
                logger.error("rate_limit_redis_error", error=str(exc))
            return await call_next(request)

        if self.backend != "memory":
            return await call_next(request)
        current_time = time.time()
        
        # Clean old entries
        if client_ip in self.requests:
            self.requests[client_ip] = [
                (ts, count) for ts, count in self.requests[client_ip]
                if current_time - ts < 60
            ]
        
        # Count requests in last minute
        if client_ip not in self.requests:
            self.requests[client_ip] = []
        
        request_count = sum(count for _, count in self.requests[client_ip])
        
        effective_limit = self.rate_limits.get(request.url.path, self.rate_limit)
        if request_count >= effective_limit:
            from fastapi import HTTPException
            detail = ("Too many login attempts" if "/login" in request.url.path
                      else "Rate limit exceeded. Please try again later.")
            raise HTTPException(status_code=429, detail=detail)
        
        # Add current request
        self.requests[client_ip].append((current_time, 1))
        
        return await call_next(request)
