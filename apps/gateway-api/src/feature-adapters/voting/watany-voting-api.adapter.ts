import { createVotingDefaultAdapter } from "../../../../../packages/features/voting/src";

export const watanyVotingApiAdapter = createVotingDefaultAdapter();

export const watanyVotingApiAdapterStatus = {
  pluginKey: "voting",
  host: "gateway-api",
  productionReplacement: false,
  note: "Watany voting API behavior remains preserved until explicit API proof and replacement approval."
};
