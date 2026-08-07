# -*- coding: utf-8 -*-
"""IP extraction utilities — proxy-aware."""
from __future__ import annotations
from typing import Optional
from fastapi import Request


def get_client_ip(request: Request) -> Optional[str]:
    """
    Extract the real client IP, respecting reverse-proxy headers.
    Priority: X-Forwarded-For (first) > X-Real-IP > request.client.host
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        ip = xff.split(",")[0].strip()
        if ip:
            return ip

    xri = request.headers.get("x-real-ip")
    if xri:
        ip = xri.strip()
        if ip:
            return ip

    client = getattr(request, "client", None)
    if client and getattr(client, "host", None):
        return client.host
    return None
