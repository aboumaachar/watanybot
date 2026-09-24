import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
  getRequestNetworkContext,
  getTrustProxySetting,
  normalizeIp,
} from "../auth/request-network.js";

describe("user-management trusted client IP resolution", () => {
  it("keeps the default proxy trust bounded to loopback", () => {
    expect(getTrustProxySetting(undefined)).toEqual(["127.0.0.1", "::1"]);
    expect(getTrustProxySetting("false")).toBe(false);
    expect(getTrustProxySetting("10.0.0.10,10.0.0.11")).toEqual(["10.0.0.10", "10.0.0.11"]);
    expect(normalizeIp("::ffff:198.51.100.9")).toBe("198.51.100.9");
  });

  it("accepts forwarded client IP only from a trusted loopback peer", async () => {
    const app = Fastify({ trustProxy: getTrustProxySetting(undefined) });
    app.get("/network", async (request) => getRequestNetworkContext(request));
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/network",
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "198.51.100.24" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      clientIp: "198.51.100.24",
      peerIp: "127.0.0.1",
    });
    await app.close();
  });

  it("ignores a spoofed forwarded IP from an untrusted direct peer", async () => {
    const app = Fastify({ trustProxy: getTrustProxySetting(undefined) });
    app.get("/network", async (request) => getRequestNetworkContext(request));
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/network",
      remoteAddress: "203.0.113.41",
      headers: { "x-forwarded-for": "198.51.100.88" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      clientIp: "203.0.113.41",
      peerIp: "203.0.113.41",
    });
    await app.close();
  });
});
