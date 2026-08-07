export type CivilianJobsAiRecommendationMode = "disabled" | "assistive" | "review_required";

export interface CivilianJobsAiRecommendationInput {
  profileId: string;
  opportunityIds: string[];
  userLanguage?: "ar" | "en" | "mixed";
}

export interface CivilianJobsAiRecommendationResult {
  mode: CivilianJobsAiRecommendationMode;
  recommendationIds: string[];
  explanationAr: string;
  reviewRequired: boolean;
}

export function buildSafeAiRecommendationFallback(input: CivilianJobsAiRecommendationInput): CivilianJobsAiRecommendationResult {
  return {
    mode: "disabled",
    recommendationIds: input.opportunityIds.slice(0, 5),
    explanationAr: "تم ترتيب الفرص مبدئياً بناءً على قواعد المطابقة المتوفرة. أي توصية ذكية لاحقة يجب أن تبقى خاضعة للمراجعة.",
    reviewRequired: true,
  };
}