# Local Whisper Service

This service exposes a local `/transcribe` endpoint compatible with the gateway's `STT_PROVIDER=local` path.

## Files

- `apps/api-backend/apps/api/local_stt_service.py`
- `apps/api-backend/requirements-whisper.txt`
- `apps/api-backend/.env.whisper.example`

## Install

From `apps/api-backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-whisper.txt
```

If you are not using the local `.venv`, replace the interpreter with your active Python.

## Run

From `apps/api-backend`:

```powershell
$env:WHISPER_MODEL = "small"
$env:WHISPER_DEVICE = "cpu"
$env:WHISPER_COMPUTE_TYPE = "int8"
.\.venv\Scripts\python.exe -m uvicorn apps.api.local_stt_service:app --host 127.0.0.1 --port 8001
```

Health check:

```powershell
Invoke-WebRequest http://127.0.0.1:8001/health
```

## Gateway Settings

Set these in `apps/gateway-api/.env` or your production env file:

```dotenv
STT_PROVIDER=local
WHISPER_SERVICE_URL=http://127.0.0.1:8001/transcribe
STT_TIMEOUT_MS=45000
```

If `STT_PROVIDER` is unset or set to `openai`, the gateway keeps using OpenAI Whisper.