export type AdminIntegrationStatus = 'ready' | 'blocked' | 'intentionally_disabled';

export type IntegrationHealthSignal = {
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
};

export type IntegrationStatusRow = {
  id: string;
  label: string;
  status: AdminIntegrationStatus;
  reasonCode: string;
  provider: string;
  url: string;
  model: string;
  note: string;
};

export type IntegrationStatusInput = {
  env: NodeJS.ProcessEnv;
  usePython: boolean;
  pythonBase: string;
  pythonHealth?: IntegrationHealthSignal;
  useAi: boolean;
  aiBaseUrl: string;
  aiProvider: string;
  aiModel: string;
  aiHealth?: IntegrationHealthSignal;
  gatewayUrl?: string;
};

function envValue(env: NodeJS.ProcessEnv, name: string): string {
  return String(env[name] ?? '').trim();
}

function hasAll(env: NodeJS.ProcessEnv, names: string[]): boolean {
  return names.every((name) => envValue(env, name).length > 0);
}

function row(input: Omit<IntegrationStatusRow, 'url' | 'model' | 'note'> & Partial<Pick<IntegrationStatusRow, 'url' | 'model' | 'note'>>): IntegrationStatusRow {
  return {
    ...input,
    url: input.url ?? '',
    model: input.model ?? '',
    note: input.note ?? '',
  };
}

function classifyLegacyPython(input: IntegrationStatusInput): IntegrationStatusRow {
  if (!input.usePython) {
    return row({ id: 'python_api', label: 'Legacy Python KB Backend', status: 'intentionally_disabled', reasonCode: 'LEGACY_PYTHON_DISABLED', provider: 'python', url: input.pythonBase });
  }
  if (input.pythonHealth?.ok) {
    return row({ id: 'python_api', label: 'Legacy Python KB Backend', status: 'ready', reasonCode: 'LEGACY_PYTHON_HEALTH_OK', provider: 'python', url: input.pythonBase, note: input.pythonHealth.latencyMs === undefined ? '' : `health ${input.pythonHealth.latencyMs}ms` });
  }
  return row({ id: 'python_api', label: 'Legacy Python KB Backend', status: 'blocked', reasonCode: input.pythonHealth?.error ? 'LEGACY_PYTHON_HEALTH_UNREACHABLE' : 'LEGACY_PYTHON_HEALTH_FAILED', provider: 'python', url: input.pythonBase, note: input.pythonHealth?.error ?? '' });
}

function classifyPrimaryAi(input: IntegrationStatusInput): IntegrationStatusRow {
  const provider = input.aiProvider || 'unknown';
  const label = provider.toLowerCase() === 'ollama' ? 'Ollama AI (Primary)' : 'Primary AI Provider';
  if (!input.useAi) {
    return row({ id: 'ai_provider', label, status: 'intentionally_disabled', reasonCode: 'AI_PROVIDER_DISABLED', provider, url: input.aiBaseUrl, model: input.aiModel });
  }
  if (input.aiHealth?.ok) {
    return row({ id: 'ai_provider', label, status: 'ready', reasonCode: 'AI_PROVIDER_HEALTH_OK', provider, url: input.aiBaseUrl, model: input.aiModel, note: input.aiHealth.latencyMs === undefined ? '' : `health ${input.aiHealth.latencyMs}ms` });
  }
  return row({ id: 'ai_provider', label, status: 'blocked', reasonCode: input.aiHealth ? 'AI_PROVIDER_HEALTH_FAILED' : 'AI_PROVIDER_NOT_INITIALIZED', provider, url: input.aiBaseUrl, model: input.aiModel, note: input.aiHealth?.error ?? '' });
}

function classifySms(env: NodeJS.ProcessEnv): IntegrationStatusRow {
  const provider = envValue(env, 'OTP_PROVIDER') || 'console';
  if (provider === 'android_sms_gateway') {
    const endpoint = envValue(env, 'ANDROID_SMS_GATEWAY_ENDPOINT') || envValue(env, 'SMSGATE_ENDPOINT') || envValue(env, 'SMSGATE_API_URL');
    const token = envValue(env, 'ANDROID_SMS_GATEWAY_TOKEN') || envValue(env, 'SMSGATE_TOKEN');
    const login = envValue(env, 'ANDROID_SMS_GATEWAY_LOGIN') || envValue(env, 'SMSGATE_USERNAME');
    const password = envValue(env, 'ANDROID_SMS_GATEWAY_PASSWORD') || envValue(env, 'SMSGATE_PASSWORD');
    if (!endpoint) return row({ id: 'sms', label: 'SMS / OTP', status: 'blocked', reasonCode: 'ANDROID_SMS_GATEWAY_ENDPOINT_MISSING', provider });
    if (!token && !(login && password)) return row({ id: 'sms', label: 'SMS / OTP', status: 'blocked', reasonCode: 'ANDROID_SMS_GATEWAY_AUTH_MISSING', provider, url: endpoint });
    return row({ id: 'sms', label: 'SMS / OTP', status: 'ready', reasonCode: 'ANDROID_SMS_GATEWAY_CONFIGURED', provider, url: endpoint });
  }
  if (provider === 'sms_api') {
    const url = envValue(env, 'SMS_API_BASE_URL');
    return hasAll(env, ['SMS_API_BASE_URL', 'SMS_API_KEY'])
      ? row({ id: 'sms', label: 'SMS / OTP', status: 'ready', reasonCode: 'SMS_API_CONFIGURED', provider, url })
      : row({ id: 'sms', label: 'SMS / OTP', status: 'blocked', reasonCode: 'SMS_API_CONFIG_INCOMPLETE', provider, url });
  }
  if (provider === 'sms') {
    const configured = hasAll(env, ['SMS_ACCOUNT_SID', 'SMS_AUTH_TOKEN', 'SMS_FROM']);
    return row({ id: 'sms', label: 'SMS / OTP', status: configured ? 'ready' : 'blocked', reasonCode: configured ? 'TWILIO_SMS_CONFIGURED' : 'TWILIO_SMS_CONFIG_INCOMPLETE', provider: 'twilio' });
  }
  if (provider === 'whatsapp') {
    const mode = envValue(env, 'WHATSAPP_OUTBOUND_MODE') || (envValue(env, 'NODE_ENV') === 'production' ? 'live' : 'simulate');
    const liveConfigured = hasAll(env, ['WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']);
    if (mode === 'simulate' && envValue(env, 'NODE_ENV') !== 'production') return row({ id: 'sms', label: 'SMS / OTP', status: 'ready', reasonCode: 'WHATSAPP_OTP_SIMULATION_CONFIGURED', provider: 'whatsapp-simulate' });
    return row({ id: 'sms', label: 'SMS / OTP', status: mode === 'live' && liveConfigured ? 'ready' : 'blocked', reasonCode: mode === 'live' && liveConfigured ? 'WHATSAPP_OTP_LIVE_CONFIGURED' : 'WHATSAPP_OTP_CONFIG_INCOMPLETE', provider: `whatsapp-${mode}` });
  }
  if (provider === 'console') {
    const production = envValue(env, 'NODE_ENV') === 'production';
    return row({ id: 'sms', label: 'SMS / OTP', status: production ? 'blocked' : 'ready', reasonCode: production ? 'OTP_CONSOLE_NOT_PRODUCTION_SAFE' : 'OTP_CONSOLE_DEV_PROVIDER', provider });
  }
  return row({ id: 'sms', label: 'SMS / OTP', status: 'blocked', reasonCode: 'OTP_PROVIDER_UNSUPPORTED', provider });
}

function classifyWhatsApp(env: NodeJS.ProcessEnv): IntegrationStatusRow {
  const cloudToken = envValue(env, 'WHATSAPP_API_TOKEN');
  const phoneId = envValue(env, 'WHATSAPP_PHONE_NUMBER_ID');
  const verifyToken = envValue(env, 'WHATSAPP_WEBHOOK_VERIFY_TOKEN');
  const localMode = (envValue(env, 'SMSAPI_PLUGIN_MODE') || envValue(env, 'SMSAPI_MODE')).toLowerCase() === 'whatsapp-local';
  const localUrl = envValue(env, 'WHATSAPP_LOCAL_GATEWAY_URL') || envValue(env, 'SMSAPI_WHATSAPP_LOCAL_GATEWAY_URL');
  if (localMode && localUrl) return row({ id: 'whatsapp', label: 'WhatsApp', status: 'ready', reasonCode: 'WHATSAPP_LOCAL_GATEWAY_CONFIGURED', provider: 'whatsapp-local-gateway', url: localUrl });
  if (!cloudToken) return row({ id: 'whatsapp', label: 'WhatsApp', status: 'blocked', reasonCode: 'WHATSAPP_TRANSPORT_NOT_CONFIGURED', provider: 'whatsapp-cloud' });
  if (!phoneId) return row({ id: 'whatsapp', label: 'WhatsApp', status: 'blocked', reasonCode: 'WHATSAPP_PHONE_NUMBER_ID_MISSING', provider: 'whatsapp-cloud' });
  if (!verifyToken) return row({ id: 'whatsapp', label: 'WhatsApp', status: 'blocked', reasonCode: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN_MISSING', provider: 'whatsapp-cloud' });
  return row({ id: 'whatsapp', label: 'WhatsApp', status: 'ready', reasonCode: 'WHATSAPP_CLOUD_CONFIGURED', provider: 'whatsapp-cloud', url: envValue(env, 'WHATSAPP_API_URL') || 'https://graph.facebook.com/v17.0' });
}

function classifyVoice(env: NodeJS.ProcessEnv): IntegrationStatusRow {
  const sttProvider = (envValue(env, 'STT_PROVIDER') || 'openai').toLowerCase();
  const configuredTtsProvider = (envValue(env, 'TTS_PROVIDER') || 'voicerss').toLowerCase();
  const ttsProvider = ['openai', 'azure', 'voicerss', 'google'].includes(configuredTtsProvider) ? configuredTtsProvider : 'voicerss';
  const sttConfigured = sttProvider === 'local' || envValue(env, 'OPENAI_API_KEY').length > 0;
  const ttsConfigured = ttsProvider === 'google'
    || (ttsProvider === 'openai' && (envValue(env, 'OPENAI_TTS_KEY').length > 0 || envValue(env, 'OPENAI_API_KEY').length > 0))
    || (ttsProvider === 'azure' && envValue(env, 'AZURE_TTS_KEY').length > 0)
    || (ttsProvider === 'voicerss' && envValue(env, 'VOICERSS_API_KEY').length > 0);
  const reasonCode = !sttConfigured && !ttsConfigured ? 'VOICE_STT_AND_TTS_NOT_CONFIGURED'
    : !sttConfigured ? 'VOICE_STT_NOT_CONFIGURED'
      : !ttsConfigured ? 'VOICE_TTS_NOT_CONFIGURED'
        : 'VOICE_PROVIDERS_CONFIGURED';
  return row({
    id: 'voice', label: 'Voice Chat', status: sttConfigured && ttsConfigured ? 'ready' : 'blocked', reasonCode,
    provider: `stt:${sttProvider};tts:${ttsProvider}`,
    note: 'Chat pipeline route is installed; readiness requires both STT and TTS.',
  });
}

export function buildAdminIntegrationStatuses(input: IntegrationStatusInput): IntegrationStatusRow[] {
  return [
    row({ id: 'gateway', label: 'Gateway API', status: 'ready', reasonCode: 'GATEWAY_RUNNING', provider: 'gateway', url: input.gatewayUrl ?? '' }),
    classifyPrimaryAi(input),
    classifyLegacyPython(input),
    classifySms(input.env),
    classifyWhatsApp(input.env),
    classifyVoice(input.env),
    row({ id: 'audit_store', label: 'Audit Store', status: 'ready', reasonCode: 'AUDIT_STORE_POSTGRESQL_BACKED', provider: 'postgresql', note: 'PostgreSQL-backed admin authority store' }),
  ];
}
