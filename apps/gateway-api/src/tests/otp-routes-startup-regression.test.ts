import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("otpRoutes startup resilience", () => {
  it("registers in production even when OTP provider is invalid for runtime", async () => {
    process.env.NODE_ENV = "production";
    process.env.OTP_PROVIDER = "console";

    const { otpRoutes } = await import("../auth/otp-routes");
    const app = Fastify({ logger: false });
    await app.register(otpRoutes);
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03123456" },
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: expect.any(String) });

    await app.close();
  });
});