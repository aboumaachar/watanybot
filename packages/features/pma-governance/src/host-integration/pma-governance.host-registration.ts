import { createPmaGovernanceDefaultAdapter } from '../adapter/pma-governance-default.adapter';
import { pmagovernancePluginManifest } from '../manifest/pma-governance-plugin.manifest';

export const pmagovernanceHostRegistration = {
  pluginKey: 'pma-governance',
  manifest: pmagovernancePluginManifest,
  createAdapter: createPmaGovernanceDefaultAdapter
};
