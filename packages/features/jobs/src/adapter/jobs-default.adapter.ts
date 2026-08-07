import type { JobsPluginAdapter, JobsSearchInput, JobsSearchResult } from "../contracts/jobs-plugin-contract";
import { defaultJobsPluginSettings } from "../config/jobs-plugin-settings.defaults";

export const jobsDefaultAdapter: JobsPluginAdapter = {
  pluginKey: "jobs",
  async search(_input: JobsSearchInput): Promise<JobsSearchResult> {
    return {
      items: [],
      total: 0,
      sourceStatus: "unavailable"
    };
  },
  getDefaultSettings() {
    return defaultJobsPluginSettings;
  }
};