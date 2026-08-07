import { createPaymentIntelligenceDefaultAdapter } from '../adapter/payment-intelligence-default.adapter';
import { paymentIntelligencePluginManifest } from '../manifest/payment-intelligence-plugin.manifest';

export function createPaymentIntelligenceHostRegistration() {
  const adapter = createPaymentIntelligenceDefaultAdapter();
  return {
    manifest: paymentIntelligencePluginManifest,
    adapter,
    status: 'registered' as const,
  };
}
