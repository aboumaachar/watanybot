export const jobsPluginManifest = {
  pluginKey: "jobs",
  displayName: "Jobs Aggregator",
  version: "0.1.0",
  exportable: true,
  replaceable: true,
  adminConfigurable: true,
  productionUiReplacement: false,
  routes: {
    devProof: "/__apex/jobs"
  }
} as const;