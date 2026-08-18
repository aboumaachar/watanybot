import { describe, expect, it } from "vitest";
import { createCivilianOpportunityApplication, getCivilianOpportunity, listCivilianOpportunities } from "./civilian-jobs.service";
import { InMemoryCivilianJobsRepository } from "./civilian-jobs.repository";

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
    }, new InMemoryCivilianJobsRepository());
    return application.then((record) => expect(record.status).toBe("NEW_APPLICATION"));
  });

  it("does not return success when the durable repository rejects the write", async () => {
    const first = listCivilianOpportunities()[0];
    const repository = new InMemoryCivilianJobsRepository();
    repository.saveApplication = async () => {
      throw new Error("storage unavailable");
    };

    await expect(createCivilianOpportunityApplication({
      opportunityId: first.id,
      applicantName: "Storage Failure",
      applicantPhone: "70000001",
      applicantType: "VETERAN",
    }, repository)).rejects.toThrow("storage unavailable");
  });

  it("accepts only HTTPS external CV metadata", async () => {
    const first = listCivilianOpportunities()[0];
    const repository = new InMemoryCivilianJobsRepository();

    await expect(createCivilianOpportunityApplication({
      opportunityId: first.id,
      applicantName: "CV Applicant",
      applicantPhone: "70000002",
      applicantType: "VETERAN",
      cvUrl: "http://example.test/cv.pdf",
    }, repository)).rejects.toThrow("CV URL must use HTTPS");

    const application = await createCivilianOpportunityApplication({
      opportunityId: first.id,
      applicantName: "CV Applicant",
      applicantPhone: "70000003",
      applicantType: "VETERAN",
      cvUrl: "https://files.example.test/cv.pdf",
    }, repository);
    expect(application.cvUrl).toBe("https://files.example.test/cv.pdf");
  });
});