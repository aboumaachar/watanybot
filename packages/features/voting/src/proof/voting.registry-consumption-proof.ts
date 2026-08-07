import { votingHostRegistration } from "../host-integration/voting.host-registration";

export function getVotingRegistryConsumptionProof() {
  return {
    pluginKey: votingHostRegistration.pluginKey,
    exportReady: votingHostRegistration.manifest.exportReady,
    replaceReady: votingHostRegistration.manifest.replaceReady,
    adminConfigurable: votingHostRegistration.manifest.adminConfigurable,
    productionReplacement: votingHostRegistration.productionReplacement
  };
}
