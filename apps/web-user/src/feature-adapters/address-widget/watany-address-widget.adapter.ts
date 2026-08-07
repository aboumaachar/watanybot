export const watanyAddressWidgetAdapterMetadata = {
  pluginKey: 'address-widget',
  hostApp: 'watanybot',
  strategy: 'preserve-existing-ui-first',
  note: 'This adapter boundary allows WatanyBot to resolve the address widget plugin without replacing existing production address components.',
  settings: {
    adminConfigurable: true,
    childFeatureToggles: ['manual-select', 'gps', 'map', 'csv-import'],
    displayModes: ['compact', 'full', 'readonly-summary'],
  },
};