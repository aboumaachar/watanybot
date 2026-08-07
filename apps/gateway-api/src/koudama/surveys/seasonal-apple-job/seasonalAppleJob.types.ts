export type SeasonalAppleJobApplicationStatus =
  | 'pending_review'
  | 'accepted'
  | 'waitlist'
  | 'rejected'
  | 'withdrawn';

export type SeasonalAppleJobFollowUpStatus =
  | 'not_contacted'
  | 'called'
  | 'no_answer'
  | 'confirmed'
  | 'declined'
  | 'needs_follow_up';

export interface SeasonalAppleJobApplicationInput {
  name: string;
  phone: string;
  email?: string;
  age: number | string;
  gender?: string;
  relationType: string;
  governorate: string;
  governorateAr?: string;
  caza: string;
  cazaAr?: string;
  village: string;
  villageAr?: string;
  villageId?: string;
  availability: string;
  preferredPeriod?: string;
  weekendWork?: boolean | string;
  canArrive6am: boolean | string;
  hasAgriExperience: boolean | string;
  experienceText?: string;
  canStandHours: boolean | string;
  healthNote?: string;
  futureJobsInterest: boolean | string;
  interests?: string[];
  familyMore?: string;
}

export interface SeasonalAppleJobApplication extends SeasonalAppleJobApplicationInput {
  id: string;
  campaignId: 'seasonal-apple-job-2026-tannourine';
  weightedScore: number;
  status: SeasonalAppleJobApplicationStatus;
  followUpStatus: SeasonalAppleJobFollowUpStatus;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonalAppleJobAdminPatch {
  status?: SeasonalAppleJobApplicationStatus;
  followUpStatus?: SeasonalAppleJobFollowUpStatus;
  adminNotes?: string;
}