import { assertAtomType } from "./atom-types.js";
import type { BoardPiece } from "./board.js";
import type { DifficultyMetrics } from "./difficulty.js";
import type { Solution } from "./generator.js";
import type { HexCoord } from "./hex.js";
import {
  CAMPAIGN_LEVEL_COUNT,
  campaignPlateSize,
  plateSpec,
  type PlateSizeValue,
} from "./plates.js";
import rawCampaign from "./data/campaign-levels.json" with { type: "json" };

export interface CampaignLevelRecord {
  level: number;
  seed: string;
  plateSize: PlateSizeValue;
  plateRadius: 3 | 4 | 5;
  plateCells: readonly HexCoord[];
  pieces: readonly BoardPiece[];
  solution: readonly (readonly HexCoord[])[];
  difficulty: Readonly<DifficultyMetrics>;
}

function normalizeCoord(value: unknown, label: string): Readonly<HexCoord> {
  if (
    typeof value !== "object" ||
    value === null ||
    !Number.isSafeInteger((value as { q?: unknown }).q) ||
    !Number.isSafeInteger((value as { r?: unknown }).r)
  ) {
    throw new TypeError(`${label} must be a hex coordinate`);
  }
  const coord = value as { q: number; r: number };
  return Object.freeze({ q: coord.q, r: coord.r });
}

function normalizeRecord(value: unknown, expectedLevel: number): Readonly<CampaignLevelRecord> {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`Campaign level ${expectedLevel + 1} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const expectedSize = campaignPlateSize(expectedLevel);
  const expectedSpec = plateSpec(expectedSize);

  if (record.level !== expectedLevel) {
    throw new Error(`Campaign level ${expectedLevel + 1} has an invalid level index`);
  }
  if (typeof record.seed !== "string" || record.seed.length === 0) {
    throw new TypeError(`Campaign level ${expectedLevel + 1} has an invalid seed`);
  }
  if (record.plateSize !== expectedSize || record.plateRadius !== expectedSpec.radius) {
    throw new Error(`Campaign level ${expectedLevel + 1} does not match the canonical plate schedule`);
  }
  if (!Array.isArray(record.plateCells) || record.plateCells.length !== expectedSpec.cellCount) {
    throw new Error(`Campaign level ${expectedLevel + 1} has an invalid plate cell count`);
  }
  if (!Array.isArray(record.pieces) || !Array.isArray(record.solution)) {
    throw new TypeError(`Campaign level ${expectedLevel + 1} is missing puzzle data`);
  }
  if (typeof record.difficulty !== "object" || record.difficulty === null) {
    throw new TypeError(`Campaign level ${expectedLevel + 1} is missing difficulty data`);
  }

  const plateCells = Object.freeze(
    record.plateCells.map((coord, index) => normalizeCoord(coord, `plateCells[${index}]`)),
  );
  const pieces = Object.freeze(
    record.pieces.map((piece, index) => {
      if (typeof piece !== "object" || piece === null) {
        throw new TypeError(`pieces[${index}] must be a board piece`);
      }
      const coord = normalizeCoord(piece, `pieces[${index}]`);
      const type = assertAtomType((piece as { type?: unknown }).type);
      return Object.freeze({ ...coord, type });
    }),
  );
  const solution = Object.freeze(
    record.solution.map((move, moveIndex) => {
      if (!Array.isArray(move)) {
        throw new TypeError(`solution[${moveIndex}] must be an array`);
      }
      return Object.freeze(
        move.map((coord, coordIndex) =>
          normalizeCoord(coord, `solution[${moveIndex}][${coordIndex}]`),
        ),
      );
    }),
  ) satisfies readonly (readonly HexCoord[])[];

  return Object.freeze({
    level: expectedLevel,
    seed: record.seed,
    plateSize: expectedSize,
    plateRadius: expectedSpec.radius,
    plateCells,
    pieces,
    solution: solution as Solution,
    difficulty: Object.freeze({ ...(record.difficulty as DifficultyMetrics) }),
  });
}

const rawLevels = (rawCampaign as { levels?: unknown }).levels;
if (!Array.isArray(rawLevels) || rawLevels.length !== CAMPAIGN_LEVEL_COUNT) {
  throw new Error(`Frozen campaign must contain exactly ${CAMPAIGN_LEVEL_COUNT} levels`);
}

export const CAMPAIGN_LEVELS: readonly Readonly<CampaignLevelRecord>[] = Object.freeze(
  rawLevels.map((record, level) => normalizeRecord(record, level)),
);

export function getCampaignLevel(level: number): Readonly<CampaignLevelRecord> {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`);
  }
  const record = CAMPAIGN_LEVELS[level];
  if (!record) throw new Error(`Missing campaign level ${level + 1}`);
  return record;
}
