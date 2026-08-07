import { unifiedglossyuiHostRegistration } from '../host-integration/unified-glossy-ui.host-registration';

export function proveUnifiedGlossyUiRegistryConsumption(): boolean {
  return unifiedglossyuiHostRegistration.pluginKey === 'unified-glossy-ui' &&
    Boolean(unifiedglossyuiHostRegistration.manifest) &&
    typeof unifiedglossyuiHostRegistration.createAdapter === 'function';
}
