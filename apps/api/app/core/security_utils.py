from __future__ import annotations
import time
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException

def get_client_ip(request: Request) -> str:
    # Prefer reverse-proxy headers
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    if request.client:
        return request.client.host
    return "unknown"

# Very small default limiter: 10 attempts per 600s per IP
_WINDOW = 600
_MAX = 10
_bucket: Dict[str, List[float]] = {}

def rate_limit_login(ip: str):
    now = time.time()
    arr = _bucket.get(ip, [])
    arr = [t for t in arr if now - t <= _WINDOW]
    if len(arr) >= _MAX:
        raise HTTPException(status_code=429, detail="Too many attempts. Try later.")
    arr.append(now)
    _bucket[ip] = arr
