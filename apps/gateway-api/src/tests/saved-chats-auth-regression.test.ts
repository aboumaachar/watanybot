import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

describe("saved chats auth regression", () => {
  it("blocks unauthenticated saved chat access", async () => {
    const app = await getApp();
    const response = await app.inject({ method: "GET", url: "/api/saved" });

    expect(response.statusCode).toBe(401);
  });

  it("allows non-production dev superadmin headers without legacy profile login", async () => {
    const app = await getApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/saved",
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
        url: "/api/saved",
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

  it("allows authenticated saved chat CRUD", async () => {
    const app = await getApp();

    const login = await app.inject({
      method: "POST",
      url: "/api/profile/login",
      payload: { name: "Test User", role: "accredited" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toEqual({
      profile: expect.objectContaining({
        isAuthed: true,
        role: "accredited",
      }),
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/saved",
      payload: { text: "hello" },
    });
    expect(created.statusCode).toBe(200);

    const item = created.json();
    expect(item).toEqual(expect.objectContaining({
      id: expect.any(String),
      text: "hello",
      ts: expect.any(Number),
      status: "active",
      updatedAt: expect.any(Number),
    }));

    const closed = await app.inject({
      method: "PATCH",
      url: `/api/saved/${item.id}`,
      payload: { status: "closed" },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toEqual(expect.objectContaining({
      id: item.id,
      status: "closed",
      closedAt: expect.any(Number),
      updatedAt: expect.any(Number),
    }));

    const deletedForMe = await app.inject({
      method: "PATCH",
      url: `/api/saved/${item.id}`,
      payload: { status: "deleted_for_me" },
    });
    expect(deletedForMe.statusCode).toBe(200);
    expect(deletedForMe.json()).toEqual(expect.objectContaining({
      id: item.id,
      status: "deleted_for_me",
      deletedForMeAt: expect.any(Number),
    }));

    const listed = await app.inject({ method: "GET", url: "/api/saved" });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toEqual({
      items: expect.arrayContaining([
        expect.objectContaining({
          id: item.id,
          text: "hello",
          status: "deleted_for_me",
        }),
      ]),
    });

    const removed = await app.inject({ method: "DELETE", url: `/api/saved/${item.id}` });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ ok: true });
  });
});