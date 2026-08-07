export type WorldCupPollOption = { id: string; label: string; };

export type WorldCupPoll = {
  id: string;
  type: "champion_team" | "best_player" | "match_winner";
  title: string;
  question: string;
  options: WorldCupPollOption[];
};

export const worldCupPolls: WorldCupPoll[] = [
  {
    id: "poll-champion-team",
    type: "champion_team",
    title: "توقع بطل كأس العالم 2026 — عرض تجريبي",
    question: "من تتوقع أن يفوز بكأس العالم؟",
    options: [
      { id: "argentina", label: "الأرجنتين" },
      { id: "france", label: "فرنسا" },
      { id: "brazil", label: "البرازيل" },
      { id: "other", label: "منتخب آخر" }
    ]
  },
  {
    id: "poll-best-player",
    type: "best_player",
    title: "توقع أفضل لاعب",
    question: "من تتوقع أن يكون أفضل لاعب في البطولة؟",
    options: [
      { id: "player-1", label: "لاعب من الأرجنتين" },
      { id: "player-2", label: "لاعب من فرنسا" },
      { id: "player-3", label: "لاعب من البرازيل" },
      { id: "other", label: "لاعب آخر" }
    ]
  }
];