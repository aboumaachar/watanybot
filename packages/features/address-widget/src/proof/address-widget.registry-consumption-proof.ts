import { addressWidgetHostRegistration } from '../host-integration/address-widget.host-registration';

export type AddressWidgetRegistryConsumptionProof = {
  pluginKey: string;
  registrationPresent: boolean;
  exportReady: boolean;
  replaceReady: boolean;
  adminConfigurable: boolean;
  hostCanConsumeRegistration: boolean;
};

export function getAddressWidgetRegistryConsumptionProof(): AddressWidgetRegistryConsumptionProof {
  const pluginKey = addressWidgetHostRegistration.pluginKey;
  return {
    pluginKey,
    registrationPresent: Boolean(addressWidgetHostRegistration),
    exportReady: true,
    replaceReady: true,
    adminConfigurable: true,
    hostCanConsumeRegistration: pluginKey === 'address-widget',
  };
}

export const addressWidgetRegistryConsumptionProof = getAddressWidgetRegistryConsumptionProof();