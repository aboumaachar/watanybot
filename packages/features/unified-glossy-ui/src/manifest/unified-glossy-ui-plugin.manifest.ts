import type { UnifiedGlossyUiPluginManifest } from '../contracts/unified-glossy-ui-plugin-contract';
import { defaultUnifiedGlossyUiPluginSettings } from '../config/unified-glossy-ui-plugin-settings.defaults';

export const unifiedglossyuiPluginManifest: UnifiedGlossyUiPluginManifest = {
  pluginKey: 'unified-glossy-ui',
  displayName: 'Unified Glossy UI',
  version: '0.1.0',
  settings: defaultUnifiedGlossyUiPluginSettings
};
