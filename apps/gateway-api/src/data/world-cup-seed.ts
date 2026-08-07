import { labelToIsoDate, teamArabicNameByCode, worldCupOfficialMatchSeeds } from "@watany/shared/worldcup-official-data";

export type WorldCupMatchSeed = {
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

export const worldCupMatchSeed: WorldCupMatchSeed[] = worldCupOfficialMatchSeeds.map((match, index) => ({
  id: `wc-2026-match-${String(index + 1).padStart(3, "0")}`,
  dateTime: `${labelToIsoDate(match.dateLabel)}T${match.time}:00Z`,
  teamA: teamArabicNameByCode(match.homeCode),
  teamB: teamArabicNameByCode(match.awayCode),
  stage: match.group,
  venue: match.venue,
  status: "scheduled",
  officialSourceUrl: OFFICIAL_MATCHES_URL
}));