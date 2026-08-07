import type { WorldCupProvider, WorldCupMatch, WorldCupMatchEvent } from './provider.interface';
import { buildWorldCupEventHash } from '../normalizers/worldcupNormalizer';
import { MockWorldCupProvider } from './mock.provider';

export interface ApiFootballProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

/** API-Football v3 fixture shape (partial) */
type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
    venue?: { name?: string };
  };
  league: { round?: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

type ApiFootballFixtureEvent = {
  time?: { elapsed?: number | null; extra?: number | null };
  team?: { id?: number | null; name?: string | null };
  player?: { id?: number | null; name?: string | null };
  assist?: { id?: number | null; name?: string | null };
  type?: string | null;
  detail?: string | null;
  comments?: string | null;
};

type ApiFootballResponse<T> = {
  response: T[];
};

const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

export class ApiFootballProvider extends MockWorldCupProvider implements WorldCupProvider {
  public readonly name = 'api-football';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: ApiFootballProviderOptions = {}) {
    super();
    this.baseUrl = (
      options.baseUrl ||
      process.env.API_FOOTBALL_BASE_URL ||
      'https://v3.football.api-sports.io'
    ).replace(/\/$/, '');
    this.apiKey = options.apiKey || process.env.API_FOOTBALL_API_KEY || '';
    this.timeoutMs = options.timeoutMs || 8000;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async apiFetch<T>(path: string): Promise<ApiFootballResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `${this.baseUrl}${path}`;
      const hostname = new URL(this.baseUrl).hostname;
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': hostname,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`API-Football ${path} responded ${response.status}`);
      }
      return response.json() as Promise<ApiFootballResponse<T>>;
    } finally {
      clearTimeout(timer);
    }
  }

  private fixtureToMatch(f: ApiFootballFixture): WorldCupMatch {
    const short = f.fixture.status?.short ?? 'NS';
    const status: WorldCupMatch['status'] =
      short === 'FT' || short === 'AET' || short === 'PEN' ? 'finished' :
      short === '1H' || short === 'HT' || short === '2H' || short === 'ET' || short === 'P' ? 'live' :
      'scheduled';
    const homeGoals = f.goals?.home;
    const awayGoals = f.goals?.away;
    const score =
      homeGoals !== null && homeGoals !== undefined &&
      awayGoals !== null && awayGoals !== undefined
        ? `${homeGoals}-${awayGoals}`
        : null;
    return {
      id: `apifootball-${f.fixture.id}`,
      providerMatchId: String(f.fixture.id),
      dateTime: f.fixture.date,
      teamA: f.teams.home.name,
      teamB: f.teams.away.name,
      stage: f.league?.round ?? '',
      venue: f.fixture.venue?.name ?? '',
      status,
      score,
      events: [],
      lastSyncedAt: new Date().toISOString(),
      freshnessStatus: 'FRESH',
    };
  }

  private async getFixtureEvents(fixtureId: string): Promise<WorldCupMatchEvent[]> {
    try {
      const data = await this.apiFetch<ApiFootballFixtureEvent>(`/fixtures/events?fixture=${fixtureId}`);
      return (data.response || [])
        .map((event): WorldCupMatchEvent | null => {
          const type = (event.type || event.detail || event.comments || '').trim();
          if (!type) {
            return null;
          }

          const mapped: WorldCupMatchEvent = {
            matchId: `apifootball-${fixtureId}`,
            type,
            minute: typeof event.time?.elapsed === 'number' ? event.time.elapsed : null,
            team: event.team?.name ? {
              name: event.team.name,
              providerTeamId: event.team.id != null ? String(event.team.id) : undefined,
            } : null,
            playerName: event.player?.name || null,
            assistName: event.assist?.name || null,
            detail: [event.detail, event.comments].filter(Boolean).join(' - ') || null,
          };

          mapped.eventHash = buildWorldCupEventHash(mapped);
          return mapped;
        })
        .filter((event): event is WorldCupMatchEvent => Boolean(event));
    } catch {
      return [];
    }
  }

  override async getMatches(): Promise<WorldCupMatch[]> {
    try {
      const data = await this.apiFetch<ApiFootballFixture>(
        `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`
      );
      return (data.response || []).map((f) => this.fixtureToMatch(f));
    } catch {
      return super.getMatches();
    }
  }

  override async getTodayMatches(): Promise<WorldCupMatch[]> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await this.apiFetch<ApiFootballFixture>(
        `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&date=${today}`
      );
      return (data.response || []).map((f) => this.fixtureToMatch(f));
    } catch {
      return super.getTodayMatches();
    }
  }

  override async getLiveMatches(): Promise<WorldCupMatch[]> {
    try {
      const data = await this.apiFetch<ApiFootballFixture>(
        `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&live=all`
      );
      return (data.response || []).map((f) => this.fixtureToMatch(f));
    } catch {
      return super.getLiveMatches();
    }
  }

  override async getStandings(): Promise<unknown> {
    try {
      const data = await this.apiFetch<unknown>(
        `/standings?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`
      );
      return { standings: data.response || [] };
    } catch {
      return super.getStandings();
    }
  }

  override async getMatchById(id: string): Promise<WorldCupMatch | null> {
    const numericId = id.replace(/^apifootball-/, '');
    if (!numericId || isNaN(Number(numericId))) {
      return super.getMatchById(id);
    }
    try {
      const data = await this.apiFetch<ApiFootballFixture>(`/fixtures?id=${numericId}`);
      const fixture = data.response?.[0];
      if (!fixture) {
        return null;
      }

      const match = this.fixtureToMatch(fixture);
      const events = await this.getFixtureEvents(numericId);
      return { ...match, events };
    } catch {
      return super.getMatchById(id);
    }
  }
}
