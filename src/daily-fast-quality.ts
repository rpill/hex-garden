import { GardenBoard, type BoardPiece } from "./board.js";
import type { DailyDifficultyBand } from "./daily.js";
import { createSeededRandom } from "./generator.js";
import type { HexCoord } from "./hex.js";
import type { PlateSizeValue } from "./plates.js";

export interface FastDailyQualityMetrics {
  readonly averageMeaningfulMoveCount: number;
  readonly forcedStepRatio: number;
  readonly constrainedStepRatio: number;
  readonly ambiguousMoveRatio: number;
  readonly sampledRouteSurvivalProbability: number;
}

export interface FastDailySelectionProfile {
  readonly weights: Readonly<{
    freedom: number;
    constrained: number;
    ambiguity: number;
    route: number;
  }>;
  readonly target: Readonly<{
    freedom: number;
    constrained: number;
    ambiguity: number;
    routeSurvival: number;
  }>;
}

export interface FastDailyQualityCandidate {
  readonly plateSize: PlateSizeValue;
  readonly quality: Readonly<FastDailyQualityMetrics>;
}

export interface RankedFastDailyCandidate<T extends FastDailyQualityCandidate> {
  readonly candidate: T;
  readonly score: number;
}

const FAST_DAILY_SELECTION_PROFILES: Readonly<Record<DailyDifficultyBand, Readonly<FastDailySelectionProfile>>> = Object.freeze({
  medium: Object.freeze({
    weights: Object.freeze({ freedom: 0.30, constrained: 0.20, ambiguity: 0.20, route: 0.30 }),
    target: Object.freeze({ freedom: 0.45, constrained: 0.70, ambiguity: 0.35, routeSurvival: 0.65 }),
  }),
  mediumHard: Object.freeze({
    weights: Object.freeze({ freedom: 0.28, constrained: 0.20, ambiguity: 0.22, route: 0.30 }),
    target: Object.freeze({ freedom: 0.55, constrained: 0.52, ambiguity: 0.50, routeSurvival: 0.50 }),
  }),
  hard: Object.freeze({
    weights: Object.freeze({ freedom: 0.26, constrained: 0.18, ambiguity: 0.26, route: 0.30 }),
    target: Object.freeze({ freedom: 0.68, constrained: 0.34, ambiguity: 0.65, routeSurvival: 0.35 }),
  }),
  challenge: Object.freeze({
    weights: Object.freeze({ freedom: 0.24, constrained: 0.16, ambiguity: 0.30, route: 0.30 }),
    target: Object.freeze({ freedom: 0.80, constrained: 0.16, ambiguity: 0.80, routeSurvival: 0.20 }),
  }),
});

export function fastDailySelectionProfileForBand(
  band: DailyDifficultyBand,
): Readonly<FastDailySelectionProfile> {
  return FAST_DAILY_SELECTION_PROFILES[band];
}

function applyMove(board: GardenBoard, move: readonly HexCoord[]): void {
  let result;
  for (const cell of move) result = board.select(cell);
  if (result?.kind !== "removed") {
    throw new Error("Fast Daily analysis encountered an invalid move");
  }
}

function typeSignature(move: readonly BoardPiece[]): string {
  return move.map((piece) => piece.type).sort((left, right) => left - right).join("+");
}

function sampledRouteSurvivalProbability(
  pieces: readonly BoardPiece[],
  sampleSeed: string,
  trials: number,
  maxDepth: number,
): number {
  if (trials <= 0) return 0;
  const random = createSeededRandom(`fast-daily-route:${sampleSeed}`);
  let survived = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const board = new GardenBoard(pieces);
    let dead = false;
    for (let depth = 0; depth < maxDepth && !board.won; depth += 1) {
      const legalMoves = board.legalMoves();
      if (legalMoves.length === 0) {
        dead = true;
        break;
      }
      const move = legalMoves[Math.floor(random() * legalMoves.length)];
      if (!move) {
        dead = true;
        break;
      }
      applyMove(board, move);
    }
    if (!dead) survived += 1;
  }

  return survived / trials;
}

export function analyzeFastDailyQuality({
  pieces,
  solution,
  sampleSeed,
  decisionSteps = 5,
  rolloutTrials = 2,
  rolloutDepth = 8,
}: {
  pieces: readonly BoardPiece[];
  solution: readonly (readonly HexCoord[])[];
  sampleSeed: string;
  decisionSteps?: number;
  rolloutTrials?: number;
  rolloutDepth?: number;
}): Readonly<FastDailyQualityMetrics> {
  const board = new GardenBoard(pieces);
  const stepsToAnalyze = Math.min(Math.max(0, Math.floor(decisionSteps)), solution.length);
  let meaningfulMoveTotal = 0;
  let forcedSteps = 0;
  let constrainedSteps = 0;
  let ambiguousMoveTotal = 0;

  for (let step = 0; step < solution.length; step += 1) {
    const certificateMove = solution[step];
    if (!certificateMove) break;

    if (step < stepsToAnalyze) {
      const legalMoves = board.legalMoves();
      const meaningfulMoveCount = new Set(legalMoves.map(typeSignature)).size;
      meaningfulMoveTotal += meaningfulMoveCount;
      if (meaningfulMoveCount <= 1) forcedSteps += 1;
      if (meaningfulMoveCount <= 2) constrainedSteps += 1;
      if (legalMoves.length > 0) {
        ambiguousMoveTotal += 1 - meaningfulMoveCount / legalMoves.length;
      }
    }

    applyMove(board, certificateMove);
  }

  if (!board.won) {
    throw new Error("Fast Daily analysis certificate did not solve the board");
  }

  const divisor = Math.max(1, stepsToAnalyze);
  return Object.freeze({
    averageMeaningfulMoveCount: meaningfulMoveTotal / divisor,
    forcedStepRatio: forcedSteps / divisor,
    constrainedStepRatio: constrainedSteps / divisor,
    ambiguousMoveRatio: ambiguousMoveTotal / divisor,
    sampledRouteSurvivalProbability: sampledRouteSurvivalProbability(
      pieces,
      sampleSeed,
      Math.max(0, Math.floor(rolloutTrials)),
      Math.max(1, Math.floor(rolloutDepth)),
    ),
  });
}

function percentileRanks(values: readonly number[]): number[] {
  if (values.length <= 1) return values.map(() => 0.5);
  return values.map((value) => {
    let less = 0;
    let equal = 0;
    for (const other of values) {
      if (other < value) less += 1;
      else if (other === value) equal += 1;
    }
    return (less + (equal - 1) / 2) / (values.length - 1);
  });
}

export function rankFastDailyCandidatesForProfile<T extends FastDailyQualityCandidate>(
  candidates: readonly T[],
  profile: Readonly<FastDailySelectionProfile>,
): ReadonlyArray<Readonly<RankedFastDailyCandidate<T>>> {
  const groups = new Map<PlateSizeValue, Array<{ candidate: T; originalIndex: number }>>();
  candidates.forEach((candidate, originalIndex) => {
    const group = groups.get(candidate.plateSize) ?? [];
    group.push({ candidate, originalIndex });
    groups.set(candidate.plateSize, group);
  });

  const ranked: Array<RankedFastDailyCandidate<T> & { originalIndex: number }> = [];
  for (const group of groups.values()) {
    const freedom = percentileRanks(group.map(({ candidate }) => candidate.quality.averageMeaningfulMoveCount));
    const constrained = percentileRanks(group.map(({ candidate }) => candidate.quality.constrainedStepRatio));
    const ambiguity = percentileRanks(group.map(({ candidate }) => candidate.quality.ambiguousMoveRatio));
    const routeSurvival = percentileRanks(group.map(({ candidate }) => candidate.quality.sampledRouteSurvivalProbability));

    group.forEach((entry, index) => {
      const score =
        profile.weights.freedom * Math.abs((freedom[index] ?? 0.5) - profile.target.freedom) +
        profile.weights.constrained * Math.abs((constrained[index] ?? 0.5) - profile.target.constrained) +
        profile.weights.ambiguity * Math.abs((ambiguity[index] ?? 0.5) - profile.target.ambiguity) +
        profile.weights.route * Math.abs((routeSurvival[index] ?? 0.5) - profile.target.routeSurvival);
      ranked.push({ candidate: entry.candidate, score, originalIndex: entry.originalIndex });
    });
  }

  ranked.sort((left, right) => left.score - right.score || left.originalIndex - right.originalIndex);
  return ranked.map(({ candidate, score }) => Object.freeze({ candidate, score }));
}
