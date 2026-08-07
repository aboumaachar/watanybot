import { createPaymentIntelligenceHostRegistration } from '../host-integration/payment-intelligence.host-registration';

export function provePaymentIntelligenceRegistryConsumption() {
  const registration = createPaymentIntelligenceHostRegistration();
  const settings = registration.adapter.getSettings();
  return {
    pluginKey: registration.manifest.pluginKey,
    enabled: settings.enabled,
    exportable: registration.manifest.exportable,
    replaceable: registration.manifest.replaceable,
    adminConfigurable: registration.manifest.adminConfigurable,
    proof: 'payment-intelligence-registry-consumption-proof' as const,
  };
}
