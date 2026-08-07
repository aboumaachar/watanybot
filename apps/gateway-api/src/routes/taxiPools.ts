import type { FastifyInstance } from 'fastify';

type FastifyWithHasRoute = FastifyInstance & {
  hasRoute?: (options: { method: string; url: string }) => boolean;
};

type PoolRow = {
  id: string;
  createdAt: string;
  ownerId?: string;
  pickup?: unknown;
  destination?: unknown;
  seats?: number;
  note?: string;
};

const pools: PoolRow[] = [];

function safeText(value: unknown, max = 300): string {
  return String(value || '').trim().slice(0, max);
}

function hasExistingTaxiPoolsRoutes(fastify: FastifyInstance): boolean {
  const app = fastify as FastifyWithHasRoute;
  if (typeof app.hasRoute !== 'function') return false;

  try {
    return Boolean(
      app.hasRoute({ method: 'GET', url: '/api/taxi/pools' }) ||
      app.hasRoute({ method: 'POST', url: '/api/taxi/pools' }),
    );
  } catch {
    return false;
  }
}

export async function taxiPoolsRoutes(fastify: FastifyInstance) {
  // APEX_TAXI_POOLS_DUPLICATE_ROUTE_GUARD_v5_0_2
  const fastifyWithTaxiPoolsGuard = fastify as FastifyInstance & {
    __watanybotTaxiPoolsRoutesRegistered?: boolean;
  };

  if (fastifyWithTaxiPoolsGuard.__watanybotTaxiPoolsRoutesRegistered) {
    fastify.log.warn('taxiPoolsRoutes already registered on this Fastify instance; skipping duplicate registration.');
    return;
  }

  if (
    fastify.hasRoute({ method: 'GET', url: '/api/taxi/pools' }) ||
    fastify.hasRoute({ method: 'POST', url: '/api/taxi/pools' })
  ) {
    fastify.log.warn('Taxi pools routes already exist; skipping taxiPoolsRoutes registration to avoid Fastify duplicate route crash.');
    fastifyWithTaxiPoolsGuard.__watanybotTaxiPoolsRoutesRegistered = true;
    return;
  }

  fastifyWithTaxiPoolsGuard.__watanybotTaxiPoolsRoutesRegistered = true;
  if (hasExistingTaxiPoolsRoutes(fastify)) {
    fastify.log.warn(
      { route: '/api/taxi/pools' },
      'taxi_pools_routes_already_registered_skipping_duplicate_plugin',
    );
    return;
  }

  fastify.get('/api/taxi/pools', async () => {
    return { ok: true, pools };
  });

  fastify.post('/api/taxi/pools', async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    const pickup = body.pickup;
    const destination = body.destination;
    const seatsRaw = Number(body.seats || 1);
    const seats = Number.isFinite(seatsRaw) ? Math.max(1, Math.min(6, Math.round(seatsRaw))) : 1;
    const note = safeText(body.note, 500);

    if (!pickup) {
      return reply.code(400).send({ ok: false, error: 'PICKUP_REQUIRED' });
    }

    const row: PoolRow = {
      id: `pool_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      ownerId: safeText(body.ownerId, 120),
      pickup,
      destination,
      seats,
      note,
    };

    pools.unshift(row);
    return reply.code(201).send({ ok: true, pool: row });
  });
}

export default taxiPoolsRoutes;