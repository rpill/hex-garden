export const PlayMode = Object.freeze({
  TUTORIAL: "tutorial",
  CAMPAIGN: "campaign",
  DAILY: "daily",
  ENDLESS: "endless",
} as const);

export type PlayModeValue = (typeof PlayMode)[keyof typeof PlayMode];
