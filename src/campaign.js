import {
  BoardVariant,
  createSeededRandom,
  generateSolvableBoard,
} from "./generator.js";

export const DEFAULT_CAMPAIGN_SEED = "garden-campaign-v1";

/**
 * Generate one deterministic campaign level without reading any level file.
 * Level N depends only on the campaign seed, variant, and N itself.
 */
export function generateCampaignLevel(
  level,
  {
    campaignSeed = DEFAULT_CAMPAIGN_SEED,
    variant = BoardVariant.STANDARD,
  } = {},
) {
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new RangeError("level must be a non-negative safe integer");
  }

  const seed = `${campaignSeed}:${variant}:${level}`;
  return {
    level,
    seed,
    ...generateSolvableBoard({
      random: createSeededRandom(seed),
      variant,
    }),
  };
}
