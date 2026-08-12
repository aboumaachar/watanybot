import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import type { CommunityRealtimeEvent } from "@watany/types";

import { verifyToken } from "../auth/auth-middleware.js";
import {
  decodeCommunityRealtimeSequence,
  getLatestCommunityRealtimeSequence,
  setCommunityServiceRealtimeEmitter,
  validateCommunityGroupAccess,
  validateCommunityMessageInGroup,
  type CommunityServiceRealtimeEvent,
  type CommunityViewer,
} from "../community/service.js";
import { isFeatureFlagEnabled } from "../lib/feature-flags.js";

type FeatureFlagResolver = (flagId: string, fallback?: boolean) => Promise<boolean>;
type SocketMessagePayload = string | Buffer | ArrayBuffer | Buffer[];

type CommunitySocketSubscribeMessage = {
  type: "community.subscribe";
  groupId: string;
  since?: string | null;
};

type CommunitySocketUnsubscribeMessage = {
  type: "community.unsubscribe";
  groupId: string;
};

type PingMessage = {
  type: "ping";
};

type CommunitySocketReceiptMessage = {
  type: "community.receipt.delivered";
  groupId: string;
  messageId: string;
};

type CommunitySocketMessage = CommunitySocketSubscribeMessage | CommunitySocketUnsubscribeMessage | CommunitySocketReceiptMessage | PingMessage;

type AuthenticatedCommunitySocket = {
  userId: string;
  viewer: CommunityViewer;
  lastSeenAt: number;
};

export type CommunityWSRoutesOptions = {
  getFeatureFlag?: FeatureFlagResolver;
};

const COMMUNITY_HEARTBEAT_INTERVAL_MS = 15_000;
const COMMUNITY_HEARTBEAT_TIMEOUT_MS = 45_000;

const socketState = new WeakMap<WebSocket, AuthenticatedCommunitySocket>();
const socketGroups = new WeakMap<WebSocket, Set<string>>();
const groupSubscribers = new Map<string, Set<WebSocket>>();
const userSockets = new Map<string, Set<WebSocket>>();

function parseSocketPayload(raw: SocketMessagePayload): string {
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

function safeSend(socket: WebSocket, payload: unknown): boolean {
  if (socket.readyState !== 1) {
    return false;
  }

  try {
    socket.send(JSON.stringify(payload));
    return true;
  } catch {
    socket.close();
    return false;
  }
}

function createCommunitySocketEvent(
  eventType: CommunityRealtimeEvent["eventType"],
  groupId: string,
  actorId: string | null,
  payload: Record<string, unknown>,
  options?: { occurredAt?: string; sequence?: string | null },
): CommunityRealtimeEvent<Record<string, unknown>> {
  return {
    eventId: randomUUID(),
    eventType,
    occurredAt: options?.occurredAt ?? new Date().toISOString(),
    groupId,
    actorId,
    messageId: null,
    sequence: options?.sequence ?? null,
    payload,
  };
}

function requiresCommunityAccessRevalidation(eventType: CommunityRealtimeEvent["eventType"]): boolean {
  return eventType === "community.membership.updated"
    || eventType === "community.member.removed"
    || eventType === "community.member.suspended"
    || eventType === "community.member.banned";
}

function trackUserSocket(userId: string, socket: WebSocket) {
  const sockets = userSockets.get(userId) ?? new Set<WebSocket>();
  sockets.add(socket);
  userSockets.set(userId, sockets);
}

function untrackUserSocket(userId: string, socket: WebSocket) {
  const sockets = userSockets.get(userId);
  if (!sockets) {
    return;
  }

  sockets.delete(socket);
  if (sockets.size === 0) {
    userSockets.delete(userId);
  }
}

function addGroupSubscription(socket: WebSocket, groupId: string) {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    return;
  }

  const groups = socketGroups.get(socket) ?? new Set<string>();
  groups.add(normalizedGroupId);
  socketGroups.set(socket, groups);

  const subscribers = groupSubscribers.get(normalizedGroupId) ?? new Set<WebSocket>();
  subscribers.add(socket);
  groupSubscribers.set(normalizedGroupId, subscribers);
}

function removeGroupSubscription(socket: WebSocket, groupId: string) {
  const normalizedGroupId = groupId.trim();
  if (!normalizedGroupId) {
    return;
  }

  const groups = socketGroups.get(socket);
  groups?.delete(normalizedGroupId);

  const subscribers = groupSubscribers.get(normalizedGroupId);
  subscribers?.delete(socket);
  if (subscribers && subscribers.size === 0) {
    groupSubscribers.delete(normalizedGroupId);
  }
}

function removeSocket(socket: WebSocket) {
  const groups = socketGroups.get(socket);
  if (groups) {
    for (const groupId of groups) {
      removeGroupSubscription(socket, groupId);
    }
  }

  socketGroups.delete(socket);

  const state = socketState.get(socket);
  if (state) {
    untrackUserSocket(state.userId, socket);
  }

  socketState.delete(socket);
}

function markSocketSeen(socket: WebSocket) {
  const state = socketState.get(socket);
  if (!state) {
    return;
  }

  state.lastSeenAt = Date.now();
}

async function sendSubscriptionStatus(
  socket: WebSocket,
  state: AuthenticatedCommunitySocket,
  message: CommunitySocketSubscribeMessage,
  getFeatureFlag: FeatureFlagResolver,
) {
  const latestSequence = await getLatestCommunityRealtimeSequence(message.groupId);
  const pollingFallbackEnabled = await getFeatureFlag("community.realtime.polling_fallback.enabled", true);
  const parsedSince = message.since ? decodeCommunityRealtimeSequence(message.since) : null;
  const invalidSequence = Boolean(message.since) && (!parsedSince || parsedSince.groupId !== message.groupId);
  const sequenceMismatch = Boolean(message.since) && !invalidSequence && message.since !== latestSequence;

  if (invalidSequence || sequenceMismatch) {
    safeSend(socket, createCommunitySocketEvent(
      "community.connection.resync_required",
      message.groupId,
      state.userId,
      {
        latestSequence,
        pollingFallbackEnabled,
        reason: invalidSequence ? "invalid_sequence" : "missed_events",
      },
      { sequence: latestSequence },
    ));
    return;
  }

  safeSend(socket, createCommunitySocketEvent(
    "community.connection.ready",
    message.groupId,
    state.userId,
    {
      latestSequence,
      pollingFallbackEnabled,
    },
    { sequence: latestSequence },
  ));
}

async function handleSubscribe(
  app: FastifyInstance,
  socket: WebSocket,
  message: CommunitySocketSubscribeMessage,
  getFeatureFlag: FeatureFlagResolver,
) {
  const state = socketState.get(socket);
  if (!state) {
    socket.close(4003, "Forbidden");
    return;
  }

  const groupId = message.groupId.trim();
  if (!groupId) {
    safeSend(socket, { type: "community.error", message: "invalid_group_id" });
    return;
  }

  const realtimeEnabled = await getFeatureFlag("community.realtime.enabled", true);
  if (!realtimeEnabled) {
    safeSend(socket, { type: "community.error", message: "community_realtime_disabled" });
    socket.close(4004, "Community realtime disabled");
    return;
  }

  const access = await validateCommunityGroupAccess(groupId, state.viewer, { requireAuthenticated: true });
  if (!access.ok) {
    app.log.warn({ groupId, userId: state.userId, errorCode: access.code }, "community websocket subscription rejected");
    removeGroupSubscription(socket, groupId);
    safeSend(socket, createCommunitySocketEvent(
      "community.authorization.revoked",
      groupId,
      state.userId,
      { code: access.code },
    ));
    return;
  }

  addGroupSubscription(socket, groupId);
  await sendSubscriptionStatus(socket, state, { ...message, groupId }, getFeatureFlag);
}

async function handleSocketMessage(
  app: FastifyInstance,
  socket: WebSocket,
  raw: SocketMessagePayload,
  getFeatureFlag: FeatureFlagResolver,
) {
  let message: CommunitySocketMessage;

  try {
    message = JSON.parse(parseSocketPayload(raw)) as CommunitySocketMessage;
  } catch {
    safeSend(socket, { type: "community.error", message: "invalid_json" });
    return;
  }

  if (message.type === "ping") {
    safeSend(socket, { type: "pong", timestamp: Date.now() });
    return;
  }

  if (message.type === "community.unsubscribe") {
    removeGroupSubscription(socket, message.groupId);
    return;
  }

  if (message.type === "community.subscribe") {
    await handleSubscribe(app, socket, message, getFeatureFlag);
    return;
  }

  if (message.type === "community.receipt.delivered") {
    const state = socketState.get(socket);
    const groupId = message.groupId.trim();
    const messageId = message.messageId.trim();
    const subscribed = socketGroups.get(socket)?.has(groupId);
    if (!state || !groupId || !messageId || !subscribed || !await validateCommunityMessageInGroup(groupId, messageId)) {
      safeSend(socket, { type: "community.error", message: "community_receipt_forbidden" });
      return;
    }

    await fanOutCommunityRealtimeEvent(app, {
      eventId: randomUUID(),
      eventType: "community.receipt.delivered",
      occurredAt: new Date().toISOString(),
      groupId,
      actorId: state.userId,
      messageId,
      sequence: null,
      payload: { recipientUserId: state.userId, messageId },
    });
    return;
  }

  safeSend(socket, { type: "community.error", message: "unknown_message_type" });
}

async function fanOutCommunityRealtimeEvent(app: FastifyInstance, event: CommunityServiceRealtimeEvent) {
  if (event.eventType === "community.read_state.updated") {
    if (!event.actorId) {
      return;
    }

    const sockets = userSockets.get(event.actorId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      if (!safeSend(socket, event)) {
        removeSocket(socket);
      }
    }
    return;
  }

  if (event.eventType === "community.receipt.read") {
    const senderUserId = typeof event.payload.senderUserId === "string" ? event.payload.senderUserId : null;
    if (!senderUserId) {
      return;
    }

    const sockets = userSockets.get(senderUserId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      if (!safeSend(socket, event)) {
        removeSocket(socket);
      }
    }
    return;
  }

  const sockets = groupSubscribers.get(event.groupId);
  if (!sockets) {
    return;
  }

  const shouldRevalidateAccess = requiresCommunityAccessRevalidation(event.eventType);

  for (const socket of [...sockets]) {
    const state = socketState.get(socket);
    if (!state) {
      removeSocket(socket);
      continue;
    }

    if (shouldRevalidateAccess) {
      const access = await validateCommunityGroupAccess(event.groupId, state.viewer, { requireAuthenticated: true });
      if (!access.ok) {
        removeGroupSubscription(socket, event.groupId);
        if (!safeSend(socket, createCommunitySocketEvent(
          "community.authorization.revoked",
          event.groupId,
          state.userId,
          { code: access.code },
          { sequence: event.sequence },
        ))) {
          removeSocket(socket);
        }
        continue;
      }
    }

    if ((event.eventType === "community.typing.started" || event.eventType === "community.typing.stopped") && event.actorId === state.userId) {
      continue;
    }

    if (!safeSend(socket, event)) {
      removeSocket(socket);
    }
  }

  app.log.debug({ eventType: event.eventType, groupId: event.groupId }, "community realtime event delivered");
}

function buildSocketStateFromRequest(request: FastifyRequest): AuthenticatedCommunitySocket | null {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const token = url.searchParams.get("token");
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.sub,
    viewer: {
      id: payload.sub,
      role: payload.role,
    },
    lastSeenAt: Date.now(),
  };
}

export async function communityWSRoutes(app: FastifyInstance, opts?: CommunityWSRoutesOptions): Promise<void> {
  const getFeatureFlag = opts?.getFeatureFlag ?? isFeatureFlagEnabled;

  const heartbeatTimer = globalThis.setInterval(() => {
    const now = Date.now();
    for (const sockets of userSockets.values()) {
      for (const socket of sockets) {
        const state = socketState.get(socket);
        if (!state) {
          removeSocket(socket);
          continue;
        }

        if (now - state.lastSeenAt > COMMUNITY_HEARTBEAT_TIMEOUT_MS) {
          socket.close();
        }
      }
    }
  }, COMMUNITY_HEARTBEAT_INTERVAL_MS);

  const realtimeEmitter = (event: CommunityServiceRealtimeEvent) => {
    void fanOutCommunityRealtimeEvent(app, event);
  };

  setCommunityServiceRealtimeEmitter(realtimeEmitter);

  app.addHook("onClose", async () => {
    globalThis.clearInterval(heartbeatTimer);
    setCommunityServiceRealtimeEmitter(null);
    groupSubscribers.clear();
    userSockets.clear();
  });

  app.get("/ws/community", { websocket: true }, (socket, request) => {
    void (async () => {
      const realtimeEnabled = await getFeatureFlag("community.realtime.enabled", true);
      if (!realtimeEnabled) {
        socket.close(4004, "Community realtime disabled");
        return;
      }

      const state = buildSocketStateFromRequest(request);
      if (!state) {
        const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
        const token = url.searchParams.get("token");
        socket.close(token ? 4003 : 4001, token ? "Forbidden" : "Missing token");
        return;
      }

      socketState.set(socket, state);
      socketGroups.set(socket, new Set<string>());
      trackUserSocket(state.userId, socket);

      app.log.info({ userId: state.userId }, "community websocket connected");

      socket.on("message", (raw: SocketMessagePayload) => {
        markSocketSeen(socket);
        void handleSocketMessage(app, socket, raw, getFeatureFlag).catch((error) => {
          app.log.warn({ err: error instanceof Error ? error.message : String(error), userId: state.userId }, "community websocket message failed");
          safeSend(socket, { type: "community.error", message: "internal_error" });
        });
      });

      socket.on("close", () => {
        removeSocket(socket);
        app.log.info({ userId: state.userId }, "community websocket disconnected");
      });

      socket.on("error", () => {
        removeSocket(socket);
      });
    })().catch((error) => {
      app.log.warn({ err: error instanceof Error ? error.message : String(error) }, "community websocket initialization failed");
      socket.close(1011, "Internal error");
    });
  });
}