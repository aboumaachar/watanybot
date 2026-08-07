export type SmsApiOtpStartInput = {
  phone: string;
  purpose?: string;
  locale?: string;
  channel?: string;
  userRef?: string;
};

export type SmsApiOtpCheckInput = {
  otpRequestId: string;
  phone?: string;
  code: string;
};

type SmsApiConfig = {
  baseUrl: string;
  apiKey: string;
  clientName: string;
  timeoutMs: number;
};

function getSmsApiConfig(): SmsApiConfig {
  return {
    baseUrl: (process.env.SMSAPI_BASE_URL || 'http://localhost:3012/v1').replace(/\/$/, ''),
    apiKey: process.env.SMSAPI_API_KEY || '',
    clientName: process.env.SMSAPI_WATANYBOT_CLIENT || 'watanybot-local',
    timeoutMs: Number(process.env.SMSAPI_TIMEOUT_MS || '10000') || 10000,
  };
}

async function callSmsApi(method: 'GET' | 'POST', path: string, body?: unknown) {
  const config = getSmsApiConfig();

  if (!config.apiKey) {
    return {
      success: false,
      error: {
        code: 'SMSAPI_API_KEY_MISSING',
        message: 'SMSAPI_API_KEY is not configured on WatanyBot gateway.',
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        'x-watanybot-client': config.clientName,
      },
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    return {
      success: response.ok,
      status: response.status,
      data: payload,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'SMSAPI_FETCH_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function smsapiOtpHealth() {
  return callSmsApi('GET', '/integrations/watanybot/otp/health');
}

export async function smsapiOtpStart(input: SmsApiOtpStartInput) {
  return callSmsApi('POST', '/integrations/watanybot/otp/start', {
    phone: input.phone,
    purpose: input.purpose || 'watanybot-login',
    locale: input.locale || 'ar-LB',
    channel: input.channel || 'WHATSAPP',
    userRef: input.userRef,
  });
}

export async function smsapiOtpCheck(input: SmsApiOtpCheckInput) {
  return callSmsApi('POST', '/integrations/watanybot/otp/check', {
    otpRequestId: input.otpRequestId,
    phone: input.phone,
    code: input.code,
  });
}
