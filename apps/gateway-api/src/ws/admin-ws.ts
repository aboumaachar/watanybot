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

  app.get("/ws/admin", { websocket: true }, (socket, request) => {
    // Authenticate via query param token
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      socket.close(4001, "Missing token");
      return;
    }

    const payload = verifyToken(token);
    if (!payload || !hasMinRole(payload.role, "admin")) {
      socket.close(4003, "Forbidden");
      return;
    }

    adminClients.add(socket);
    adminLastSeen.set(socket, Date.now());
    app.log.info(`[ws] admin connected: ${payload.email} (${adminClients.size} total)`);

    socket.on("close", () => {
      adminClients.delete(socket);
      app.log.info(`[ws] admin disconnected (${adminClients.size} remaining)`);
    });

    socket.on("message", (raw: Buffer | string) => {
      adminLastSeen.set(socket, Date.now());
      // Admin can send commands: intervention, broadcasts, live activity monitoring
      try {
        const msg = JSON.parse(raw.toString());
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
        app.log.info({ msg }, "[ws] admin message");
      } catch {
        // ignore
      }
    });
  });
}

export function getAdminClientCount(): number {
  return adminClients.size;
}
