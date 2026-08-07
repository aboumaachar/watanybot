/**
 * Local Whisper STT client — calls a faster-whisper HTTP service.
 * Falls back gracefully if the service is unavailable.
 */

const WHISPER_URL = () => process.env.WHISPER_SERVICE_URL || "http://127.0.0.1:8001/transcribe";
const STT_TIMEOUT = () => Number(process.env.STT_TIMEOUT_MS || "45000");

export interface LocalSttResult {
  text: string;
  language: string;
  duration: number;
  confidence: number;
}

/**
 * Transcribe audio via a local faster-whisper HTTP service.
 * Expects the service to accept multipart form with `file` + `language` fields.
 */
export async function transcribeLocal(
  audioBuffer: Buffer,
  mime: string,
  language = "ar",
): Promise<LocalSttResult> {
  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/webm;codecs=opus": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };
  const ext = extMap[mime.toLowerCase()] || "webm";

  const bytes = new Uint8Array(audioBuffer);
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const form = new FormData();
  form.append("file", blob, `recording.${ext}`);
  form.append("language", language);

  const res = await fetch(WHISPER_URL(), {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(STT_TIMEOUT()),
  });

  if (!res.ok) {
    throw new Error(`Local STT failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    text?: string;
    language?: string;
    duration?: number;
  };

  return {
    text: data.text || "",
    language: data.language || language,
    duration: data.duration || 0,
    confidence: data.text ? 0.9 : 0,
  };
}
