import { describe, expect, it } from "vitest";
import { FreelancerMarketplaceService } from "./civilian-jobs.freelancer-marketplace.service";
import { InMemoryFreelancerMarketplaceRepository } from "./civilian-jobs.freelancer-marketplace.repository";
import type { FreelancerMarketplaceProfile } from "./civilian-jobs.freelancer-marketplace.types";

function makeProfile(overrides: Partial<FreelancerMarketplaceProfile> = {}): FreelancerMarketplaceProfile {
  const base: FreelancerMarketplaceProfile = {
    id: "freelancer-1",
    displayName: "Veteran Electrician",
    profileStatus: "ACTIVE",
    verificationStatus: "VERIFIED",
    profileType: "VETERAN",
    skills: [{ skillId: "construction_electrician", level: "EXPERT", yearsExperience: 12 }],
    availability: ["PROJECT", "EMERGENCY_CALL"],
    coverageAreas: [{ governorate: "Mount Lebanon", district: "Keserwan", allLebanon: false }],
    equipmentIds: ["tool_electrical", "tool_ladder"],
    certificationIds: ["license_driving_private", "cert_technical"],
    veteranTags: ["veteran", "former_communications_specialist"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
  return { ...base, ...overrides };
}

describe("FreelancerMarketplaceService", () => {
  it("scores multi-skill freelancer matches with veteran bonus", () => {
    const service = new FreelancerMarketplaceService(new InMemoryFreelancerMarketplaceRepository());
    service.saveProfile(makeProfile());
    const results = service.search({
      skillIds: ["construction_electrician", "construction_plumber"],
      governorate: "Mount Lebanon",
      availability: ["PROJECT"],
      equipmentIds: ["tool_electrical"],
      certificationIds: ["cert_technical"],
      veteranOnly: true
    });
    expect(results).toHaveLength(1);
    expect(results[0].match.totalScore).toBeGreaterThanOrEqual(70);
    expect(results[0].match.reasons).toContain("Veteran/family priority");
  });

  it("stores missing skill suggestions pending admin review", () => {
    const service = new FreelancerMarketplaceService(new InMemoryFreelancerMarketplaceRepository());
    const suggestion = service.submitMissingSkill({ rawLabel: "تركيب كاميرات مراقبة", submittedByUserId: "user-1" });
    expect(suggestion.status).toBe("SUBMITTED");
    const reviewed = service.reviewMissingSkill(suggestion.id, { status: "APPROVED", adminNote: "Valid Lebanese market skill" });
    expect(reviewed?.status).toBe("APPROVED");
  });
});