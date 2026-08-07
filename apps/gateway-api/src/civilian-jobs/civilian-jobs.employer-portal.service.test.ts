import { describe, expect, it } from "vitest";
import { CivilianEmployerPortalService } from "./civilian-jobs.employer-portal.service";
import { inMemoryCivilianEmployerPortalRepository } from "./civilian-jobs.employer-portal.repository";

describe("CivilianEmployerPortalService", () => {
  it("submits and approves an employer", () => {
    const service = new CivilianEmployerPortalService(inMemoryCivilianEmployerPortalRepository);
    const employer = service.submitEmployer({ id: "emp-test", organizationName: "Test Employer", contactName: "Admin", veteranFriendly: true });
    expect(employer.status).toBe("PENDING_REVIEW");
    expect(service.approveEmployer("emp-test")?.status).toBe("APPROVED");
  });

  it("scores employer needs by matching skills", () => {
    const service = new CivilianEmployerPortalService(inMemoryCivilianEmployerPortalRepository);
    const need = service.submitNeed({ id: "need-test", employerId: "emp-test", title: "Electrician", description: "Need skilled electrician", neededSkillIds: ["construction.electrician", "transport.driver"], workMode: "PROJECT" });
    const match = service.explainNeedMatch(need, ["construction.electrician"]);
    expect(match.score).toBe(50);
    expect(match.reasons.length).toBe(1);
  });
});