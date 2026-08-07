import type { WorldCupMatch, WorldCupMatchEvent } from '../providers/provider.interface';

export function buildWorldCupEventHash(event: Omit<WorldCupMatchEvent, 'eventHash'>): string {
  return [
    event.matchId,
    event.type,
    event.minute ?? '',
    event.team?.providerTeamId ?? event.team?.name ?? '',
    event.playerName ?? '',
  ].join('|').toLowerCase();
}

export function normalizeWorldCupMatchForCache(match: WorldCupMatch): WorldCupMatch {
  return {
    ...match,
    lastSyncedAt: match.lastSyncedAt || new Date().toISOString(),
    freshnessStatus: match.freshnessStatus || 'UNKNOWN',
    events: (match.events || []).map((event) => ({
      ...event,
      eventHash: event.eventHash || buildWorldCupEventHash(event),
    })),
  };
}

export function isWorldCupMatchFresh(match: WorldCupMatch, maxAgeSeconds = 60): boolean {
  const parsed = Date.parse(match.lastSyncedAt);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= maxAgeSeconds * 1000;
}
