import type { FastifyInstance } from 'fastify';
import {
  approveNetworkMembership,
  getNetworkMembership,
  getNetworkSettings,
  listNetworkProfiles,
  saveDraftNetworkMembership,
  searchNetworkProfiles,
  submitNetworkMembership,
} from './network-store';
import type { NetworkFamilyTier, NetworkVisibilityLevel } from './network-types';

type MembershipBody = {
  userId?: string;
  displayName?: string;
  visibilityLevel?: NetworkVisibilityLevel;
  familyTier?: NetworkFamilyTier;
  points?: number;
  address?: unknown;
  isVerifiedUser?: boolean;
};

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizeVisibilityLevel(value: unknown): NetworkVisibilityLevel {
  const normalized = normalizeText(value) as NetworkVisibilityLevel;
  if (normalized === 'VISIBLE_PUBLIC' || normalized === 'VISIBLE_NETWORK_ONLY' || normalized === 'VISIBLE_CAZA_ONLY' || normalized === 'VISIBLE_VILLAGE_ONLY' || normalized === 'HIDDEN') {
    return normalized;
  }
  return 'VISIBLE_CAZA_ONLY';
}

function normalizeFamilyTier(value: unknown): NetworkFamilyTier {
  const normalized = normalizeText(value) as NetworkFamilyTier;
  if (normalized === 'BASIC_FAMILY_MEMBER' || normalized === 'VERIFIED_FAMILY_MEMBER' || normalized === 'CONTRIBUTOR' || normalized === 'COMMUNITY_STEWARD') {
    return normalized;
  }
  return 'BASIC_FAMILY_MEMBER';
}

export async function theNetworkRoutes(server: FastifyInstance) {
  server.get('/api/network/settings', async () => ({ ok: true, settings: getNetworkSettings() }));

  server.get('/api/network/membership', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const userId = normalizeText(query.userId);
    if (!userId) {
      return reply.code(400).send({ ok: false, error: 'USER_ID_REQUIRED' });
    }

    const profile = await getNetworkMembership(userId);
    return { ok: true, profile };
  });

  server.put('/api/network/membership', async (request, reply) => {
    const body = (request.body ?? {}) as MembershipBody;
    const userId = normalizeText(body.userId);
    if (!userId) {
      return reply.code(400).send({ ok: false, error: 'USER_ID_REQUIRED' });
    }

    const nextProfile = await saveDraftNetworkMembership({
      userId,
      displayName: normalizeText(body.displayName),
      address: body.address,
      visibilityLevel: normalizeVisibilityLevel(body.visibilityLevel),
      familyTier: normalizeFamilyTier(body.familyTier),
      points: Number(body.points ?? 0),
      isVerifiedUser: body.isVerifiedUser === true,
    });

    return { ok: true, profile: nextProfile };
  });

  server.post('/api/network/membership/submit', async (request, reply) => {
    const body = (request.body ?? {}) as MembershipBody;
    const userId = normalizeText(body.userId);
    if (!userId) {
      return reply.code(400).send({ ok: false, error: 'USER_ID_REQUIRED' });
    }

    const profile = await submitNetworkMembership(userId);
    if (!profile) {
      return reply.code(404).send({ ok: false, error: 'PROFILE_NOT_FOUND' });
    }

    return { ok: true, profile };
  });

  server.post('/api/network/membership/approve', async (request, reply) => {
    const body = (request.body ?? {}) as MembershipBody;
    const userId = normalizeText(body.userId);
    if (!userId) {
      return reply.code(400).send({ ok: false, error: 'USER_ID_REQUIRED' });
    }

    const profile = await approveNetworkMembership(userId);
    if (!profile) {
      return reply.code(404).send({ ok: false, error: 'PROFILE_NOT_FOUND' });
    }

    return { ok: true, profile };
  });

  server.get('/api/network/map', async () => ({ ok: true, profiles: await listNetworkProfiles() }));
  server.get('/api/network/search', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return {
      ok: true,
      profiles: await searchNetworkProfiles({
        governorateId: query.governorateId,
        cazaId: query.cazaId,
        municipalityId: query.municipalityId,
        villageId: query.villageId,
      }),
    };
  });
}

export default theNetworkRoutes;