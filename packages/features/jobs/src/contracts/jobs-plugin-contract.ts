export type JobsPluginKey = "jobs";

export interface JobsSearchInput {
  query?: string;
  location?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}

export interface JobsListing {
  id: string;
  title: string;
  source?: string;
  company?: string;
  location?: string;
  url?: string;
  publishedAt?: string;
  tags?: string[];
}

export interface JobsSearchResult {
  items: JobsListing[];
  total: number;
  sourceStatus: "mock" | "live" | "mixed" | "unavailable";
}

export interface JobsPluginAdapter {
  pluginKey: JobsPluginKey;
  search(input: JobsSearchInput): Promise<JobsSearchResult>;
  getDefaultSettings(): JobsPluginSettings;
}

export interface JobsPluginSettings {
  pluginKey: JobsPluginKey;
  enabled: boolean;
  childFeatures: {
    search: boolean;
    savedJobs: boolean;
    alerts: boolean;
    sourceSync: boolean;
    aiMatching: boolean;
    moderation: boolean;
  };
  display: {
    showSource: boolean;
    showCompany: boolean;
    showLocation: boolean;
    showApplyLink: boolean;
  };
  dataSources: {
    workable: boolean;
    manualAdmin: boolean;
    externalFeeds: boolean;
  };
}