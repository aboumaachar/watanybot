import { pmagovernanceHostRegistration } from '../host-integration/pma-governance.host-registration';

export function provePmaGovernanceRegistryConsumption(): boolean {
  return pmagovernanceHostRegistration.pluginKey === 'pma-governance' &&
    Boolean(pmagovernanceHostRegistration.manifest) &&
    typeof pmagovernanceHostRegistration.createAdapter === 'function';
}
