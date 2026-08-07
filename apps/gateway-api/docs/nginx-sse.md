# Nginx configuration recommendations for SSE endpoints

This document shows a minimal nginx snippet to proxy Server-Sent Events (SSE) reliably without re-encoding or buffering which can introduce mojibake or delayed frames.

Place inside your `server` or `location` block that proxies `/api/chat/stream` to the upstream gateway.

Example:

location /api/chat/stream {
    proxy_pass http://127.0.0.1:8010;
    proxy_http_version 1.1;
    proxy_set_header Connection "";           # allow keep-alive to upstream
    proxy_buffering off;                       # disable buffering for SSE
    proxy_cache off;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Ensure nginx will not re-encode or gzip SSE responses
    gzip off;
    proxy_set_header Accept-Encoding "";

    # Optional: tune timeouts for long-lived connections
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

Notes:
- `proxy_buffering off` and `proxy_http_version 1.1` are critical for streaming behavior.
- Disabling gzip/Accept-Encoding prevents intermediate compression from buffering whole responses and changing bytes.
- If you use another proxy (HAProxy, Traefik), ensure equivalent streaming/unbuffered settings are applied.

After deploying this config, restart nginx and re-test the SSE endpoint.

```bash
# validate nginx and reload
nginx -t && nginx -s reload
```
