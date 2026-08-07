import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signAccessToken } from "../auth/auth-middleware";

let appPromise: Promise<typeof import("../server").default> | null = null;

async function getApp() {
  process.env.JWT_SECRET ||= "test-jwt-secret-for-admin-hardening-0123456789";
  process.env.DISABLE_PLUGIN_DB ||= "true";
  process.env.DISABLE_KB_NODES ||= "true";
  process.env.DISABLE_CHAT_PERSIST ||= "true";
  appPromise ||= import("../server").then((mod) => mod.default);
  return appPromise;
}

beforeAll(async () => {
  await getApp();
}, 60000);

beforeEach(async () => {
  const app = await getApp();
  await app.inject({ method: "POST", url: "/api/profile/logout" });
}, 30000);

afterAll(async () => {
  if (appPromise !== null) {
    const app = await appPromise;
    await app.close();
  }
}, 30000);

describe("notifications JWT auth regression", () => {
  it("allows non-production dev superadmin headers without legacy profile login", async () => {
    const app = await getApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: {
        "x-watany-role": "superadmin",
        "x-superadmin": "1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: expect.any(Array),
    });
  });

  it("does not allow dev superadmin headers when NODE_ENV is production", async () => {
    const app = await getApp();
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/notifications",
        headers: {
          "x-watany-role": "superadmin",
          "x-superadmin": "1",
        },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("allows JWT-authenticated users even when the legacy plugin profile is logged out", async () => {
    const app = await getApp();
    const accessToken = signAccessToken({
      sub: "00000000-0000-0000-0000-000000000001",
      role: "superadmin",
      email: "role-check-user@example.invalid",
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: expect.any(Array),
    });
  });
});
