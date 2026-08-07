export interface CivilianJobsFreelancerProfile {
  id: string;
  displayName: string;
  skillIds: string[];
  serviceAreas: string[];
  verified: boolean;
  available: boolean;
}

export function freelancerMatchesSkill(profile: CivilianJobsFreelancerProfile, requestedSkillIds: string[]): boolean {
  if (!profile.available) return false;
  return requestedSkillIds.some((skillId) => profile.skillIds.includes(skillId));
}