import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { advancedRoutes } from "../routes/advanced";

async function makeApp() {
  const app = Fastify();
  app.addHook("onRequest", async (request) => {
    const id = request.headers["x-test-user-id"];
    const role = request.headers["x-test-user-role"];
    if (typeof id === "string" && typeof role === "string") {
      request.user = {
        id,
        role: role as any,
        email: `${id}@watany.test`,
      };
    }
  });
  await app.register(advancedRoutes);
  await app.ready();
  return app;
}

const headers = (id: string, role: string) => ({
  "x-test-user-id": id,
  "x-test-user-role": role,
});
describe("advanced route authorization convergence", () => {
  it("rejects guest behavioral profile reads", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/v2/user/user-a/profile" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("allows an accredited user to read only their own profile", async () => {
    const app = await makeApp();
    const own = await app.inject({ method: "GET", url: "/api/v2/user/user-a/profile", headers: headers("user-a", "accredited") });
    const cross = await app.inject({ method: "GET", url: "/api/v2/user/user-b/profile", headers: headers("user-a", "accredited") });
    expect(own.statusCode).toBe(200);
    expect(own.json()).toMatchObject({ userId: "user-a" });
    expect(cross.statusCode).toBe(403);
    await app.close();
  });

  it("allows an admin to read another user's profile", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/v2/user/user-b/profile", headers: headers("admin-a", "admin") });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: "user-b" });
    await app.close();
  });

  it("protects interaction analytics as an admin surface", async () => {
    const app = await makeApp();
    const guest = await app.inject({ method: "GET", url: "/api/v2/analytics/interactions?limit=1" });
    const accredited = await app.inject({ method: "GET", url: "/api/v2/analytics/interactions?limit=1", headers: headers("user-a", "accredited") });
    const admin = await app.inject({ method: "GET", url: "/api/v2/analytics/interactions?limit=1", headers: headers("admin-a", "admin") });
    expect(guest.statusCode).toBe(401);
    expect(accredited.statusCode).toBe(403);
    expect(admin.statusCode).toBe(200);
    expect(admin.json()).toHaveProperty("interactions");
    await app.close();
  });
});
