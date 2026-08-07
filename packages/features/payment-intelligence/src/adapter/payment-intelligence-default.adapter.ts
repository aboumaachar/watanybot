import type { PaymentIntelligenceAdapter } from '../contracts/payment-intelligence-plugin-contract';
import { defaultPaymentIntelligenceSettings } from '../config/payment-intelligence-plugin-settings.defaults';
import { paymentIntelligencePluginManifest } from '../manifest/payment-intelligence-plugin.manifest';

export function createPaymentIntelligenceDefaultAdapter(): PaymentIntelligenceAdapter {
  return {
    getSettings() {
      return defaultPaymentIntelligenceSettings;
    },
    getManifest() {
      return paymentIntelligencePluginManifest;
    },
  };
}
