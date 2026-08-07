/**
 * SMS provider abstraction for OTP delivery.
 *
 * Configured via environment variable:
 *   OTP_PROVIDER=console   (default — logs to stdout, non-production only)
 *   OTP_PROVIDER=sms       (uses SMS_PROVIDER-specific implementation)
 *   OTP_PROVIDER=whatsapp  (uses WhatsApp simulation or Cloud API delivery)
 */

export interface SmsProvider {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}

type SupportedSmsProvider = "twilio";
type SupportedWhatsAppMode = "live" | "simulate";

const DEFAULT_WHATSAPP_ACCOUNT_NUMBER = "+96181396332";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildOtpMessage(code: string): string {
  return `رمز التحقق الخاص بك في موطني هو: ${code}`;
}

/** Logs OTP to stdout. Never usable in production unless explicitly opted in. */
export class ConsoleMockProvider implements SmsProvider {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    // Safe to log in dev/test — visible in PM2 logs and terminal
    process.stdout.write(`[OTP:dev] ${phoneNumber} → ${code}\n`);
  }
}

export class TwilioSmsProvider implements SmsProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly from: string;
  private readonly authorizationHeader: string;

  constructor(options?: { accountSid?: string; authToken?: string; from?: string }) {
    this.accountSid = options?.accountSid?.trim() || requireEnv("SMS_ACCOUNT_SID");
    this.authToken = options?.authToken?.trim() || requireEnv("SMS_AUTH_TOKEN");
    this.from = options?.from?.trim() || requireEnv("SMS_FROM");
    const credentials = this.accountSid + ":" + this.authToken;
    this.authorizationHeader = `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: this.authorizationHeader,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: this.from,
          Body: buildOtpMessage(code),
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`Twilio SMS request failed (${response.status}): ${errorBody}`);
    }
  }
}

export class WhatsAppSimulationProvider implements SmsProvider {
  private readonly accountNumber: string;

  constructor(options?: { accountNumber?: string }) {
    this.accountNumber = options?.accountNumber?.trim() || process.env.WHATSAPP_ACCOUNT_NUMBER?.trim() || DEFAULT_WHATSAPP_ACCOUNT_NUMBER;
  }

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const payload = {
      messaging_product: "whatsapp",
      accountNumber: this.accountNumber,
      to: phoneNumber,
      type: "text",
      text: { body: buildOtpMessage(code) },
    };

    process.stdout.write(`[OTP:whatsapp:simulate] ${JSON.stringify(payload)}\n`);
  }
}

export class WhatsAppCloudProvider implements SmsProvider {
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly phoneNumberId: string;
  private readonly accountNumber: string;

  constructor(options?: {
    apiUrl?: string;
    apiToken?: string;
    phoneNumberId?: string;
    accountNumber?: string;
  }) {
    this.apiUrl = options?.apiUrl?.trim() || process.env.WHATSAPP_API_URL?.trim() || "https://graph.facebook.com/v17.0";
    this.apiToken = options?.apiToken?.trim() || requireEnv("WHATSAPP_API_TOKEN");
    this.phoneNumberId = options?.phoneNumberId?.trim() || requireEnv("WHATSAPP_PHONE_NUMBER_ID");
    this.accountNumber = options?.accountNumber?.trim() || process.env.WHATSAPP_ACCOUNT_NUMBER?.trim() || DEFAULT_WHATSAPP_ACCOUNT_NUMBER;
  }

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: buildOtpMessage(code) },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `WhatsApp Cloud API request failed for account ${this.accountNumber} (${response.status}): ${errorBody}`,
      );
    }
  }
}

function createConfiguredSmsProvider(): SmsProvider {
  const smsProvider = (process.env.SMS_PROVIDER ?? "twilio").trim().toLowerCase();

  if (smsProvider === "twilio") {
    return new TwilioSmsProvider();
  }

  throw new Error(`Unsupported SMS_PROVIDER: "${smsProvider}"`);
}

function createConfiguredWhatsAppProvider(): SmsProvider {
  const defaultMode: SupportedWhatsAppMode = process.env.NODE_ENV === "production" ? "live" : "simulate";
  const whatsAppMode = (process.env.WHATSAPP_OUTBOUND_MODE ?? defaultMode).trim().toLowerCase();
  const hasLiveCredentials = Boolean(process.env.WHATSAPP_API_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());

  switch (whatsAppMode) {
    case "simulate":
      if (process.env.NODE_ENV === "production") {
        throw new Error("WhatsApp simulation provider is not allowed in production");
      }
      return new WhatsAppSimulationProvider();
    case "live":
      if (!hasLiveCredentials) {
        return new WhatsAppSimulationProvider();
      }
      return new WhatsAppCloudProvider();
    default:
      throw new Error(`Unsupported WHATSAPP_OUTBOUND_MODE: "${whatsAppMode}"`);
  }
}

export function createSmsProvider(): SmsProvider {
  const provider = process.env.OTP_PROVIDER ?? "console";

  switch (provider) {
    case "console":
      if (process.env.NODE_ENV === "production") {
        throw new Error("Console OTP provider is not allowed in production");
      }
      return new ConsoleMockProvider();
    case "sms":
      return createConfiguredSmsProvider();
    case "whatsapp":
      return createConfiguredWhatsAppProvider();
    default:
      throw new Error(`Invalid OTP_PROVIDER: "${provider}"`);
  }
}
