import type { FastifyInstance } from 'fastify';
import { findPaymentOverrideAnswer, loadPaymentOverrides } from './payment-override-service';

export async function registerPaymentOverrideRoutes(server: FastifyInstance): Promise<void> {
  server.get('/api/payment-intelligence/overrides', async (_request, reply) => {
    return reply.send({ ok: true, overrides: loadPaymentOverrides() });
  });

  server.post('/api/payment-intelligence/override-match', async (request, reply) => {
    const body = (request.body || {}) as { query?: string; locale?: 'ar' | 'en' };
    const result = findPaymentOverrideAnswer(body.query || '', body.locale || 'ar');
    return reply.send({ ok: true, result });
  });
}

export default registerPaymentOverrideRoutes;