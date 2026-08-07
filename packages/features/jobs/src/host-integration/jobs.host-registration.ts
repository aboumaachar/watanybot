import { jobsPluginManifest } from "../manifest/jobs-plugin.manifest";
import { jobsDefaultAdapter } from "../adapter/jobs-default.adapter";
import { defaultJobsPluginSettings } from "../config/jobs-plugin-settings.defaults";

export const jobsHostRegistration = {
  manifest: jobsPluginManifest,
  adapter: jobsDefaultAdapter,
  settings: defaultJobsPluginSettings
} as const;