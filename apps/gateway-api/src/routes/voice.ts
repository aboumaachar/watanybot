/**
 * Watany Voice Routes — TTS, STT, and unified voice-chat endpoint.
 *
 * POST /api/tts         — Text-to-Speech (returns audio/mp3) via Voicerss / Google fallback
 * POST /api/stt         — Speech-to-Text (accepts base64 audio JSON, returns transcript) via OpenAI
 * POST /api/voice/chat  — Unified voice round-trip: STT → chat pipeline → TTS
 * GET  /api/voice/health — Voice subsystem health check
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ttsCache } from "../lib/tts-cache";
import { sanitizeForSpeech } from "../lib/speech-sanitizer";
import { transcribeLocal } from "../lib/stt-local";
import { sanitizeInput, filterContent } from "../filters/content-filter.js";
import type { VoiceRoutesOptions, VoiceChatRequest, VoiceChatResponse, VoiceChatError, VoiceChatSource } from "../lib/voice-types";
import { ALLOWED_AUDIO_MIMES, MAX_AUDIO_BYTES } from "../lib/voice-types";

const VOICERS_API_URL = "http://api.voicerss.org/";
const GOOGLE_TTS_URL = "https://translate.google.com/translate_tts";
const DEFAULT_OPENAI_API_URL = "https://api.openai.com/v1";

function getOpenAiApiUrl(): string {
  return process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || DEFAULT_OPENAI_API_URL;
}

function getApiKey(): string {
  // Prefer explicit OpenAI key for STT (avoid using non-OpenAI AI_API_KEY values like 'ollama')
  return process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
}

function getTtsKey(provider?: string): string {
  // Get TTS provider key based on selected provider
  const ttsProvider = provider || (process.env.TTS_PROVIDER || "voicerss").toLowerCase();
  
  switch (ttsProvider) {
    case "openai":
      return process.env.OPENAI_TTS_KEY || process.env.OPENAI_API_KEY || "";
    case "azure":
      return process.env.AZURE_TTS_KEY || "";
    case "voicerss":
      return process.env.VOICERSS_API_KEY || "";
    default:
      return process.env.VOICERSS_API_KEY || "";
  }
}

function getTtsProvider(): string {
  // Validate and return configured TTS provider
  const provider = (process.env.TTS_PROVIDER || "voicerss").toLowerCase();
  const validProviders = ["openai", "azure", "voicerss", "google"];
  
  if (!validProviders.includes(provider)) {
    console.warn(`Invalid TTS_PROVIDER: ${provider}. Falling back to voicerss`);
    return "voicerss";
  }
  
  return provider;
}

function resolveTtsProvider(lang: string): string {
  const configured = getTtsProvider();
  const strictProvider = (process.env.TTS_STRICT_PROVIDER || "false").toLowerCase() === "true";

  if (!strictProvider && lang.startsWith("ar") && getTtsKey("openai")) {
    if (configured === "voicerss" || configured === "google") {
      return "openai";
    }
  }

  return configured;
}

function resolveOpenAiVoice(lang: string, requestedVoice?: string): string {
  if (requestedVoice) return requestedVoice;
  return lang.startsWith("ar")
    ? (process.env.OPENAI_TTS_AR_VOICE || "alloy")
    : (process.env.OPENAI_TTS_DEFAULT_VOICE || "alloy");
}

function resolveOpenAiModel(lang: string): string {
  return lang.startsWith("ar")
    ? (process.env.OPENAI_TTS_AR_MODEL || process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts")
    : (process.env.OPENAI_TTS_MODEL || "tts-1-hd");
}

function resolveOpenAiInstructions(lang: string): string | undefined {
  if (lang.startsWith("ar")) {
    return process.env.OPENAI_TTS_AR_INSTRUCTIONS
      || "Speak in natural colloquial Lebanese Arabic, not formal Modern Standard Arabic. Sound like a real Lebanese person speaking casually, warmly, and clearly. Use light everyday Lebanese wording such as بدك, فيك, شو, هيدا, هيك when it fits naturally, but do not force slang into every sentence. Keep the delivery smooth, short, and conversational, avoid theatrical emphasis, and avoid over-pronouncing letters or spelling symbols, URLs, or technical fragments.";
  }
  return process.env.OPENAI_TTS_INSTRUCTIONS || undefined;
}

/* ------------------------------------------------------------------ */
/*  TTS — Text to Speech                                              */
/* ------------------------------------------------------------------ */

interface TtsBody {
  text: string;
  voice?: string;
  speed?: number;
  lang?: string;
}

/* ------------------------------------------------------------------ */
/*  STT — Speech to Text (accepts { audio: base64, mime?: string })   */
/* ------------------------------------------------------------------ */

interface SttBody {
  audio: string;  // base64-encoded audio
  mime?: string;   // e.g. "audio/webm;codecs=opus"
  language?: string;
}

interface TtsRequestContext {
  speechText: string;
  lang: string;
  speed: number;
  provider: string;
  providerKey: string;
  selectedVoice: string;
}

interface AudioValidationResult {
  mime: string;
  audioBuffer: Buffer;
}

interface VoiceTranscriptionResult {
  transcript: string;
  sttProvider: string;
  sttMs: number;
}

interface VoiceChatPipelineResult {
  sanitizedTranscript: string;
  replyText: string;
  debugInfo: Record<string, unknown>;
  chatMs: number;
}

interface VoiceConfidenceResult {
  kbConfidence: number;
  topScore: number;
  usedKb: boolean;
  deterministic: boolean;
  replyText: string;
}

interface VoiceAudioResult {
  audioPayload: { base64: string; mimeType: string } | null;
  ttsMs: number;
}

function sendMp3Response(reply: FastifyReply, audioBuffer: Buffer, cacheHit = false): void {
  const response = reply
    .header("Content-Type", "audio/mpeg")
    .header("Content-Length", audioBuffer.length)
    .header("Cache-Control", "public, max-age=86400");

  if (cacheHit) {
    response.header("X-Tts-Cache", "HIT");
  }

  response.send(audioBuffer);
}

function getCachedTtsAudio(fastify: FastifyInstance, speechText: string, lang: string): Buffer | null {
  const cachedAudio = ttsCache.get(speechText, lang);
  if (cachedAudio && cachedAudio.length > 0) {
    fastify.log.debug({ text: speechText.slice(0, 50), lang, cacheHit: true }, "TTS cache hit");
    return cachedAudio;
  }
  return null;
}

function buildTtsRequestContext(body: TtsBody): TtsRequestContext | { error: string } {
  const { text, voice, speed = 1, lang = "ar" } = body || {};
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return { error: "text is required" };
  }

  const speechText = sanitizeForSpeech(text, Number(process.env.TTS_MAX_WORDS || "55"));
  if (!speechText) {
    return { error: "text became empty after speech sanitization" };
  }

  const provider = resolveTtsProvider(lang);
  return {
    speechText,
    lang,
    speed,
    provider,
    providerKey: getTtsKey(provider),
    selectedVoice: resolveOpenAiVoice(lang, voice),
  };
}

async function tryOpenAiTts(fastify: FastifyInstance, context: TtsRequestContext): Promise<Buffer | null> {
  if (context.provider !== "openai" || !context.providerKey) {
    return null;
  }

  try {
    const voiceMap: Record<string, string> = {
      nova: "nova",
      alloy: "alloy",
      echo: "echo",
      fable: "fable",
      onyx: "onyx",
      shimmer: "shimmer",
    };
    const openaiVoice = voiceMap[context.selectedVoice] || resolveOpenAiVoice(context.lang);
    const openaiModel = resolveOpenAiModel(context.lang);
    const openaiInstructions = resolveOpenAiInstructions(context.lang);
    const payload: Record<string, unknown> = {
      model: openaiModel,
      input: context.speechText.trim().slice(0, 4096),
      voice: openaiVoice,
      response_format: "mp3",
      speed: Math.min(Math.max(context.speed, 0.25), 4),
    };

    if (openaiInstructions && openaiModel.includes("gpt-4o")) {
      payload.instructions = openaiInstructions;
    }

    const res = await fetch(`${getOpenAiApiUrl()}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${context.providerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      fastify.log.warn({ status: res.status }, "OpenAI TTS failed, falling back to Voicerss");
      return null;
    }

    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    fastify.log.warn(error, "OpenAI TTS error, falling back to Voicerss");
    return null;
  }
}

async function tryVoiceRssTts(fastify: FastifyInstance, context: TtsRequestContext): Promise<Buffer | null> {
  if (!context.providerKey || context.provider === "openai") {
    return null;
  }

  const hlMap: Record<string, string> = {
    ar: "ar-eg",
    fr: "fr-fr",
    en: "en-us",
  };
  const params = new URLSearchParams({
    key: context.providerKey,
    src: context.speechText.trim(),
    hl: hlMap[context.lang] || "ar-eg",
    r: Math.round((context.speed - 1) * 10).toString(),
    c: "MP3",
    f: "48khz_16bit_mono",
  });

  const res = await fetch(`${VOICERS_API_URL}?${params}`, { method: "GET" });
  if (!res.ok) {
    fastify.log.warn({ status: res.status }, "Voicerss failed, falling back to Google TTS");
    return null;
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  if (audioBuffer.length >= 100 && !audioBuffer.toString("utf-8").startsWith("ERROR")) {
    return audioBuffer;
  }

  fastify.log.warn("Voicerss returned error body, falling back to Google TTS");
  return null;
}

async function tryGoogleTts(fastify: FastifyInstance, context: TtsRequestContext): Promise<Buffer | null> {
  const googleLangMap: Record<string, string> = { ar: "ar", fr: "fr", en: "en" };
  const tl = googleLangMap[context.lang] || "ar";
  const trimmed = context.speechText.trim().slice(0, 200);
  const gParams = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl,
    q: trimmed,
  });

  const gRes = await fetch(`${GOOGLE_TTS_URL}?${gParams}`, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://translate.google.com/",
    },
  });

  if (!gRes.ok) {
    fastify.log.error({ status: gRes.status }, "Google TTS fallback also failed");
    return null;
  }

  return Buffer.from(await gRes.arrayBuffer());
}

async function generateTtsAudio(fastify: FastifyInstance, context: TtsRequestContext): Promise<Buffer | null> {
  const openAiAudio = await tryOpenAiTts(fastify, context);
  if (openAiAudio) {
    return openAiAudio;
  }

  const voiceRssAudio = await tryVoiceRssTts(fastify, context);
  if (voiceRssAudio) {
    return voiceRssAudio;
  }

  return tryGoogleTts(fastify, context);
}

function validateVoiceAudio(body: VoiceChatRequest): AudioValidationResult | VoiceChatError | null {
  if (!body.audio) {
    return null;
  }

  const mime = body.mime || "audio/webm";
  const baseMime = mime.split(";")[0].trim().toLowerCase();
  if (!ALLOWED_AUDIO_MIMES.has(mime.toLowerCase()) && !ALLOWED_AUDIO_MIMES.has(baseMime)) {
    return { ok: false, error: "Unsupported audio MIME type", code: "INVALID_MIME" };
  }

  const estimatedBytes = Math.ceil(body.audio.length * 0.75);
  if (estimatedBytes > MAX_AUDIO_BYTES) {
    return { ok: false, error: "Audio too large (max 10 MB)", code: "AUDIO_TOO_LARGE" };
  }

  const audioBuffer = Buffer.from(body.audio, "base64");
  if (audioBuffer.length === 0) {
    return { ok: false, error: "Empty audio data", code: "EMPTY_AUDIO" };
  }

  return { mime, audioBuffer };
}

async function transcribeVoiceInput(
  fastify: FastifyInstance,
  body: VoiceChatRequest,
  lang: string,
): Promise<VoiceTranscriptionResult> {
  let transcript = (body.transcript || "").trim();
  let sttProvider = transcript ? "text" : "none";
  let sttMs = 0;

  if (transcript || !body.audio) {
    return { transcript, sttProvider, sttMs };
  }

  const validation = validateVoiceAudio(body);
  if (!validation || "ok" in validation) {
    return { transcript: "", sttProvider, sttMs };
  }

  const sttStart = Date.now();
  const preferredStt = (process.env.STT_PROVIDER || "openai").toLowerCase();

  if (preferredStt === "local") {
    try {
      const result = await transcribeLocal(validation.audioBuffer, validation.mime, lang);
      transcript = result.text.trim();
      sttProvider = "local";
    } catch (err) {
      fastify.log.warn({ err }, "Local STT failed, falling back to OpenAI");
    }
  }

  if (!transcript && process.env.OPENAI_API_KEY) {
    try {
      const sttRes = await fastify.inject({
        method: "POST",
        url: "/api/stt",
        payload: { audio: body.audio, mime: validation.mime, language: lang },
      });
      if (sttRes.statusCode === 200) {
        const sttData = JSON.parse(sttRes.body) as { text?: string };
        transcript = (sttData.text || "").trim();
        sttProvider = "openai";
      }
    } catch (err) {
      fastify.log.warn({ err }, "OpenAI STT fallback also failed");
    }
  }

  sttMs = Date.now() - sttStart;
  return { transcript, sttProvider, sttMs };
}

async function runVoiceChatPipeline(
  fastify: FastifyInstance,
  opts: VoiceRoutesOptions,
  body: VoiceChatRequest,
  transcript: string,
  lang: string,
  channel: string,
): Promise<VoiceChatPipelineResult> {
  const sanitizedTranscript = sanitizeInput(transcript);
  const chatStart = Date.now();
  let replyText = "";
  let debugInfo: Record<string, unknown> = {};

  try {
    const chatResponse = await opts.fetchChatResponse!({
      message: sanitizedTranscript,
      lang,
      channel,
      userId: body.userId,
      sessionId: body.sessionId,
    });
    replyText = chatResponse.reply || "";
    debugInfo = chatResponse.debug || {};

    if (replyText) {
      const filterResult = await filterContent(replyText);
      replyText = filterResult.sanitized;
    }
  } catch (err) {
    console.log("CHAT PIPELINE ERROR:", err);
    fastify.log.error({ err }, "voice_chat_pipeline_error");
    replyText = "عذراً، حصل خطأ أثناء معالجة طلبك. حاول مرة ثانية.";
  }

  return {
    sanitizedTranscript,
    replyText,
    debugInfo,
    chatMs: Date.now() - chatStart,
  };
}

function evaluateVoiceConfidence(
  opts: VoiceRoutesOptions,
  sanitizedTranscript: string,
  debugInfo: Record<string, unknown>,
  replyText: string,
): VoiceConfidenceResult {
  let kbConfidence = 0;
  let topScore = 0;
  let usedKb = false;
  const deterministic = !!debugInfo?.deterministicFamilyPension || !!debugInfo?.deterministicReply;

  try {
    if (opts.evaluateRelevance) {
      const rel = opts.evaluateRelevance(sanitizedTranscript, 5);
      const confMap: Record<string, number> = { high: 0.85, medium: 0.6, low: 0.35, none: 0 };
      kbConfidence = confMap[rel.confidence] ?? 0;
      topScore = rel.topScore ?? 0;
      usedKb = kbConfidence > 0;
    }
  } catch {
    // evaluateRelevance might fail if RAG not loaded — skip
  }

  const LOW_CONF_THRESHOLD = Number(process.env.VOICE_LOW_CONFIDENCE_THRESHOLD || "0.35");
  const adjustedReplyText = kbConfidence > 0 && kbConfidence < LOW_CONF_THRESHOLD && !deterministic
    ? "ما عندي جواب موثوق كفاية من قاعدة المعرفة بهالسؤال. فيك تعيد صياغته بكلمات أبسط أو تحدد نوع الطلب؟"
    : replyText;

  return {
    kbConfidence,
    topScore,
    usedKb,
    deterministic,
    replyText: adjustedReplyText,
  };
}

async function generateVoiceChatAudio(
  fastify: FastifyInstance,
  spokenText: string,
  lang: string,
): Promise<VoiceAudioResult> {
  if (!spokenText) {
    return { audioPayload: null, ttsMs: 0 };
  }

  const ttsStart = Date.now();
  let audioPayload: { base64: string; mimeType: string } | null = null;
  try {
    const ttsRes = await fastify.inject({
      method: "POST",
      url: "/api/tts",
      payload: { text: spokenText, speed: 0.9, lang },
    });
    if (ttsRes.statusCode === 200 && ttsRes.rawPayload.length >= 100) {
      audioPayload = {
        base64: ttsRes.rawPayload.toString("base64"),
        mimeType: "audio/mpeg",
      };
    }
  } catch (err) {
    fastify.log.warn({ err }, "voice_chat_tts_failed");
  }

  return {
    audioPayload,
    ttsMs: Date.now() - ttsStart,
  };
}

function buildVoiceSources(debugInfo: Record<string, unknown>): VoiceChatSource[] {
  const sources: VoiceChatSource[] = [];
  const rawSources = (debugInfo?.sources || debugInfo?.chunks) as
    | Array<{ id?: string; title?: string; score?: number; metadata?: Record<string, unknown> }>
    | undefined;

  if (!Array.isArray(rawSources)) {
    return sources;
  }

  for (const source of rawSources.slice(0, 5)) {
    sources.push({
      id: source.id || "unknown",
      title: source.title || (source.metadata as Record<string, string>)?.title_ar || "",
      score: source.score,
    });
  }

  return sources;
}

export default async function voiceRoutes(fastify: FastifyInstance, opts: VoiceRoutesOptions) {
  // ── TTS endpoint ──
  fastify.post<{ Body: TtsBody }>("/api/tts", async (req: FastifyRequest<{ Body: TtsBody }>, reply: FastifyReply) => {
    const context = buildTtsRequestContext(req.body || {});
    if ("error" in context) {
      reply.code(400);
      return { error: context.error };
    }

    try {
      const cachedAudio = getCachedTtsAudio(fastify, context.speechText, context.lang);
      if (cachedAudio) {
        sendMp3Response(reply, cachedAudio, true);
        return;
      }

      const audioBuffer = await generateTtsAudio(fastify, context);
      if (!audioBuffer || audioBuffer.length <= 0) {
        reply.code(502);
        return { error: "All TTS providers failed" };
      }

      ttsCache.set(context.speechText, audioBuffer, context.lang);
      sendMp3Response(reply, audioBuffer);
    } catch (error) {
      fastify.log.error(error, "TTS error");
      reply.code(500);
      return { error: "TTS processing failed" };
    }
  });

  // ── STT endpoint ──
  // Accepts JSON body: { audio: "<base64>", mime?: "audio/webm", language?: "ar" }
  fastify.post<{ Body: SttBody }>("/api/stt", async (req: FastifyRequest<{ Body: SttBody }>, reply: FastifyReply) => {
    // Explicitly require an OpenAI key for Whisper STT; don't treat generic AI_API_KEY (used for Ollama/etc.) as sufficient
    if (!process.env.OPENAI_API_KEY) {
      reply.code(501);
      return { error: "OPENAI_API_KEY not configured — STT disabled" };
    }
    const apiKey = getApiKey();

    try {
      const { audio, mime = "audio/webm", language = "ar" } = req.body || {};

      if (!audio || typeof audio !== "string") {
        reply.code(400);
        return { error: "audio (base64) is required" };
      }

      const audioBuffer = Buffer.from(audio, "base64");
      if (audioBuffer.length === 0) {
        reply.code(400);
        return { error: "Empty audio data" };
      }

      // Determine file extension from mime
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
      const filename = `recording.${ext}`;

      // Build multipart form for OpenAI Whisper
      const blob = new Blob([audioBuffer], { type: mime });
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("model", "whisper-1");
      formData.append("language", language);
      formData.append("response_format", "verbose_json");

      const res = await fetch(`${getOpenAiApiUrl()}/audio/transcriptions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "unknown");
        fastify.log.error({ status: res.status, err }, "OpenAI STT failed");
        reply.code(502);
        return { error: `STT failed: ${res.status}` };
      }

      const result = (await res.json()) as {
        text: string;
        language?: string;
        duration?: number;
        segments?: Array<{ text: string; start: number; end: number }>;
      };

      return {
        text: result.text || "",
        language: result.language || language,
        duration: result.duration || 0,
        confidence: 0.95,
      };
    } catch (err) {
      fastify.log.error({ err }, "STT request failed");
      reply.code(500);
      return { error: "STT service error" };
    }
  });

  /* ================================================================
   *  GET /api/voice/health — Voice subsystem health
   * ================================================================ */
  fastify.get("/api/voice/health", async (_req, reply) => {
    const sttProvider = (process.env.STT_PROVIDER || "openai").toLowerCase();
    const ttsProvider = getTtsProvider();
    const hasSttKey = sttProvider === "local" || !!process.env.OPENAI_API_KEY;
    const hasTtsKey = ttsProvider === "google" || !!getTtsKey();

    return reply.send({
      ok: hasSttKey && hasTtsKey,
      stt: { provider: sttProvider, configured: hasSttKey },
      tts: { provider: ttsProvider, configured: hasTtsKey },
      chatPipeline: !!opts.fetchChatResponse,
    });
  });

  /* ================================================================
   *  POST /api/voice/chat — Unified voice round-trip
   *  audio (base64) or transcript → STT → chat pipeline → TTS → response
   * ================================================================ */
  fastify.post<{ Body: VoiceChatRequest }>("/api/voice/chat", async (req, reply) => {
    if (!opts.fetchChatResponse) {
      reply.code(503);
      return { ok: false, error: "Voice chat pipeline not configured", code: "NOT_CONFIGURED" } satisfies VoiceChatError;
    }

    const totalStart = Date.now();
    const body = req.body || {};
    const lang = body.lang || "ar";
    const channel = body.channel || "voice";

    const audioValidation = validateVoiceAudio(body);
    if (audioValidation && "ok" in audioValidation) {
      reply.code(400);
      return audioValidation;
    }

    const { transcript, sttProvider, sttMs } = await transcribeVoiceInput(fastify, body, lang);

    if (!transcript) {
      reply.code(400);
      return { ok: false, error: "No speech detected", code: "EMPTY_TRANSCRIPT" } satisfies VoiceChatError;
    }

    const pipeline = await runVoiceChatPipeline(fastify, opts, body, transcript, lang, channel);
    const confidence = evaluateVoiceConfidence(opts, pipeline.sanitizedTranscript, pipeline.debugInfo, pipeline.replyText);
    const maxWords = Number(process.env.VOICE_MAX_REPLY_WORDS || "45");
    const spokenText = sanitizeForSpeech(confidence.replyText, maxWords);
    const { audioPayload, ttsMs } = await generateVoiceChatAudio(fastify, spokenText, lang);

    const sources = buildVoiceSources(pipeline.debugInfo);

    const totalMs = Date.now() - totalStart;

    fastify.log.info({
      endpoint: "/api/voice/chat",
      requestId: req.id,
      transcript: pipeline.sanitizedTranscript.slice(0, 100),
      sttProvider,
      kbConfidence: confidence.kbConfidence,
      topScore: confidence.topScore,
      deterministic: confidence.deterministic,
      sourceCount: sources.length,
      timings: { sttMs: sttMs, chatMs: pipeline.chatMs, ttsMs: ttsMs, totalMs: totalMs },
    }, "voice_chat_completed");

    const response: VoiceChatResponse = {
      ok: true,
      transcript: pipeline.sanitizedTranscript,
      reply: confidence.replyText,
      spokenText,
      audio: audioPayload,
      sources,
      meta: {
        sttProvider,
        ttsProvider: getTtsProvider(),
        kbConfidence: confidence.kbConfidence,
        usedKb: confidence.usedKb,
        topScore: confidence.topScore,
        deterministic: confidence.deterministic,
        timings: { sttMs: sttMs, chatMs: pipeline.chatMs, ttsMs: ttsMs, totalMs: totalMs },
      },
    };

    reply.header("content-type", "application/json; charset=utf-8");
    return response;
  });
}
