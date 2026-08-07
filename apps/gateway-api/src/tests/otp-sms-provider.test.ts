import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function bodyToText(body: RequestInit["body"]): string {
  if (typeof body === "string") {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  throw new Error("Expected request body to be a string or URLSearchParams");
}

describe("sms provider factory", () => {
  it("allows the console provider outside production", async () => {
    process.env.NODE_ENV = "test";
    process.env.OTP_PROVIDER = "console";

    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { createSmsProvider } = await import("../auth/sms.js");

    await createSmsProvider().sendOtp("+96170123456", "123456");

    expect(writeSpy).toHaveBeenCalledWith("[OTP:dev] +96170123456 → 123456\n");
  });

  it("blocks the console provider in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "console";

    const { createSmsProvider } = await import("../auth/sms.js");

    expect(() => createSmsProvider()).toThrow(/not allowed in production/i);
  });

  it("requires credentials for the twilio provider", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "sms";
    process.env.SMS_PROVIDER = "twilio";
    delete process.env.SMS_ACCOUNT_SID;
    delete process.env.SMS_AUTH_TOKEN;
    delete process.env.SMS_FROM;

    const { createSmsProvider } = await import("../auth/sms.js");

    expect(() => createSmsProvider()).toThrow(/SMS_ACCOUNT_SID|SMS_AUTH_TOKEN|SMS_FROM/);
  });

  it("sends via twilio without logging the OTP code", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "sms";
    process.env.SMS_PROVIDER = "twilio";
    process.env.SMS_ACCOUNT_SID = "AC123";
    process.env.SMS_AUTH_TOKEN = "secret";
    process.env.SMS_FROM = "+15005550006";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { createSmsProvider } = await import("../auth/sms.js");

    await createSmsProvider().sendOtp("+96170123456", "123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/Accounts/AC123/Messages.json");
    expect(init.method).toBe("POST");
    expect(String(init.headers && (init.headers as Record<string, string>).authorization)).toMatch(/^Basic /);
    const bodyText = bodyToText(init.body);
    expect(bodyText).toContain("To=%2B96170123456");
    expect(bodyText).toContain("Body=");
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("allows the whatsapp simulation provider outside production", async () => {
    process.env.NODE_ENV = "test";
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.WHATSAPP_OUTBOUND_MODE = "simulate";
    process.env.WHATSAPP_ACCOUNT_NUMBER = "+96181396332";

    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { createSmsProvider } = await import("../auth/sms.js");

    await createSmsProvider().sendOtp("+96181396332", "123456");

    const firstWrite = String(writeSpy.mock.calls[0]?.[0] ?? "");
    expect(firstWrite).toContain("[OTP:whatsapp:simulate]");
    expect(firstWrite).toContain('"accountNumber":"+96181396332"');
    expect(firstWrite).toContain('"to":"+96181396332"');
    expect(firstWrite).toContain("123456");
  });

  it("blocks the whatsapp simulation provider in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.WHATSAPP_OUTBOUND_MODE = "simulate";
    process.env.WHATSAPP_ACCOUNT_NUMBER = "+96181396332";

    const { createSmsProvider } = await import("../auth/sms.js");

    expect(() => createSmsProvider()).toThrow(/simulation provider is not allowed in production/i);
  });

  it("falls back to whatsapp simulation when live credentials are missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.WHATSAPP_OUTBOUND_MODE = "live";
    delete process.env.WHATSAPP_API_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;

    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);

    const { createSmsProvider } = await import("../auth/sms.js");

    await createSmsProvider().sendOtp("+96170123456", "123456");

    const firstWrite = String(writeSpy.mock.calls[0]?.[0] ?? "");
    expect(firstWrite).toContain("[OTP:whatsapp:simulate]");
    expect(firstWrite).toContain('"accountNumber":"+96181396332"');
    expect(firstWrite).toContain('"to":"+96170123456"');
  });

  it("sends via the live whatsapp provider without logging the OTP code", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "whatsapp";
    process.env.WHATSAPP_OUTBOUND_MODE = "live";
    process.env.WHATSAPP_ACCOUNT_NUMBER = "+96181396332";
    process.env.WHATSAPP_API_TOKEN = "wa-secret";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
    process.env.WHATSAPP_API_URL = "https://graph.facebook.com/v19.0";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const { createSmsProvider } = await import("../auth/sms.js");

    await createSmsProvider().sendOtp("+96170123456", "123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v19.0/123456789/messages");
    expect(init.method).toBe("POST");
    expect(String((init.headers as Record<string, string>).authorization)).toBe("Bearer wa-secret");
    const bodyText = bodyToText(init.body);
    expect(bodyText).toContain('"messaging_product":"whatsapp"');
    expect(bodyText).toContain('"to":"+96170123456"');
    expect(bodyText).toContain("123456");
    expect(writeSpy).not.toHaveBeenCalled();
  });
});