// TAXI_DB_WIRING_READINESS_GATE_PRESENT

export type TaxiDbWiringReadinessReport = {
  schemaFound: boolean;
  migrationProofFound: boolean;
  prismaClientGenerated: boolean;
  routeSwitchAllowed: boolean;
  blockers: string[];
};

export function createTaxiDbWiringReadinessReport(input: {
  schemaFound: boolean;
  migrationProofFound: boolean;
  prismaClientGenerated: boolean;
}): TaxiDbWiringReadinessReport {
  const blockers: string[] = [];
  if (!input.schemaFound) blockers.push("SCHEMA_MISSING");
  if (!input.migrationProofFound) blockers.push("MIGRATION_PROOF_MISSING");
  if (!input.prismaClientGenerated) blockers.push("PRISMA_CLIENT_NOT_GENERATED");
  return {
    ...input,
    routeSwitchAllowed: blockers.length === 0,
    blockers,
  };
}