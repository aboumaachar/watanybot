import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, sendOtpMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  sendOtpMock: vi.fn(),
}));

vi.mock("../lib/db.js", () => ({ query: queryMock }));
vi.mock("../auth/sms.js", () => ({
  createSmsProvider: () => ({ sendOtp: sendOtpMock }),
}));

const { otpRoutes, normalizePhone } = await import("../auth/otp-routes");

beforeEach(() => {
  queryMock.mockReset();
  sendOtpMock.mockReset();
  sendOtpMock.mockResolvedValue(undefined);
});
describe("OTP request persistence resilience", () => {
  it("normalizes the login phone shown by the production UI", () => {
    expect(normalizePhone("03156789")).toBe("+9613156789");
  });

  it("maps phone_otps persistence failures to controlled service unavailability", async () => {
    queryMock.mockRejectedValueOnce(Object.assign(new Error('relation "phone_otps" does not exist'), { code: "42P01" }));
    const app = Fastify({ logger: false });
    await app.register(otpRoutes);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/otp/request",
      payload: { phoneNumber: "03156789" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: expect.any(String) });
    expect(sendOtpMock).not.toHaveBeenCalled();
    await app.close();
  });
});
