// Wave12 Freelancer Marketplace Hardening types.
// This file belongs only to Civilian Jobs & Services and must not be coupled to military recruitment announcements.

export type FreelancerProfileStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type FreelancerVerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type FreelancerAvailabilityMode = "HOURLY" | "DAILY" | "PROJECT" | "PART_TIME" | "FULL_TIME" | "EMERGENCY_CALL" | "VOLUNTEER";
export type FreelancerSkillLevel = "BEGINNER" | "INTERMEDIATE" | "PROFESSIONAL" | "EXPERT";
export type FreelancerSkillSuggestionStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "MERGED" | "REJECTED";

export interface FreelancerCoverageArea {
  governorate?: string;
  district?: string;
  village?: string;
  radiusKm?: number;
  allLebanon?: boolean;
}

export interface FreelancerEquipmentItem {
  id: string;
  labelAr: string;
  labelEn: string;
  category: "VEHICLE" | "TOOLS" | "SAFETY" | "DIGITAL" | "OTHER";
}

export interface FreelancerCertificationItem {
  id: string;
  labelAr: string;
  labelEn: string;
  category: "DRIVING" | "SECURITY" | "FIRST_AID" | "TECHNICAL" | "MILITARY" | "EDUCATION" | "OTHER";
}

export interface FreelancerProfileSkill {
  skillId: string;
  level: FreelancerSkillLevel;
  yearsExperience?: number;
  notes?: string;
}

export interface FreelancerMarketplaceProfile {
  id: string;
  ownerUserId?: string;
  displayName: string;
  phone?: string;
  profileStatus: FreelancerProfileStatus;
  verificationStatus: FreelancerVerificationStatus;
  profileType: "VETERAN" | "VETERAN_FAMILY" | "CIVILIAN" | "NGO_VOLUNTEER" | "STUDENT" | "RETIREE";
  skills: FreelancerProfileSkill[];
  availability: FreelancerAvailabilityMode[];
  coverageAreas: FreelancerCoverageArea[];
  equipmentIds: string[];
  certificationIds: string[];
  veteranTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerSkillSuggestion {
  id: string;
  submittedByUserId?: string;
  rawLabel: string;
  normalizedLabel: string;
  suggestedCategory?: string;
  status: FreelancerSkillSuggestionStatus;
  mergeIntoSkillId?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerMarketplaceSearchQuery {
  skillIds?: string[];
  text?: string;
  governorate?: string;
  district?: string;
  village?: string;
  availability?: FreelancerAvailabilityMode[];
  equipmentIds?: string[];
  certificationIds?: string[];
  veteranOnly?: boolean;
}

export interface FreelancerMarketplaceMatchBreakdown {
  skillScore: number;
  locationScore: number;
  availabilityScore: number;
  equipmentScore: number;
  certificationScore: number;
  veteranBonusScore: number;
  totalScore: number;
  reasons: string[];
}

export interface FreelancerMarketplaceSearchResult {
  profile: FreelancerMarketplaceProfile;
  match: FreelancerMarketplaceMatchBreakdown;
}