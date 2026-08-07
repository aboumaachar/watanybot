import { teamArabicNameByCode, teamFlagEmojiByCode, worldCupOfficialPlayersForTeam, worldCupOfficialTeamSeeds } from "@watany/shared/worldcup-official-data";
import { worldCupMatchSeed } from "./world-cup-seed";

export const worldCupTeamsSeed = worldCupOfficialTeamSeeds.map((team) => ({
  id: team.id,
  code: team.code,
  nameAr: teamArabicNameByCode(team.code),
  nameEn: team.nameEn,
  group: team.group,
  flagEmoji: teamFlagEmojiByCode(team.code),
  players: worldCupOfficialPlayersForTeam(team)
}));

const bestPlayerPollOptions = worldCupTeamsSeed.flatMap((team) =>
  team.players.map((player) => player.id)
);

export const worldCupPollsSeed = [
  {
    id: "poll-champion-team",
    type: "champion_team",
    title: "توقع بطل كأس العالم",
    question: "من تتوقع أن يفوز بكأس العالم؟",
    options: ["الأرجنتين", "فرنسا", "البرازيل", "منتخب آخر"]
  },
  {
    id: "poll-best-player",
    type: "best_player",
    title: "تصويت أفضل لاعب في كأس العالم",
    question: "المرحلة الأولى: اختر المنتخب ثم اختر اللاعب للتصويت على أفضل لاعب في البطولة.",
    options: bestPlayerPollOptions
  },
  ...worldCupMatchSeed.map((match) => ({
    id: `poll-match-winner-${match.id}`,
    type: "match_winner",
    title: `تصويت المباراة: ${match.teamA} ضد ${match.teamB}`,
    question: `من تتوقع يفوز في مباراة ${match.teamA} ضد ${match.teamB}؟`,
    options: [match.teamA, "تعادل", match.teamB]
  }))
];