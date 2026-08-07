import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { createDefaultWorldCupService } from "../worldcup";
import { getWorldCupLiveSnapshot } from "../routes/world-cup-live";

type SocketMessagePayload = string | Buffer | ArrayBuffer | Buffer[];

type SubscribeMessage = {
  type: "world-cup.subscribe";
  matchIds: string[];
};

type UnsubscribeMessage = {
  type: "world-cup.unsubscribe";
  matchIds: string[];
};

type PingMessage = {
  type: "ping";
};

type WorldCupSocketMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

const worldCupService = createDefaultWorldCupService();
const socketSubscriptions = new WeakMap<WebSocket, Set<string>>();
const matchSubscribers = new Map<string, Set<WebSocket>>();
const lastBroadcastHashes = new Map<string, string>();
const WORLD_CUP_REFRESH_MS = 10_000;

function parseSocketPayload(raw: SocketMessagePayload) {
  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString();
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString();
  }

  return raw.toString();
}

function safeSend(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== 1) {
    return;
  }

  try {
    socket.send(JSON.stringify(payload));
  } catch {
    socket.close();
  }
}

function addSubscription(socket: WebSocket, matchId: string) {
  const normalizedMatchId = matchId.trim();
  if (!normalizedMatchId) {
    return;
  }

  const subscriptions = socketSubscriptions.get(socket) ?? new Set<string>();
  subscriptions.add(normalizedMatchId);
  socketSubscriptions.set(socket, subscriptions);

  const subscribers = matchSubscribers.get(normalizedMatchId) ?? new Set<WebSocket>();
  subscribers.add(socket);
  matchSubscribers.set(normalizedMatchId, subscribers);
}

function removeSubscription(socket: WebSocket, matchId: string) {
  const subscriptions = socketSubscriptions.get(socket);
  subscriptions?.delete(matchId);

  const subscribers = matchSubscribers.get(matchId);
  subscribers?.delete(socket);
  if (subscribers && subscribers.size === 0) {
    matchSubscribers.delete(matchId);
    lastBroadcastHashes.delete(matchId);
  }
}

function removeSocket(socket: WebSocket) {
  const subscriptions = socketSubscriptions.get(socket);
  if (!subscriptions) {
    return;
  }

  for (const matchId of subscriptions) {
    removeSubscription(socket, matchId);
  }

  socketSubscriptions.delete(socket);
}

async function sendSnapshot(socket: WebSocket, matchId: string) {
  const snapshot = await getWorldCupLiveSnapshot(matchId, worldCupService);
  if (!snapshot) {
    safeSend(socket, { type: "world-cup.error", matchId, message: "match_not_found" });
    return;
  }

  safeSend(socket, { type: "world-cup.snapshot", matchId, snapshot });
}

async function refreshSubscribedMatches() {
  const matchIds = [...matchSubscribers.keys()];

  await Promise.all(matchIds.map(async (matchId) => {
    const subscribers = matchSubscribers.get(matchId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const snapshot = await getWorldCupLiveSnapshot(matchId, worldCupService);
    if (!snapshot) {
      return;
    }

    const hash = JSON.stringify(snapshot);
    if (lastBroadcastHashes.get(matchId) === hash) {
      return;
    }

    lastBroadcastHashes.set(matchId, hash);
    for (const socket of subscribers) {
      safeSend(socket, { type: "world-cup.snapshot", matchId, snapshot });
    }
  }));
}

export async function publishWorldCupMatchSnapshot(matchId: string) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const snapshot = await getWorldCupLiveSnapshot(matchId, worldCupService);
  if (!snapshot) {
    return;
  }

  lastBroadcastHashes.set(matchId, JSON.stringify(snapshot));
  for (const socket of subscribers) {
    safeSend(socket, { type: "world-cup.snapshot", matchId, snapshot });
  }
}

export async function worldCupWSRoutes(app: FastifyInstance): Promise<void> {
  const refreshTimer = globalThis.setInterval(() => {
    void refreshSubscribedMatches().catch((error) => {
      app.log.warn({ err: error instanceof Error ? error.message : String(error) }, "world cup websocket refresh failed");
    });
  }, WORLD_CUP_REFRESH_MS);

  app.addHook("onClose", async () => {
    globalThis.clearInterval(refreshTimer);
  });

  app.get("/ws/world-cup", { websocket: true }, (socket) => {
    socketSubscriptions.set(socket, new Set<string>());

    socket.on("message", (raw: SocketMessagePayload) => {
      let message: WorldCupSocketMessage;

      try {
        message = JSON.parse(parseSocketPayload(raw)) as WorldCupSocketMessage;
      } catch {
        safeSend(socket, { type: "world-cup.error", message: "invalid_json" });
        return;
      }

      if (message.type === "ping") {
        safeSend(socket, { type: "pong", timestamp: Date.now() });
        return;
      }

      if (message.type === "world-cup.unsubscribe") {
        for (const matchId of message.matchIds || []) {
          removeSubscription(socket, matchId);
        }
        return;
      }

      if (message.type === "world-cup.subscribe") {
        for (const matchId of message.matchIds || []) {
          addSubscription(socket, matchId);
          void sendSnapshot(socket, matchId);
        }
      }
    });

    socket.on("close", () => {
      removeSocket(socket);
    });

    socket.on("error", () => {
      removeSocket(socket);
    });
  });
}