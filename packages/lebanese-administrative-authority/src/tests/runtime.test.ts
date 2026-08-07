import { describe, expect, it } from 'vitest';
import { loadAdministrativeRuntime } from '../runtime';

describe('UL2 runtime fail-closed behavior', () => {
  it('rejects a candidate manifest before loading data', async () => {
    const response = { ok: true, status: 200, json: async () => ({ status: 'candidate', releasedAt: null, approval: { approvedBy: [] } }) } as Response;
    await expect(loadAdministrativeRuntime({ manifestUrl: '/manifest.json', canonicalUrl: '/canonical.json', aliasesUrl: '/aliases.json', fetchImpl: async () => response })).rejects.toThrow('UL2_DATASET_NOT_RELEASED');
  });

  it('rejects HTTP failures', async () => {
    await expect(loadAdministrativeRuntime({ manifestUrl: '/manifest.json', canonicalUrl: '/canonical.json', aliasesUrl: '/aliases.json', fetchImpl: async () => ({ ok: false, status: 404 } as Response) })).rejects.toThrow('UL2_RUNTIME_HTTP_404');
  });
});
