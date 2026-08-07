import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";

type MediaChannelMode = "direct" | "relay";
type MediaPeerRole = "host" | "participant" | "viewer";
type MediaPreset = "meeting" | "broadcast" | "indirect";
type SignalType = "offer" | "answer" | "ice-candidate";
type SocketMessagePayload = string | Buffer | ArrayBuffer | Buffer[];

type JoinMessage = {
  type: "join";
  roomId: string;
  role: MediaPeerRole;
  mode: MediaChannelMode;
  preset?: MediaPreset;
  displayName?: string;
};

type SignalMessage = {
  type: "signal";
  roomId: string;
  targetPeerId: string;
  signalType: SignalType;
  payload: unknown;
};

type LeaveMessage = {
  type: "leave";
  roomId: string;
};

type PingMessage = {
  type: "ping";
};

type ClientMessage = JoinMessage | SignalMessage | LeaveMessage | PingMessage;

type PeerSummary = {
  peerId: string;
  role: MediaPeerRole;
  displayName: string;
};

type RoomPeer = PeerSummary & {
  socket: WebSocket;
  roomId: string;
};

type MediaRoom = {
  roomId: string;
  mode: MediaChannelMode;
  preset?: MediaPreset;
  hostPeerId?: string;
  peers: Map<string, RoomPeer>;
  createdAt: number;
};

const rooms = new Map<string, MediaRoom>();
const socketPeerIds = new WeakMap<WebSocket, string>();
const socketLastSeen = new WeakMap<WebSocket, number>();
const MEDIA_HEARTBEAT_INTERVAL_MS = 15_000;
const MEDIA_HEARTBEAT_TIMEOUT_MS = 45_000;

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

function resolveRequestedRole(room: MediaRoom, requestedRole: MediaPeerRole): MediaPeerRole {
  if (requestedRole !== "host" || !room.hostPeerId) {
    return requestedRole;
  }

  return room.mode === "relay" ? "viewer" : "participant";
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

function listPeers(room: MediaRoom, exceptPeerId?: string): PeerSummary[] {
  return [...room.peers.values()]
    .filter((peer) => peer.peerId !== exceptPeerId)
    .map(({ peerId, role, displayName }) => ({ peerId, role, displayName }));
}

function broadcastRoomState(room: MediaRoom) {
  const payload = {
    type: "room-state",
    roomId: room.roomId,
    mode: room.mode,
    preset: room.preset,
    hostPeerId: room.hostPeerId,
    peers: listPeers(room),
    peerCount: room.peers.size,
  };

  for (const peer of room.peers.values()) {
    safeSend(peer.socket, payload);
  }
}

function removePeerFromRoom(app: FastifyInstance, socket: WebSocket) {
  const peerId = socketPeerIds.get(socket);
  if (!peerId) {
    return;
  }

  socketPeerIds.delete(socket);
  socketLastSeen.delete(socket);

  for (const room of rooms.values()) {
    const peer = room.peers.get(peerId);
    if (!peer) {
      continue;
    }

    room.peers.delete(peerId);

    if (room.hostPeerId === peerId) {
      const nextHost = [...room.peers.values()].find((candidate) => candidate.role !== "viewer");
      room.hostPeerId = nextHost?.peerId;
      if (nextHost) {
        nextHost.role = "host";
      }
    }

    for (const otherPeer of room.peers.values()) {
      safeSend(otherPeer.socket, {
        type: "peer-left",
        roomId: room.roomId,
        peerId,
        hostPeerId: room.hostPeerId,
      });
    }

    if (room.peers.size === 0) {
      rooms.delete(room.roomId);
      app.log.info({ roomId: room.roomId }, "media room removed");
      return;
    }

    broadcastRoomState(room);
    app.log.info({ roomId: room.roomId, peerId }, "media peer removed");
    return;
  }
}

export async function mediaWSRoutes(app: FastifyInstance): Promise<void> {
  const heartbeatTimer = globalThis.setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      for (const peer of room.peers.values()) {
        const lastSeen = socketLastSeen.get(peer.socket) ?? 0;
        if (now - lastSeen > MEDIA_HEARTBEAT_TIMEOUT_MS) {
          peer.socket.close();
        }
      }
    }
  }, MEDIA_HEARTBEAT_INTERVAL_MS);

  app.addHook("onClose", async () => {
    globalThis.clearInterval(heartbeatTimer);
  });

  app.get("/ws/media", { websocket: true }, (socket) => {
    socket.on("message", (raw: SocketMessagePayload) => {
      socketLastSeen.set(socket, Date.now());
      let message: ClientMessage;

      try {
        message = JSON.parse(parseSocketPayload(raw)) as ClientMessage;
      } catch {
        safeSend(socket, { type: "error", message: "invalid_json" });
        return;
      }

      if (message.type === "ping") {
        safeSend(socket, { type: "pong", timestamp: Date.now() });
        return;
      }

      if (message.type === "leave") {
        removePeerFromRoom(app, socket);
        return;
      }

      if (message.type === "join") {
        const roomId = message.roomId.trim();
        if (!roomId) {
          safeSend(socket, { type: "error", message: "missing_room_id" });
          return;
        }

        removePeerFromRoom(app, socket);

        const existingRoom = rooms.get(roomId);
        const room: MediaRoom = existingRoom ?? {
          roomId,
          mode: message.mode,
          preset: message.preset,
          peers: new Map<string, RoomPeer>(),
          createdAt: Date.now(),
        };

        if (!existingRoom) {
          rooms.set(roomId, room);
        }

        if (room.mode !== message.mode) {
          safeSend(socket, { type: "error", message: "room_mode_mismatch" });
          return;
        }

        const peerId = randomUUID();
        const resolvedRole = resolveRequestedRole(room, message.role);

        const peer: RoomPeer = {
          peerId,
          role: resolvedRole,
          displayName: message.displayName?.trim() || resolvedRole,
          roomId,
          socket,
        };

        if (!room.hostPeerId || resolvedRole === "host") {
          room.hostPeerId = peerId;
          peer.role = "host";
        }

        room.peers.set(peerId, peer);
        socketPeerIds.set(socket, peerId);

        safeSend(socket, {
          type: "joined",
          roomId,
          peerId,
          role: peer.role,
          mode: room.mode,
          preset: room.preset,
          hostPeerId: room.hostPeerId,
          peers: listPeers(room, peerId),
          peerCount: room.peers.size,
        });

        for (const otherPeer of room.peers.values()) {
          if (otherPeer.peerId === peerId) {
            continue;
          }

          safeSend(otherPeer.socket, {
            type: "peer-joined",
            roomId,
            peer: {
              peerId,
              role: peer.role,
              displayName: peer.displayName,
            },
            hostPeerId: room.hostPeerId,
          });
        }

        broadcastRoomState(room);
        app.log.info({ roomId, peerId, role: peer.role, mode: room.mode }, "media peer joined");
        return;
      }

      const peerId = socketPeerIds.get(socket);
      if (!peerId) {
        safeSend(socket, { type: "error", message: "join_required" });
        return;
      }

      const room = rooms.get(message.roomId);
      if (!room) {
        safeSend(socket, { type: "error", message: "room_not_found" });
        return;
      }

      if (message.type === "signal") {
        const targetPeer = room.peers.get(message.targetPeerId);
        if (!targetPeer) {
          safeSend(socket, { type: "error", message: "target_peer_not_found", targetPeerId: message.targetPeerId });
          return;
        }

        safeSend(targetPeer.socket, {
          type: "signal",
          roomId: room.roomId,
          fromPeerId: peerId,
          signalType: message.signalType,
          payload: message.payload,
        });
      }
    });

    socket.on("close", () => {
      removePeerFromRoom(app, socket);
    });
  });
}
