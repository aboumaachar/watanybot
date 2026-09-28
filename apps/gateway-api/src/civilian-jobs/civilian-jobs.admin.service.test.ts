import { describe, it, expect } from "vitest";
import {
  adminListOpportunities, adminGetOpportunity, adminCreateOpportunity,
  adminUpdateOpportunity, adminPublishOpportunity, adminArchiveOpportunity,
  adminRejectOpportunity, adminUpdateSource,
} from "./civilian-jobs.admin.service.js";
import { InMemoryCivilianJobsRepository } from "./civilian-jobs.repository.js";

async function createDraft(repository: InMemoryCivilianJobsRepository, title = "Test Admin Job") {
  return adminCreateOpportunity({
    title, organization: "Test Org", location: "Beirut", type: "PAID_JOB",
    summary: "Admin-created test.", description: "Full description.", category: "Testing",
  }, repository);
}

describe("civilian jobs wave 02 admin service", () => {
  it("lists all opportunities (including DRAFT)", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const items = await adminListOpportunities({}, repository);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by status", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const published = await adminListOpportunities({ status: "PUBLISHED" }, repository);
    expect(published.every((o) => o.status === "PUBLISHED")).toBe(true);
  });

  it("creates a new opportunity as DRAFT", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const item = await createDraft(repository);
    expect(item.status).toBe("DRAFT");
    expect(item.adminVerified).toBe(false);
  });

  it("gets opportunity by id", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const created = await createDraft(repository);
    const item = await adminGetOpportunity(created.id, repository);
    expect(item?.title).toBe("Test Admin Job");
  });

  it("updates an opportunity field", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const created = await createDraft(repository);
    const item = await adminUpdateOpportunity(created.id, { title: "Updated Job Title" }, repository);
    expect(item?.title).toBe("Updated Job Title");
  });

  it("publishes an opportunity", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const created = await createDraft(repository);
    const item = await adminPublishOpportunity(created.id, repository);
    expect(item.status).toBe("PUBLISHED");
    expect(item.adminVerified).toBe(true);
  });

  it("archives a published opportunity", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const created = await createDraft(repository);
    await adminPublishOpportunity(created.id, repository);
    const item = await adminArchiveOpportunity(created.id, repository);
    expect(item.status).toBe("ARCHIVED");
    expect(item.adminVerified).toBe(false);
  });

  it("rejects an opportunity in DRAFT", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const draft = await createDraft(repository, "To Reject");
    const rejected = await adminRejectOpportunity(draft.id, repository);
    expect(rejected.status).toBe("ARCHIVED");
  });

  it("returns undefined for unknown opportunity id", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    expect(await adminGetOpportunity("nonexistent-id", repository)).toBeUndefined();
  });

  it("throws on missing required fields in create", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    await expect(adminCreateOpportunity({ title: "No org" }, repository)).rejects.toThrow();
  });

  it("enables and disables a source", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    const enabled = await adminUpdateSource("daleel-madani", { enabled: true }, repository);
    expect(enabled?.enabled).toBe(true);
    const disabled = await adminUpdateSource("daleel-madani", { enabled: false }, repository);
    expect(disabled?.enabled).toBe(false);
  });

  it("returns undefined for unknown source id", async () => {
    const repository = new InMemoryCivilianJobsRepository();
    expect(await adminUpdateSource("no-such-source", { enabled: true }, repository)).toBeUndefined();
  });
});
