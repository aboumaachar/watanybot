import { describe, it, expect, beforeEach } from "vitest";
import {
  adminListOpportunities,
  adminGetOpportunity,
  adminCreateOpportunity,
  adminUpdateOpportunity,
  adminPublishOpportunity,
  adminArchiveOpportunity,
  adminRejectOpportunity,
  adminUpdateSource,
} from "./civilian-jobs.admin.service.js";

describe("civilian jobs wave 02 admin service", () => {
  let createdId: string;

  it("lists all opportunities (including DRAFT)", () => {
    const items = adminListOpportunities();
    // Seed has 2 PUBLISHED items
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by status", () => {
    const published = adminListOpportunities({ status: "PUBLISHED" });
    expect(published.every((o) => o.status === "PUBLISHED")).toBe(true);
  });

  it("creates a new opportunity as DRAFT", () => {
    const item = adminCreateOpportunity({
      title: "Test Admin Job",
      organization: "Test Org",
      location: "Beirut",
      type: "PAID_JOB",
      summary: "Admin-created test.",
      description: "Full description.",
      category: "Testing",
    });
    expect(item.status).toBe("DRAFT");
    expect(item.adminVerified).toBe(false);
    createdId = item.id;
  });

  it("gets opportunity by id", () => {
    const item = adminGetOpportunity(createdId);
    expect(item).toBeDefined();
    expect(item?.title).toBe("Test Admin Job");
  });

  it("updates an opportunity field", () => {
    const item = adminUpdateOpportunity(createdId, { title: "Updated Job Title" });
    expect(item?.title).toBe("Updated Job Title");
  });

  it("publishes an opportunity", () => {
    const item = adminPublishOpportunity(createdId);
    expect(item?.status).toBe("PUBLISHED");
    expect(item?.adminVerified).toBe(true);
  });

  it("archives a published opportunity", () => {
    const item = adminArchiveOpportunity(createdId);
    expect(item?.status).toBe("ARCHIVED");
    expect(item?.adminVerified).toBe(false);
  });

  it("rejects an opportunity in DRAFT", () => {
    const draft = adminCreateOpportunity({
      title: "To Reject",
      organization: "Org",
      location: "South Lebanon",
      type: "VOLUNTEER_WORK",
    });
    const rejected = adminRejectOpportunity(draft.id);
    expect(rejected?.status).toBe("ARCHIVED");
  });

  it("updates adminGetOpportunity returns undefined for unknown id", () => {
    expect(adminGetOpportunity("nonexistent-id")).toBeUndefined();
  });

  it("throws on missing required fields in create", () => {
    expect(() => adminCreateOpportunity({ title: "No org" })).toThrow();
  });

  it("enables a source", () => {
    const result = adminUpdateSource("daleel-madani", { enabled: true });
    expect(result?.enabled).toBe(true);
  });

  it("disables a source", () => {
    const result = adminUpdateSource("daleel-madani", { enabled: false });
    expect(result?.enabled).toBe(false);
  });

  it("returns undefined for unknown source id", () => {
    expect(adminUpdateSource("no-such-source", { enabled: true })).toBeUndefined();
  });
});
