import { createWorldCupProvider } from '../providers/providerRegistry';

export type WorldCupServiceResult<T> = {
  data: T;
  source: string;
  generatedAt: string;
};

export interface WorldCupService {
  getMatches(): Promise<WorldCupServiceResult<unknown>>;
  getTodayMatches(): Promise<WorldCupServiceResult<unknown>>;
  getLiveMatches(): Promise<WorldCupServiceResult<unknown>>;
  getStandings(): Promise<WorldCupServiceResult<unknown>>;
  getMatchById(id: string): Promise<WorldCupServiceResult<unknown>>;
}

export function createDefaultWorldCupService(): WorldCupService {
  const provider = createWorldCupProvider();
  const source = `worldcup/${provider.name}`;

  return {
    async getMatches() {
      const matches = await provider.getMatches();
      return { data: { matches }, source, generatedAt: new Date().toISOString() };
    },

    async getTodayMatches() {
      const matches = await provider.getTodayMatches();
      return { data: { matches }, source, generatedAt: new Date().toISOString() };
    },

    async getLiveMatches() {
      const matches = await provider.getLiveMatches();
      return {
        data: { status: 'ok', matches },
        source,
        generatedAt: new Date().toISOString(),
      };
    },

    async getStandings() {
      const standings = await provider.getStandings();
      return { data: standings, source, generatedAt: new Date().toISOString() };
    },

    async getMatchById(id: string) {
      const match = await provider.getMatchById(id);
      return { data: match, source, generatedAt: new Date().toISOString() };
    },
  };
}
