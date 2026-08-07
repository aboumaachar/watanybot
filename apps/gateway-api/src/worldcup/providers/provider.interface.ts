export type WorldCupMatchEvent = {
  eventHash?: string;
  matchId: string;
  type: string;
  minute?: number | null;
  team?: { name?: string; providerTeamId?: string } | null;
  playerName?: string | null;
  assistName?: string | null;
  detail?: string | null;
};

export type WorldCupMatch = {
  id: string;
  providerMatchId?: string;
  dateTime: string;
  teamA: string;
  teamB: string;
  stage?: string;
  venue?: string;
  status: 'scheduled' | 'live' | 'finished' | string;
  score?: string | null;
  events?: WorldCupMatchEvent[];
  lastSyncedAt: string;
  freshnessStatus?: 'FRESH' | 'STALE' | 'UNKNOWN' | string;
};

export interface WorldCupProvider {
  readonly name: string;
  isConfigured(): boolean;
  getMatches(): Promise<WorldCupMatch[]>;
  getTodayMatches(): Promise<WorldCupMatch[]>;
  getLiveMatches(): Promise<WorldCupMatch[]>;
  getTeams(): Promise<unknown[]>;
  getPlayers(): Promise<unknown[]>;
  getStandings(): Promise<unknown>;
  getMatchById(id: string): Promise<WorldCupMatch | null>;
}
