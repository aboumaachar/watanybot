import Fastify from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('undici', () => ({
  request: vi.fn(async () => ({ statusCode: 503 })),
}));

vi.mock('../lib/config.js', () => ({
  usePython: true,
  getPythonBase: () => 'http://localhost:8010',
  useAi: true,
  aiBaseUrl: 'http://127.0.0.1:11434/v1',
}));

vi.mock('../bootstrap/ai-state.js', () => ({
  getAiProvider: () => 'ollama',
  getAiModel: () => 'qwen3.5:9b',
  getAiChat: () => ({
    name: 'ollama',
    healthCheck: async () => ({ ok: true, model: 'qwen3.5:9b', latencyMs: 4 }),
  }),
}));

vi.mock('../admin-authority/adminAuthorityAudit.js', () => ({
  appendAdminAuditEvent: vi.fn(),
  createAdminAuditEvent: vi.fn(),
  listRecentAdminAuditEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock('../admin-authority/adminAuthorityApproval.js', () => ({
  createAdminApprovalRequest: vi.fn(),
  decideAdminApprovalRequest: vi.fn(),
  listPendingAdminApprovalRequests: vi.fn().mockResolvedValue([]),
}));

import { adminAuthorityRoutes } from '../admin-authority/adminAuthorityRoutes.js';

let app: ReturnType<typeof Fastify>;
const originalEnv = { ...process.env };

beforeAll(async () => {
  process.env.NODE_ENV = 'production';
  process.env.OTP_PROVIDER = 'android_sms_gateway';
  process.env.ANDROID_SMS_GATEWAY_ENDPOINT = 'http://sms-gateway.test';
  process.env.ANDROID_SMS_GATEWAY_TOKEN = 'configured-token';
  delete process.env.WHATSAPP_API_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  process.env.STT_PROVIDER = 'openai';
  process.env.TTS_PROVIDER = 'voicerss';
  delete process.env.OPENAI_API_KEY;
  delete process.env.VOICERSS_API_KEY;

  app = Fastify({ logger: false });
  app.addHook('onRequest', async (request) => {
    request.user = { id: 'integration-super', role: 'superadmin', email: 'integration@test.local' };
  });
  await app.register(adminAuthorityRoutes, { prefix: '/api' });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe('GET /api/admin-authority/integration-status', () => {
  it('returns deterministic classified integration rows through Fastify inject', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin-authority/integration-status' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { ok: boolean; integrations: Array<Record<string, unknown>> };
    expect(body.ok).toBe(true);
    expect(body.integrations.some((item) => item.status === 'unknown')).toBe(false);
    expect(body.integrations.find((item) => item.id === 'ai_provider')).toMatchObject({ status: 'ready', provider: 'ollama' });
    expect(body.integrations.find((item) => item.id === 'python_api')).toMatchObject({ status: 'blocked', url: 'http://localhost:8010' });
    expect(body.integrations.find((item) => item.id === 'sms')).toMatchObject({ status: 'ready', reasonCode: 'ANDROID_SMS_GATEWAY_CONFIGURED' });
    expect(body.integrations.find((item) => item.id === 'whatsapp')).toMatchObject({ status: 'blocked', reasonCode: 'WHATSAPP_TRANSPORT_NOT_CONFIGURED' });
    expect(body.integrations.find((item) => item.id === 'voice')).toMatchObject({ status: 'blocked', reasonCode: 'VOICE_STT_AND_TTS_NOT_CONFIGURED' });
  });
});
