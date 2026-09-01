/**
 * Admin WebSocket server — real-time push to admin dashboard.
 */
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { verifyToken } from "../auth/auth-middleware.js";
import { hasMinRole } from "../auth/rbac.js";
import type { WSEvent } from "@watany/types";

const adminClients = new Set<WebSocket>();
const adminLastSeen = new WeakMap<WebSocket, number>();
const ADMIN_HEARTBEAT_INTERVAL_MS = 15_000;
const ADMIN_HEARTBEAT_TIMEOUT_MS = 45_000;
const ADMIN_AUTH_TIMEOUT_MS = 5_000;

/**
 * Broadcast a WSEvent to all connected admin clients.
 */
export function broadcastToAdmins(event: WSEvent): void {
  const msg = JSON.stringify(event);
  for (const client of adminClients) {
    try {
      if (client.readyState === 1) {
        client.send(msg);
      }
    } catch {
      adminClients.delete(client);
    }
  }
}

/**
 * Register the /ws/admin WebSocket endpoint.
 */
export async function adminWSRoutes(app: FastifyInstance): Promise<void> {
  const heartbeatTimer = globalThis.setInterval(() => {
    const now = Date.now();
    for (const client of adminClients) {
      const lastSeen = adminLastSeen.get(client) ?? 0;
      if (now - lastSeen > ADMIN_HEARTBEAT_TIMEOUT_MS) {
        client.close();
      }
    }
  }, ADMIN_HEARTBEAT_INTERVAL_MS);

  app.addHook("onClose", async () => {
    globalThis.clearInterval(heartbeatTimer);
  });

  app.get("/ws/admin", { websocket: true }, (socket) => {
    let authenticated = false;
    let authenticatedEmail = "";
    const authTimer = globalThis.setTimeout(() => {
      if (!authenticated) socket.close(4001, "Missing auth");
    }, ADMIN_AUTH_TIMEOUT_MS);

    socket.on("close", () => {
      globalThis.clearTimeout(authTimer);
      adminClients.delete(socket);
      if (authenticated) app.log.info(`[ws] admin disconnected (${adminClients.size} remaining)`);
    });

    socket.on("message", (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!authenticated) {
          if (msg.type !== "auth" || typeof msg.token !== "string") {
            socket.close(4001, "Authentication required");
            return;
          }
          const payload = verifyToken(msg.token);
          if (!payload || !hasMinRole(payload.role, "admin")) {
            socket.close(4003, "Forbidden");
            return;
          }
          authenticated = true;
          authenticatedEmail = payload.email;
          globalThis.clearTimeout(authTimer);
          adminClients.add(socket);
          adminLastSeen.set(socket, Date.now());
          socket.send(JSON.stringify({ type: "auth:ok" }));
          app.log.info(`[ws] admin connected: ${authenticatedEmail} (${adminClients.size} total)`);
          return;
        }

        adminLastSeen.set(socket, Date.now());
        if (msg.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
          return;
        }

        if (msg.type === "monitor" || msg.type === "live-activity") {
          // Live monitoring request — echo current stats
          socket.send(JSON.stringify({
            type: "monitor:stats",
            connectedAdmins: adminClients.size,
            timestamp: new Date().toISOString(),
          }));
        }
        app.log.info({ type: msg.type }, "[ws] admin message");
      } catch {
        // ignore
      }
    });
  });
}

export function getAdminClientCount(): number {
  return adminClients.size;
}
