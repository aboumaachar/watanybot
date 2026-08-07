import type { CandidateProfile, FreelancerProfile, MatchScoreBreakdown, OpportunityMatchResult } from "./civilian-jobs.matching.types";
import type { CivilianOpportunity } from "./civilian-jobs.types";
export function scoreOpportunityForCandidate(opportunity: CivilianOpportunity, candidate: CandidateProfile): OpportunityMatchResult {
  const opportunityText = `${opportunity.title} ${opportunity.category ?? ""} ${opportunity.location ?? ""}`.toLowerCase();
  const skillHits = candidate.skillIds.filter((skill) => opportunityText.includes(skill.toLowerCase())).length;
  const skill = Math.min(40, skillHits * 20);
  const location = candidate.location && opportunity.location && opportunity.location.toLowerCase().includes(candidate.location.toLowerCase()) ? 20 : 0;
  const type = candidate.preferredOpportunityTypes.includes(opportunity.type) ? 20 : 0;
  const availability = candidate.availability ? 10 : 5;
  const veteranFit = candidate.applicantKind === "VETERAN" ? 10 : 5;
  const total = skill + location + type + availability + veteranFit;
  const reasonsAr: string[] = [];
  if (skill > 0) reasonsAr.push("توجد مهارات مطابقة مع متطلبات الفرصة.");
  if (location > 0) reasonsAr.push("الموقع مناسب للمرشح.");
  if (type > 0) reasonsAr.push("نوع الفرصة مطابق للتفضيلات.");
  const breakdown: MatchScoreBreakdown = { skill, location, type, availability, veteranFit, total, reasonsAr };
  return { opportunityId: opportunity.id, candidateId: candidate.id, score: total, breakdown, explanationAr: reasonsAr.length ? reasonsAr.join(" ") : "هذه فرصة محتملة وتحتاج مراجعة إضافية من المسؤول." };
}
export function matchFreelancersBySkill(freelancers: FreelancerProfile[], requestedSkillIds: string[], location?: string): FreelancerProfile[] {
  return freelancers.filter((f) => f.availability === "AVAILABLE" && requestedSkillIds.some((s) => f.skillIds.includes(s)) && (!location || !f.location || f.location.toLowerCase().includes(location.toLowerCase())));
}