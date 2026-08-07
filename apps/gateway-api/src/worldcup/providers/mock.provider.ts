import type { WorldCupProvider, WorldCupMatch } from './provider.interface';
import { worldCupMatchSeed } from '../../data/world-cup-seed';
import { worldCupTeamsSeed } from '../../data/world-cup-teams-seed';

function getMatchStatus(matchDateTime: string, now = Date.now()): 'scheduled' | 'live' | 'finished' {
  const kickoff = new Date(matchDateTime).getTime();
  const liveWindowMs = 2 * 60 * 60 * 1000;

  if (now < kickoff) return 'scheduled';
  if (now <= kickoff + liveWindowMs) return 'live';
  return 'finished';
}

function getComputedScore(matchId: string, status: 'scheduled' | 'live' | 'finished'): string | null {
  if (status === 'scheduled') {
    return null;
  }

  const seed = Number.parseInt(matchId.replace(/\D/g, ''), 10) || 1;
  const home = (seed % 4) + (status === 'finished' ? 1 : 0);
  const away = (seed * 2) % 3;
  return `${home}-${away}`;
}

export class MockWorldCupProvider implements WorldCupProvider {
  public readonly name: string = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async getMatches(): Promise<WorldCupMatch[]> {
    return worldCupMatchSeed.map((m) => this.seedToMatch(m));
  }

  async getTodayMatches(): Promise<WorldCupMatch[]> {
    const today = new Date().toISOString().slice(0, 10);
    return worldCupMatchSeed
      .filter((m) => m.dateTime.slice(0, 10) === today)
      .map((m) => this.seedToMatch(m));
  }

  async getLiveMatches(): Promise<WorldCupMatch[]> {
    return worldCupMatchSeed
      .filter((m) => getMatchStatus(m.dateTime) === 'live')
      .map((m) => this.seedToMatch(m));
  }

  async getTeams(): Promise<unknown[]> {
    return [...worldCupTeamsSeed] as unknown[];
  }

  async getPlayers(): Promise<unknown[]> {
    return ([...worldCupTeamsSeed] as any[]).flatMap((team) =>
      (team.players as any[]).map((player) => ({
        ...player,
        teamId: team.id,
        teamNameAr: team.nameAr,
        teamNameEn: team.nameEn,
      }))
    );
  }

  async getStandings(): Promise<unknown> {
    return { note: 'Standings not available from mock provider.', standings: [] };
  }

  async getMatchById(id: string): Promise<WorldCupMatch | null> {
    const match = worldCupMatchSeed.find((m) => m.id === id);
    return match ? this.seedToMatch(match) : null;
  }

  protected seedToMatch(m: {
    id: string;
    dateTime: string;
    teamA: string;
    teamB: string;
    stage?: string;
    venue?: string;
    status: string;
    score?: string;
  }): WorldCupMatch {
    const derivedStatus = getMatchStatus(m.dateTime);

    return {
      id: m.id,
      dateTime: m.dateTime,
      teamA: m.teamA,
      teamB: m.teamB,
      stage: m.stage,
      venue: m.venue,
      status: derivedStatus,
      score: m.score ?? getComputedScore(m.id, derivedStatus),
      events: [],
      lastSyncedAt: new Date().toISOString(),
      freshnessStatus: 'FRESH',
    };
  }
}
