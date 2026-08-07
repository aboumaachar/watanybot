export const watanyAddressWidgetApiAdapterMetadata = {
  pluginKey: 'address-widget',
  hostApp: 'watanybot-gateway',
  apiSlots: ['address-lookup', 'address-normalize'],
  persistence: 'host-managed',
  replacementRule: 'A replacement plugin must satisfy the address-widget contract before being mounted.',
};