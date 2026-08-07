export const TAXI_PRISMA_PERSISTENCE_GATE_PRESENT = true;

export type TaxiPrismaRecord = Record<string, unknown>;

type ModelDelegate = {
  findMany?: (args?: unknown) => Promise<TaxiPrismaRecord[]>;
  findUnique?: (args?: unknown) => Promise<TaxiPrismaRecord | null>;
  create?: (args: unknown) => Promise<TaxiPrismaRecord>;
  update?: (args: unknown) => Promise<TaxiPrismaRecord>;
};

export type TaxiPrismaLike = {
  taxiDriverProfile?: ModelDelegate;
  taxiReservation?: ModelDelegate;
  taxiAuditEvent?: ModelDelegate;
};

export function assertTaxiPrismaReady(prisma: TaxiPrismaLike): void {
  if (!prisma.taxiDriverProfile || !prisma.taxiReservation || !prisma.taxiAuditEvent) {
    throw new Error("TAXI_PRISMA_MODELS_NOT_AVAILABLE: merge taxi Prisma models, run migration, and regenerate Prisma client before production use.");
  }
}

export function createTaxiPrismaPersistence(prisma: TaxiPrismaLike) {
  assertTaxiPrismaReady(prisma);
  const taxiDriverProfile = prisma.taxiDriverProfile;
  const taxiReservation = prisma.taxiReservation;
  const taxiAuditEvent = prisma.taxiAuditEvent;
  const findManyTaxiDrivers = taxiDriverProfile?.findMany;
  const createTaxiDriver = taxiDriverProfile?.create;
  const createTaxiAuditEvent = taxiAuditEvent?.create;

  if (!findManyTaxiDrivers || !createTaxiDriver || !taxiReservation || !createTaxiAuditEvent) {
    throw new Error("TAXI_PRISMA_DELEGATE_METHODS_NOT_AVAILABLE: regenerate Prisma client and verify taxi model delegates.");
  }

  return {
    async searchPublicApprovedDrivers() {
      return findManyTaxiDrivers({
        where: {
          status: "APPROVED",
          phoneVerifiedAt: { not: null },
          documentsApprovedAt: { not: null },
          suspendedAt: null,
        },
        take: 25,
      });
    },

    async createDriverApplication(input: TaxiPrismaRecord) {
      return createTaxiDriver({
        data: {
          ...input,
          status: "PENDING",
        },
      });
    },

    async writeAuditEvent(input: TaxiPrismaRecord) {
      return createTaxiAuditEvent({ data: input });
    },
  };
}