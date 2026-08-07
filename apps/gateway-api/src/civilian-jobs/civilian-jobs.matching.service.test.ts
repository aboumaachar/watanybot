import { describe, expect, it } from "vitest";
import { matchFreelancersBySkill, scoreOpportunityForCandidate } from "./civilian-jobs.matching.service";
describe("civilian jobs matching", () => {
  it("matches freelancers by multiple selected skills", () => {
    const items = matchFreelancersBySkill([{ id: "f1", userId: "u1", displayName: "Ali", skillIds: ["carpenter", "painter"], availability: "AVAILABLE", verified: true, createdAt: "now", updatedAt: "now" }], ["painter"]);
    expect(items).toHaveLength(1);
  });
  it("scores opportunity candidates deterministically", () => {
    const result = scoreOpportunityForCandidate({ id: "o1", type: "PAID_JOB", status: "PUBLISHED", titleAr: "سائق لشركة", category: "driver", location: "Beirut", organizationName: "Demo", descriptionAr: "", sourceType: "MANUAL", createdAt: "now", updatedAt: "now" } as any, { id: "c1", userId: "u1", applicantKind: "VETERAN", location: "Beirut", skillIds: ["driver"], preferredOpportunityTypes: ["PAID_JOB"], availability: "now" });
    expect(result.score).toBeGreaterThan(0);
  });
});