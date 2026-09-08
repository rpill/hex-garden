import { PlayMode, type PlayModeValue } from "../modes.js";

export interface AssistancePolicy {
  rewardRequired: boolean;
}

export function assistancePolicy(
  mode: PlayModeValue,
  campaignLevel?: number,
): Readonly<AssistancePolicy> {
  return Object.freeze({
    rewardRequired:
      mode === PlayMode.CAMPAIGN
        ? (campaignLevel ?? 0) >= 5
        : mode !== PlayMode.TUTORIAL,
  });
}
