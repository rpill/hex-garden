import { GardenBoard, type BoardPiece } from "./board.js";
import {
  getCampaignLevel,
  type CampaignLevelRecord,
} from "./campaign-levels.js";
import {
  BoardVariant,
  type BoardVariantValue,
  type Solution,
} from "./generator.js";
import type { HexCoord } from "./hex.js";

/** @deprecated Campaign content is frozen; this seed is retained for migration-only callers. */
export const DEFAULT_CAMPAIGN_SEED = "campaign-v2";

export interface CampaignLevel
  extends Omit<CampaignLevelRecord, "plateCells" | "pieces" | "solution"> {
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  variant: typeof BoardVariant.STANDARD;
  shape: "canonical";
  board: GardenBoard;
}

/** @deprecated Campaign variant selection is ignored by the frozen v2 campaign. */
export interface GenerateCampaignLevelOptions {
  campaignSeed?: string;
  variant?: BoardVariantValue;
}

/**
 * Compatibility facade for callers that still expect a generated mutable board.
 * Campaign puzzle data itself is loaded from the frozen 50-level dataset and
 * never uses runtime randomness.
 */
export function generateCampaignLevel(
  level: number,
  _options: GenerateCampaignLevelOptions = {},
): CampaignLevel {
  const record = getCampaignLevel(level);
  const plateCells = record.plateCells.map((cell) => ({ ...cell }));
  const pieces = record.pieces.map((piece) => ({ ...piece }));
  const solution = record.solution.map((move) => move.map((cell) => ({ ...cell })));
  return {
    ...record,
    plateCells,
    pieces,
    solution,
    variant: BoardVariant.STANDARD,
    shape: "canonical",
    board: new GardenBoard(pieces),
  };
}

export { getCampaignLevel } from "./campaign-levels.js";
