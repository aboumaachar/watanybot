import type { PmaGovernancePluginAdapter, PmaGovernancePluginManifest, PmaGovernancePluginSettings } from '../contracts/pma-governance-plugin-contract';
import { pmagovernancePluginManifest } from '../manifest/pma-governance-plugin.manifest';

export function createPmaGovernanceDefaultAdapter(): PmaGovernancePluginAdapter {
  return {
    getSettings(): PmaGovernancePluginSettings {
      return pmagovernancePluginManifest.settings;
    },
    getManifest(): PmaGovernancePluginManifest {
      return pmagovernancePluginManifest;
    }
  };
}
