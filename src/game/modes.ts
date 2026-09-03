import { BoardVariant } from "../generator.js";
export const PlayMode = Object.freeze({ TUTORIAL: "tutorial", CAMPAIGN: "campaign", STANDARD: BoardVariant.STANDARD, QUINTESSENCE: BoardVariant.QUINTESSENCE } as const);
export type PlayModeValue = (typeof PlayMode)[keyof typeof PlayMode];
