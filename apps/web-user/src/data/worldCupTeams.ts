import { teamArabicNameByCode, teamFlagEmojiByCode, worldCupOfficialPlayersForTeam, worldCupOfficialTeamSeeds } from "@watany/shared/worldcup-official-data";

export type WorldCupPlayer = {
  id: string;
  name: string;
  position: "goalkeeper" | "defender" | "midfielder" | "forward" | "unknown";
  shirtNumber?: number;
  imageQuery?: string;
};

export type WorldCupTeam = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  group?: string;
  flagEmoji?: string;
  players: WorldCupPlayer[];
};

export const worldCupTeams: WorldCupTeam[] = worldCupOfficialTeamSeeds.map((team) => ({
  id: team.id,
  code: team.code,
  nameAr: teamArabicNameByCode(team.code),
  nameEn: team.nameEn,
  group: team.group,
  flagEmoji: teamFlagEmojiByCode(team.code),
  players: worldCupOfficialPlayersForTeam(team)
}));

export function getWorldCupTeamById(id: string) {
  return worldCupTeams.find((team) => team.id === id);
}