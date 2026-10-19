import { describe, expect, it } from "vitest";
import { InMemoryCivilianJobsRepository } from "./civilian-jobs.repository";
import { getCivilianJobsPersistenceHealth } from "./civilian-jobs.persistence.service";

async function firstOpportunity(repository: InMemoryCivilianJobsRepository) {
  const rows = await repository.listOpportunities();
  if (!rows[0]) throw new Error("expected fixture opportunity");
  return rows[0];
}

describe("civilian jobs persistence repository", () => {
  it("exposes repository health", async () => {
    const health = await getCivilianJobsPersistenceHealth(new InMemoryCivilianJobsRepository());
    expect(health.mode).toBe("IN_MEMORY_REPOSITORY_TEST_FIXTURE");
    expect(health.opportunities).toBeGreaterThan(0);
    expect(health.sources).toBeGreaterThan(0);
  });

  it("records audit events for status changes", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const opportunity = await firstOpportunity(repository);
    await repository.updateOpportunityStatus(opportunity.id, "PUBLISHED", "test-admin", "unit test publish");
    const events = await repository.listAuditEvents("OPPORTUNITY", opportunity.id);
    expect(events.some((event) => event.action === "STATUS_PUBLISHED")).toBe(true);
  });
});
