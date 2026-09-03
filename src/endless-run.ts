import { DEFAULT_CAMPAIGN_SEED, generateCampaignLevel } from "./campaign.js";
import { BoardVariant, type Solution } from "./generator.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import { enumerateHexPlate, type HexCoord } from "./hex.js";
import { generateProgressionLevel } from "./progression.js";

export const ENDLESS_COMPACT_LEVEL_COUNT = 2;
export const ENDLESS_MEDIUM_LEVEL_COUNT = 3;
export const ENDLESS_LARGE_START_LEVEL = ENDLESS_COMPACT_LEVEL_COUNT + ENDLESS_MEDIUM_LEVEL_COUNT;

const MEDIUM_PROGRESSION_LEVELS = Object.freeze([9, 12, 15]);
export type EndlessRunPhase = "compact" | "medium" | "large";

export interface EndlessRunLevel {
  level: number;
  seed: string;
  variant: typeof BoardVariant.STANDARD;
  shape: string;
  plateRadius: number;
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  board: GardenBoard;
}

function assertLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0) throw new RangeError("level must be a non-negative safe integer");
}

export function endlessRunPhase(level: number): EndlessRunPhase {
  assertLevel(level);
  if (level < ENDLESS_COMPACT_LEVEL_COUNT) return "compact";
  if (level < ENDLESS_LARGE_START_LEVEL) return "medium";
  return "large";
}

interface GeneratedRunSource {
  seed: string;
  shape: string;
  pieces: BoardPiece[];
  solution: Solution;
  board: GardenBoard;
}

function asRunRecord(level: number, phase: EndlessRunPhase, generated: GeneratedRunSource, plateRadius: number): EndlessRunLevel {
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
  level: number,
  { campaignSeed = DEFAULT_CAMPAIGN_SEED }: { campaignSeed?: string } = {},
): EndlessRunLevel {
  assertLevel(level);
  const phase = endlessRunPhase(level);

  if (phase === "compact") {
    const generated = generateProgressionLevel(8, { campaignSeed: `${campaignSeed}:endless-run:compact:${level}` });
    return asRunRecord(level, phase, generated, 3);
  }

  if (phase === "medium") {
    const phaseLevel = level - ENDLESS_COMPACT_LEVEL_COUNT;
    const progressionLevel = MEDIUM_PROGRESSION_LEVELS[phaseLevel];
    if (progressionLevel === undefined) throw new RangeError("Endless medium phase level is out of range");
    const generated = generateProgressionLevel(progressionLevel, { campaignSeed: `${campaignSeed}:endless-run:medium:${level}` });
    return asRunRecord(level, phase, generated, 4);
  }

  const generated = generateCampaignLevel(level - ENDLESS_LARGE_START_LEVEL, {
    campaignSeed: `${campaignSeed}:endless-run:large`,
    variant: BoardVariant.STANDARD,
  });
  return asRunRecord(level, phase, generated, 5);
}
