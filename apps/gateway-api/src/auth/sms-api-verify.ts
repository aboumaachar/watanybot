type SmsApiSuccessStatus = "pending" | "verified";

type SmsApiRequestOptions = {
  method: "POST" | "GET";
  body?: Record<string, unknown>;
};

export type SmsApiStartVerifyResponse = {
  requestId: string;
  phone: string;
  channel: string;
  status: SmsApiSuccessStatus;
  expiresAt: string;
};

export type SmsApiCheckVerifyResponse = {
  requestId: string;
  phone: string;
  status: SmsApiSuccessStatus;
  verifiedAt?: string;
};

export class SmsApiConfigError extends Error {
  constructor(message = "SMS API phone verification is not configured") {
    super(message);
    this.name = "SmsApiConfigError";
  }
}

export class SmsApiRequestError extends Error {
  readonly statusCode: number;

  readonly responseBody: unknown;

  constructor(statusCode: number, message: string, responseBody?: unknown) {
    super(message);
    this.name = "SmsApiRequestError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getSmsApiConfig() {
  const baseUrl = process.env.SMS_API_BASE_URL?.trim();
  const apiKey = process.env.SMS_API_KEY?.trim();
  const timeoutMs = Number(process.env.SMS_API_TIMEOUT_MS || "10000");

  if (!baseUrl || !apiKey) {
    throw new SmsApiConfigError();
  }

  return {
    baseUrl: trimTrailingSlash(baseUrl),
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000,
  };
}

function buildSmsApiUrl(baseUrl: string, endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}${normalizedEndpoint}`;
  }
  return `${baseUrl}/v1${normalizedEndpoint}`;
}

async function readSmsApiBody(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function smsApiRequest<T>(endpoint: string, options: SmsApiRequestOptions): Promise<T> {
  const { baseUrl, apiKey, timeoutMs } = getSmsApiConfig();
  const response = await fetch(buildSmsApiUrl(baseUrl, endpoint), {
    method: options.method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const responseBody = await readSmsApiBody(response);
  if (!response.ok) {
    const message =
      typeof responseBody === "object" && responseBody && "message" in responseBody
        ? String((responseBody as { message?: unknown }).message || `sms_api_${response.status}`)
        : `sms_api_${response.status}`;
    throw new SmsApiRequestError(response.status, message, responseBody);
  }

  return responseBody as T;
}

export async function startSmsApiPhoneVerification(phone: string): Promise<SmsApiStartVerifyResponse> {
  return smsApiRequest<SmsApiStartVerifyResponse>("/verify/start", {
    method: "POST",
    body: {
      phone,
      channel: "sms",
      template: "default",
      locale: "ar",
    },
  });
}

export async function checkSmsApiPhoneVerification(requestId: string, code: string): Promise<SmsApiCheckVerifyResponse> {
  return smsApiRequest<SmsApiCheckVerifyResponse>("/verify/check", {
    method: "POST",
    body: {
      requestId,
      code,
    },
  });
}