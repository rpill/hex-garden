import { GardenBoard, type BoardPiece } from "./board.js";
import { analyzePuzzleDifficulty, type DifficultyMetrics } from "./difficulty.js";
import {
  rankCandidatesForProfile,
  type DifficultyProfile,
} from "./difficulty-profiles.js";
import { type HexCoord } from "./hex.js";
import { PlateSize, type PlateSizeValue } from "./plates.js";
import {
  generatePuzzleCandidate,
  type PuzzleComposition,
} from "./puzzle-generation.js";

export type DailyDifficultyBand = "medium" | "mediumHard" | "hard" | "challenge";

export interface DailyDifficultyProfile extends DifficultyProfile {
  readonly band: DailyDifficultyBand;
  readonly plateSize: PlateSizeValue;
  readonly targetPieceCount: number;
}

export interface DailyPuzzle {
  readonly dateKey: string;
  readonly seed: string;
  readonly candidateSeed: string;
  readonly band: DailyDifficultyBand;
  readonly plateSize: PlateSizeValue;
  readonly plateRadius: 3 | 4 | 5;
  readonly plateCells: readonly HexCoord[];
  readonly pieces: readonly BoardPiece[];
  readonly solution: readonly (readonly HexCoord[])[];
  readonly metrics: Readonly<DifficultyMetrics>;
  readonly board: GardenBoard;
}

const DAILY_CANDIDATE_COUNT = 16;

const DAILY_COMPOSITION = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
} satisfies PuzzleComposition);

function freezeDailyProfile(profile: DailyDifficultyProfile): Readonly<DailyDifficultyProfile> {
  return Object.freeze({
    band: profile.band,
    plateSize: profile.plateSize,
    targetPieceCount: profile.targetPieceCount,
    weights: Object.freeze({ ...profile.weights }),
    target: Object.freeze({ ...profile.target }),
  });
}

const DAILY_DIFFICULTY_PROFILES: Readonly<Record<DailyDifficultyBand, Readonly<DailyDifficultyProfile>>> = Object.freeze({
  medium: freezeDailyProfile({
    band: "medium",
    plateSize: PlateSize.MEDIUM,
    targetPieceCount: 43,
    weights: {
      freedom: 0.22,
      risk: 0.24,
      deception: 0.14,
      consequence: 0.20,
      route: 0.20,
    },
    target: {
      freedom: 0.58,
      risk: 0.48,
      deception: 0.32,
      consequence: 0.40,
      routeWin: 0.44,
    },
  }),
  mediumHard: freezeDailyProfile({
    band: "mediumHard",
    plateSize: PlateSize.MEDIUM,
    targetPieceCount: 47,
    weights: {
      freedom: 0.18,
      risk: 0.27,
      deception: 0.20,
      consequence: 0.20,
      route: 0.15,
    },
    target: {
      freedom: 0.52,
      risk: 0.64,
      deception: 0.52,
      consequence: 0.54,
      routeWin: 0.30,
    },
  }),
  hard: freezeDailyProfile({
    band: "hard",
    plateSize: PlateSize.LARGE,
    targetPieceCount: 51,
    weights: {
      freedom: 0.15,
      risk: 0.29,
      deception: 0.24,
      consequence: 0.21,
      route: 0.11,
    },
    target: {
      freedom: 0.48,
      risk: 0.78,
      deception: 0.68,
      consequence: 0.66,
      routeWin: 0.20,
    },
  }),
  challenge: freezeDailyProfile({
    band: "challenge",
    plateSize: PlateSize.LARGE,
    targetPieceCount: 55,
    weights: {
      freedom: 0.13,
      risk: 0.30,
      deception: 0.26,
      consequence: 0.23,
      route: 0.08,
    },
    target: {
      freedom: 0.42,
      risk: 0.88,
      deception: 0.82,
      consequence: 0.80,
      routeWin: 0.12,
    },
  }),
});

function parseDateKey(dateKey: string): { readonly weekdayIndex: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new RangeError("Daily date key must use YYYY-MM-DD format");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    !Number.isSafeInteger(year) ||
    year < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid Daily date key: ${dateKey}`);
  }

  const utcWeekday = date.getUTCDay();
  return { weekdayIndex: utcWeekday === 0 ? 6 : utcWeekday - 1 };
}

function dailyBandForDateKey(dateKey: string): DailyDifficultyBand {
  const { weekdayIndex } = parseDateKey(dateKey);
  if (weekdayIndex <= 3) return "medium";
  if (weekdayIndex === 4) return "mediumHard";
  if (weekdayIndex === 5) return "hard";
  return "challenge";
}

export function dailyDifficultyProfile(dateKey: string): Readonly<DailyDifficultyProfile> {
  return DAILY_DIFFICULTY_PROFILES[dailyBandForDateKey(dateKey)];
}

interface AnalyzedDailyCandidate {
  readonly candidateSeed: string;
  readonly plateSize: PlateSizeValue;
  readonly plateRadius: 3 | 4 | 5;
  readonly plateCells: readonly HexCoord[];
  readonly pieces: readonly BoardPiece[];
  readonly solution: readonly (readonly HexCoord[])[];
  readonly metrics: Readonly<DifficultyMetrics>;
}

export function generateDailyPuzzle(dateKey: string): DailyPuzzle {
  const profile = dailyDifficultyProfile(dateKey);
  const seed = `daily-v1:${dateKey}`;
  const candidates: AnalyzedDailyCandidate[] = [];

  for (let candidateIndex = 0; candidateIndex < DAILY_CANDIDATE_COUNT; candidateIndex += 1) {
    const candidateSeed = `${seed}:candidate:${candidateIndex}`;
    try {
      const generated = generatePuzzleCandidate({
        seed: candidateSeed,
        plateSize: profile.plateSize,
        targetPieceCount: profile.targetPieceCount,
        composition: DAILY_COMPOSITION,
      });
      const metrics = analyzePuzzleDifficulty({
        pieces: generated.pieces,
        solution: generated.solution,
        plateCells: generated.plateCells,
        sampleSeed: candidateSeed,
      });
      candidates.push({
        candidateSeed,
        plateSize: generated.plateSize,
        plateRadius: generated.plateRadius,
        plateCells: generated.plateCells,
        pieces: generated.pieces,
        solution: generated.solution,
        metrics,
      });
    } catch {
      // The pool is intentionally bounded. A failed candidate consumes its slot;
      // another deterministic seed may still yield a rankable puzzle.
    }
  }

  const ranked = rankCandidatesForProfile(candidates, profile);
  const selected = ranked[0]?.candidate;
  if (!selected) {
    throw new Error(
      `Could not generate a rankable Daily puzzle for ${dateKey} from ${DAILY_CANDIDATE_COUNT} deterministic candidates`,
    );
  }

  const plateCells = selected.plateCells.map((cell) => ({ ...cell }));
  const pieces = selected.pieces.map((piece) => ({ ...piece }));
  const solution = selected.solution.map((move) => move.map((cell) => ({ ...cell })));

  return {
    dateKey,
    seed,
    candidateSeed: selected.candidateSeed,
    band: profile.band,
    plateSize: selected.plateSize,
    plateRadius: selected.plateRadius,
    plateCells,
    pieces,
    solution,
    metrics: selected.metrics,
    board: new GardenBoard(pieces),
  };
}
