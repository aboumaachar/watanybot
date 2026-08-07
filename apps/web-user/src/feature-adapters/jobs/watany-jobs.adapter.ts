import { jobsHostRegistration } from "../../../../../packages/features/jobs/src/index";

export const watanyJobsWebAdapter = {
  pluginKey: jobsHostRegistration.manifest.pluginKey,
  route: jobsHostRegistration.manifest.routes.devProof,
  productionUiReplacement: false
} as const;