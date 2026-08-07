import type { FastifyPluginAsync } from 'fastify';
import { taxiTrustedMobilityRepository } from '../services/taxiTrustedMobilityRepository';

const taxiTrustedMobilityRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/taxi/drivers', async (request) => {
    const query = request.query as { area?: string };
    return {
      ok: true,
      drivers: taxiTrustedMobilityRepository.listApprovedAvailable(query.area),
    };
  });

  app.post('/api/taxi/driver/apply', async (request, reply) => {
    const body = request.body as {
      fullName?: string;
      phone?: string;
      whatsappPhone?: string;
      areaLabel?: string;
      vehicleLabel?: string;
      platePublicLastDigits?: string;
    };

    if (!body.fullName || !body.phone || !body.areaLabel || !body.vehicleLabel) {
      return reply.code(400).send({ ok: false, error: 'MISSING_REQUIRED_DRIVER_FIELDS' });
    }

    const application = taxiTrustedMobilityRepository.apply({
      fullName: body.fullName,
      phone: body.phone,
      whatsappPhone: body.whatsappPhone,
      areaLabel: body.areaLabel,
      vehicleLabel: body.vehicleLabel,
      platePublicLastDigits: body.platePublicLastDigits,
    });

    return { ok: true, application };
  });

  app.post('/api/taxi/availability', async (request, reply) => {
    const body = request.body as { driverId?: string; availability?: 'AVAILABLE' | 'BUSY' | 'OFFLINE'; areaLabel?: string };
    if (!body.driverId || !body.availability) {
      return reply.code(400).send({ ok: false, error: 'MISSING_REQUIRED_AVAILABILITY_FIELDS' });
    }
    const driver = taxiTrustedMobilityRepository.setAvailability(body.driverId, body.availability, body.areaLabel);
    if (!driver) return reply.code(404).send({ ok: false, error: 'DRIVER_NOT_FOUND' });
    return { ok: true, driver };
  });

  app.get('/api/admin/taxi/drivers', async () => {
    return { ok: true, drivers: taxiTrustedMobilityRepository.adminList() };
  });

  app.patch('/api/admin/taxi/drivers/:id/status', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' };
    if (!body.status) return reply.code(400).send({ ok: false, error: 'MISSING_STATUS' });
    const driver = taxiTrustedMobilityRepository.adminSetStatus(params.id, body.status);
    if (!driver) return reply.code(404).send({ ok: false, error: 'DRIVER_NOT_FOUND' });
    return { ok: true, driver };
  });

  app.get('/api/admin/taxi/monitoring', async () => {
    return { ok: true, monitoring: taxiTrustedMobilityRepository.adminGetMonitoring() };
  });

  app.get('/api/admin/taxi/settings', async () => {
    return { ok: true, settings: taxiTrustedMobilityRepository.adminGetSettings() };
  });

  app.patch('/api/admin/taxi/settings', async (request) => {
    const body = request.body as {
      requireAdminApproval?: boolean;
      allowPhoneContact?: boolean;
      allowWhatsappContact?: boolean;
      complaintsEnabled?: boolean;
      privacyMaskPlateDigits?: boolean;
      veteranPriorityOnly?: boolean;
      maxActiveReservationsPerDriver?: number;
      availabilityHeartbeatMinutes?: number;
    };

    const settings = taxiTrustedMobilityRepository.adminUpdateSettings(body || {});
    return { ok: true, settings };
  });
};

export default taxiTrustedMobilityRoutes;
export { taxiTrustedMobilityRoutes };