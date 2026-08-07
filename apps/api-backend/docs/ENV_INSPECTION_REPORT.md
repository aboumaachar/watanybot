# Environment Inspection Report

Generated: 2026-02-05T22:03:56.307302+00:00

IMPORTANT: Rerun this inspection after a computer restart.

## Next steps

After restart, run:

```
./scripts/env_inspect.ps1
```

## Results

- INFO: Repo root - C:\xampp\htdocs\projectx\watanbot
- INFO: .env file - present
- PASS: APP_ENV - dev
- PASS: KB_SQLITE_PATH - present
- PASS: AUTO_CREATE_KB - valid
- PASS: POSTGRES_* - present
- PASS: JWT_SECRET - length ok
- WARN: WHATSAPP_* - not set
- PASS: data/ - present
- PASS: KB_SQLITE_PATH dir - present
- PASS: scripts/ - present
- PASS: sources/primary - present
- INFO: Runtime stack - FastAPI
- INFO: Python - 3.13.12
- INFO: pip - available
- INFO: requirements.txt - present
- PASS: Port 8000 - free
- PASS: Port 5432 - free
- PASS: Port 3000 - free
- PASS: Postgres TCP - reachable