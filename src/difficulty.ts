import { GardenBoard, type BoardPiece } from "./board.js";
import { createSeededRandom } from "./generator.js";
import { hexKey, type HexCoord } from "./hex.js";

export interface DifficultyInput {
  pieces: readonly BoardPiece[];
  solution: readonly (readonly HexCoord[])[];
  plateCells: readonly HexCoord[];
  sampleSeed: string;
}

export interface DifficultyMetrics {
  pieceCount: number;
  moveCount: number;
  plateFill: number;
  initialFreeCount: number;
  initialLegalMoveCount: number;
  minimumLegalMoveCount: number;
  maximumLegalMoveCount: number;
  averageLegalMoveCount: number;
  forcedCertificateSteps: number;
  initialMeaningfulMoveCount: number;
  minimumMeaningfulMoveCount: number;
  maximumMeaningfulMoveCount: number;
  averageMeaningfulMoveCount: number;
  sampledRouteWinProbability: number;
  routeAnalysisComplete: boolean;
  reachableStateCount: number | null;
  deadEndStateCount: number | null;
  shortestDeadEndMove: number | null;
  randomRouteWinProbability: number | null;
  firstMixedDecisionStep: number | null;
  mixedDecisionSteps: number | null;
  losingMovesAlongCertificate: number | null;
  firstDeceptiveDecisionStep: number | null;
  deceptiveDecisionSteps: number | null;
  deceptiveLosingMovesAlongCertificate: number | null;
  earlyDecisionStepsAnalyzed: number;
  earlyChoiceSteps: number;
  earlyAlternativeMovesAnalyzed: number;
  earlyRiskyAlternativeMoves: number;
  earlyRiskyDecisionSteps: number;
  firstRiskyDecisionStep: number | null;
  earlyDeceptiveRiskyMoves: number;
  earlyDeceptiveDecisionSteps: number;
  firstDeceptiveRiskStep: number | null;
  consequenceDepthSamples: number;
  consequenceDepthMedian: number | null;
  consequenceDepthMax: number | null;
}

interface RouteState {
  deadEnd: boolean;
  shortestDeadEndMove: number | null;
  winProbability: number;
}

function applyMove(board: GardenBoard, move: readonly HexCoord[]): void {
  let result;
  for (const position of move) result = board.select(position);
  if (result?.kind !== "removed") {
    throw new Error("Difficulty analysis encountered an invalid certificate");
  }
}

function moveTypeSignature(move: readonly BoardPiece[]): string {
  return move
    .map((piece) => piece.type)
    .sort((left, right) => left - right)
    .join("+");
}

function movePositionSignature(move: readonly HexCoord[]): string {
  return move
    .map(hexKey)
    .sort()
    .join("|");
}

function analyzeReachableRoutes(pieces: readonly BoardPiece[]) {
  // Exact route analysis remains intentionally limited to compact boards.
  // Larger boards use deterministic sampled rollouts instead of enumerating
  // an impractically large reachable-state graph on the synchronous path.
  if (pieces.length > 24) {
    return Object.freeze({
      routeAnalysisComplete: false,
      reachableStateCount: null,
      deadEndStateCount: null,
      shortestDeadEndMove: null,
      randomRouteWinProbability: null,
    });
  }

  const pieceIndex = new Map<string, number>(
    pieces.map((piece, index) => [hexKey(piece), index]),
  );
  const fullMask = (1n << BigInt(pieces.length)) - 1n;
  const memo = new Map<string, Readonly<RouteState>>();

  const visit = (mask: bigint): Readonly<RouteState> => {
    const key = mask.toString();
    const cached = memo.get(key);
    if (cached) return cached;

    const board = new GardenBoard(
      pieces.filter(
        (_piece, index) => (mask & (1n << BigInt(index))) !== 0n,
      ),
    );
    if (board.won) {
      const result = Object.freeze({
        deadEnd: false,
        shortestDeadEndMove: null,
        winProbability: 1,
      });
      memo.set(key, result);
      return result;
    }

    const legalMoves = board.legalMoves();
    if (legalMoves.length === 0) {
      const result = Object.freeze({
        deadEnd: true,
        shortestDeadEndMove: 0,
        winProbability: 0,
      });
      memo.set(key, result);
      return result;
    }

    const children = legalMoves.map((move) => {
      let nextMask = mask;
      for (const piece of move) {
        const index = pieceIndex.get(hexKey(piece));
        if (index === undefined) {
          throw new Error("Difficulty piece index is missing");
        }
        nextMask &= ~(1n << BigInt(index));
      }
      return visit(nextMask);
    });
    const deadEndDistances = children.flatMap((child) =>
      child.shortestDeadEndMove === null
        ? []
        : [child.shortestDeadEndMove + 1],
    );
    const result = Object.freeze({
      deadEnd: false,
      shortestDeadEndMove:
        deadEndDistances.length > 0 ? Math.min(...deadEndDistances) : null,
      winProbability:
        children.reduce((sum, child) => sum + child.winProbability, 0) /
        children.length,
    });
    memo.set(key, result);
    return result;
  };

  const initial = visit(fullMask);
  return Object.freeze({
    routeAnalysisComplete: true,
    reachableStateCount: memo.size,
    deadEndStateCount: [...memo.values()].filter((state) => state.deadEnd)
      .length,
    shortestDeadEndMove: initial.shortestDeadEndMove,
    randomRouteWinProbability: initial.winProbability,
  });
}

function rolloutWinProbability(
  initialBoard: GardenBoard,
  seed: string,
  trials: number,
): number {
  const random = createSeededRandom(seed);
  let wins = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const board = initialBoard.clone();
    while (!board.won) {
      const legalMoves = board.legalMoves();
      if (legalMoves.length === 0) break;
      const move = legalMoves[Math.floor(random() * legalMoves.length)];
      if (!move) break;
      applyMove(board, move);
    }
    if (board.won) wins += 1;
  }

  return wins / trials;
}

function sampleRouteWinProbability(
  pieces: readonly BoardPiece[],
  trials = 32,
): number {
  const sampleSeed = pieces
    .map((piece) => `${piece.q},${piece.r},${piece.type}`)
    .sort()
    .join("|");
  return rolloutWinProbability(
    new GardenBoard(pieces),
    `route-sample:${sampleSeed}`,
    trials,
  );
}

function analyzeCertificateDecisionPressure(
  pieces: readonly BoardPiece[],
  solution: readonly (readonly HexCoord[])[],
) {
  if (pieces.length > 24) {
    return Object.freeze({
      firstMixedDecisionStep: null,
      mixedDecisionSteps: null,
      losingMovesAlongCertificate: null,
      firstDeceptiveDecisionStep: null,
      deceptiveDecisionSteps: null,
      deceptiveLosingMovesAlongCertificate: null,
    });
  }

  const pieceIndex = new Map<string, number>(
    pieces.map((piece, index) => [hexKey(piece), index]),
  );
  const fullMask = (1n << BigInt(pieces.length)) - 1n;
  const solvableMemo = new Map<string, boolean>();
  const boardForMask = (mask: bigint): GardenBoard =>
    new GardenBoard(
      pieces.filter(
        (_piece, index) => (mask & (1n << BigInt(index))) !== 0n,
      ),
    );
  const removeMove = (mask: bigint, move: readonly HexCoord[]): bigint => {
    let nextMask = mask;
    for (const piece of move) {
      const index = pieceIndex.get(hexKey(piece));
      if (index === undefined) {
        throw new Error("Certificate piece index is missing");
      }
      nextMask &= ~(1n << BigInt(index));
    }
    return nextMask;
  };
  const isSolvable = (mask: bigint): boolean => {
    const key = mask.toString();
    if (solvableMemo.has(key)) return solvableMemo.get(key) ?? false;
    const board = boardForMask(mask);
    if (board.won) {
      solvableMemo.set(key, true);
      return true;
    }
    const solvable = board
      .legalMoves()
      .some((move) => isSolvable(removeMove(mask, move)));
    solvableMemo.set(key, solvable);
    return solvable;
  };

  let mask = fullMask;
  let firstMixedDecisionStep = null;
  let mixedDecisionSteps = 0;
  let losingMovesAlongCertificate = 0;
  let firstDeceptiveDecisionStep = null;
  let deceptiveDecisionSteps = 0;
  let deceptiveLosingMovesAlongCertificate = 0;

  solution.forEach((certificateMove, step) => {
    const legalMoves = boardForMask(mask).legalMoves();
    const winningMoveCount = legalMoves.filter((move) =>
      isSolvable(removeMove(mask, move)),
    ).length;
    const losingMoveCount = legalMoves.length - winningMoveCount;
    if (winningMoveCount > 0 && losingMoveCount > 0) {
      firstMixedDecisionStep ??= step + 1;
      mixedDecisionSteps += 1;
      losingMovesAlongCertificate += losingMoveCount;
    }
    const movesBySignature = new Map<
      string,
      { winning: number; losing: number }
    >();
    for (const move of legalMoves) {
      const signature = moveTypeSignature(move);
      const state = movesBySignature.get(signature) ?? {
        winning: 0,
        losing: 0,
      };
      if (isSolvable(removeMove(mask, move))) state.winning += 1;
      else state.losing += 1;
      movesBySignature.set(signature, state);
    }
    const deceptiveLosingMoveCount = [...movesBySignature.values()]
      .filter((state) => state.winning > 0 && state.losing > 0)
      .reduce((sum, state) => sum + state.losing, 0);
    if (deceptiveLosingMoveCount > 0) {
      firstDeceptiveDecisionStep ??= step + 1;
      deceptiveDecisionSteps += 1;
      deceptiveLosingMovesAlongCertificate += deceptiveLosingMoveCount;
    }
    mask = removeMove(mask, certificateMove);
  });

  return Object.freeze({
    firstMixedDecisionStep,
    mixedDecisionSteps,
    losingMovesAlongCertificate,
    firstDeceptiveDecisionStep,
    deceptiveDecisionSteps,
    deceptiveLosingMovesAlongCertificate,
  });
}

/**
 * Sample how many removals a risky branch survives before its failure becomes
 * visible to the player. Depth includes the risky alternative itself, so an
 * alternative that immediately produces a visible dead end has depth 1.
 */
function sampledDeadEndDepths(
  start: GardenBoard,
  seed: string,
  {
    samples = 8,
    maxDepth = 12,
  }: { samples?: number; maxDepth?: number } = {},
): number[] {
  const depths: number[] = [];
  if (maxDepth < 1) return depths;

  for (let sample = 0; sample < samples; sample += 1) {
    const random = createSeededRandom(`${seed}:depth:${sample}`);
    const board = start.clone();

    if (!board.won && board.legalMoves().length === 0) {
      depths.push(1);
      continue;
    }

    // The risky alternative is depth 1. Each continuation removal advances
    // the visible consequence depth by one, capped at maxDepth total.
    for (let depth = 2; depth <= maxDepth; depth += 1) {
      const moves = board.legalMoves();
      if (moves.length === 0) break;
      const move = moves[Math.floor(random() * moves.length)];
      if (!move) break;
      applyMove(board, move);
      if (board.won) break;
      if (board.legalMoves().length === 0) {
        depths.push(depth);
        break;
      }
    }
  }

  return depths;
}

function analyzeEarlyDecisionConsequences(
  pieces: readonly BoardPiece[],
  solution: readonly (readonly HexCoord[])[],
  sampleSeed: string,
) {
  const board = new GardenBoard(pieces);
  const analyzedSteps = Math.min(10, solution.length);
  let choiceSteps = 0;
  let alternativesAnalyzed = 0;
  let riskyAlternativeMoves = 0;
  let riskyDecisionSteps = 0;
  let deceptiveRiskyMoves = 0;
  let deceptiveDecisionSteps = 0;
  let firstRiskyDecisionStep: number | null = null;
  let firstDeceptiveRiskStep: number | null = null;
  const consequenceDepths: number[] = [];

  for (let step = 0; step < analyzedSteps; step += 1) {
    const legalMoves = board.legalMoves();
    const certificatePositions = solution[step];
    if (!certificatePositions) break;
    const certifiedMove = certificatePositions
      .map((position) => board.pieceAt(position))
      .filter((piece): piece is BoardPiece => piece !== undefined);
    const certifiedPositionSignature = movePositionSignature(certifiedMove);
    const certifiedTypeSignature = moveTypeSignature(certifiedMove);
    const alternatives = legalMoves
      .filter(
        (move) => movePositionSignature(move) !== certifiedPositionSignature,
      )
      .sort((left, right) =>
        movePositionSignature(left).localeCompare(movePositionSignature(right)),
      )
      .slice(0, 6);

    if (alternatives.length > 0) choiceSteps += 1;
    let stepHasRisk = false;
    let stepHasDeceptiveRisk = false;
    for (const alternative of alternatives) {
      const branch = board.clone();
      applyMove(branch, alternative);
      const signature = movePositionSignature(alternative);
      const winProbability = rolloutWinProbability(
        branch,
        `branch:${step}:${signature}:${pieces.length}`,
        6,
      );
      alternativesAnalyzed += 1;
      if (winProbability > 0.25) continue;

      riskyAlternativeMoves += 1;
      stepHasRisk = true;
      consequenceDepths.push(
        ...sampledDeadEndDepths(
          branch,
          `${sampleSeed}:branch:${step}:${signature}:${pieces.length}`,
        ),
      );
      if (moveTypeSignature(alternative) === certifiedTypeSignature) {
        deceptiveRiskyMoves += 1;
        stepHasDeceptiveRisk = true;
      }
    }
    if (stepHasRisk) {
      firstRiskyDecisionStep ??= step + 1;
      riskyDecisionSteps += 1;
    }
    if (stepHasDeceptiveRisk) {
      firstDeceptiveRiskStep ??= step + 1;
      deceptiveDecisionSteps += 1;
    }
    applyMove(board, certificatePositions);
  }

  const orderedDepths = [...consequenceDepths].sort(
    (left, right) => left - right,
  );
  let consequenceDepthMedian: number | null = null;
  let consequenceDepthMax: number | null = null;
  if (orderedDepths.length > 0) {
    const middle = Math.floor(orderedDepths.length / 2);
    if (orderedDepths.length % 2 === 0) {
      const lower = orderedDepths[middle - 1];
      const upper = orderedDepths[middle];
      if (lower !== undefined && upper !== undefined) {
        consequenceDepthMedian = (lower + upper) / 2;
      }
    } else {
      consequenceDepthMedian = orderedDepths[middle] ?? null;
    }
    consequenceDepthMax = orderedDepths[orderedDepths.length - 1] ?? null;
  }

  return Object.freeze({
    earlyDecisionStepsAnalyzed: analyzedSteps,
    earlyChoiceSteps: choiceSteps,
    earlyAlternativeMovesAnalyzed: alternativesAnalyzed,
    earlyRiskyAlternativeMoves: riskyAlternativeMoves,
    earlyRiskyDecisionSteps: riskyDecisionSteps,
    firstRiskyDecisionStep,
    earlyDeceptiveRiskyMoves: deceptiveRiskyMoves,
    earlyDeceptiveDecisionSteps: deceptiveDecisionSteps,
    firstDeceptiveRiskStep,
    consequenceDepthSamples: orderedDepths.length,
    consequenceDepthMedian,
    consequenceDepthMax,
  });
}

export function analyzePuzzleDifficulty(
  input: Readonly<DifficultyInput>,
): Readonly<DifficultyMetrics> {
  const board = new GardenBoard(input.pieces);
  const snapshots: Array<{
    freeCount: number;
    legalMoveCount: number;
    meaningfulMoveCount: number;
  }> = [];

  for (const move of input.solution) {
    const freeCount = board
      .pieces()
      .filter((piece) => board.isFree(piece)).length;
    const legalMoves = board.legalMoves();
    snapshots.push({
      freeCount,
      legalMoveCount: legalMoves.length,
      meaningfulMoveCount: new Set(legalMoves.map(moveTypeSignature)).size,
    });
    applyMove(board, move);
  }

  const legalCounts = snapshots.map(({ legalMoveCount }) => legalMoveCount);
  const freeCounts = snapshots.map(({ freeCount }) => freeCount);
  const meaningfulCounts = snapshots.map(
    ({ meaningfulMoveCount }) => meaningfulMoveCount,
  );
  const routeAnalysis = analyzeReachableRoutes(input.pieces);
  const decisionPressure = analyzeCertificateDecisionPressure(
    input.pieces,
    input.solution,
  );
  const earlyConsequences = analyzeEarlyDecisionConsequences(
    input.pieces,
    input.solution,
    input.sampleSeed,
  );
  const average = (values: readonly number[]): number =>
    values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  const minimum = (values: readonly number[]): number =>
    values.length === 0 ? 0 : Math.min(...values);
  const maximum = (values: readonly number[]): number =>
    values.length === 0 ? 0 : Math.max(...values);

  return Object.freeze({
    pieceCount: input.pieces.length,
    moveCount: input.solution.length,
    plateFill:
      input.plateCells.length === 0
        ? 0
        : input.pieces.length / input.plateCells.length,
    initialFreeCount: freeCounts[0] ?? 0,
    initialLegalMoveCount: legalCounts[0] ?? 0,
    minimumLegalMoveCount: minimum(legalCounts),
    maximumLegalMoveCount: maximum(legalCounts),
    averageLegalMoveCount: average(legalCounts),
    forcedCertificateSteps: legalCounts.filter((count) => count === 1).length,
    initialMeaningfulMoveCount: meaningfulCounts[0] ?? 0,
    minimumMeaningfulMoveCount: minimum(meaningfulCounts),
    maximumMeaningfulMoveCount: maximum(meaningfulCounts),
    averageMeaningfulMoveCount: average(meaningfulCounts),
    sampledRouteWinProbability: sampleRouteWinProbability(input.pieces, 32),
    ...decisionPressure,
    ...routeAnalysis,
    ...earlyConsequences,
  });
}
