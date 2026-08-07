export interface CivilianJobsCareerAdviceInput {
  profileId: string;
  skillIds: string[];
  preferredOpportunityTypes: string[];
}

export interface CivilianJobsCareerAdvice {
  summaryAr: string;
  recommendedTrainingIds: string[];
  recommendedSkillIds: string[];
  reviewRequired: boolean;
}

export function buildCareerAdviceFallback(input: CivilianJobsCareerAdviceInput): CivilianJobsCareerAdvice {
  return {
    summaryAr: "يمكن تحسين فرص المطابقة عبر تحديث المهارات واختيار نوع العمل والمنطقة المفضلة.",
    recommendedTrainingIds: [],
    recommendedSkillIds: input.skillIds,
    reviewRequired: true,
  };
}