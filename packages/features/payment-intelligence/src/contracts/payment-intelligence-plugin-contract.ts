export type PaymentAnswerMode = 'fixed-law' | 'variable-status' | 'admin-override' | 'mixed';

export interface PaymentIntelligenceSettings {
  pluginKey: 'payment-intelligence';
  enabled: boolean;
  answerMode: PaymentAnswerMode;
  allowAdminOverrides: boolean;
  requireSourceCitation: boolean;
  showLastReviewedAt: boolean;
  childFeatures: {
    paymentStatus: boolean;
    variableAnswers: boolean;
    adminOverrides: boolean;
    sourceCitations: boolean;
    reviewWorkflow: boolean;
  };
}

export interface PaymentIntelligenceManifest {
  pluginKey: 'payment-intelligence';
  displayName: string;
  version: string;
  exportable: boolean;
  replaceable: boolean;
  adminConfigurable: boolean;
}

export interface PaymentIntelligenceAdapter {
  getSettings(): PaymentIntelligenceSettings;
  getManifest(): PaymentIntelligenceManifest;
}
