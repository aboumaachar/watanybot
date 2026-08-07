import type { WorldCupProvider } from './provider.interface';
import { MockWorldCupProvider } from './mock.provider';
import { ApiFootballProvider } from './apiFootball.provider';

export type WorldCupProviderName = 'mock' | 'api-football';

/** Accepts a provider name string, an options object, or nothing (env-driven). */
export type WorldCupProviderOptions =
  | WorldCupProviderName
  | { providerName?: WorldCupProviderName };

export function createWorldCupProvider(opts?: WorldCupProviderOptions): WorldCupProvider {
  const name: WorldCupProviderName =
    typeof opts === 'string'
      ? opts
      : (opts?.providerName ??
          ((process.env.WORLD_CUP_PROVIDER as WorldCupProviderName) || 'mock'));

  if (name === 'api-football') {
    const provider = new ApiFootballProvider();
    if (provider.isConfigured()) return provider;
  }
  return new MockWorldCupProvider();
}

export const worldCupProvider = createWorldCupProvider();
