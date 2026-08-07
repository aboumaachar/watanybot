#!/usr/bin/env python3
"""Simple dev health check for local services (gateway, backend, web UI)."""
import urllib.request
from urllib.error import URLError, HTTPError

endpoints = {
    'GATEWAY_4000': 'http://localhost:4000/api/health',
    'GATEWAY_3000': 'http://localhost:3000/api/health',
    'BACKEND_DOCS': 'http://127.0.0.1:8012/docs',
    'BACKEND_HEALTH': 'http://127.0.0.1:8012/api/health',
    'WEB_USER': 'http://127.0.0.1:5174/',
    'TTS_4000': 'http://localhost:4000/api/tts',
    'TTS_3000': 'http://localhost:3000/api/tts',
}


def check(url, timeout=3):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "dev-health-check/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(512)
            return {'ok': True, 'status': resp.status, 'len': len(body)}
    except HTTPError as he:
        return {'ok': False, 'status': he.code, 'error': str(he)}
    except URLError as ue:
        return {'ok': False, 'error': str(ue)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}


if __name__ == '__main__':
    print('\nDev host health check:\n')
    for name, url in endpoints.items():
        res = check(url)
        if res.get('ok'):
            print(f"{name}: UP — HTTP {res['status']} — {url}")
        else:
            err = res.get('error') or f"HTTP {res.get('status')}"
            print(f"{name}: DOWN — {err} — {url}")
    print()