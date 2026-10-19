import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AndroidSmsGatewayProvider, createSmsProvider } from "../auth/sms";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const keys = [
  "NODE_ENV", "OTP_PROVIDER", "ANDROID_SMS_GATEWAY_ENDPOINT", "ANDROID_SMS_GATEWAY_LOGIN",
  "ANDROID_SMS_GATEWAY_PASSWORD", "ANDROID_SMS_GATEWAY_TOKEN", "ANDROID_SMS_GATEWAY_TIMEOUT_MS",
] as const;
const original = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of keys) original.set(key, process.env[key]);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 202, text: async () => "" } as Response);
});

afterEach(() => {
  for (const key of keys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  vi.clearAllMocks();
});
describe("AndroidSmsGatewayProvider", () => {
  it("sends OTP text through the private SMSGate messages endpoint with Basic auth", async () => {
    const provider = new AndroidSmsGatewayProvider({ endpoint: "http://127.0.0.1:3000/api/3rdparty/v1", login: "watany", password: "secret" });
    await provider.sendOtp("+9613156789", "123456");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3000/api/3rdparty/v1/messages");
    expect((init.headers as Record<string, string>).authorization).toMatch(/^Basic /);
    const body = JSON.parse(String(init.body)) as { phoneNumbers: string[]; textMessage: { text: string }; ttl: number; priority: number };
    expect(body.phoneNumbers).toEqual(["+9613156789"]);
    expect(body.textMessage.text).toContain("123456");
    expect(body.ttl).toBe(300);
    expect(body.priority).toBe(100);
  });

  it("supports a scoped bearer token and provider factory selection", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "android_sms_gateway";
    process.env.ANDROID_SMS_GATEWAY_ENDPOINT = "https://sms.example.test/api/3rdparty/v1";
    process.env.ANDROID_SMS_GATEWAY_TOKEN = "scoped-token";
    const provider = createSmsProvider();
    expect(provider).toBeInstanceOf(AndroidSmsGatewayProvider);
    await provider.sendOtp("+9613156789", "654321");
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).authorization).toBe("Bearer scoped-token");
  });

  it("fails closed when authentication is not configured", () => {
    delete process.env.ANDROID_SMS_GATEWAY_TOKEN;
    delete process.env.ANDROID_SMS_GATEWAY_LOGIN;
    delete process.env.ANDROID_SMS_GATEWAY_PASSWORD;
    expect(() => new AndroidSmsGatewayProvider({ endpoint: "http://127.0.0.1:3000/api/3rdparty/v1" })).toThrow(/ANDROID_SMS_GATEWAY_LOGIN/);
  });

  it("fails closed when SMSGate rejects the message", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "no active device" } as Response);
    const provider = new AndroidSmsGatewayProvider({ endpoint: "http://127.0.0.1:3000/api/3rdparty/v1", token: "token" });
    await expect(provider.sendOtp("+9613156789", "123456")).rejects.toThrow("Android SMS Gateway request failed (503)");
  });
});
