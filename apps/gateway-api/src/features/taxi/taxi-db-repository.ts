// TAXI_DB_REPOSITORY_WIRING_GATE_PRESENT
// Guarded Prisma-backed taxi repository adapter.
// Runtime switching should happen only after Prisma migration and readiness checks pass.

export type TaxiDbReadiness = {
  ok: boolean;
  mode: "db" | "memory" | "unavailable";
  reasons: string[];
};

type UnknownRecord = Record<string, unknown>;

type TaxiPrismaLike = {
  taxiDriverProfile?: {
    findMany?: (args?: UnknownRecord) => Promise<unknown[]>;
    create?: (args: UnknownRecord) => Promise<unknown>;
    update?: (args: UnknownRecord) => Promise<unknown>;
  };
  taxiVehicle?: {
    findMany?: (args?: UnknownRecord) => Promise<unknown[]>;
    create?: (args: UnknownRecord) => Promise<unknown>;
  };
  taxiServiceArea?: {
    findMany?: (args?: UnknownRecord) => Promise<unknown[]>;
    create?: (args: UnknownRecord) => Promise<unknown>;
  };
  taxiAvailability?: {
    findMany?: (args?: UnknownRecord) => Promise<unknown[]>;
    create?: (args: UnknownRecord) => Promise<unknown>;
  };
  taxiReservation?: {
    findMany?: (args?: UnknownRecord) => Promise<unknown[]>;
    create?: (args: UnknownRecord) => Promise<unknown>;
  };
  taxiCallEvent?: {
    create?: (args: UnknownRecord) => Promise<unknown>;
  };
  taxiAuditEvent?: {
    create?: (args: UnknownRecord) => Promise<unknown>;
  };
};

export function getTaxiDbReadiness(prisma: TaxiPrismaLike | null | undefined): TaxiDbReadiness {
  const reasons: string[] = [];
  if (!prisma) reasons.push("PRISMA_CLIENT_MISSING");
  if (!prisma?.taxiDriverProfile?.findMany) reasons.push("TAXI_DRIVER_PROFILE_DELEGATE_MISSING");
  if (!prisma?.taxiVehicle?.findMany) reasons.push("TAXI_VEHICLE_DELEGATE_MISSING");
  if (!prisma?.taxiServiceArea?.findMany) reasons.push("TAXI_SERVICE_AREA_DELEGATE_MISSING");
  if (!prisma?.taxiAvailability?.findMany) reasons.push("TAXI_AVAILABILITY_DELEGATE_MISSING");
  if (!prisma?.taxiReservation?.findMany) reasons.push("TAXI_RESERVATION_DELEGATE_MISSING");
  if (!prisma?.taxiCallEvent?.create) reasons.push("TAXI_CALL_EVENT_DELEGATE_MISSING");
  if (!prisma?.taxiAuditEvent?.create) reasons.push("TAXI_AUDIT_EVENT_DELEGATE_MISSING");

  return {
    ok: reasons.length === 0,
    mode: reasons.length === 0 ? "db" : "unavailable",
    reasons,
  };
}

export async function listPublicApprovedTaxiDrivers(prisma: TaxiPrismaLike, limit = 20): Promise<unknown[]> {
  const readiness = getTaxiDbReadiness(prisma);
  if (!readiness.ok || !prisma.taxiDriverProfile?.findMany) {
    throw new Error(`Taxi DB repository unavailable: ${readiness.reasons.join(",")}`);
  }

  return prisma.taxiDriverProfile.findMany({
    where: {
      status: "APPROVED",
      otpVerified: true,
      documentReviewStatus: "APPROVED",
      publicVisible: true,
      availabilityEvents: { some: { status: "AVAILABLE" } },
    },
    take: limit,
  });
}

export async function recordTaxiAuditEvent(
  prisma: TaxiPrismaLike,
  eventType: string,
  actorId: string | null,
  subjectId: string | null,
  metadata: UnknownRecord = {},
): Promise<void> {
  const createAudit = prisma.taxiAuditEvent?.create;
  if (!createAudit) return;
  await createAudit({
    data: {
      eventType,
      actorId,
      subjectId,
      metadataJson: JSON.stringify(metadata),
      action: eventType,
      actorUserId: actorId,
      driverId: subjectId,
      detailJson: JSON.stringify(metadata),
    },
  });
}