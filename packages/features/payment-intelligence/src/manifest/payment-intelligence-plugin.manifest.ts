import type { PaymentIntelligenceManifest } from '../contracts/payment-intelligence-plugin-contract';

export const paymentIntelligencePluginManifest: PaymentIntelligenceManifest = {
  pluginKey: 'payment-intelligence',
  displayName: 'Payment Intelligence',
  version: '0.1.0',
  exportable: true,
  replaceable: true,
  adminConfigurable: true,
};
