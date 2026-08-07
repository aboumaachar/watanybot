import { createVotingDefaultAdapter } from "../../../../../packages/features/voting/src/index";

export const watanyVotingAdapter = createVotingDefaultAdapter();

export const watanyVotingAdapterStatus = {
  pluginKey: "voting",
  host: "web-user",
  productionReplacement: false,
  note: "Watany voting UI remains preserved until explicit browser proof and replacement approval."
};
