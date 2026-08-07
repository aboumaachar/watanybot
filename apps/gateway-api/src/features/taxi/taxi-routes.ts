import type { FastifyInstance } from 'fastify';
import {
  approveTaxiDriver,
  createTaxiComplaint,
  createTaxiDriverApplication,
  createTaxiDriverReview,
  createTaxiReservation,
  getTaxiDriverRatingSummaries,
  getTaxiDriverRatingSummary,
  listTaxiCallEventsForAdmin,
  listTaxiDriverReviews,
  listTaxiDriversForAdmin,
  listTaxiReservationsForAdmin,
  listTaxiReservationsForUser,
  recordTaxiCallEvent,
  searchTaxiDrivers,
  setTaxiDriverAvailability,
  suspendTaxiDriver,
} from './taxi-repository';

const taxiAdminSettings = {
  featureFlags: {
    taxiEnabled: true,
    driverApplyEnabled: true,
    reservationEnabled: true,
    callButtonEnabled: true,
    whatsappButtonEnabled: true,
    adminReviewRequired: true,
    communityChatUnchanged: true,
  },
  matchingDefaults: {
    minimumVisibleCharacters: 3,
    defaultSearchLimit: 5,
    preferAvailableDrivers: true,
  },
  safetyDefaults: {
    showOnlyPartialPlate: true,
    requireAdminApprovalBeforePublicListing: true,
    requirePhoneVerificationBeforeProduction: true,
  },
};

function requireBody<T>(body: unknown): T {
  if (!body || typeof body !== 'object') throw new Error('REQUEST_BODY_REQUIRED');
  return body as T;
}

export async function taxiRoutes(app: FastifyInstance) {
  app.get('/api/taxi/search', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return {
      ok: true,
      drivers: await searchTaxiDrivers({
        q: query.q,
        muhafaza: query.muhafaza,
        caza: query.caza,
        village: query.village,
      }),
      safetyNotice: 'الرجاء الاتفاق على السعر بوضوح مع السائق قبل الانطلاق.',
    };
  });

  app.get('/api/taxi/ratings', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const ids = (query.driverIds ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return { ok: true, ratings: await getTaxiDriverRatingSummaries(ids) };
  });

  app.get('/api/taxi/drivers/:id/rating', async (request) => {
    const params = request.params as { id: string };
    return { ok: true, rating: await getTaxiDriverRatingSummary(params.id) };
  });

  app.get('/api/taxi/drivers/:id/reviews', async (request) => {
    const params = request.params as { id: string };
    return { ok: true, reviews: await listTaxiDriverReviews(params.id) };
  });

  app.post('/api/taxi/drivers/:id/reviews', async (request, reply) => {
    const params = request.params as { id: string };
    const body = requireBody<Record<string, unknown>>(request.body);
    const rating = Number(body.rating);

    if (!Number.isFinite(rating)) {
      return reply.code(400).send({ ok: false, error: 'RATING_REQUIRED' });
    }

    const review = await createTaxiDriverReview(params.id, {
      userId: typeof body.userId === 'string' ? body.userId : undefined,
      rating,
      comment: typeof body.comment === 'string' ? body.comment : undefined,
    });
    const summary = await getTaxiDriverRatingSummary(params.id);
    return reply.code(201).send({ ok: true, review, summary });
  });

  app.post('/api/taxi/driver/apply', async (request, reply) => {
    const body = requireBody<Record<string, string>>(request.body);
    if (!body.fullName || !body.phone) {
      return reply.code(400).send({ ok: false, error: 'FULL_NAME_AND_PHONE_REQUIRED' });
    }
    const driver = await createTaxiDriverApplication({
      fullName: body.fullName,
      phone: body.phone,
      whatsappPhone: body.whatsappPhone,
      profileImageUrl: body.profileImageUrl,
      notes: body.notes,
      vehicleCarType: body.vehicleCarType,
      vehicleColor: body.vehicleColor,
      vehicleMake: body.vehicleMake,
      vehicleModel: body.vehicleModel,
      platePublicLastDigits: body.platePublicLastDigits,
      plateType: (body.plateType as any) ?? 'UNKNOWN',
      muhafaza: body.muhafaza,
      caza: body.caza,
      village: body.village,
    });
    return reply.code(201).send({ ok: true, driver, nextStep: 'PENDING_ADMIN_REVIEW' });
  });

  app.post('/api/taxi/driver/availability', async (request, reply) => {
    const body = requireBody<Record<string, string | number | undefined>>(request.body);
    const driverId = String(body.driverId ?? '');
    if (!driverId) return reply.code(400).send({ ok: false, error: 'DRIVER_ID_REQUIRED' });
    const availability = await setTaxiDriverAvailability(driverId, {
      status: (body.status as any) ?? 'OFFLINE',
      locationLabel: typeof body.locationLabel === 'string' ? body.locationLabel : undefined,
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      lng: typeof body.lng === 'number' ? body.lng : undefined,
      availableUntil: typeof body.availableUntil === 'string' ? body.availableUntil : undefined,
    });
    return { ok: true, availability };
  });

  app.post('/api/taxi/reservations', async (request, reply) => {
    const body = requireBody<Record<string, string | number | undefined>>(request.body);
    const driverId = String(body.driverId ?? '');
    const pickupText = String(body.pickupText ?? '');
    if (!driverId || !pickupText) return reply.code(400).send({ ok: false, error: 'DRIVER_ID_AND_PICKUP_REQUIRED' });
    const reservation = await createTaxiReservation({
      driverId,
      pickupText,
      pickupLat: typeof body.pickupLat === 'number' ? body.pickupLat : undefined,
      pickupLng: typeof body.pickupLng === 'number' ? body.pickupLng : undefined,
      destinationText: typeof body.destinationText === 'string' ? body.destinationText : undefined,
      scheduledAt: typeof body.scheduledAt === 'string' ? body.scheduledAt : undefined,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    }, typeof body.riderUserId === 'string' ? body.riderUserId : undefined);
    return reply.code(201).send({ ok: true, reservation });
  });

  app.get('/api/taxi/my/reservations', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const riderUserId = query.user_id?.trim() || query.riderUserId?.trim() || '';
    return { ok: true, reservations: await listTaxiReservationsForUser(riderUserId) };
  });

  app.post('/api/taxi/call-events', async (request, reply) => {
    const body = requireBody<Record<string, string | undefined>>(request.body);
    if (!body.driverId) return reply.code(400).send({ ok: false, error: 'DRIVER_ID_REQUIRED' });
    const event = await recordTaxiCallEvent({ driverId: body.driverId, reservationId: body.reservationId, callType: body.callType ?? 'DIRECT_PHONE' });
    return reply.code(201).send({ ok: true, event });
  });

  app.post('/api/taxi/complaints', async (request, reply) => {
    const body = requireBody<Record<string, unknown>>(request.body);
    const complaint = await createTaxiComplaint({
      userId: typeof body.userId === 'string' ? body.userId : undefined,
      driverId: typeof body.driverId === 'string' ? body.driverId : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
      message: typeof body.message === 'string' ? body.message : '',
    });
    return reply.code(201).send({ ok: true, complaint });
  });

  app.get('/api/admin/taxi/drivers', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    return { ok: true, drivers: await listTaxiDriversForAdmin(query.status) };
  });

  app.patch('/api/admin/taxi/drivers/:id/approve', async (request) => {
    const params = request.params as { id: string };
    return { ok: true, driver: await approveTaxiDriver(params.id) };
  });

  app.patch('/api/admin/taxi/drivers/:id/suspend', async (request) => {
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as { note?: string };
    return { ok: true, driver: await suspendTaxiDriver(params.id, body.note) };
  });

  app.patch('/api/admin/taxi/drivers/:id/status', async (request, reply) => {
    const params = request.params as { id: string };
    const body = (request.body ?? {}) as { status?: string; note?: string };
    const status = body.status?.toUpperCase();

    if (status === 'APPROVED') {
      return { ok: true, driver: await approveTaxiDriver(params.id) };
    }

    if (status === 'SUSPENDED') {
      return { ok: true, driver: await suspendTaxiDriver(params.id, body.note) };
    }

    return reply.code(400).send({ ok: false, error: 'UNSUPPORTED_TAXI_DRIVER_STATUS' });
  });

  app.get('/api/admin/taxi/reservations', async () => {
    return { ok: true, reservations: await listTaxiReservationsForAdmin() };
  });

  app.get('/api/admin/taxi/monitoring', async () => {
    const [drivers, reservations, callEvents] = await Promise.all([
      listTaxiDriversForAdmin(),
      listTaxiReservationsForAdmin(),
      listTaxiCallEventsForAdmin(),
    ]);

    return {
      ok: true,
      monitoring: {
        totalDrivers: drivers.length,
        pendingDrivers: drivers.filter((driver) => driver.status === 'PENDING').length,
        approvedDrivers: drivers.filter((driver) => driver.status === 'APPROVED').length,
        suspendedDrivers: drivers.filter((driver) => driver.status === 'SUSPENDED').length,
        totalReservations: reservations.length,
        totalCallEvents: callEvents.length,
        availableDrivers: drivers.filter((driver) => driver.currentAvailability?.status === 'AVAILABLE').length,
      },
    };
  });

  app.get('/api/admin/taxi/settings', async () => {
    return { ok: true, settings: taxiAdminSettings };
  });
}