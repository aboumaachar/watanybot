import { jobsHostRegistration } from "../../../../../packages/features/jobs/src";

export const watanyJobsApiAdapter = {
  pluginKey: jobsHostRegistration.manifest.pluginKey,
  productionApiReplacement: false
} as const;