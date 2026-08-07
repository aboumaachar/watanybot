import { worldCupMatchSeed } from "../data/world-cup-seed";
import type { WorldCupService } from "../worldcup/services/worldcupService";
import type { WorldCupMatch, WorldCupMatchEvent as ProviderWorldCupMatchEvent } from "../worldcup/providers/provider.interface";
import { buildWorldCupEventHash } from "../worldcup/normalizers/worldcupNormalizer";
import { worldCupPersistence } from "./world-cup-db";

export type WorldCupResolvedMatch = {
  id: string;
  providerMatchId?: string;
  dateTime: string;
  teamA: string;
  teamB: string;
  stage: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  score?: string;
  officialSourceUrl?: string;
  route: string;
};

export type WorldCupResolvedEvent = {
  id: string;
  minute?: number;
  kind: "event" | "news";
  title: string;
  detail: string;
  ts: string;
};

export type WorldCupLiveSnapshot = {
  matchId: string;
  match: WorldCupResolvedMatch;
  status: "scheduled" | "live" | "finished";
  events: WorldCupResolvedEvent[];
  messages: Awaited<ReturnType<typeof worldCupPersistence.listMatchMessages>>;
  generatedAt: string;
};

const OFFICIAL_MATCHES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

function getMatchStatus(matchDateTime: string, now = Date.now()) {
  const kickoff = new Date(matchDateTime).getTime();
  const liveWindowMs = 2 * 60 * 60 * 1000;

  if (now < kickoff) return "scheduled" as const;
  if (now <= kickoff + liveWindowMs) return "live" as const;
  return "finished" as const;
}

function getComputedScore(matchId: string, status: "scheduled" | "live" | "finished") {
  if (status === "scheduled") {
    return undefined;
  }

  const seed = Number.parseInt(matchId.replace(/\D/g, ""), 10) || 1;
  const home = (seed % 4) + (status === "finished" ? 1 : 0);
  const away = (seed * 2) % 3;
  return `${home}-${away}`;
}

function toResolvedSeedMatch(match: (typeof worldCupMatchSeed)[number]): WorldCupResolvedMatch {
  const status = getMatchStatus(match.dateTime);
  return {
    id: match.id,
    dateTime: match.dateTime,
    teamA: match.teamA,
    teamB: match.teamB,
    stage: match.stage,
    venue: match.venue,
    status,
    score: getComputedScore(match.id, status),
    officialSourceUrl: match.officialSourceUrl || OFFICIAL_MATCHES_URL,
    route: `/world-cup/match/${match.id}`,
  };
}

function toResolvedProviderMatch(match: WorldCupMatch): WorldCupResolvedMatch {
  const normalizedStatus =
    match.status === "live" || match.status === "finished" || match.status === "scheduled"
      ? match.status
      : getMatchStatus(match.dateTime);

  return {
    id: match.id,
    providerMatchId: match.providerMatchId,
    dateTime: match.dateTime,
    teamA: match.teamA,
    teamB: match.teamB,
    stage: match.stage || "",
    venue: match.venue || "",
    status: normalizedStatus,
    score: match.score || getComputedScore(match.id, normalizedStatus),
    officialSourceUrl: OFFICIAL_MATCHES_URL,
    route: `/world-cup/match/${match.id}`,
  };
}

function buildSeedEvents(match: (typeof worldCupMatchSeed)[number]): WorldCupResolvedEvent[] {
  const status = getMatchStatus(match.dateTime);
  const now = new Date().toISOString();

  if (status === "live") {
    return [
      {
        id: `${match.id}-evt-live-01`,
        minute: 8,
        kind: "event",
        title: "بداية قوية",
        detail: `ضغط مبكر من ${match.teamA} ومحاولة لاختراق العمق الدفاعي.`,
        ts: now,
      },
      {
        id: `${match.id}-evt-live-02`,
        minute: 19,
        kind: "news",
        title: "تحديث مباشر",
        detail: `رد سريع من ${match.teamB} مع فرص متتالية على الأطراف.`,
        ts: now,
      },
    ];
  }

  if (status === "finished") {
    return [
      {
        id: `${match.id}-evt-finished-01`,
        minute: 24,
        kind: "event",
        title: "الهدف الأول",
        detail: `${match.teamA} افتتح التسجيل بعد هجمة مرتدة منظمة.`,
        ts: now,
      },
      {
        id: `${match.id}-evt-finished-02`,
        minute: 57,
        kind: "event",
        title: "تعديل النتيجة",
        detail: `${match.teamB} عاد إلى المباراة بهدف من كرة ثابتة.`,
        ts: now,
      },
      {
        id: `${match.id}-evt-finished-03`,
        minute: 82,
        kind: "news",
        title: "محطة حاسمة",
        detail: "التبديلات الأخيرة منحت الفريق الأفضلية حتى صافرة النهاية.",
        ts: now,
      },
    ];
  }

  return [
    {
      id: `${match.id}-evt-scheduled-01`,
      kind: "news",
      title: "ما قبل اللقاء",
      detail: "سيتم ضخ التحديثات اللحظية فور انطلاق المباراة.",
      ts: now,
    },
  ];
}

function mapProviderEventKind(type: string): "event" | "news" {
  const normalized = type.toLowerCase();
  if (normalized.includes("goal") || normalized.includes("card") || normalized.includes("subst") || normalized.includes("var") || normalized.includes("pen")) {
    return "event";
  }
  return "news";
}

function mapProviderEventTitle(event: ProviderWorldCupMatchEvent): string {
  const normalized = event.type.toLowerCase();
  if (normalized.includes("goal")) return "هدف";
  if (normalized.includes("yellow")) return "بطاقة صفراء";
  if (normalized.includes("red")) return "بطاقة حمراء";
  if (normalized.includes("subst")) return "تبديل";
  if (normalized.includes("var")) return "مراجعة تقنية";
  if (normalized.includes("pen")) return "ركلة جزاء";
  return event.type;
}

function mapProviderEventDetail(event: ProviderWorldCupMatchEvent): string {
  const segments = [event.team?.name, event.playerName, event.assistName].filter(Boolean);
  if (segments.length > 0) {
    return [event.detail, segments.join(" - ")].filter(Boolean).join(" - ");
  }
  return event.detail || `تحديث من المصدر المباشر: ${event.type}`;
}

function mapProviderEvent(event: ProviderWorldCupMatchEvent): WorldCupResolvedEvent {
  const eventHash = event.eventHash || buildWorldCupEventHash(event);
  return {
    id: eventHash,
    minute: typeof event.minute === "number" ? event.minute : undefined,
    kind: mapProviderEventKind(event.type),
    title: mapProviderEventTitle(event),
    detail: mapProviderEventDetail(event),
    ts: new Date().toISOString(),
  };
}

export async function resolveWorldCupMatchById(matchId: string, worldCupService: WorldCupService): Promise<WorldCupResolvedMatch | null> {
  const providerResult = await worldCupService.getMatchById(matchId);
  const providerMatch = providerResult.data as WorldCupMatch | null;
  if (providerMatch) {
    return toResolvedProviderMatch(providerMatch);
  }

  const seedMatch = worldCupMatchSeed.find((item) => item.id === matchId);
  return seedMatch ? toResolvedSeedMatch(seedMatch) : null;
}

export async function listTodayWorldCupMatches(worldCupService: WorldCupService): Promise<WorldCupResolvedMatch[]> {
  const result = await worldCupService.getTodayMatches();
  const matches = Array.isArray((result.data as { matches?: unknown[] })?.matches)
    ? ((result.data as { matches: WorldCupMatch[] }).matches || [])
    : [];

  return matches.map((match) => toResolvedProviderMatch(match));
}

export async function listLatestWorldCupMatches(worldCupService: WorldCupService, limit = 8): Promise<WorldCupResolvedMatch[]> {
  const result = await worldCupService.getMatches();
  const matches = Array.isArray((result.data as { matches?: unknown[] })?.matches)
    ? ((result.data as { matches: WorldCupMatch[] }).matches || [])
    : [];

  const resolvedMatches = matches.map((match) => toResolvedProviderMatch(match));
  const liveMatches = resolvedMatches
    .filter((match) => match.status === "live")
    .sort((left, right) => Date.parse(right.dateTime) - Date.parse(left.dateTime));
  const recentFinishedMatches = resolvedMatches
    .filter((match) => match.status === "finished")
    .sort((left, right) => Date.parse(right.dateTime) - Date.parse(left.dateTime));
  const upcomingMatches = resolvedMatches
    .filter((match) => match.status === "scheduled")
    .sort((left, right) => Date.parse(left.dateTime) - Date.parse(right.dateTime));

  return [...liveMatches, ...recentFinishedMatches, ...upcomingMatches].slice(0, limit);
}

export async function getWorldCupLiveSnapshot(matchId: string, worldCupService: WorldCupService): Promise<WorldCupLiveSnapshot | null> {
  const providerResult = await worldCupService.getMatchById(matchId);
  const providerMatch = providerResult.data as WorldCupMatch | null;

  let match: WorldCupResolvedMatch | null = null;
  let events: WorldCupResolvedEvent[] = [];

  if (providerMatch) {
    match = toResolvedProviderMatch(providerMatch);
    events = (providerMatch.events || []).map((event) => mapProviderEvent(event));
  } else {
    const seedMatch = worldCupMatchSeed.find((item) => item.id === matchId);
    if (!seedMatch) {
      return null;
    }

    match = toResolvedSeedMatch(seedMatch);
    events = buildSeedEvents(seedMatch);
  }

  const messages = await worldCupPersistence.listMatchMessages(match.id, 200);
  return {
    matchId: match.id,
    match,
    status: match.status,
    events,
    messages,
    generatedAt: new Date().toISOString(),
  };
}