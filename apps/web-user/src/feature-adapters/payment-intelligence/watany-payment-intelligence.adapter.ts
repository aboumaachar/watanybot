export function createWatanyPaymentIntelligenceAdapter() {
  return {
    pluginKey: 'payment-intelligence',
    host: 'watany-web-user',
    preservesExistingBehavior: true,
  };
}
