import { describe, expect, it } from "vitest";
import { adminUpdateApplicationStatus } from "./civilian-jobs.admin.service";
import { createCivilianOpportunityApplication, getCivilianOpportunity, listCivilianOpportunityApplications, listCivilianOpportunities, updateCivilianOpportunityApplicationStatus } from "./civilian-jobs.service";
import { InMemoryCivilianJobsRepository } from "./civilian-jobs.repository";

async function firstPublished(repository: InMemoryCivilianJobsRepository) {
  const rows = await listCivilianOpportunities({}, repository);
  if (!rows[0]) throw new Error("expected published fixture opportunity");
  return rows[0];
}

describe("civilian jobs wave 01 service", () => {
  it("lists published civilian opportunities", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const items = await listCivilianOpportunities({}, repository);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === "PUBLISHED")).toBe(true);
  });

  it("gets one opportunity by id", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const first = await firstPublished(repository);
    expect((await getCivilianOpportunity(first.id, repository))?.id).toBe(first.id);
  });

  it("creates an admin-review application", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const first = await firstPublished(repository);
    const application = await createCivilianOpportunityApplication({
      opportunityId: first.id,
      applicantName: "Test Applicant",
      applicantPhone: "70000000",
      applicantType: "VETERAN",
    }, repository);
    expect(application.status).toBe("NEW_APPLICATION");
  });

  it("does not return success when the durable repository rejects the write", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const first = await firstPublished(repository);
    repository.saveApplication = async () => { throw new Error("storage unavailable"); };
    await expect(createCivilianOpportunityApplication({
      opportunityId: first.id,
      applicantName: "Storage Failure",
      applicantPhone: "70000001",
      applicantType: "VETERAN",
    }, repository)).rejects.toThrow("storage unavailable");
  });

  it("persists application status updates through the repository", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const first = await firstPublished(repository);
    const application = await createCivilianOpportunityApplication({
      opportunityId: first.id, applicantName: "Status Applicant", applicantPhone: "70000004", applicantType: "VETERAN",
    }, repository);
    const updated = await updateCivilianOpportunityApplicationStatus(application.id, "REVIEWED", repository);
    const listed = await listCivilianOpportunityApplications(repository);
    expect(updated?.status).toBe("REVIEWED");
    expect(listed.find((item) => item.id === application.id)?.status).toBe("REVIEWED");
  });

  it("persists status changes through the admin service boundary", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const first = await firstPublished(repository);
    const application = await createCivilianOpportunityApplication({
      opportunityId: first.id, applicantName: "Admin Status Applicant", applicantPhone: "70000005", applicantType: "VETERAN",
    }, repository);
    const updated = await adminUpdateApplicationStatus(application.id, "ACCEPTED", repository);
    expect(updated?.status).toBe("ACCEPTED");
    expect((await listCivilianOpportunityApplications(repository)).find((item) => item.id === application.id)?.status).toBe("ACCEPTED");
  });

  it("accepts only HTTPS external CV metadata", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const first = await firstPublished(repository);
    await expect(createCivilianOpportunityApplication({
      opportunityId: first.id, applicantName: "CV Applicant", applicantPhone: "70000002", applicantType: "VETERAN",
      cvUrl: "http://example.test/cv.pdf",
    }, repository)).rejects.toThrow("CV URL must use HTTPS");

    const application = await createCivilianOpportunityApplication({
      opportunityId: first.id, applicantName: "CV Applicant", applicantPhone: "70000003", applicantType: "VETERAN",
      cvUrl: "https://files.example.test/cv.pdf",
    }, repository);
    expect(application.cvUrl).toBe("https://files.example.test/cv.pdf");
  });
});
