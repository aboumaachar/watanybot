import { freelancerCertificationRegistry, freelancerEquipmentRegistry } from "./civilian-jobs.freelancer-marketplace.registry";
import { freelancerMarketplaceRepository, type FreelancerMarketplaceRepository } from "./civilian-jobs.freelancer-marketplace.repository";
import type {
  FreelancerMarketplaceMatchBreakdown,
  FreelancerMarketplaceProfile,
  FreelancerMarketplaceSearchQuery,
  FreelancerMarketplaceSearchResult,
  FreelancerSkillSuggestionStatus
} from "./civilian-jobs.freelancer-marketplace.types";

function scoreProfile(profile: FreelancerMarketplaceProfile, query: FreelancerMarketplaceSearchQuery): FreelancerMarketplaceMatchBreakdown {
  const reasons: string[] = [];
  const profileSkillIds = new Set(profile.skills.map((skill) => skill.skillId));
  const skillScore = query.skillIds?.length
    ? Math.round((query.skillIds.filter((skillId) => profileSkillIds.has(skillId)).length / query.skillIds.length) * 45)
    : 10;
  if (skillScore > 0) reasons.push("Skill match");

  const locationScore = profile.coverageAreas.some((area) => area.allLebanon || (!query.governorate || area.governorate === query.governorate)) ? 20 : 0;
  if (locationScore > 0) reasons.push("Location coverage match");

  const availabilityScore = query.availability?.length
    ? (query.availability.some((mode) => profile.availability.includes(mode)) ? 15 : 0)
    : 5;
  if (availabilityScore > 0) reasons.push("Availability match");

  const equipmentScore = query.equipmentIds?.length
    ? (query.equipmentIds.some((id) => profile.equipmentIds.includes(id)) ? 10 : 0)
    : 0;
  if (equipmentScore > 0) reasons.push("Equipment match");

  const certificationScore = query.certificationIds?.length
    ? (query.certificationIds.some((id) => profile.certificationIds.includes(id)) ? 5 : 0)
    : 0;
  if (certificationScore > 0) reasons.push("Certification match");

  const veteranBonusScore = profile.profileType === "VETERAN" || profile.profileType === "VETERAN_FAMILY" ? 5 : 0;
  if (veteranBonusScore > 0) reasons.push("Veteran/family priority");

  const totalScore = Math.min(100, skillScore + locationScore + availabilityScore + equipmentScore + certificationScore + veteranBonusScore);
  return { skillScore, locationScore, availabilityScore, equipmentScore, certificationScore, veteranBonusScore, totalScore, reasons };
}

export class FreelancerMarketplaceService {
  constructor(private readonly repository: FreelancerMarketplaceRepository = freelancerMarketplaceRepository) {}

  listEquipment() {
    return freelancerEquipmentRegistry;
  }

  listCertifications() {
    return freelancerCertificationRegistry;
  }

  saveProfile(profile: FreelancerMarketplaceProfile): FreelancerMarketplaceProfile {
    return this.repository.upsertProfile(profile);
  }

  search(query: FreelancerMarketplaceSearchQuery): FreelancerMarketplaceSearchResult[] {
    return this.repository.searchProfiles(query)
      .map((profile) => ({ profile, match: scoreProfile(profile, query) }))
      .sort((a, b) => b.match.totalScore - a.match.totalScore);
  }

  submitMissingSkill(input: { rawLabel: string; submittedByUserId?: string; suggestedCategory?: string }) {
    return this.repository.submitSkillSuggestion(input);
  }

  listMissingSkillSuggestions(status?: FreelancerSkillSuggestionStatus) {
    return this.repository.listSkillSuggestions(status);
  }

  reviewMissingSkill(id: string, patch: { status: FreelancerSkillSuggestionStatus; mergeIntoSkillId?: string; adminNote?: string }) {
    return this.repository.updateSkillSuggestion(id, patch);
  }
}

export const freelancerMarketplaceService = new FreelancerMarketplaceService();