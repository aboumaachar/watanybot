export type EngagementCategory =
  | 'activity'
  | 'learning'
  | 'community'
  | 'volunteer'
  | 'contribution'
  | 'administrative'
  | 'service'
  | 'civic';

export type EngagementAwardInput = {
  userId: string;
  ruleCode: string;
  sourceType: string;
  sourceId?: string;
  reasonAr: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
  verificationApproved?: boolean;
};

export type EngagementAwardResult = {
  awarded: boolean;
  transactionId?: string;
  points: number;
  reason:
    | 'awarded'
    | 'duplicate'
    | 'rule_not_found'
    | 'rule_inactive'
    | 'verification_required'
    | 'daily_cap_reached'
    | 'cooldown_active';
};

export type EngagementSummary = {
  points: number;
  reputation: number;
  level: {
    code: string;
    titleAr: string;
    titleEn: string | null;
    minimumPoints: number;
  };
  nextLevel: {
    code: string;
    titleAr: string;
    minimumPoints: number;
    pointsRemaining: number;
  } | null;
  badges: Array<{
    code: string;
    titleAr: string;
    descriptionAr: string | null;
    iconName: string | null;
    awardedAt: string;
  }>;
};