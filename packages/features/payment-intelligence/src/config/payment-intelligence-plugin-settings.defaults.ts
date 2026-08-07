import type { PaymentIntelligenceSettings } from '../contracts/payment-intelligence-plugin-contract';

export const defaultPaymentIntelligenceSettings: PaymentIntelligenceSettings = {
  pluginKey: 'payment-intelligence',
  enabled: true,
  answerMode: 'mixed',
  allowAdminOverrides: true,
  requireSourceCitation: true,
  showLastReviewedAt: true,
  childFeatures: {
    paymentStatus: true,
    variableAnswers: true,
    adminOverrides: true,
    sourceCitations: true,
    reviewWorkflow: true,
  },
};
