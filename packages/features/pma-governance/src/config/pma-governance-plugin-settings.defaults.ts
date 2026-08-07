import type { PmaGovernancePluginSettings } from '../contracts/pma-governance-plugin-contract';

export const defaultPmaGovernancePluginSettings: PmaGovernancePluginSettings = {
  pluginKey: 'pma-governance',
  enabled: true,
  adminConfigurable: true,
  exportable: true,
  replaceable: true
};
