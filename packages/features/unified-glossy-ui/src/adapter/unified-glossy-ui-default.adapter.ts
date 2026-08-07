import type { UnifiedGlossyUiPluginAdapter, UnifiedGlossyUiPluginManifest, UnifiedGlossyUiPluginSettings } from '../contracts/unified-glossy-ui-plugin-contract';
import { unifiedglossyuiPluginManifest } from '../manifest/unified-glossy-ui-plugin.manifest';

export function createUnifiedGlossyUiDefaultAdapter(): UnifiedGlossyUiPluginAdapter {
  return {
    getSettings(): UnifiedGlossyUiPluginSettings {
      return unifiedglossyuiPluginManifest.settings;
    },
    getManifest(): UnifiedGlossyUiPluginManifest {
      return unifiedglossyuiPluginManifest;
    }
  };
}
