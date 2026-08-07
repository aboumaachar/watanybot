import {
  TaxiAvailability,
  TaxiAvailabilityInput,
  TaxiDriverApplicationInput,
  TaxiDriverProfile,
  TaxiReservation,
  TaxiReservationInput,
  TaxiSearchQuery,
  isDriverPubliclyVisible,
} from './taxi-domain';
import { getTaxiPrismaClient } from './taxi-prisma-client';
import { decideTaxiRepositoryRuntime } from './taxi-repository-runtime';

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const drivers = new Map<string, TaxiDriverProfile>();
const reservations = new Map<string, TaxiReservation>();

type TaxiCallEventRecord = { id: string; driverId: string; reservationId?: string; callType: string; createdAt: string };
type TaxiDriverReviewRecord = {
  id: string;
  driverId: string;
  userId?: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
};
type TaxiDriverRatingSummary = { driverId: string; averageRating: number; totalReviews: number };
type TaxiComplaintRecord = {
  id: string;
  userId?: string;
  driverId?: string;
  category: 'driver' | 'ride' | 'service' | 'other';
  message: string;
  createdAt: string;
};

const callEvents: TaxiCallEventRecord[] = [];
const driverReviews = new Map<string, TaxiDriverReviewRecord[]>();
const taxiComplaints: TaxiComplaintRecord[] = [];

type TaxiRecord = Record<string, any>;

function getRepositoryRuntime() {
  const prisma = getTaxiPrismaClient();
  const requestedMode = process.env.TAXI_REPOSITORY_MODE ?? (process.env.DATABASE_URL ? 'db' : undefined);
  return { prisma, decision: decideTaxiRepositoryRuntime(prisma, requestedMode) };
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return nowIso();
}

function mapAvailability(row: TaxiRecord | undefined): TaxiAvailability | undefined {
  if (!row) return undefined;
  return {
    id: String(row.id),
    driverId: String(row.driverId),
    status: row.status ?? 'OFFLINE',
    locationLabel: row.locationLabel ?? undefined,
    lat: typeof row.latitude === 'number' ? row.latitude : undefined,
    lng: typeof row.longitude === 'number' ? row.longitude : undefined,
    availableUntil: row.availableUntil ? toIso(row.availableUntil) : undefined,
    lastSeenAt: row.lastSeenAt ? toIso(row.lastSeenAt) : toIso(row.createdAt),
  };
}

function mapDriver(row: TaxiRecord): TaxiDriverProfile {
  const availabilityRows = Array.isArray(row.availabilityEvents) ? row.availabilityEvents : [];
  const vehicles = Array.isArray(row.vehicles) ? row.vehicles : [];
  const serviceAreas = Array.isArray(row.serviceAreas) ? row.serviceAreas : [];

  return {
    id: String(row.id),
    userId: row.userId ?? undefined,
    fullName: String(row.fullName ?? ''),
    phone: String(row.phone ?? ''),
    whatsappPhone: row.whatsappPhone ?? undefined,
    profileImageUrl: row.profileImageUrl ?? undefined,
    status: row.status ?? 'PENDING',
    verificationLevel: row.verificationLevel ?? 'BASIC',
    notes: row.notes ?? undefined,
    vehicles: vehicles.map((vehicle: TaxiRecord) => ({
      id: String(vehicle.id),
      carType: vehicle.carType ?? undefined,
      make: vehicle.make ?? undefined,
      model: vehicle.model ?? undefined,
      year: typeof vehicle.year === 'number' ? vehicle.year : undefined,
      color: vehicle.color ?? undefined,
      platePublicLastDigits: vehicle.platePublicLastDigits ?? undefined,
      plateType: vehicle.plateType ?? 'UNKNOWN',
      seats: typeof vehicle.seats === 'number' ? vehicle.seats : undefined,
      hasInsurance: Boolean(vehicle.hasInsurance),
      hasInspection: Boolean(vehicle.hasInspection),
      hasFireExtinguisher: Boolean(vehicle.hasFireExtinguisher),
    })),
    serviceAreas: serviceAreas.map((area: TaxiRecord) => ({
      id: String(area.id),
      muhafaza: area.muhafaza ?? undefined,
      caza: area.caza ?? undefined,
      village: area.village ?? undefined,
      notes: area.notes ?? undefined,
    })),
    currentAvailability: mapAvailability(availabilityRows[0]),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapReservation(row: TaxiRecord): TaxiReservation {
  return {
    id: String(row.id),
    riderUserId: row.riderUserId ?? undefined,
    driverId: String(row.driverId),
    pickupText: String(row.pickupText ?? ''),
    pickupLat: typeof row.pickupLatitude === 'number' ? row.pickupLatitude : undefined,
    pickupLng: typeof row.pickupLongitude === 'number' ? row.pickupLongitude : undefined,
    destinationText: row.destinationText ?? undefined,
    scheduledAt: row.scheduledAt ? toIso(row.scheduledAt) : undefined,
    status: row.status ?? 'REQUESTED',
    priceAgreementText: row.priceAgreementText ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: toIso(row.createdAt),
  };
}

const driverInclude = {
  vehicles: true,
  serviceAreas: true,
  availabilityEvents: {
    orderBy: [{ lastSeenAt: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 1,
  },
};

async function writeAudit(action: string, driverId: string | undefined, detail: TaxiRecord = {}) {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode !== 'db' || !prisma) return;
  await prisma.taxiAuditEvent.create({
    data: {
      action: action as any,
      driverId,
      detailJson: JSON.stringify(detail),
    },
  });
}

function textMatches(value: string | undefined, query: string | undefined): boolean {
  if (!query) return true;
  if (!value) return false;
  return value.toLowerCase().includes(query.toLowerCase());
}

function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildDriverRatingSummary(driverId: string): TaxiDriverRatingSummary {
  const reviews = driverReviews.get(driverId) ?? [];
  if (!reviews.length) {
    return { driverId, averageRating: 0, totalReviews: 0 };
  }
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    driverId,
    averageRating: roundRating(total / reviews.length),
    totalReviews: reviews.length,
  };
}

export async function createTaxiDriverApplication(input: TaxiDriverApplicationInput): Promise<TaxiDriverProfile> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const driver = await prisma.taxiDriverProfile.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        whatsappPhone: input.whatsappPhone,
        profileImageUrl: input.profileImageUrl,
        notes: input.notes,
        vehicles: {
          create: {
            carType: input.vehicleCarType,
            color: input.vehicleColor,
            make: input.vehicleMake,
            model: input.vehicleModel,
            platePublicLastDigits: input.platePublicLastDigits,
            plateType: input.plateType ?? 'UNKNOWN',
          },
        },
        serviceAreas: {
          create: {
            muhafaza: input.muhafaza,
            caza: input.caza,
            village: input.village,
          },
        },
        auditEvents: {
          create: {
            action: 'DRIVER_APPLIED',
            detailJson: JSON.stringify({ source: 'api' }),
          },
        },
      } as any,
      include: driverInclude,
    });
    return mapDriver(driver as TaxiRecord);
  }

  const id = makeId('taxi_driver');
  const vehicleId = makeId('taxi_vehicle');
  const areaId = makeId('taxi_area');
  const driver: TaxiDriverProfile = {
    id,
    fullName: input.fullName,
    phone: input.phone,
    whatsappPhone: input.whatsappPhone,
    profileImageUrl: input.profileImageUrl,
    notes: input.notes,
    status: 'PENDING',
    verificationLevel: 'BASIC',
    vehicles: [
      {
        id: vehicleId,
        carType: input.vehicleCarType,
        color: input.vehicleColor,
        make: input.vehicleMake,
        model: input.vehicleModel,
        platePublicLastDigits: input.platePublicLastDigits,
        plateType: input.plateType ?? 'UNKNOWN',
        hasInsurance: false,
        hasInspection: false,
        hasFireExtinguisher: false,
      },
    ],
    serviceAreas: [
      {
        id: areaId,
        muhafaza: input.muhafaza,
        caza: input.caza,
        village: input.village,
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  drivers.set(id, driver);
  return driver;
}

export async function setTaxiDriverAvailability(driverId: string, input: TaxiAvailabilityInput): Promise<TaxiAvailability> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const driver = await prisma.taxiDriverProfile.findUnique({ where: { id: driverId } });
    if (!driver) throw new Error('TAXI_DRIVER_NOT_FOUND');
    if (driver.status !== 'APPROVED') throw new Error('TAXI_DRIVER_NOT_APPROVED');

    const availability = await prisma.taxiAvailability.create({
      data: {
        driverId,
        status: input.status,
        locationLabel: input.locationLabel,
        latitude: input.lat,
        longitude: input.lng,
        availableUntil: input.availableUntil ? new Date(input.availableUntil) : undefined,
        lastSeenAt: new Date(),
      },
    });
    await writeAudit('AVAILABILITY_CHANGED', driverId, { status: input.status });
    return mapAvailability(availability as TaxiRecord)!;
  }

  const driver = drivers.get(driverId);
  if (!driver) throw new Error('TAXI_DRIVER_NOT_FOUND');
  if (driver.status !== 'APPROVED') throw new Error('TAXI_DRIVER_NOT_APPROVED');

  const availability: TaxiAvailability = {
    id: makeId('taxi_availability'),
    driverId,
    status: input.status,
    locationLabel: input.locationLabel,
    lat: input.lat,
    lng: input.lng,
    availableUntil: input.availableUntil,
    lastSeenAt: nowIso(),
  };
  driver.currentAvailability = availability;
  driver.updatedAt = nowIso();
  drivers.set(driverId, driver);
  return availability;
}

export async function approveTaxiDriver(driverId: string): Promise<TaxiDriverProfile> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const driver = await prisma.taxiDriverProfile.update({
      where: { id: driverId },
      data: {
        status: 'APPROVED',
        verificationLevel: 'LICENSED',
        publicVisible: true,
      },
      include: driverInclude,
    });
    await writeAudit('DRIVER_APPROVED', driverId);
    return mapDriver(driver as TaxiRecord);
  }

  const driver = drivers.get(driverId);
  if (!driver) throw new Error('TAXI_DRIVER_NOT_FOUND');
  driver.status = 'APPROVED';
  driver.verificationLevel = 'LICENSED';
  driver.updatedAt = nowIso();
  drivers.set(driverId, driver);
  return driver;
}

export async function suspendTaxiDriver(driverId: string, note?: string): Promise<TaxiDriverProfile> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const driver = await prisma.taxiDriverProfile.update({
      where: { id: driverId },
      data: {
        status: 'SUSPENDED',
        notes: note,
        publicVisible: false,
      },
      include: driverInclude,
    });
    await writeAudit('DRIVER_SUSPENDED', driverId, { note });
    return mapDriver(driver as TaxiRecord);
  }

  const driver = drivers.get(driverId);
  if (!driver) throw new Error('TAXI_DRIVER_NOT_FOUND');
  driver.status = 'SUSPENDED';
  driver.notes = note ?? driver.notes;
  driver.updatedAt = nowIso();
  drivers.set(driverId, driver);
  return driver;
}

export async function searchTaxiDrivers(query: TaxiSearchQuery): Promise<TaxiDriverProfile[]> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const q = query.q?.trim();
    const drivers = await prisma.taxiDriverProfile.findMany({
      where: {
        status: 'APPROVED',
        otpVerified: true,
        documentReviewStatus: 'APPROVED',
        publicVisible: true,
        availabilityEvents: { some: { status: 'AVAILABLE' } },
        serviceAreas: {
          some: {
            muhafaza: query.muhafaza ? { contains: query.muhafaza, mode: 'insensitive' } : undefined,
            caza: query.caza ? { contains: query.caza, mode: 'insensitive' } : undefined,
            village: query.village ? { contains: query.village, mode: 'insensitive' } : undefined,
          },
        },
        OR: q
          ? [
              { fullName: { contains: q, mode: 'insensitive' } },
              { serviceAreas: { some: { muhafaza: { contains: q, mode: 'insensitive' } } } },
              { serviceAreas: { some: { caza: { contains: q, mode: 'insensitive' } } } },
              { serviceAreas: { some: { village: { contains: q, mode: 'insensitive' } } } },
              { availabilityEvents: { some: { locationLabel: { contains: q, mode: 'insensitive' } } } },
            ]
          : undefined,
      },
      include: driverInclude,
      take: 25,
      orderBy: { updatedAt: 'desc' },
    });
    return drivers.map((driver: TaxiRecord) => mapDriver(driver as TaxiRecord));
  }

  const q = query.q?.trim();
  return Array.from(drivers.values())
    .filter(isDriverPubliclyVisible)
    .filter((driver) => {
      const areaMatch = driver.serviceAreas.some((area) => {
        return (
          textMatches(area.muhafaza, query.muhafaza) &&
          textMatches(area.caza, query.caza) &&
          textMatches(area.village, query.village)
        );
      });
      const freeTextMatch = !q ||
        driver.fullName.toLowerCase().includes(q.toLowerCase()) ||
        driver.currentAvailability?.locationLabel?.toLowerCase().includes(q.toLowerCase()) ||
        driver.serviceAreas.some((area) => [area.muhafaza, area.caza, area.village].some((value) => textMatches(value, q)));
      return areaMatch && freeTextMatch;
    })
    .sort((left, right) => {
      const leftTime = left.currentAvailability?.lastSeenAt ?? '';
      const rightTime = right.currentAvailability?.lastSeenAt ?? '';
      return rightTime.localeCompare(leftTime);
    });
}

export async function createTaxiReservation(input: TaxiReservationInput, riderUserId?: string): Promise<TaxiReservation> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const driver = await prisma.taxiDriverProfile.findFirst({
      where: {
        id: input.driverId,
        status: 'APPROVED',
        otpVerified: true,
        documentReviewStatus: 'APPROVED',
        publicVisible: true,
        availabilityEvents: { some: { status: 'AVAILABLE' } },
      },
    });
    if (!driver) throw new Error('TAXI_DRIVER_NOT_AVAILABLE');

    const reservation = await prisma.taxiReservation.create({
      data: {
        riderUserId,
        driverId: input.driverId,
        pickupText: input.pickupText,
        pickupLatitude: input.pickupLat,
        pickupLongitude: input.pickupLng,
        destinationText: input.destinationText,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        notes: input.notes,
      },
    });
    await writeAudit('RESERVATION_CREATED', input.driverId, { reservationId: reservation.id });
    return mapReservation(reservation as TaxiRecord);
  }

  const driver = drivers.get(input.driverId);
  if (!driver || !isDriverPubliclyVisible(driver)) throw new Error('TAXI_DRIVER_NOT_AVAILABLE');
  const reservation: TaxiReservation = {
    id: makeId('taxi_reservation'),
    riderUserId,
    driverId: input.driverId,
    pickupText: input.pickupText,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    destinationText: input.destinationText,
    scheduledAt: input.scheduledAt,
    status: 'REQUESTED',
    notes: input.notes,
    createdAt: nowIso(),
  };
  reservations.set(reservation.id, reservation);
  return reservation;
}

export async function recordTaxiCallEvent(input: { driverId: string; reservationId?: string; callType: string }) {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const event = await prisma.taxiCallEvent.create({
      data: {
        driverId: input.driverId,
        reservationId: input.reservationId,
        callType: input.callType as any,
      },
    });
    await writeAudit('RESERVATION_CREATED', input.driverId, { callEventId: event.id, callType: input.callType });
    return { id: event.id, driverId: event.driverId, reservationId: event.reservationId ?? undefined, callType: event.callType, createdAt: toIso(event.createdAt) };
  }

  const event = { id: makeId('taxi_call'), driverId: input.driverId, reservationId: input.reservationId, callType: input.callType, createdAt: nowIso() };
  callEvents.push(event);
  return event;
}

export async function listTaxiCallEventsForAdmin(): Promise<TaxiCallEventRecord[]> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const rows = await prisma.taxiCallEvent.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row: TaxiRecord) => ({
      id: row.id,
      driverId: row.driverId ?? '',
      reservationId: row.reservationId ?? undefined,
      callType: row.callType,
      createdAt: toIso(row.createdAt),
    }));
  }

  return [...callEvents].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listTaxiDriversForAdmin(status?: string): Promise<TaxiDriverProfile[]> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const drivers = await prisma.taxiDriverProfile.findMany({
      where: status ? { status: status as any } : undefined,
      include: driverInclude,
      orderBy: { createdAt: 'desc' },
    });
    return drivers.map((driver: TaxiRecord) => mapDriver(driver as TaxiRecord));
  }

  return Array.from(drivers.values()).filter((driver) => !status || driver.status === status);
}

export async function listTaxiReservationsForAdmin(): Promise<TaxiReservation[]> {
  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const rows = await prisma.taxiReservation.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row: TaxiRecord) => mapReservation(row as TaxiRecord));
  }

  return Array.from(reservations.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listTaxiReservationsForUser(riderUserId?: string): Promise<TaxiReservation[]> {
  const items = await listTaxiReservationsForAdmin();
  if (!riderUserId) return [];
  return items.filter((item) => item.riderUserId === riderUserId);
}

export async function listTaxiDriverReviews(driverId: string): Promise<TaxiDriverReviewRecord[]> {
  const reviews = driverReviews.get(driverId) ?? [];
  return [...reviews].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createTaxiDriverReview(
  driverId: string,
  input: { userId?: string; rating: number; comment?: string },
): Promise<TaxiDriverReviewRecord> {
  const rating = Number(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('TAXI_REVIEW_RATING_OUT_OF_RANGE');
  }

  const { prisma, decision } = getRepositoryRuntime();
  if (decision.mode === 'db' && prisma) {
    const driver = await prisma.taxiDriverProfile.findUnique({ where: { id: driverId } });
    if (!driver) throw new Error('TAXI_DRIVER_NOT_FOUND');
  } else {
    const driver = drivers.get(driverId);
    if (!driver) throw new Error('TAXI_DRIVER_NOT_FOUND');
  }

  const nextReviews = [...(driverReviews.get(driverId) ?? [])];
  const now = nowIso();
  const trimmedComment = input.comment?.trim();
  const reviewerId = input.userId?.trim();
  const existingIndex = reviewerId ? nextReviews.findIndex((review) => review.userId === reviewerId) : -1;

  const review: TaxiDriverReviewRecord = existingIndex >= 0
    ? {
        ...nextReviews[existingIndex],
        rating,
        comment: trimmedComment || undefined,
        updatedAt: now,
      }
    : {
        id: makeId('taxi_review'),
        driverId,
        userId: reviewerId || undefined,
        rating,
        comment: trimmedComment || undefined,
        createdAt: now,
        updatedAt: now,
      };

  if (existingIndex >= 0) {
    nextReviews[existingIndex] = review;
  } else {
    nextReviews.push(review);
  }

  driverReviews.set(driverId, nextReviews);
  return review;
}

export async function getTaxiDriverRatingSummary(driverId: string): Promise<TaxiDriverRatingSummary> {
  return buildDriverRatingSummary(driverId);
}

export async function getTaxiDriverRatingSummaries(driverIds: string[]): Promise<TaxiDriverRatingSummary[]> {
  const uniqueIds = Array.from(new Set(driverIds.filter(Boolean)));
  return uniqueIds.map((driverId) => buildDriverRatingSummary(driverId));
}

export async function createTaxiComplaint(input: {
  userId?: string;
  driverId?: string;
  category?: string;
  message: string;
}): Promise<TaxiComplaintRecord> {
  const message = input.message?.trim();
  if (!message) {
    throw new Error('TAXI_COMPLAINT_MESSAGE_REQUIRED');
  }

  const normalizedCategory = (input.category || 'service').toLowerCase();
  const category: TaxiComplaintRecord['category'] =
    normalizedCategory === 'driver' || normalizedCategory === 'ride' || normalizedCategory === 'service' || normalizedCategory === 'other'
      ? normalizedCategory
      : 'other';

  const complaint: TaxiComplaintRecord = {
    id: makeId('taxi_complaint'),
    userId: input.userId?.trim() || undefined,
    driverId: input.driverId?.trim() || undefined,
    category,
    message,
    createdAt: nowIso(),
  };

  taxiComplaints.unshift(complaint);
  return complaint;
}