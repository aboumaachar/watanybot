import { labelToIsoDate, teamArabicNameByCode, worldCupOfficialMatchSeeds } from "@watany/shared/worldcup-official-data";

export type WorldCupMatch = {
  id: string;
  dateTime: string;
  teamA: string;
  teamB: string;
  stage: string;
  venue: string;
  status: "scheduled" | "live" | "finished";
  score?: string;
  officialSourceUrl?: string;
};

const OFFICIAL_MATCHES_URL = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

export const worldCupMatches: WorldCupMatch[] = worldCupOfficialMatchSeeds.map((match, index) => ({
  id: `wc-2026-match-${String(index + 1).padStart(3, "0")}`,
  dateTime: `${labelToIsoDate(match.dateLabel)}T${match.time}:00Z`,
  teamA: teamArabicNameByCode(match.homeCode),
  teamB: teamArabicNameByCode(match.awayCode),
  stage: match.group,
  venue: match.venue,
  status: "scheduled",
  officialSourceUrl: OFFICIAL_MATCHES_URL
}));

export function getWorldCupMatchStatus(match: Pick<WorldCupMatch, "dateTime">, now = new Date()): WorldCupMatch["status"] {
  const start = new Date(match.dateTime).getTime();
  const current = now.getTime();
  const liveWindowMs = 2 * 60 * 60 * 1000;

  if (current < start) {
    return "scheduled";
  }

  if (current <= start + liveWindowMs) {
    return "live";
  }

  return "finished";
}

export function findWorldCupMatchById(matchId: string) {
  return worldCupMatches.find((match) => match.id === matchId);
}

export function getTodayWorldCupMatches(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return worldCupMatches.filter((m) => m.dateTime.slice(0, 10) === d);
}