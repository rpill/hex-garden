import { assertAtomType } from "./atom-types.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import { dailyDifficultyProfile, type DailyDifficultyBand } from "./daily.js";
import { isDailyDateKey } from "./daily-calendar.js";
import { type HexCoord, enumerateHexPlate } from "./hex.js";
import { plateSpec, type PlateSizeValue } from "./plates.js";
import rawDailyPack from "./data/daily-levels.json" with { type: "json" };

type PackedDailyRecord = readonly [
  candidateIndex: number,
  pieces: readonly number[],
  solution: readonly (readonly number[])[],
];

export interface FrozenDailyLevel {
  readonly dateKey: string;
  readonly seed: string;
  readonly candidateSeed: string;
  readonly band: DailyDifficultyBand;
  readonly plateSize: PlateSizeValue;
  readonly plateRadius: 3 | 4 | 5;
  readonly plateCells: readonly HexCoord[];
  readonly pieces: readonly BoardPiece[];
  readonly solution: readonly (readonly HexCoord[])[];
  readonly board: GardenBoard;
}

function dateKeyDayNumber(dateKey: string): number {
  if (!isDailyDateKey(dateKey)) {
    throw new RangeError(`Invalid Daily date key: ${dateKey}`);
  }
  const [yearText, monthText, dayText] = dateKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function parsePackedRecord(value: unknown, dateKey: string): Readonly<FrozenDailyLevel> {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(`Frozen Daily ${dateKey} has an invalid packed record`);
  }
  const [candidateIndexValue, packedPiecesValue, packedSolutionValue] = value;
  if (!Number.isSafeInteger(candidateIndexValue) || (candidateIndexValue as number) < 0) {
    throw new TypeError(`Frozen Daily ${dateKey} has an invalid candidate index`);
  }
  if (!Array.isArray(packedPiecesValue) || packedPiecesValue.length % 3 !== 0) {
    throw new TypeError(`Frozen Daily ${dateKey} has invalid packed pieces`);
  }
  if (!Array.isArray(packedSolutionValue)) {
    throw new TypeError(`Frozen Daily ${dateKey} has an invalid packed solution`);
  }

  const profile = dailyDifficultyProfile(dateKey);
  const spec = plateSpec(profile.plateSize);
  const pieces: BoardPiece[] = [];
  for (let index = 0; index < packedPiecesValue.length; index += 3) {
    const q = packedPiecesValue[index];
    const r = packedPiecesValue[index + 1];
    const type = packedPiecesValue[index + 2];
    if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) {
      throw new TypeError(`Frozen Daily ${dateKey} has an invalid piece coordinate`);
    }
    pieces.push(Object.freeze({
      q: q as number,
      r: r as number,
      type: assertAtomType(type),
    }));
  }
  if (pieces.length !== profile.targetPieceCount) {
    throw new Error(
      `Frozen Daily ${dateKey} has ${pieces.length} pieces instead of ${profile.targetPieceCount}`,
    );
  }

  const solution = packedSolutionValue.map((packedMove, moveIndex) => {
    if (!Array.isArray(packedMove) || packedMove.length === 0 || packedMove.length % 2 !== 0) {
      throw new TypeError(`Frozen Daily ${dateKey} has invalid solution move ${moveIndex}`);
    }
    const move: HexCoord[] = [];
    for (let index = 0; index < packedMove.length; index += 2) {
      const q = packedMove[index];
      const r = packedMove[index + 1];
      if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) {
        throw new TypeError(`Frozen Daily ${dateKey} has an invalid solution coordinate`);
      }
      move.push(Object.freeze({ q: q as number, r: r as number }));
    }
    return Object.freeze(move);
  });

  const candidateIndex = candidateIndexValue as number;
  const seed = `daily-v1:${dateKey}`;
  const frozenPieces = Object.freeze(pieces);
  return Object.freeze({
    dateKey,
    seed,
    candidateSeed: `${seed}:candidate:${candidateIndex}`,
    band: profile.band,
    plateSize: profile.plateSize,
    plateRadius: spec.radius,
    plateCells: Object.freeze(enumerateHexPlate(spec.radius).map((cell) => Object.freeze({ ...cell }))),
    pieces: frozenPieces,
    solution: Object.freeze(solution),
    board: new GardenBoard(frozenPieces),
  });
}

const pack = rawDailyPack as {
  format?: unknown;
  startDateKey?: unknown;
  endDateKey?: unknown;
  levels?: unknown;
};
if (pack.format !== "hex-garden-daily-pack-v1") {
  throw new Error("Frozen Daily pack has an unsupported format");
}
if (typeof pack.startDateKey !== "string" || typeof pack.endDateKey !== "string") {
  throw new TypeError("Frozen Daily pack is missing its date range");
}
if (!Array.isArray(pack.levels)) {
  throw new TypeError("Frozen Daily pack is missing levels");
}
const rawLevels = pack.levels;

export const DAILY_LEVEL_PACK_START_DATE_KEY = pack.startDateKey;
export const DAILY_LEVEL_PACK_END_DATE_KEY = pack.endDateKey;
export const FROZEN_DAILY_LEVEL_COUNT = rawLevels.length;

const startDay = dateKeyDayNumber(DAILY_LEVEL_PACK_START_DATE_KEY);
const endDay = dateKeyDayNumber(DAILY_LEVEL_PACK_END_DATE_KEY);
if (endDay - startDay + 1 !== FROZEN_DAILY_LEVEL_COUNT) {
  throw new Error("Frozen Daily pack date range does not match its level count");
}

const cache = new Map<string, Readonly<FrozenDailyLevel>>();

export function getDailyLevel(dateKey: string): Readonly<FrozenDailyLevel> {
  const day = dateKeyDayNumber(dateKey);
  const index = day - startDay;
  if (index < 0 || index >= FROZEN_DAILY_LEVEL_COUNT) {
    throw new RangeError(`Daily ${dateKey} is not included in this build's frozen Daily pack`);
  }
  const cached = cache.get(dateKey);
  if (cached) return cached;
  const rawRecord = rawLevels[index] as PackedDailyRecord | undefined;
  if (!rawRecord) {
    throw new Error(`Frozen Daily pack is missing ${dateKey}`);
  }
  const level = parsePackedRecord(rawRecord, dateKey);
  cache.set(dateKey, level);
  return level;
}
