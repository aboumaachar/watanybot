import { describe, expect, it } from "vitest";
import { InMemoryMarketplaceJobApplicationsRepository } from "./repository";
import type { JobApplicationRecord } from "./types";

const application: JobApplicationRecord = {
  id: "app_test_marketplace_1",
  job_id: "job_v2_001",
  veteran_name: "Test Applicant",
  phone: "70000010",
  email: "test@example.test",
  cover_letter: "Test cover letter",
  status: "pending",
  applied_at: "2026-08-18T00:00:00.000Z",
};

describe("marketplace job application repository contract", () => {
  it("preserves duplicate detection and phone reads in an injected fixture", async () => {
    const repository = new InMemoryMarketplaceJobApplicationsRepository();
    expect(await repository.findByJobAndPhone(application.job_id, application.phone)).toBeUndefined();
    await repository.save(application);
    expect(await repository.findByJobAndPhone(application.job_id, application.phone)).toEqual(application);
    expect(await repository.listByPhone(application.phone)).toHaveLength(1);
  });

  it("propagates storage failure instead of manufacturing success", async () => {
    const repository = new InMemoryMarketplaceJobApplicationsRepository();
    repository.save = async () => { throw new Error("storage unavailable"); };
    await expect(repository.save(application)).rejects.toThrow("storage unavailable");
  });
});