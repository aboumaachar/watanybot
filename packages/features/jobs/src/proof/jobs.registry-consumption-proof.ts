import { jobsHostRegistration } from "../host-integration/jobs.host-registration";

export function getJobsRegistryConsumptionProof() {
  return {
    pluginKey: jobsHostRegistration.manifest.pluginKey,
    exportable: jobsHostRegistration.manifest.exportable,
    replaceable: jobsHostRegistration.manifest.replaceable,
    adminConfigurable: jobsHostRegistration.manifest.adminConfigurable,
    childFeatures: jobsHostRegistration.settings.childFeatures
  };
}