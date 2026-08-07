import { createDefaultWorldCupService } from '../services/worldcupService';

export type WorldCupApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  source?: string;
  generatedAt: string;
};

function success<T>(payload: { data: T; source: string; generatedAt: string }): WorldCupApiResponse<T> {
  return {
    ok: true,
    data: payload.data,
    source: payload.source,
    generatedAt: payload.generatedAt,
  };
}

function failure(error: unknown): WorldCupApiResponse<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Unknown World Cup service error',
    generatedAt: new Date().toISOString(),
  };
}

export async function getWorldCupTodayResponse() {
  try {
    const service = createDefaultWorldCupService();
    return success(await service.getTodayMatches());
  } catch (error) {
    return failure(error);
  }
}

export async function getWorldCupLiveResponse() {
  try {
    const service = createDefaultWorldCupService();
    return success(await service.getLiveMatches());
  } catch (error) {
    return failure(error);
  }
}

export async function getWorldCupStandingsResponse() {
  try {
    const service = createDefaultWorldCupService();
    return success(await service.getStandings());
  } catch (error) {
    return failure(error);
  }
}

export async function getWorldCupMatchResponse(id: string) {
  try {
    const service = createDefaultWorldCupService();
    return success(await service.getMatchById(id));
  } catch (error) {
    return failure(error);
  }
}
