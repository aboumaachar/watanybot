import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSmsProvider, SmsApiDeliveryProvider } from "../auth/sms";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const managedKeys = [
  "NODE_ENV",
  "OTP_PROVIDER",
  "SMS_API_BASE_URL",
  "SMS_API_KEY",
  "SMS_API_TIMEOUT_MS",
  "SMS_API_SENDER",
  "WHATSAPP_OUTBOUND_MODE",
  "WHATSAPP_API_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
] as const;

const originalEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of managedKeys) originalEnv.set(key, process.env[key]);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 202, text: async () => "" } as Response);
});

afterEach(() => {
  for (const key of managedKeys) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.clearAllMocks();
});

describe("SmsApiDeliveryProvider", () => {
  it("delivers the locally generated OTP through the SMS API message endpoint", async () => {
    const provider = new SmsApiDeliveryProvider({
      baseUrl: "http://127.0.0.1:3012",
      apiKey: "test-project-key",
      sender: "MOWATANY",
      timeoutMs: 5000,
    });

    await provider.sendOtp("+9613123456", "123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3012/v1/messages/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-project-key", "content-type": "application/json" });
    const payload = JSON.parse(String(init.body)) as { to: string; body: string; sender?: string };
    expect(payload.to).toBe("+9613123456");
    expect(payload.sender).toBe("MOWATANY");
    expect(payload.body).toContain("123456");
    expect(payload.body.length).toBeGreaterThan(6);
  });

  it("does not duplicate /v1 when it is already present in the base URL", async () => {
    const provider = new SmsApiDeliveryProvider({ baseUrl: "https://sms.example.test/v1/", apiKey: "key" });
    await provider.sendOtp("+9613123456", "123456");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sms.example.test/v1/messages/send");
  });

  it("fails closed when the SMS API rejects delivery", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "provider unavailable" } as Response);
    const provider = new SmsApiDeliveryProvider({ baseUrl: "http://127.0.0.1:3012", apiKey: "key" });
    await expect(provider.sendOtp("+9613123456", "123456")).rejects.toThrow("SMS API request failed (503)");
  });
});

describe("createSmsProvider", () => {
  it("selects SMS API delivery when OTP_PROVIDER=sms_api", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "sms_api";
    process.env.SMS_API_BASE_URL = "http://127.0.0.1:3012";
    process.env.SMS_API_KEY = "project-key";
    const provider = createSmsProvider();
    expect(provider).toBeInstanceOf(SmsApiDeliveryProvider);
    await provider.sendOtp("+9613123456", "123456");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects production WhatsApp live mode when credentials are missing", () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.WHATSAPP_OUTBOUND_MODE = "live";
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    expect(() => createSmsProvider()).toThrow("WhatsApp live OTP requires");
  });
});
