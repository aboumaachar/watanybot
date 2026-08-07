// TAXI_REPOSITORY_RUNTIME_SWITCH_GATE_PRESENT
// This module centralizes future DB/runtime repository switching.
// Do not switch to DB mode unless migration proof and Prisma delegates are available.

import { getTaxiDbReadiness } from "./taxi-db-repository";

type TaxiRepositoryRuntimeMode = "memory" | "db";

type TaxiRuntimeDecision = {
  mode: TaxiRepositoryRuntimeMode;
  dbReady: boolean;
  reasons: string[];
};

export function decideTaxiRepositoryRuntime(prisma: unknown, requestedMode: string | undefined): TaxiRuntimeDecision {
  const requested = requestedMode === "db" ? "db" : "memory";
  const dbReadiness = getTaxiDbReadiness(prisma as never);
  if (requested === "db" && dbReadiness.ok) {
    return { mode: "db", dbReady: true, reasons: [] };
  }
  if (requested === "db" && !dbReadiness.ok) {
    return { mode: "memory", dbReady: false, reasons: dbReadiness.reasons };
  }
  return { mode: "memory", dbReady: dbReadiness.ok, reasons: [] };
}