import { createWorldCupProvider } from '../providers/providerRegistry';

export async function getWorldCupProviderHealth() {
  const provider = createWorldCupProvider({ providerName: 'mock' });
  return {
    ok: true,
    provider: provider.name,
    mode: 'mock',
    checkedAt: new Date().toISOString(),
    note: 'Batch 3 uses mock provider only. Real provider wiring is intentionally deferred.',
  };
}
