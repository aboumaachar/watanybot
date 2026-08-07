import type { JobsPluginSettings } from "../contracts/jobs-plugin-contract";

export const defaultJobsPluginSettings: JobsPluginSettings = {
  pluginKey: "jobs",
  enabled: true,
  childFeatures: {
    search: true,
    savedJobs: true,
    alerts: false,
    sourceSync: false,
    aiMatching: false,
    moderation: true
  },
  display: {
    showSource: true,
    showCompany: true,
    showLocation: true,
    showApplyLink: true
  },
  dataSources: {
    workable: false,
    manualAdmin: true,
    externalFeeds: false
  }
};