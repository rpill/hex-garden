import {
  BoardVariant,
  createSeededRandom,
  generateSolvableBoard,
  type BoardVariantValue,
  type GeneratedBoard,
} from "./generator.js";

export const DEFAULT_CAMPAIGN_SEED = "garden-campaign-v1";

export interface CampaignLevel extends GeneratedBoard {
  level: number;
  seed: string;
}

export interface GenerateCampaignLevelOptions {
  campaignSeed?: string;
  variant?: BoardVariantValue;
}

/**
 * Generate one deterministic campaign level without reading any level file.
 * Level N depends only on the campaign seed, variant, and N itself.
 */
export function generateCampaignLevel(
  level: number,
  {
    campaignSeed = DEFAULT_CAMPAIGN_SEED,
    variant = BoardVariant.STANDARD,
  }: GenerateCampaignLevelOptions = {},
): CampaignLevel {
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new RangeError("level must be a non-negative safe integer");
  }

  const seed = `${campaignSeed}:${variant}:${level}`;
  return {
    level,
    seed,
    ...generateSolvableBoard({ random: createSeededRandom(seed), variant }),
  };
}
