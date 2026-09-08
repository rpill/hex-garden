import { GardenBoard, type BoardPiece } from "./board.js";
import { analyzePuzzleDifficulty, type DifficultyMetrics } from "./difficulty.js";
import {
  rankCandidatesForProfile,
  type DifficultyProfile,
} from "./difficulty-profiles.js";
import { BoardVariant } from "./generator.js";
import { type HexCoord } from "./hex.js";
import { PlateSize, type PlateSizeValue } from "./plates.js";
import {
  generatePuzzleCandidate,
  type PuzzleComposition,
} from "./puzzle-generation.js";

export type EndlessDifficultyBand = "easy" | "medium" | "hard" | "mastery";

interface EndlessDifficultyProfile extends DifficultyProfile {
  readonly band: EndlessDifficultyBand;
  readonly plateSize: PlateSizeValue;
  readonly targetPieceCount: number;
}

export interface EndlessRunLevel {
  readonly level: number;
  readonly seed: string;
  readonly candidateSeed: string;
  readonly band: EndlessDifficultyBand;
  readonly variant: typeof BoardVariant.STANDARD;
  readonly shape: "canonical";
  readonly plateSize: PlateSizeValue;
  readonly plateRadius: 3 | 4 | 5;
  readonly plateCells: readonly HexCoord[];
  readonly pieces: readonly BoardPiece[];
  readonly solution: readonly (readonly HexCoord[])[];
  readonly difficulty: Readonly<DifficultyMetrics>;
  readonly board: GardenBoard;
}

const ENDLESS_CANDIDATE_COUNT = 12;

const ENDLESS_COMPOSITION = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
} satisfies PuzzleComposition);

function freezeProfile(profile: EndlessDifficultyProfile): Readonly<EndlessDifficultyProfile> {
  return Object.freeze({
    band: profile.band,
    plateSize: profile.plateSize,
    targetPieceCount: profile.targetPieceCount,
    weights: Object.freeze({ ...profile.weights }),
    target: Object.freeze({ ...profile.target }),
  });
}

const ENDLESS_DIFFICULTY_PROFILES: Readonly<
  Record<EndlessDifficultyBand, Readonly<EndlessDifficultyProfile>>
> = Object.freeze({
  easy: freezeProfile({
    band: "easy",
    plateSize: PlateSize.SMALL,
    targetPieceCount: 29,
    weights: {
      freedom: 0.30,
      risk: 0.20,
      deception: 0.05,
      consequence: 0.15,
      route: 0.30,
    },
    target: {
      freedom: 0.72,
      risk: 0.22,
      deception: 0.12,
      consequence: 0.18,
      routeWin: 0.62,
    },
  }),
  medium: freezeProfile({
    band: "medium",
    plateSize: PlateSize.MEDIUM,
    targetPieceCount: 43,
    weights: {
      freedom: 0.22,
      risk: 0.25,
      deception: 0.13,
      consequence: 0.20,
      route: 0.20,
    },
    target: {
      freedom: 0.58,
      risk: 0.50,
      deception: 0.34,
      consequence: 0.42,
      routeWin: 0.42,
    },
  }),
  hard: freezeProfile({
    band: "hard",
    plateSize: PlateSize.LARGE,
    targetPieceCount: 51,
    weights: {
      freedom: 0.15,
      risk: 0.30,
      deception: 0.24,
      consequence: 0.21,
      route: 0.10,
    },
    target: {
      freedom: 0.48,
      risk: 0.76,
      deception: 0.66,
      consequence: 0.64,
      routeWin: 0.22,
    },
  }),
  mastery: freezeProfile({
    band: "mastery",
    plateSize: PlateSize.LARGE,
    targetPieceCount: 55,
    weights: {
      freedom: 0.15,
      risk: 0.30,
      deception: 0.25,
      consequence: 0.20,
      route: 0.10,
    },
    target: {
      freedom: 0.46,
      risk: 0.82,
      deception: 0.76,
      consequence: 0.72,
      routeWin: 0.16,
    },
  }),
});

function assertIndex(index: number): void {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError("Endless board index must be a non-negative safe integer");
  }
}

function assertRunSeed(runSeed: string): void {
  if (typeof runSeed !== "string" || runSeed.length === 0) {
    throw new TypeError("runSeed must be a non-empty string");
  }
}

export function endlessPlateSize(index: number): PlateSizeValue {
  assertIndex(index);
  if (index < 2) return PlateSize.SMALL;
  if (index < 5) return PlateSize.MEDIUM;
  return PlateSize.LARGE;
}

export function endlessDifficultyBand(index: number): EndlessDifficultyBand {
  assertIndex(index);
  if (index < 2) return "easy";
  if (index < 5) return "medium";
  if (index < 10) return "hard";
  return "mastery";
}

function endlessDifficultyProfile(index: number): Readonly<EndlessDifficultyProfile> {
  const band = endlessDifficultyBand(index);
  const profile = ENDLESS_DIFFICULTY_PROFILES[band];
  const plateSize = endlessPlateSize(index);
  if (profile.plateSize !== plateSize) {
    throw new Error(`Endless profile ${band} does not match ${plateSize} plate schedule`);
  }
  return profile;
}

interface AnalyzedEndlessCandidate {
  readonly candidateSeed: string;
  readonly plateSize: PlateSizeValue;
  readonly plateRadius: 3 | 4 | 5;
  readonly plateCells: readonly HexCoord[];
  readonly pieces: readonly BoardPiece[];
  readonly solution: readonly (readonly HexCoord[])[];
  readonly metrics: Readonly<DifficultyMetrics>;
}

export function generateEndlessRunLevel(
  level: number,
  { runSeed }: { runSeed: string },
): EndlessRunLevel {
  assertIndex(level);
  assertRunSeed(runSeed);

  const profile = endlessDifficultyProfile(level);
  const seed = `${runSeed}:board:${level}`;
  const candidates: AnalyzedEndlessCandidate[] = [];

  for (let candidateIndex = 0; candidateIndex < ENDLESS_CANDIDATE_COUNT; candidateIndex += 1) {
    const candidateSeed = `${seed}:candidate:${candidateIndex}`;
    try {
      const generated = generatePuzzleCandidate({
        seed: candidateSeed,
        plateSize: profile.plateSize,
        targetPieceCount: profile.targetPieceCount,
        composition: ENDLESS_COMPOSITION,
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
      // Candidate pools are intentionally bounded. Failed deterministic seeds
      // consume their slot and the remaining seeds still form the same pool.
    }
  }

  const selected = rankCandidatesForProfile(candidates, profile)[0]?.candidate;
  if (!selected) {
    throw new Error(
      `Could not generate a rankable Endless board ${level} from ${ENDLESS_CANDIDATE_COUNT} deterministic candidates`,
    );
  }

  const plateCells = selected.plateCells.map((cell) => ({ ...cell }));
  const pieces = selected.pieces.map((piece) => ({ ...piece }));
  const solution = selected.solution.map((move) => move.map((cell) => ({ ...cell })));

  return {
    level,
    seed,
    candidateSeed: selected.candidateSeed,
    band: profile.band,
    variant: BoardVariant.STANDARD,
    shape: "canonical",
    plateSize: selected.plateSize,
    plateRadius: selected.plateRadius,
    plateCells,
    pieces,
    solution,
    difficulty: selected.metrics,
    board: new GardenBoard(pieces),
  };
}
