import { DEFAULT_CAMPAIGN_SEED, generateCampaignLevel } from "./campaign.js";
import { BoardVariant } from "./generator.js";
import { enumerateHexPlate } from "./hex.js";
import { generateProgressionLevel } from "./progression.js";

export const ENDLESS_COMPACT_LEVEL_COUNT = 2;
export const ENDLESS_MEDIUM_LEVEL_COUNT = 3;
export const ENDLESS_LARGE_START_LEVEL =
  ENDLESS_COMPACT_LEVEL_COUNT + ENDLESS_MEDIUM_LEVEL_COUNT;

const MEDIUM_PROGRESSION_LEVELS = Object.freeze([9, 12, 15]);

function assertLevel(level) {
  if (!Number.isSafeInteger(level) || level < 0) {
    throw new RangeError("level must be a non-negative safe integer");
  }
}

export function endlessRunPhase(level) {
  assertLevel(level);
  if (level < ENDLESS_COMPACT_LEVEL_COUNT) return "compact";
  if (level < ENDLESS_LARGE_START_LEVEL) return "medium";
  return "large";
}

function asRunRecord(level, phase, generated, plateRadius) {
  return {
    level,
    seed: generated.seed,
    variant: BoardVariant.STANDARD,
    shape: `endless-${phase}-${generated.shape}`,
    plateRadius,
    plateCells: enumerateHexPlate(plateRadius),
    pieces: generated.pieces,
    solution: generated.solution,
    board: generated.board,
  };
}

export function generateEndlessRunLevel(
  level,
  { campaignSeed = DEFAULT_CAMPAIGN_SEED } = {},
) {
  assertLevel(level);
  const phase = endlessRunPhase(level);

  if (phase === "compact") {
    const generated = generateProgressionLevel(8, {
      campaignSeed: `${campaignSeed}:endless-run:compact:${level}`,
    });
    return asRunRecord(level, phase, generated, 3);
  }

  if (phase === "medium") {
    const phaseLevel = level - ENDLESS_COMPACT_LEVEL_COUNT;
    const generated = generateProgressionLevel(
      MEDIUM_PROGRESSION_LEVELS[phaseLevel],
      { campaignSeed: `${campaignSeed}:endless-run:medium:${level}` },
    );
    return asRunRecord(level, phase, generated, 4);
  }

  const generated = generateCampaignLevel(level - ENDLESS_LARGE_START_LEVEL, {
    campaignSeed: `${campaignSeed}:endless-run:large`,
    variant: BoardVariant.STANDARD,
  });
  return asRunRecord(level, phase, generated, 5);
}
