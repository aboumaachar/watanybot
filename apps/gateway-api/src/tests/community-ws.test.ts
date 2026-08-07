import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";

import { registerAuthHook, signAccessToken } from "../auth/auth-middleware";
import {
  addCommunityMessage,
  createCommunityGroup,
  getCommunityGroupMessagesPage,
  markCommunityGroupRead,
  resetCommunityStore,
  setCommunityGroupTyping,
  suspendCommunityGroupMember,
} from "../community/service";
import { runMigrations } from "../db/migrate";
import { communityWSRoutes } from "../ws/community-ws";
import { acquireCommunityDbTestLock } from "./community-db-test-lock";

process.env.JWT_SECRET ||= "test-jwt-secret-for-community-ws-0123456789";

type SocketQueueMessage = Record<string, unknown>;

function adminAccessToken() {
  return signAccessToken({
    sub: "community-admin-1",
    role: "admin",
    email: "community.admin@watany.test",
  });
}

function userAccessToken(userId: string, email: string) {
  return signAccessToken({
    sub: userId,
    role: "user",
    email,
  });
}

async function readSocketData(data: unknown): Promise<string> {
  if (typeof data === "string") {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString();
  }

  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString();
  }

  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return await data.text();
  }

  return String(data);
}

function createSocketQueue(socket: WebSocket) {
  const pending: SocketQueueMessage[] = [];
  const waiters: Array<(value: SocketQueueMessage) => void> = [];

  const listener = (event: any) => {
    void readSocketData(event.data)
      .then((text) => JSON.parse(text) as SocketQueueMessage)
      .then((message) => {
        const waiter = waiters.shift();
        if (waiter) {
          waiter(message);
          return;
        }

        pending.push(message);
      });
  };

  socket.addEventListener("message", listener);

  return {
    async next(timeoutMs = 2_000): Promise<SocketQueueMessage> {
      if (pending.length > 0) {
        return pending.shift() as SocketQueueMessage;
      }

      return await new Promise<SocketQueueMessage>((resolve, reject) => {
        const timer = globalThis.setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(new Error("Timed out waiting for websocket message"));
        }, timeoutMs);

        const waiter = (message: SocketQueueMessage) => {
          globalThis.clearTimeout(timer);
          resolve(message);
        };

        waiters.push(waiter);
      });
    },
    async expectNone(timeoutMs = 250): Promise<void> {
      try {
        const message = await this.next(timeoutMs);
        throw new Error(`Unexpected websocket message: ${JSON.stringify(message)}`);
      } catch (error) {
        if (error instanceof Error && error.message === "Timed out waiting for websocket message") {
          return;
        }

        throw error;
      }
    },
    dispose() {
      socket.removeEventListener("message", listener);
    },
  };
}

async function waitForSocketOpen(socket: WebSocket, timeoutMs = 2_000): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket open"));
    }, timeoutMs);

    const handleOpen = () => {
      cleanup();
      resolve();
    };

    const handleClose = (event: any) => {
      cleanup();
      reject(new Error(`Socket closed before open: ${event.code}`));
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Socket errored before open"));
    };

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
  });
}

async function waitForSocketClose(socket: WebSocket, timeoutMs = 2_000): Promise<{ code: number; reason: string }> {
  const result = { code: 0, reason: "" };

  await new Promise<void>((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket close"));
    }, timeoutMs);

    const handleClose = (event: any) => {
      result.code = event.code;
      result.reason = typeof event.reason === "string" ? event.reason : String(event.reason ?? "");
      cleanup();
      resolve();
    };

    const handleError = () => {
      // Closing follows on auth failures; keep waiting for the close frame.
    };

    const cleanup = () => {
      globalThis.clearTimeout(timer);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("error", handleError);
    };

    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
  });

  return result;
}

async function openCommunitySocket(baseWsUrl: string, token: string): Promise<WebSocket> {
  const socket = new WebSocket(`${baseWsUrl}/ws/community?token=${encodeURIComponent(token)}`);
  await waitForSocketOpen(socket);
  return socket;
}

async function startCommunityWsApp(flags?: Record<string, boolean>): Promise<{ app: FastifyInstance; wsBaseUrl: string }> {
  const app = Fastify({ logger: false });
  registerAuthHook(app);
  await app.register(websocket);
  app.register(communityWSRoutes, {
    getFeatureFlag: async (flagId, defaultValue = true) => {
      return Object.hasOwn(flags ?? {}, flagId)
        ? Boolean(flags?.[flagId])
        : defaultValue;
    },
  });
  await app.ready();

  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  return {
    app,
    wsBaseUrl: address.replace(/^http/, "ws"),
  };
}

let releaseDbTestLock: null | (() => Promise<void>) = null;

beforeAll(async () => {
  const release = await acquireCommunityDbTestLock();
  try {
    await runMigrations();
  } finally {
    await release();
  }
});

beforeEach(async () => {
  releaseDbTestLock = await acquireCommunityDbTestLock();
  await resetCommunityStore();
});

afterEach(async () => {
  if (releaseDbTestLock) {
    await releaseDbTestLock();
    releaseDbTestLock = null;
  }
});

describe("community websocket routes", () => {
  it("rejects missing and invalid websocket tokens", async () => {
    const { app, wsBaseUrl } = await startCommunityWsApp();

    const missingSocket = new WebSocket(`${wsBaseUrl}/ws/community`);
    const missingClose = await waitForSocketClose(missingSocket);
    expect(missingClose.code).toBe(4001);

    const invalidSocket = new WebSocket(`${wsBaseUrl}/ws/community?token=not-a-token`);
    const invalidClose = await waitForSocketClose(invalidSocket);
    expect(invalidClose.code).toBe(4003);

    await app.close();
  });

  it("delivers typing and message events to authorized subscribers", async () => {
    const { app, wsBaseUrl } = await startCommunityWsApp();
    const viewer = { id: "community-admin-1", role: "admin" } as const;
    const page = await getCommunityGroupMessagesPage("health-room", viewer);
    expect(page.ok).toBe(true);
    if (!page.ok) {
      await app.close();
      return;
    }

    const socket = await openCommunitySocket(wsBaseUrl, adminAccessToken());
    const queue = createSocketQueue(socket);

    socket.send(JSON.stringify({ type: "community.subscribe", groupId: "health-room", since: page.value.latestSequence }));
    await expect(queue.next()).resolves.toMatchObject({
      eventType: "community.connection.ready",
      groupId: "health-room",
      payload: { latestSequence: page.value.latestSequence },
    });

    const typing = await setCommunityGroupTyping("health-room", "مرسل مباشر", true, { id: "community-admin-2", role: "admin" });
    expect(typing.ok).toBe(true);
    await expect(queue.next()).resolves.toMatchObject({
      eventType: "community.typing.started",
      groupId: "health-room",
      actorId: "community-admin-2",
      payload: expect.objectContaining({ userId: "community-admin-2", userName: "مرسل مباشر" }),
    });

    const created = await addCommunityMessage(
      "health-room",
      {
        id: "health-live-msg-1",
        groupId: "health-room",
        senderId: "community-admin-2",
        senderName: "مرسل مباشر",
        senderRole: "admin",
        type: "text",
        body: "رسالة مباشرة لاختبار النقل الحي",
        createdAt: "2026-06-24T06:00:00.000Z",
      },
      { viewer: { id: "community-admin-2", role: "admin" } },
    );
    expect(created.ok).toBe(true);

    await expect(queue.next()).resolves.toMatchObject({
      eventType: "community.typing.stopped",
      groupId: "health-room",
      actorId: "community-admin-2",
      payload: expect.objectContaining({ userId: "community-admin-2", userName: "مرسل مباشر" }),
    });

    await expect(queue.next()).resolves.toMatchObject({
      eventType: "community.message.created",
      groupId: "health-room",
      actorId: "community-admin-2",
      messageId: "health-live-msg-1",
      payload: expect.objectContaining({
        clientRequestId: null,
        message: expect.objectContaining({ id: "health-live-msg-1", body: "رسالة مباشرة لاختبار النقل الحي" }),
      }),
    });

    queue.dispose();
    socket.close();
    await app.close();
  });

  it("requires resync after reconnect when the since sequence is stale", async () => {
    const { app, wsBaseUrl } = await startCommunityWsApp();
    const viewer = { id: "community-admin-1", role: "admin" } as const;
    const page = await getCommunityGroupMessagesPage("health-room", viewer);
    expect(page.ok).toBe(true);
    if (!page.ok) {
      await app.close();
      return;
    }

    const staleSequence = page.value.latestSequence;
    expect(staleSequence).not.toBeNull();

    const firstSocket = await openCommunitySocket(wsBaseUrl, adminAccessToken());
    const firstQueue = createSocketQueue(firstSocket);
    firstSocket.send(JSON.stringify({ type: "community.subscribe", groupId: "health-room", since: staleSequence }));
    await expect(firstQueue.next()).resolves.toMatchObject({ eventType: "community.connection.ready" });

    firstQueue.dispose();
    firstSocket.close();
    await waitForSocketClose(firstSocket);

    const writeResult = await addCommunityMessage(
      "health-room",
      {
        id: "health-live-msg-2",
        groupId: "health-room",
        senderId: "community-admin-2",
        senderName: "مُرسِل لاحق",
        senderRole: "admin",
        type: "text",
        body: "رسالة بعد انقطاع الاتصال",
        createdAt: "2026-06-24T06:05:00.000Z",
      },
      { viewer: { id: "community-admin-2", role: "admin" } },
    );
    expect(writeResult.ok).toBe(true);

    const secondSocket = await openCommunitySocket(wsBaseUrl, adminAccessToken());
    const secondQueue = createSocketQueue(secondSocket);
    secondSocket.send(JSON.stringify({ type: "community.subscribe", groupId: "health-room", since: staleSequence }));

    const resync = await secondQueue.next();
    expect(resync).toMatchObject({
      eventType: "community.connection.resync_required",
      groupId: "health-room",
      payload: expect.objectContaining({ reason: "missed_events" }),
    });
    expect(((resync.payload as Record<string, unknown>).latestSequence)).not.toBe(staleSequence);

    secondQueue.dispose();
    secondSocket.close();
    await app.close();
  });

  it("rejects unauthorized subscription attempts for restricted groups", async () => {
    const { app, wsBaseUrl } = await startCommunityWsApp();
    const group = await createCommunityGroup(
      {
        id: "private-community-room",
        communityId: "watany-community",
        name: "غرفة خاصة",
        description: "غرفة تتطلب عضوية صريحة",
        category: "support",
        memberCount: 1,
        unreadCount: 0,
        visibility: "private",
      },
      { id: "community-admin-1", role: "admin" },
    );
    expect(group.id).toBe("private-community-room");

    const socket = await openCommunitySocket(wsBaseUrl, userAccessToken("community-user-5", "community.user5@watany.test"));
    const queue = createSocketQueue(socket);
    socket.send(JSON.stringify({ type: "community.subscribe", groupId: group.id }));

    await expect(queue.next()).resolves.toMatchObject({
      eventType: "community.authorization.revoked",
      groupId: group.id,
      payload: { code: "community_group_forbidden" },
    });

    queue.dispose();
    socket.close();
    await app.close();
  });

  it("fans out read-state updates to same-user tabs without leaking them to other subscribers", async () => {
    const { app, wsBaseUrl } = await startCommunityWsApp();
    const viewer = { id: "community-admin-1", role: "admin" } as const;
    const page = await getCommunityGroupMessagesPage("health-room", viewer);
    expect(page.ok).toBe(true);
    if (!page.ok) {
      await app.close();
      return;
    }

    const token = adminAccessToken();
    const socketA = await openCommunitySocket(wsBaseUrl, token);
    const socketB = await openCommunitySocket(wsBaseUrl, token);
    const otherSocket = await openCommunitySocket(wsBaseUrl, userAccessToken("community-user-7", "community.user7@watany.test"));
    const queueA = createSocketQueue(socketA);
    const queueB = createSocketQueue(socketB);
    const otherQueue = createSocketQueue(otherSocket);

    const subscribePayload = JSON.stringify({ type: "community.subscribe", groupId: "health-room", since: page.value.latestSequence });
    socketA.send(subscribePayload);
    socketB.send(subscribePayload);
    otherSocket.send(subscribePayload);
    await expect(queueA.next()).resolves.toMatchObject({ eventType: "community.connection.ready" });
    await expect(queueB.next()).resolves.toMatchObject({ eventType: "community.connection.ready" });
    await expect(otherQueue.next()).resolves.toMatchObject({ eventType: "community.connection.ready" });

    const readResult = await markCommunityGroupRead("health-room", viewer);
    expect(readResult.ok).toBe(true);

    await expect(queueA.next()).resolves.toMatchObject({
      eventType: "community.read_state.updated",
      actorId: viewer.id,
      groupId: "health-room",
    });
    await expect(queueB.next()).resolves.toMatchObject({
      eventType: "community.read_state.updated",
      actorId: viewer.id,
      groupId: "health-room",
    });
    await otherQueue.expectNone();

    queueA.dispose();
    queueB.dispose();
    otherQueue.dispose();
    socketA.close();
    socketB.close();
    otherSocket.close();
    await app.close();
  });

  it("revokes suspended member subscribers in real time while keeping authorized admins subscribed", async () => {
    const { app, wsBaseUrl } = await startCommunityWsApp();
    const group = await createCommunityGroup(
      {
        id: "private-sanctions-ws-room",
        communityId: "watany-community",
        name: "غرفة عقوبات مباشرة",
        description: "غرفة خاصة لاختبار سحب الصلاحية المباشر",
        category: "support",
        memberCount: 1,
        unreadCount: 0,
        visibility: "private",
        memberIds: ["community-user-8"],
      },
      { id: "community-admin-1", role: "admin" },
    );
    expect(group.id).toBe("private-sanctions-ws-room");

    const adminSocket = await openCommunitySocket(wsBaseUrl, adminAccessToken());
    const memberSocket = await openCommunitySocket(wsBaseUrl, userAccessToken("community-user-8", "community.user8@watany.test"));
    const adminQueue = createSocketQueue(adminSocket);
    const memberQueue = createSocketQueue(memberSocket);

    const subscribePayload = JSON.stringify({ type: "community.subscribe", groupId: group.id });
    adminSocket.send(subscribePayload);
    memberSocket.send(subscribePayload);

    await expect(adminQueue.next()).resolves.toMatchObject({
      eventType: "community.connection.ready",
      groupId: group.id,
    });
    await expect(memberQueue.next()).resolves.toMatchObject({
      eventType: "community.connection.ready",
      groupId: group.id,
    });

    const suspended = await suspendCommunityGroupMember(
      group.id,
      "community-user-8",
      {
        id: "community-admin-1",
        role: "admin",
        displayName: "community.admin",
      },
      "24h",
      "تعليق مباشر لاختبار سحب الصلاحية.",
    );
    expect(suspended.ok).toBe(true);

    await expect(adminQueue.next()).resolves.toMatchObject({
      eventType: "community.member.suspended",
      groupId: group.id,
      payload: expect.objectContaining({
        userId: "community-user-8",
        status: "suspended",
      }),
    });
    await expect(memberQueue.next()).resolves.toMatchObject({
      eventType: "community.authorization.revoked",
      groupId: group.id,
      payload: { code: "community_group_forbidden" },
    });
    await memberQueue.expectNone();

    adminQueue.dispose();
    memberQueue.dispose();
    adminSocket.close();
    memberSocket.close();
    await app.close();
  });
});