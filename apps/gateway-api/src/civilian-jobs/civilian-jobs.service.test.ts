import { describe, expect, it } from "vitest";
import { createCivilianOpportunityApplication, getCivilianOpportunity, listCivilianOpportunities } from "./civilian-jobs.service";

describe("civilian jobs wave 01 service", () => {
  it("lists published civilian opportunities", () => {
    const items = listCivilianOpportunities();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === "PUBLISHED")).toBe(true);
  });

  it("gets one opportunity by id", () => {
    const first = listCivilianOpportunities()[0];
    expect(getCivilianOpportunity(first.id)?.id).toBe(first.id);
  });

  it("creates an admin-review application", () => {
    const first = listCivilianOpportunities()[0];
    const application = createCivilianOpportunityApplication({
      opportunityId: first.id,
      applicantName: "Test Applicant",
      applicantPhone: "70000000",
      applicantType: "VETERAN"
    });
    expect(application.status).toBe("NEW_APPLICATION");
  });
});