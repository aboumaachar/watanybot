import type { SmartDashboardLoadState, SmartDashboardResponse } from './smart-dashboard-stage-a-types';

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadSmartDashboardStageA(baseUrl = ''): Promise<SmartDashboardLoadState> {
  try {
    const response = await fetch(`${baseUrl}/api/dashboard`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 401 || response.status === 403) {
      return { status: 'auth-gated', statusCode: response.status };
    }

    if (response.status === 503) {
      return { status: 'db-not-configured', statusCode: 503 };
    }

    if (!response.ok) {
      return { status: 'unavailable', statusCode: response.status, message: `HTTP ${response.status}` };
    }

    return { status: 'ready', data: (await safeJson(response)) as SmartDashboardResponse };
  } catch (error) {
    return {
      status: 'unavailable',
      message: error instanceof Error ? error.message : 'Smart dashboard unavailable',
    };
  }
}
