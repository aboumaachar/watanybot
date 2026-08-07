import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type OtpStartBody = {
  phone?: string;
  purpose?: string;
  channel?: string;
  locale?: string;
};

type OtpCheckBody = {
  phone?: string;
  purpose?: string;
  code?: string;
};

type StoredOtp = {
  code: string;
  expiresAt: number;
  phone: string;
  purpose: string;
  consumed: boolean;
};

type DispatchResult = {
  ok: boolean;
  status?: number;
  provider: string;
  messageId?: string;
  reason?: string;
  senderPhone?: string;
  gatewayConfigured?: boolean;
  response?: unknown;
};

const otpStore = new Map<string, StoredOtp>();

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getPurpose(value: unknown): string {
  const purpose = normalizeText(value);
  return purpose.length > 0 ? purpose : 'login';
}

function getOtpKey(phone: string, purpose: string): string {
  return purpose + ':' + phone;
}

function createOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getTtlSeconds(): number {
  const configured = Number.parseInt(process.env.SMSAPI_STANDALONE_OTP_TTL_SECONDS ?? '300', 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 300;
}

function getBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return defaultValue;
  }

  const value = raw.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

function shouldExposeCode(): boolean {
  return getBooleanEnv('SMSAPI_STANDALONE_EXPOSE_CODE', false);
}

function requireDispatchSuccess(): boolean {
  return getBooleanEnv('SMSAPI_REQUIRE_DISPATCH_SUCCESS', false);
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return '****';
  }

  return '*'.repeat(Math.max(0, phone.length - 4)) + phone.slice(-4);
}

function getPluginMode(): string {
  return (process.env.SMSAPI_PLUGIN_MODE ?? process.env.SMSAPI_MODE ?? 'standalone').toLowerCase();
}

function getSenderPhone(): string {
  const configured = normalizeText(process.env.SMSAPI_OTP_SENDER_PHONE);
  return configured.length > 0 ? configured : '+96181396332';
}

function getGatewayBaseUrl(): string {
  return normalizeText(process.env.WHATSAPP_LOCAL_GATEWAY_URL ?? process.env.SMSAPI_WHATSAPP_LOCAL_GATEWAY_URL);
}

function getGatewaySendPath(): string {
  const configured = normalizeText(process.env.WHATSAPP_LOCAL_GATEWAY_SEND_PATH);
  return configured.length > 0 ? configured : '/send';
}

function joinUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return cleanBase + cleanPath;
}

function buildOtpMessage(code: string): string {
  const template = normalizeText(process.env.SMSAPI_OTP_MESSAGE_TEMPLATE);
  if (template.length > 0) {
    return template.replace(/\{code\}/g, code);
  }

  return 'WatanyBot verification code: ' + code + '. This code expires in 5 minutes.';
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractMessageId(responseBody: unknown): string | undefined {
  if (!responseBody || typeof responseBody !== 'object') {
    return undefined;
  }

  const record = responseBody as Record<string, unknown>;
  const direct = record.messageId ?? record.id;

  if (typeof direct === 'string') {
    return direct;
  }

  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    const nested = dataRecord.messageId ?? dataRecord.id;
    if (typeof nested === 'string') {
      return nested;
    }
  }

  return undefined;
}

async function dispatchWhatsappLocal(phone: string, code: string, purpose: string): Promise<DispatchResult> {
  const gatewayBaseUrl = getGatewayBaseUrl();
  const senderPhone = getSenderPhone();

  if (gatewayBaseUrl.length === 0) {
    return {
      ok: false,
      provider: 'whatsapp-local-gateway',
      reason: 'WHATSAPP_LOCAL_GATEWAY_URL_MISSING',
      senderPhone: maskPhone(senderPhone),
      gatewayConfigured: false,
    };
  }

  const timeoutMs = Number.parseInt(process.env.SMSAPI_TIMEOUT_MS ?? '10000', 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000);

  const message = buildOtpMessage(code);

  const payload = {
    to: phone,
    phone,
    recipient: phone,
    message,
    text: message,
    from: senderPhone,
    sender: senderPhone,
    senderPhone,
    purpose,
    client: process.env.SMSAPI_WATANYBOT_CLIENT ?? 'watanybot-local',
  };

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  const gatewayApiKey = normalizeText(process.env.WHATSAPP_LOCAL_GATEWAY_API_KEY);
  if (gatewayApiKey.length > 0) {
    headers.authorization = 'Bearer ' + gatewayApiKey;
  }

  try {
    const response = await fetch(joinUrl(gatewayBaseUrl, getGatewaySendPath()), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseBody = await readResponseBody(response);
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        provider: 'whatsapp-local-gateway',
        reason: 'WHATSAPP_GATEWAY_HTTP_ERROR',
        senderPhone: maskPhone(senderPhone),
        gatewayConfigured: true,
        response: responseBody,
      };
    }

    return {
      ok: true,
      status: response.status,
      provider: 'whatsapp-local-gateway',
      messageId: extractMessageId(responseBody) ?? 'whatsapp-local-' + Date.now(),
      senderPhone: maskPhone(senderPhone),
      gatewayConfigured: true,
      response: responseBody,
    };
  } catch (error) {
    clearTimeout(timeout);

    const message = error instanceof Error ? error.message : 'Unknown WhatsApp gateway error';
    const reason = message.toLowerCase().includes('abort') ? 'WHATSAPP_GATEWAY_TIMEOUT' : 'WHATSAPP_GATEWAY_FETCH_FAILED';

    return {
      ok: false,
      provider: 'whatsapp-local-gateway',
      reason,
      senderPhone: maskPhone(senderPhone),
      gatewayConfigured: true,
      response: message,
    };
  }
}

async function dispatchOtp(phone: string, code: string, purpose: string): Promise<DispatchResult> {
  const mode = getPluginMode();

  if (mode === 'whatsapp-local') {
    return dispatchWhatsappLocal(phone, code, purpose);
  }

  return {
    ok: true,
    status: 200,
    provider: 'watanybot-standalone-dev',
    messageId: 'watanybot-standalone-' + Date.now(),
    senderPhone: maskPhone(getSenderPhone()),
    gatewayConfigured: false,
  };
}

function sendBadRequest(reply: FastifyReply, code: string, message: string) {
  return reply.status(400).send({
    success: false,
    error: {
      code,
      message,
    },
  });
}

export async function smsapiOtpRoutes(app: FastifyInstance): Promise<void> {
  if (app.hasRoute({ method: 'GET', url: '/otp/health' })) {
    app.log.warn('SMSAPI OTP routes already exist; skipping duplicate standalone registration.');
    return;
  }

  app.get('/otp/health', async () => {
    const mode = getPluginMode();
    const gatewayBaseUrl = getGatewayBaseUrl();

    return {
      success: true,
      data: {
        ok: true,
        mode,
        provider: mode === 'whatsapp-local' ? 'whatsapp-local-gateway' : 'watanybot-standalone-smsapi-plugin',
        externalEngineRequired: false,
        senderPhone: maskPhone(getSenderPhone()),
        whatsappLocalGatewayConfigured: gatewayBaseUrl.length > 0,
        requireDispatchSuccess: requireDispatchSuccess(),
        exposeCode: shouldExposeCode(),
        client: process.env.SMSAPI_WATANYBOT_CLIENT ?? 'watanybot-local',
        timestamp: new Date().toISOString(),
      },
    };
  });

  app.post('/otp/start', async (request: FastifyRequest<{ Body: OtpStartBody }>, reply) => {
    const body = request.body ?? {};
    const phone = normalizeText(body.phone);
    const purpose = getPurpose(body.purpose);

    if (phone.length === 0) {
      return sendBadRequest(reply, 'PHONE_REQUIRED', 'phone is required.');
    }

    const ttlSeconds = getTtlSeconds();
    const code = createOtpCode();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const key = getOtpKey(phone, purpose);

    otpStore.set(key, {
      code,
      expiresAt,
      phone,
      purpose,
      consumed: false,
    });

    const dispatch = await dispatchOtp(phone, code, purpose);

    if (!dispatch.ok && requireDispatchSuccess()) {
      otpStore.delete(key);

      return reply.status(502).send({
        success: false,
        error: {
          code: 'OTP_DISPATCH_FAILED',
          message: 'OTP was generated but WhatsApp dispatch failed. The OTP was not kept active.',
        },
        data: {
          phone: maskPhone(phone),
          purpose,
          dispatch,
        },
      });
    }

    const responseData: Record<string, unknown> = {
      accepted: true,
      phone: maskPhone(phone),
      purpose,
      expiresInSeconds: ttlSeconds,
      senderPhone: maskPhone(getSenderPhone()),
      dispatch,
    };

    if (shouldExposeCode()) {
      responseData.devOtp = code;
    }

    app.log.info({ phone: maskPhone(phone), purpose, dispatchOk: dispatch.ok, provider: dispatch.provider }, 'SMSAPI OTP processed by WatanyBot plugin.');

    return {
      success: true,
      data: responseData,
    };
  });

  app.post('/otp/check', async (request: FastifyRequest<{ Body: OtpCheckBody }>, reply) => {
    const body = request.body ?? {};
    const phone = normalizeText(body.phone);
    const code = normalizeText(body.code);
    const purpose = getPurpose(body.purpose);

    if (phone.length === 0) {
      return sendBadRequest(reply, 'PHONE_REQUIRED', 'phone is required.');
    }

    if (code.length === 0) {
      return sendBadRequest(reply, 'CODE_REQUIRED', 'code is required.');
    }

    const key = getOtpKey(phone, purpose);
    const stored = otpStore.get(key);

    if (!stored || stored.consumed) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'OTP_NOT_FOUND',
          message: 'No active OTP was found for this phone and purpose.',
        },
      });
    }

    if (stored.expiresAt < Date.now()) {
      otpStore.delete(key);

      return reply.status(401).send({
        success: false,
        error: {
          code: 'OTP_EXPIRED',
          message: 'OTP has expired.',
        },
      });
    }

    if (stored.code !== code) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'OTP_INVALID',
          message: 'OTP code is invalid.',
        },
      });
    }

    otpStore.set(key, {
      ...stored,
      consumed: true,
    });

    return {
      success: true,
      data: {
        verified: true,
        phone: maskPhone(phone),
        purpose,
        provider: 'watanybot-standalone-smsapi-plugin',
      },
    };
  });
}

export default smsapiOtpRoutes;
