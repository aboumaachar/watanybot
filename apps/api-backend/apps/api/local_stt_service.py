import os
import tempfile
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

app = FastAPI(title="Watany Local STT Service", version="1.0.0")


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@lru_cache(maxsize=1)
def get_model():
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(
            "faster-whisper is not installed. Install apps/api-backend/requirements-whisper.txt first."
        ) from exc

    model_name = os.getenv("WHISPER_MODEL", "small")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    cpu_threads = _env_int("WHISPER_CPU_THREADS", 4)

    return WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        cpu_threads=cpu_threads,
    )


@app.get("/health")
def health():
    try:
        get_model()
    except Exception as exc:
        return {
            "ok": False,
            "error": str(exc),
        }

    return {
        "ok": True,
        "model": os.getenv("WHISPER_MODEL", "small"),
        "device": os.getenv("WHISPER_DEVICE", "cpu"),
        "compute_type": os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("ar"),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    temp_path: str | None = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            handle.write(content)
            temp_path = handle.name

        model = get_model()
        segments, info = model.transcribe(
            temp_path,
            language=language or "ar",
            vad_filter=True,
            beam_size=_env_int("WHISPER_BEAM_SIZE", 5),
        )

        parts = [segment.text.strip() for segment in segments if segment.text.strip()]
        text = " ".join(parts).strip()
        duration = float(getattr(info, "duration", 0.0) or 0.0)
        detected_language = getattr(info, "language", None) or language or "ar"

        return {
            "text": text,
            "language": detected_language,
            "duration": duration,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)