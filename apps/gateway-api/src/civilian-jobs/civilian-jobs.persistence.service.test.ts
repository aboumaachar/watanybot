import { describe, expect, it } from "vitest";
import { civilianJobsRepository } from "./civilian-jobs.repository";
import { getCivilianJobsPersistenceHealth } from "./civilian-jobs.persistence.service";

const firstOpportunity = async () => {
  const rows = await civilianJobsRepository.listOpportunities();
  if (!rows[0]) throw new Error("expected seed opportunity");
  return rows[0];
};

describe("civilian jobs persistence repository", () => {
  it("exposes repository health", async () => {
    const health = await getCivilianJobsPersistenceHealth();
    expect(health.mode).toBe("IN_MEMORY_REPOSITORY_READY_FOR_DB_ADAPTER");
    expect(health.opportunities).toBeGreaterThan(0);
    expect(health.sources).toBeGreaterThan(0);
  });

  it("records audit events for status changes", async () => {
    const opportunity = await firstOpportunity();
    await civilianJobsRepository.updateOpportunityStatus(opportunity.id, "PUBLISHED", "test-admin", "unit test publish");
    const events = await civilianJobsRepository.listAuditEvents("OPPORTUNITY", opportunity.id);
    expect(events.some((event) => event.action === "STATUS_PUBLISHED")).toBe(true);
  });
});