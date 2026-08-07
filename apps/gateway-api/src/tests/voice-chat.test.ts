/**
 * Voice Chat Endpoint Tests
 * Tests the unified /api/voice/chat endpoint that handles STT → Chat → TTS.
 */
import Fastify from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import voiceRoutes from "../routes/voice";
import type { VoiceChatRequest, VoiceChatResponse } from "../lib/voice-types";

// Mock dependencies
vi.mock('../lib/tts-cache', () => ({
  ttsCache: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}));

vi.mock('../lib/speech-sanitizer', () => ({
  sanitizeForSpeech: vi.fn((text) => text),
}));

vi.mock('../lib/stt-local', () => ({
  transcribeLocal: vi.fn(),
}));

vi.mock('../filters/content-filter', () => ({
  sanitizeInput: vi.fn((text) => text),
  filterContent: vi.fn((response) => Promise.resolve({ sanitized: response })),
}));

// Mock the chat service and AI functions
const mockFetchChatResponse = vi.fn().mockResolvedValue({
  reply: 'This is a test reply from the chat service.',
  debug: {
    sources: [{ id: 'test-1', title: 'Test Source', score: 0.85 }],
  },
  meta: { confidence: 0.85 },
});

const mockEvaluateRelevance = vi.fn().mockReturnValue({
  confidence: 'high',
  score: 0.85,
  topScore: 0.85,
});

describe('/api/voice/chat', () => {
  let app: any;

  beforeEach(() => {
    mockFetchChatResponse.mockReset();
    mockEvaluateRelevance.mockReset();

    mockFetchChatResponse.mockResolvedValue({
      reply: 'This is a test reply from the chat service.',
      debug: {
        sources: [{ id: 'test-1', title: 'Test Source', score: 0.85 }],
      },
      meta: { confidence: 0.85 },
    });

    mockEvaluateRelevance.mockReturnValue({
      confidence: 'high',
      score: 0.85,
      topScore: 0.85,
    });
  });

  beforeAll(async () => {
    app = Fastify();

    // Register voice routes with mocked options
    await app.register(voiceRoutes, {
      fetchChatResponse: mockFetchChatResponse,
      evaluateRelevance: mockEvaluateRelevance,
    });

    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return error when chat pipeline not configured', async () => {
    const testApp = Fastify();
    await testApp.register(voiceRoutes, {}); // No options
    await testApp.ready();

    const requestBody: VoiceChatRequest = {
      transcript: 'test query',
      lang: 'ar',
      channel: 'web',
    };

    const response = await testApp.inject({
      method: 'POST',
      url: '/api/voice/chat',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.statusCode).toBe(503);
    const result = JSON.parse(response.body);
    expect(result.error).toContain('not configured');

    await testApp.close();
  });

  it('should return error for missing transcript', async () => {
    const requestBody = {
      lang: 'ar',
      channel: 'web',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/voice/chat',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.statusCode).toBe(400);
    const result = JSON.parse(response.body);
    expect(result.error).toContain('No speech detected');
  });

  it('should handle transcript-only request successfully', async () => {
    mockFetchChatResponse.mockResolvedValueOnce({
      reply: 'This is a test reply from the chat service.',
      debug: {
        sources: [{ id: 'test-1', title: 'Test Source', score: 0.85 }],
      },
      meta: { confidence: 0.85 },
    });

    // Mock TTS response
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)), // Mock audio data
    });

    const requestBody: VoiceChatRequest = {
      transcript: 'كيف أحسب معاشي التقاعدي',
      lang: 'ar',
      channel: 'web',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/voice/chat',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.statusCode).toBe(200);
    const result: VoiceChatResponse = JSON.parse(response.body);

    expect(result.ok).toBe(true);
    expect(result.transcript).toBe('كيف أحسب معاشي التقاعدي');
    expect(result.reply).toContain('test reply');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      id: 'test-1',
      title: 'Test Source',
      score: 0.85,
    });
    expect(result.meta).toBeDefined();
    expect(result.meta?.sttProvider).toBe('text');
    expect(result.meta?.kbConfidence).toBe(0.85);
  });
});