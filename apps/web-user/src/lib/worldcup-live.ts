import type { WorldCupMatchChatMessage, WorldCupMatchDto, WorldCupMatchEvent } from "./api";

const STORAGE_KEY = "watany_world_cup_last_seen_v1";

export type WorldCupLiveSnapshot = {
  matchId: string;
  match: WorldCupMatchDto;
  status: "scheduled" | "live" | "finished";
  events: WorldCupMatchEvent[];
  messages: WorldCupMatchChatMessage[];
  generatedAt: string;
};

export type WorldCupSocketEvent =
  | { type: "world-cup.snapshot"; matchId: string; snapshot: WorldCupLiveSnapshot }
  | { type: "world-cup.error"; matchId?: string; message: string }
  | { type: "pong"; timestamp: number };

function readLastSeenMap(): Record<string, string> {
  if (globalThis.localStorage === undefined) {
    return {};
  }

  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLastSeenMap(value: Record<string, string>) {
  if (globalThis.localStorage === undefined) {
    return;
  }

  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getWorldCupLastSeen(matchId: string): string | undefined {
  return readLastSeenMap()[matchId];
}

export function getWorldCupSnapshotNewestTimestamp(snapshot: Pick<WorldCupLiveSnapshot, "events" | "messages" | "generatedAt">): string {
  const timestamps = [
    snapshot.generatedAt,
    ...snapshot.events.map((event) => event.ts),
    ...snapshot.messages.map((message) => message.createdAt),
  ].filter(Boolean);

  const sortedTimestamps = [...timestamps].sort((left: string, right: string) => left.localeCompare(right));
  return sortedTimestamps.at(-1) || new Date().toISOString();
}

export function markWorldCupMatchSeen(matchId: string, timestamp: string) {
  const current = readLastSeenMap();
  current[matchId] = timestamp;
  writeLastSeenMap(current);
}

export function countUnreadWorldCupItems(snapshot: Pick<WorldCupLiveSnapshot, "events" | "messages">, lastSeenAt?: string): number {
  if (!lastSeenAt) {
    return snapshot.events.length + snapshot.messages.length;
  }

  const seenAt = Date.parse(lastSeenAt);
  if (Number.isNaN(seenAt)) {
    return snapshot.events.length + snapshot.messages.length;
  }

  const unreadEvents = snapshot.events.filter((event) => Date.parse(event.ts) > seenAt).length;
  const unreadMessages = snapshot.messages.filter((message) => Date.parse(message.createdAt) > seenAt).length;
  return unreadEvents + unreadMessages;
}