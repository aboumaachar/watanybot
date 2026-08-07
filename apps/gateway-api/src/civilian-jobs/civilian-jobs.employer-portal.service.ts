import type { CivilianEmployerOpportunityNeed, CivilianEmployerProfile, EmployerCandidateMatch } from "./civilian-jobs.employer-portal.types";
import { inMemoryCivilianEmployerPortalRepository, type CivilianEmployerPortalRepository } from "./civilian-jobs.employer-portal.repository";

export class CivilianEmployerPortalService {
  constructor(private readonly repo: CivilianEmployerPortalRepository = inMemoryCivilianEmployerPortalRepository) {}

  listEmployers(): CivilianEmployerProfile[] {
    return this.repo.listEmployers();
  }

  submitEmployer(input: Omit<CivilianEmployerProfile, "status" | "createdAt" | "updatedAt">): CivilianEmployerProfile {
    return this.repo.upsertEmployer({ ...input, status: "PENDING_REVIEW", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  approveEmployer(id: string): CivilianEmployerProfile | undefined {
    const employer = this.repo.listEmployers().find((item) => item.id === id);
    if (!employer) return undefined;
    return this.repo.upsertEmployer({ ...employer, status: "APPROVED" });
  }

  submitNeed(input: Omit<CivilianEmployerOpportunityNeed, "status" | "createdAt" | "updatedAt">): CivilianEmployerOpportunityNeed {
    return this.repo.upsertNeed({ ...input, status: "SUBMITTED", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  listNeeds(): CivilianEmployerOpportunityNeed[] {
    return this.repo.listNeeds();
  }

  explainNeedMatch(need: CivilianEmployerOpportunityNeed, candidateSkillIds: string[]): EmployerCandidateMatch {
    const needed = new Set(need.neededSkillIds);
    const matched = candidateSkillIds.filter((id) => needed.has(id));
    const score = need.neededSkillIds.length === 0 ? 0 : Math.round((matched.length / need.neededSkillIds.length) * 100);
    return { employerNeedId: need.id, candidateId: "candidate-preview", candidateType: "FREELANCER", score, reasons: matched.map((id) => `Skill match: ${id}`) };
  }
}

export const civilianEmployerPortalService = new CivilianEmployerPortalService();