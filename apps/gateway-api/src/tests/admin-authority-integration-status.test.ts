import { describe, expect, it } from 'vitest';
import { buildAdminIntegrationStatuses } from '../admin-authority/integrationStatus.js';

function byId(rows: ReturnType<typeof buildAdminIntegrationStatuses>, id: string) {
  const found = rows.find((row) => row.id === id);
  if (!found) throw new Error(`missing integration ${id}`);
  return found;
}

describe('admin integration status classification', () => {
  it('classifies the diagnosed production shape without unknown states', () => {
    const env = {
      NODE_ENV: 'production',
      OTP_PROVIDER: 'android_sms_gateway',
      ANDROID_SMS_GATEWAY_ENDPOINT: 'http://sms-gateway.test',
      ANDROID_SMS_GATEWAY_TOKEN: 'configured-token',
      STT_PROVIDER: 'openai',
      TTS_PROVIDER: 'voicerss',
    } as NodeJS.ProcessEnv;
    const rows = buildAdminIntegrationStatuses({
      env,
      usePython: true,
      pythonBase: 'http://localhost:8010',
      pythonHealth: { ok: false, error: 'ECONNREFUSED' },
      useAi: true,
      aiBaseUrl: 'http://127.0.0.1:11434/v1',
      aiProvider: 'ollama',
      aiModel: 'qwen3.5:9b',
      aiHealth: { ok: true, latencyMs: 12 },
    });

    expect(byId(rows, 'ai_provider')).toMatchObject({ status: 'ready', provider: 'ollama', reasonCode: 'AI_PROVIDER_HEALTH_OK' });
    expect(byId(rows, 'python_api')).toMatchObject({ status: 'blocked', url: 'http://localhost:8010', reasonCode: 'LEGACY_PYTHON_HEALTH_UNREACHABLE' });
    expect(byId(rows, 'sms')).toMatchObject({ status: 'ready', reasonCode: 'ANDROID_SMS_GATEWAY_CONFIGURED' });
    expect(byId(rows, 'whatsapp')).toMatchObject({ status: 'blocked', reasonCode: 'WHATSAPP_TRANSPORT_NOT_CONFIGURED' });
    expect(byId(rows, 'voice')).toMatchObject({ status: 'blocked', reasonCode: 'VOICE_STT_AND_TTS_NOT_CONFIGURED' });
    expect(rows.some((row) => String(row.status) === 'unknown')).toBe(false);
  });

  it('uses intentionally_disabled only for existing explicit enable switches', () => {
    const rows = buildAdminIntegrationStatuses({
      env: { NODE_ENV: 'production' } as NodeJS.ProcessEnv,
      usePython: false,
      pythonBase: 'http://localhost:8010',
      useAi: false,
      aiBaseUrl: 'http://127.0.0.1:11434/v1',
      aiProvider: 'ollama',
      aiModel: 'qwen3.5:9b',
    });
    expect(byId(rows, 'python_api')).toMatchObject({ status: 'intentionally_disabled', reasonCode: 'LEGACY_PYTHON_DISABLED' });
    expect(byId(rows, 'ai_provider')).toMatchObject({ status: 'intentionally_disabled', reasonCode: 'AI_PROVIDER_DISABLED' });
  });

  it('classifies fully configured WhatsApp Cloud and Voice providers as ready', () => {
    const env = {
      NODE_ENV: 'production',
      OTP_PROVIDER: 'android_sms_gateway',
      ANDROID_SMS_GATEWAY_ENDPOINT: 'http://sms-gateway.test',
      ANDROID_SMS_GATEWAY_LOGIN: 'user',
      ANDROID_SMS_GATEWAY_PASSWORD: 'pass',
      WHATSAPP_API_TOKEN: 'token',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify',
      OPENAI_API_KEY: 'openai-key',
      STT_PROVIDER: 'openai',
      TTS_PROVIDER: 'voicerss',
      VOICERSS_API_KEY: 'voice-key',
    } as NodeJS.ProcessEnv;
    const rows = buildAdminIntegrationStatuses({
      env,
      usePython: true,
      pythonBase: 'http://localhost:8010',
      pythonHealth: { ok: true },
      useAi: true,
      aiBaseUrl: 'http://127.0.0.1:11434/v1',
      aiProvider: 'ollama',
      aiModel: 'qwen3.5:9b',
      aiHealth: { ok: true },
    });
    expect(byId(rows, 'whatsapp')).toMatchObject({ status: 'ready', reasonCode: 'WHATSAPP_CLOUD_CONFIGURED' });
    expect(byId(rows, 'voice')).toMatchObject({ status: 'ready', reasonCode: 'VOICE_PROVIDERS_CONFIGURED' });
  });
});
