// Wave12 in-memory repository boundary. Replace with DB adapter after migration is applied.
import type {
  FreelancerMarketplaceProfile,
  FreelancerMarketplaceSearchQuery,
  FreelancerSkillSuggestion,
  FreelancerSkillSuggestionStatus
} from "./civilian-jobs.freelancer-marketplace.types";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export interface FreelancerMarketplaceRepository {
  listProfiles(): FreelancerMarketplaceProfile[];
  upsertProfile(profile: FreelancerMarketplaceProfile): FreelancerMarketplaceProfile;
  searchProfiles(query: FreelancerMarketplaceSearchQuery): FreelancerMarketplaceProfile[];
  submitSkillSuggestion(input: { rawLabel: string; submittedByUserId?: string; suggestedCategory?: string }): FreelancerSkillSuggestion;
  listSkillSuggestions(status?: FreelancerSkillSuggestionStatus): FreelancerSkillSuggestion[];
  updateSkillSuggestion(id: string, patch: Partial<FreelancerSkillSuggestion>): FreelancerSkillSuggestion | undefined;
}

export class InMemoryFreelancerMarketplaceRepository implements FreelancerMarketplaceRepository {
  private readonly profiles = new Map<string, FreelancerMarketplaceProfile>();
  private readonly suggestions = new Map<string, FreelancerSkillSuggestion>();

  listProfiles(): FreelancerMarketplaceProfile[] {
    return Array.from(this.profiles.values());
  }

  upsertProfile(profile: FreelancerMarketplaceProfile): FreelancerMarketplaceProfile {
    const current = this.profiles.get(profile.id);
    const saved: FreelancerMarketplaceProfile = {
      ...profile,
      createdAt: current?.createdAt ?? profile.createdAt ?? nowIso(),
      updatedAt: nowIso()
    };
    this.profiles.set(saved.id, saved);
    return saved;
  }

  searchProfiles(query: FreelancerMarketplaceSearchQuery): FreelancerMarketplaceProfile[] {
    return this.listProfiles().filter((profile) => {
      if (profile.profileStatus !== "ACTIVE") return false;
      if (query.veteranOnly && profile.profileType !== "VETERAN" && profile.profileType !== "VETERAN_FAMILY") return false;
      if (query.skillIds?.length) {
        const owned = new Set(profile.skills.map((skill) => skill.skillId));
        if (!query.skillIds.some((skillId) => owned.has(skillId))) return false;
      }
      if (query.availability?.length && !query.availability.some((mode) => profile.availability.includes(mode))) return false;
      if (query.equipmentIds?.length && !query.equipmentIds.some((id) => profile.equipmentIds.includes(id))) return false;
      if (query.certificationIds?.length && !query.certificationIds.some((id) => profile.certificationIds.includes(id))) return false;
      if (query.governorate || query.district || query.village) {
        const locationMatch = profile.coverageAreas.some((area) => {
          if (area.allLebanon) return true;
          if (query.governorate && area.governorate !== query.governorate) return false;
          if (query.district && area.district !== query.district) return false;
          if (query.village && area.village !== query.village) return false;
          return true;
        });
        if (!locationMatch) return false;
      }
      return true;
    });
  }

  submitSkillSuggestion(input: { rawLabel: string; submittedByUserId?: string; suggestedCategory?: string }): FreelancerSkillSuggestion {
    const id = `skill_suggestion_${this.suggestions.size + 1}`;
    const suggestion: FreelancerSkillSuggestion = {
      id,
      rawLabel: input.rawLabel,
      normalizedLabel: normalizeText(input.rawLabel),
      suggestedCategory: input.suggestedCategory,
      submittedByUserId: input.submittedByUserId,
      status: "SUBMITTED",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    this.suggestions.set(id, suggestion);
    return suggestion;
  }

  listSkillSuggestions(status?: FreelancerSkillSuggestionStatus): FreelancerSkillSuggestion[] {
    const rows = Array.from(this.suggestions.values());
    return status ? rows.filter((row) => row.status === status) : rows;
  }

  updateSkillSuggestion(id: string, patch: Partial<FreelancerSkillSuggestion>): FreelancerSkillSuggestion | undefined {
    const current = this.suggestions.get(id);
    if (!current) return undefined;
    const next: FreelancerSkillSuggestion = { ...current, ...patch, updatedAt: nowIso() };
    this.suggestions.set(id, next);
    return next;
  }
}

export const freelancerMarketplaceRepository = new InMemoryFreelancerMarketplaceRepository();