import type { PmaGovernancePluginManifest } from '../contracts/pma-governance-plugin-contract';
import { defaultPmaGovernancePluginSettings } from '../config/pma-governance-plugin-settings.defaults';

export const pmagovernancePluginManifest: PmaGovernancePluginManifest = {
  pluginKey: 'pma-governance',
  displayName: 'PMA Governance',
  version: '0.1.0',
  settings: defaultPmaGovernancePluginSettings
};
