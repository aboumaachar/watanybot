import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { getTrustProxySetting } from "../auth/request-network.js";
import { erpNextReadinessRoutes } from "../routes/erpnext-readiness.js";

describe("ERPNext readiness network boundary", () => {
  it("rejects a public client forwarded through trusted loopback proxy", async () => {
    const app = Fastify({ trustProxy: getTrustProxySetting(undefined) });
    await app.register(erpNextReadinessRoutes);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/erpnext/readiness",
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "198.51.100.24" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ ok: false, error: "not_found" });
    await app.close();
  });

  it("rejects a direct non-loopback client even with spoofed forwarding", async () => {
    const app = Fastify({ trustProxy: getTrustProxySetting(undefined) });
    await app.register(erpNextReadinessRoutes);
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/api/erpnext/readiness",
      remoteAddress: "203.0.113.41",
      headers: { "x-forwarded-for": "127.0.0.1" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
