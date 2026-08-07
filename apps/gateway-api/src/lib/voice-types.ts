/**
 * Shared type definitions for the unified voice chat endpoint.
 */
import type { ChatRequest, ChatResponse } from "@watany/types";

export interface VoiceChatRequest {
  audio?: string;        // base64-encoded audio
  transcript?: string;   // or direct text input
  mime?: string;         // audio MIME type (default: "audio/webm")
  lang?: string;         // "ar" | "en" | "fr"
  channel?: string;
  sessionId?: string;
  userId?: string;
}

export interface VoiceChatSource {
  id: string;
  title: string;
  score?: number;
}

export interface VoiceChatTimings {
  sttMs: number;
  chatMs: number;
  ttsMs: number;
  totalMs: number;
}

export interface VoiceChatMeta {
  sttProvider: string;
  ttsProvider: string;
  kbConfidence: number;
  usedKb: boolean;
  topScore: number;
  deterministic: boolean;
  timings: VoiceChatTimings;
}

export interface VoiceChatResponse {
  ok: true;
  transcript: string;
  reply: string;
  spokenText: string;
  audio: { base64: string; mimeType: string } | null;
  sources: VoiceChatSource[];
  meta: VoiceChatMeta;
}

export interface VoiceChatError {
  ok: false;
  error: string;
  code: string;
}

export interface VoiceRoutesOptions {
  fetchChatResponse?: (body: ChatRequest) => Promise<ChatResponse>;
  evaluateRelevance?: (query: string, topK: number) => { confidence: string; topScore?: number };
}

/** Accepted audio MIME types */
export const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
]);

/** Max audio payload size in bytes (10 MB) */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
