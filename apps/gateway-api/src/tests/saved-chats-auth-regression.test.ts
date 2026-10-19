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

  it("ignores dev superadmin headers in non-production unless explicitly opted in", async () => {
    const app = await getApp();
    const previous = process.env.WATANY_ALLOW_DEV_ROLE_HEADER;
    delete process.env.WATANY_ALLOW_DEV_ROLE_HEADER;
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/saved",
        headers: { "x-watany-role": "superadmin", "x-superadmin": "1" },
      });
      expect(response.statusCode).toBe(401);
    } finally {
      if (previous !== undefined) process.env.WATANY_ALLOW_DEV_ROLE_HEADER = previous;
    }
  });

  it("allows opted-in dev superadmin headers without legacy profile login", async () => {
    const app = await getApp();
    const previous = process.env.WATANY_ALLOW_DEV_ROLE_HEADER;
    process.env.WATANY_ALLOW_DEV_ROLE_HEADER = "true";

    const response = await app.inject({
      method: "GET",
      url: "/api/saved",
      headers: {
        "x-watany-role": "superadmin",
        "x-superadmin": "1",
      },
    });
    if (previous === undefined) delete process.env.WATANY_ALLOW_DEV_ROLE_HEADER; else process.env.WATANY_ALLOW_DEV_ROLE_HEADER = previous;

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

    const { signAccessToken } = await import("../auth/auth-middleware");
    const token = signAccessToken({ sub: "saved-crud-user", role: "accredited", email: "saved.crud@watany.test" });
    const auth = { authorization: `Bearer ${token}` };
    const created = await app.inject({
      method: "POST",
      headers: auth,
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
      headers: auth,
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
      headers: auth,
      url: `/api/saved/${item.id}`,
      payload: { status: "deleted_for_me" },
    });
    expect(deletedForMe.statusCode).toBe(200);
    expect(deletedForMe.json()).toEqual(expect.objectContaining({
      id: item.id,
      status: "deleted_for_me",
      deletedForMeAt: expect.any(Number),
    }));

    const listed = await app.inject({ method: "GET", url: "/api/saved", headers: auth });
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

    const removed = await app.inject({ method: "DELETE", url: `/api/saved/${item.id}`, headers: auth });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toEqual({ ok: true });
  });

  it("isolates saved chats by canonical JWT user id", async () => {
    const app = await getApp();
    const { signAccessToken } = await import("../auth/auth-middleware");
    const tokenA = signAccessToken({ sub: "saved-user-a", role: "accredited", email: "saved.a@watany.test" });
    const tokenB = signAccessToken({ sub: "saved-user-b", role: "accredited", email: "saved.b@watany.test" });
    const authA = { authorization: `Bearer ${tokenA}` };
    const authB = { authorization: `Bearer ${tokenB}` };

    const createdA = await app.inject({ method: "POST", url: "/api/saved", headers: authA, payload: { text: "private-a" } });
    const createdB = await app.inject({ method: "POST", url: "/api/saved", headers: authB, payload: { text: "private-b" } });
    expect(createdA.statusCode).toBe(200);
    expect(createdB.statusCode).toBe(200);
    const itemA = createdA.json();
    const itemB = createdB.json();

    const listedA = await app.inject({ method: "GET", url: "/api/saved", headers: authA });
    const listedB = await app.inject({ method: "GET", url: "/api/saved", headers: authB });
    expect(listedA.statusCode).toBe(200);
    expect(listedB.statusCode).toBe(200);
    expect(listedA.json().items.map((item: any) => item.id)).toContain(itemA.id);
    expect(listedA.json().items.map((item: any) => item.id)).not.toContain(itemB.id);
    expect(listedB.json().items.map((item: any) => item.id)).toContain(itemB.id);
    expect(listedB.json().items.map((item: any) => item.id)).not.toContain(itemA.id);

    const crossPatch = await app.inject({ method: "PATCH", url: `/api/saved/${itemA.id}`, headers: authB, payload: { status: "closed" } });
    const crossDelete = await app.inject({ method: "DELETE", url: `/api/saved/${itemA.id}`, headers: authB });
    expect(crossPatch.statusCode).toBe(404);
    expect(crossDelete.statusCode).toBe(404);

    await app.inject({ method: "DELETE", url: `/api/saved/${itemA.id}`, headers: authA });
    await app.inject({ method: "DELETE", url: `/api/saved/${itemB.id}`, headers: authB });
  });

});