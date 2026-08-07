export function createWatanyPaymentIntelligenceApiAdapter() {
  return {
    pluginKey: 'payment-intelligence',
    host: 'watany-gateway-api',
    preservesExistingBehavior: true,
    requiresLiveExternalService: false,
  };
}
