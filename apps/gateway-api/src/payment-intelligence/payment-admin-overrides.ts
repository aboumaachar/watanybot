export type PaymentOverrideStatus = 'draft' | 'review_required' | 'published' | 'archived';

export type PaymentAdminOverrideAnswer = {
  id: string;
  topic: string;
  status: PaymentOverrideStatus;
  audience: string;
  answerAr: string;
  answerEn?: string;
  sourceType: 'manual_admin_override' | 'official_source' | 'mixed';
  updatedAt: string | null;
  updatedBy: string | null;
};

export const PAYMENT_ADMIN_OVERRIDE_MARKERS = {
  feature: 'payment-intelligence-admin-overrides',
  superAdminCanOverride: true,
  requirePublishedBySuperAdmin: true,
  variablePaymentAnswersMustUseAdminOverride: true,
} as const;

export function normalizePaymentOverrideAnswer(answer: PaymentAdminOverrideAnswer): PaymentAdminOverrideAnswer {
  return {
    ...answer,
    status: answer.status || 'review_required',
    sourceType: answer.sourceType || 'manual_admin_override',
  };
}

export function canPublishPaymentOverride(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'super_admin';
}