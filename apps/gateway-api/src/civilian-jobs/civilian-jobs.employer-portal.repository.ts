import type { CivilianEmployerOpportunityNeed, CivilianEmployerProfile } from "./civilian-jobs.employer-portal.types";

export interface CivilianEmployerPortalRepository {
  listEmployers(): CivilianEmployerProfile[];
  upsertEmployer(profile: CivilianEmployerProfile): CivilianEmployerProfile;
  listNeeds(): CivilianEmployerOpportunityNeed[];
  upsertNeed(need: CivilianEmployerOpportunityNeed): CivilianEmployerOpportunityNeed;
}

const employers = new Map<string, CivilianEmployerProfile>();
const needs = new Map<string, CivilianEmployerOpportunityNeed>();

export const inMemoryCivilianEmployerPortalRepository: CivilianEmployerPortalRepository = {
  listEmployers: () => Array.from(employers.values()),
  upsertEmployer: (profile) => {
    const now = new Date().toISOString();
    const next = { ...profile, updatedAt: now, createdAt: profile.createdAt || now };
    employers.set(next.id, next);
    return next;
  },
  listNeeds: () => Array.from(needs.values()),
  upsertNeed: (need) => {
    const now = new Date().toISOString();
    const next = { ...need, updatedAt: now, createdAt: need.createdAt || now };
    needs.set(next.id, next);
    return next;
  },
};