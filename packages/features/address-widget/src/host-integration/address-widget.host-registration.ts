import { addressWidgetManifest } from '../manifest/address-widget.manifest';
import { createDefaultAddressWidgetAdapter } from '../adapter/address-widget-default.adapter';

export const addressWidgetHostRegistration = {
  pluginKey: 'address-widget',
  manifest: addressWidgetManifest,
  adapterFactory: createDefaultAddressWidgetAdapter,
  settingsKey: 'address-widget.settings',
  routeSlots: ['profile-address', 'market-location', 'jobs-location', 'taxi-location'],
  apiSlots: ['address-lookup', 'address-normalize'],
  uiSlots: ['address-field', 'address-summary'],
  exportReady: true,
  replaceReady: true,
};

export type AddressWidgetHostRegistration = typeof addressWidgetHostRegistration;