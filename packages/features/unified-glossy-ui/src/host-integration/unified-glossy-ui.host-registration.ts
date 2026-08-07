import { createUnifiedGlossyUiDefaultAdapter } from '../adapter/unified-glossy-ui-default.adapter';
import { unifiedglossyuiPluginManifest } from '../manifest/unified-glossy-ui-plugin.manifest';

export const unifiedglossyuiHostRegistration = {
  pluginKey: 'unified-glossy-ui',
  manifest: unifiedglossyuiPluginManifest,
  createAdapter: createUnifiedGlossyUiDefaultAdapter
};
