import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { getFeatureFlagsPayload, type FeatureFlagsPayload } from "../lib/feature-flags.js";

type FeatureFlagsEvent = {
  type: "feature-flags.snapshot" | "feature-flags.updated";
  payload: FeatureFlagsPayload;
  timestamp: number;
};

const featureClients = new Set<WebSocket>();
const featureLastSeen = new WeakMap<WebSocket, number>();
const FEATURE_HEARTBEAT_INTERVAL_MS = 15_000;
const FEATURE_HEARTBEAT_TIMEOUT_MS = 45_000;

function sendEvent(socket: WebSocket, event: FeatureFlagsEvent) {
  if (socket.readyState !== 1) {
    return;
  }

  try {
    socket.send(JSON.stringify(event));
  } catch {
    featureClients.delete(socket);
  }
}

export async function broadcastFeatureFlagsUpdate(payload?: FeatureFlagsPayload): Promise<void> {
  const nextPayload = payload ?? await getFeatureFlagsPayload();
  const event: FeatureFlagsEvent = {
    type: "feature-flags.updated",
    payload: nextPayload,
    timestamp: Date.now(),
  };

  for (const client of featureClients) {
    sendEvent(client, event);
  }
}

export async function featuresWSRoutes(app: FastifyInstance): Promise<void> {
  const heartbeatTimer = globalThis.setInterval(() => {
    const now = Date.now();
    for (const client of featureClients) {
      const lastSeen = featureLastSeen.get(client) ?? 0;
      if (now - lastSeen > FEATURE_HEARTBEAT_TIMEOUT_MS) {
        client.close();
      }
    }
  }, FEATURE_HEARTBEAT_INTERVAL_MS);

  app.addHook("onClose", async () => {
    globalThis.clearInterval(heartbeatTimer);
  });

  app.get("/ws/features", { websocket: true }, async (socket) => {
    featureClients.add(socket);
    featureLastSeen.set(socket, Date.now());

    const snapshot = await getFeatureFlagsPayload();
    sendEvent(socket, {
      type: "feature-flags.snapshot",
      payload: snapshot,
      timestamp: Date.now(),
    });

    socket.on("close", () => {
      featureClients.delete(socket);
    });

    socket.on("message", (raw: Buffer | string) => {
      featureLastSeen.set(socket, Date.now());
      try {
        const message = JSON.parse(raw.toString()) as { type?: string };
        if (message.type === "ping") {
          socket.send(JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }));
        }
      } catch {
        // ignore invalid client payloads
      }
    });
  });
}