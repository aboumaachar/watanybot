import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerAuthHook, signAccessToken } from "../auth/auth-middleware";
import { adminWSRoutes, getAdminClientCount } from "../ws/admin-ws";

process.env.JWT_SECRET = "admin-ws-auth-test-secret";

let app: FastifyInstance;
let wsBaseUrl: string;

function token(role: "public" | "admin" | "superadmin") {
  return signAccessToken({ sub: `ws-${role}`, role, email: `${role}@synthetic.local` });
}

function waitForMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket message timeout")), 2_000);
    socket.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()) as Record<string, unknown>);
    });
  });
}

function waitForClose(socket: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket close timeout")), 7_000);
    socket.once("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

async function openSocket() {
  const socket = new WebSocket(`${wsBaseUrl}/ws/admin`);
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return socket;
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  registerAuthHook(app);
  await app.register(websocket);
  await app.register(adminWSRoutes);
  await app.ready();
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  wsBaseUrl = address.replace(/^http/, "ws");
});

afterAll(async () => {
  await app.close();
});

describe("admin WebSocket message authentication", () => {
  it("does not authenticate a socket that sends no auth", async () => {
    const socket = await openSocket();
    const close = waitForClose(socket);
    expect(await close).toBe(4001);
    expect(getAdminClientCount()).toBe(0);
  }, 8_000);

  it.each([
    ["invalid", "not-a-token"],
    ["public", token("public")],
  ])("rejects %s token without adding an admin client", async (_label, accessToken) => {
    const socket = await openSocket();
    const close = waitForClose(socket);
    socket.send(JSON.stringify({ type: "auth", token: accessToken }));
    expect(await close).toBe(4003);
    expect(getAdminClientCount()).toBe(0);
  });

  it.each(["admin", "superadmin"] as const)("authenticates %s over a message", async (role) => {
    const socket = await openSocket();
    socket.send(JSON.stringify({ type: "auth", token: token(role) }));
    await expect(waitForMessage(socket)).resolves.toEqual({ type: "auth:ok" });
    expect(getAdminClientCount()).toBe(1);
    socket.send(JSON.stringify({ type: "ping" }));
    await expect(waitForMessage(socket)).resolves.toMatchObject({ type: "pong" });
    socket.close();
  });

  it("rejects admin commands before authentication and never reflects the token", async () => {
    const socket = await openSocket();
    const close = waitForClose(socket);
    socket.send(JSON.stringify({ type: "monitor" }));
    expect(await close).toBe(4001);
    expect(getAdminClientCount()).toBe(0);
  });
});