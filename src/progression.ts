import { Atom, ELEMENT_TYPES, type AtomType } from "./atom-types.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import {
  BoardVariant,
  createSeededRandom,
  generateSolvableBoard,
  replaySolution,
  type BoardVariantValue,
  type RandomSource,
  type Solution,
} from "./generator.js";
import {
  ADJACENT_OFFSETS,
  BOARD_CENTER,
  addHex,
  enumerateHexPlate,
  hexDistance,
  hexKey,
  rotateHexAround,
  type HexCoord,
} from "./hex.js";
import {
  CURATED_CAMPAIGN_OPENINGS,
  CURATED_OPENING_LEVELS,
} from "./opening-levels.js";

// Campaign length follows the amount of tested puzzle content. Endless modes
// remain available after the authored progression; we do not pad the campaign
// to an arbitrary product number with near-duplicate boards.
export const PROGRESSION_LEVEL_COUNT = 24;
export const DEFAULT_PROGRESSION_SEED = "garden-progression-v1";

export const ProgressionChapter = Object.freeze({
  ELEMENTS: "elements",
  SALT: "salt",
  OPPOSITES: "opposites",
  METALS: "metals",
  FULL_GARDEN: "full-garden",
  QUINTESSENCE: "quintessence",
});

export type ProgressionChapterValue = (typeof ProgressionChapter)[keyof typeof ProgressionChapter];
type MaskFamily = "compact" | "wide" | "diagonal" | "branches" | "hollow";
type MoveSpec = AtomType[];

export interface ProgressionLevelDefinition {
  level: number;
  chapter: ProgressionChapterValue;
  chapterNumber: number;
  chapterLevel: number;
  plateRadius: number;
  plateCellCount: number;
  variant: BoardVariantValue;
  mechanics: readonly string[];
  metalDepth: number;
  fullComposition: boolean;
  elementCount: number;
  ordinaryMoveCount: number;
  saltElementPairCount?: number;
  saltPairCount?: number;
  oppositePairCount?: number;
  quintessenceGroupCount?: number;
}

type MutableProgressionDefinition = Omit<ProgressionLevelDefinition, "mechanics" | "elementCount" | "ordinaryMoveCount"> & {
  mechanics: string[];
  elementCount?: number;
  ordinaryMoveCount?: number;
};

interface GeneratedProgressionBoard {
  variant: BoardVariantValue;
  shape: string;
  plateRadius: number;
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  board: GardenBoard;
}

interface ProgressionRecord extends GeneratedProgressionBoard {
  level: number;
  seed: string;
  candidateIndex: number;
  definition: Readonly<ProgressionLevelDefinition>;
  sampledRouteWinProbability: number;
}

interface RouteState {
  deadEnd: boolean;
  shortestDeadEndMove: number | null;
  winProbability: number;
}

interface ChallengeMetricInput {
  sampledRouteWinProbability: number | null;
  earlyChoiceSteps: number;
  earlyRiskyDecisionSteps: number;
  earlyDeceptiveDecisionSteps: number;
  initialLegalMoveCount: number;
}

const CHAPTERS = Object.freeze([
  Object.freeze({
    id: ProgressionChapter.ELEMENTS,
    start: 0,
    end: 0,
  }),
  Object.freeze({
    id: ProgressionChapter.SALT,
    start: 1,
    end: 1,
  }),
  Object.freeze({
    id: ProgressionChapter.OPPOSITES,
    start: 2,
    end: 2,
  }),
  Object.freeze({
    id: ProgressionChapter.METALS,
    start: 3,
    end: 8,
  }),
  Object.freeze({
    id: ProgressionChapter.FULL_GARDEN,
    start: 9,
    end: PROGRESSION_LEVEL_COUNT - 1,
  }),
]);

const CAMPAIGN_MASK_FAMILIES = Object.freeze([
  "compact",
  "wide",
  "diagonal",
  "branches",
  "hollow",
] as const satisfies readonly MaskFamily[]);

const METAL_CHAIN = Object.freeze([
  Atom.LEAD,
  Atom.TIN,
  Atom.IRON,
  Atom.COPPER,
  Atom.SILVER,
  Atom.GOLD,
]);

function assertProgressionLevel(level: number): void {
  if (
    !Number.isSafeInteger(level) ||
    level < 0 ||
    level >= PROGRESSION_LEVEL_COUNT
  ) {
    throw new RangeError(
      `level must be an integer from 0 to ${PROGRESSION_LEVEL_COUNT - 1}`,
    );
  }
}

function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    const swap = result[swapIndex];
    if (current !== undefined && swap !== undefined) {
      result[index] = swap;
      result[swapIndex] = current;
    }
  }
  return result;
}

function pair(first: AtomType, second: AtomType = first): MoveSpec {
  return [first, second];
}

function cycleElementPairs(count: number, elementCount: number, offset = 0): MoveSpec[] {
  const available = ELEMENT_TYPES.slice(0, elementCount);
  if (available.length === 0) throw new Error("At least one element type is required");
  return Array.from({ length: count }, (_, index) => {
    const type = available[(index + offset) % available.length];
    if (type === undefined) throw new Error("Element cycle index is invalid");
    return pair(type);
  });
}

function findChapter(level: number): (typeof CHAPTERS)[number] | undefined {
  return CHAPTERS.find((chapter) => level >= chapter.start && level <= chapter.end);
}

function plateRadiusForLevel(level: number): number {
  if (level < 9) return 3;
  if (level < 16) return 4;
  return 5;
}

export function getProgressionLevelDefinition(level: number): Readonly<ProgressionLevelDefinition> {
  assertProgressionLevel(level);
  const chapter = findChapter(level);
  if (!chapter) throw new Error(`No progression chapter for level ${level + 1}`);
  const chapterIndex = CHAPTERS.indexOf(chapter);
  const index = level - chapter.start;
  const plateRadius = plateRadiusForLevel(level);
  const definition: MutableProgressionDefinition = {
    level,
    chapter: chapter.id,
    chapterNumber: chapterIndex + 1,
    chapterLevel: index,
    plateRadius,
    plateCellCount: 1 + 3 * plateRadius * (plateRadius + 1),
    variant: BoardVariant.STANDARD,
    mechanics: ["elements"],
    metalDepth: 0,
    fullComposition: false,
  };

  if (chapter.id === ProgressionChapter.ELEMENTS) {
    // The separate interactive tutorial teaches matching and geometric
    // freedom. Campaign level 1 can therefore start with the complete element
    // vocabulary and focus immediately on spatial decisions.
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 10;
  } else if (chapter.id === ProgressionChapter.SALT) {
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 10;
    definition.saltElementPairCount = 2;
    definition.saltPairCount = 0;
    definition.mechanics.push("salt");
  } else if (chapter.id === ProgressionChapter.OPPOSITES) {
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 10;
    definition.saltElementPairCount = 1;
    definition.saltPairCount = 1;
    definition.oppositePairCount = 1;
    definition.mechanics.push("salt", "opposites");
  } else if (chapter.id === ProgressionChapter.METALS) {
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 9 + Math.min(index, 2);
    definition.saltElementPairCount = 1;
    definition.saltPairCount = 1;
    definition.oppositePairCount = 1;
    definition.metalDepth = index + 1;
    definition.mechanics.push("salt", "opposites", "quicksilver", "metal-chain");
    if (definition.metalDepth === 6) definition.mechanics.push("gold");
  } else if (chapter.id === ProgressionChapter.FULL_GARDEN) {
    definition.elementCount = 4;
    definition.metalDepth = 6;
    definition.fullComposition = level >= 16;
    definition.ordinaryMoveCount =
      plateRadius === 4 ? 12 + (level - 9) : 22;
    definition.saltElementPairCount = 1;
    definition.saltPairCount = 1;
    definition.oppositePairCount = 2;
    definition.mechanics.push(
      "salt",
      "opposites",
      "quicksilver",
      "metal-chain",
      "gold",
    );
  } else {
    throw new Error(`No progression chapter for level ${level + 1}`);
  }

  if (definition.elementCount === undefined || definition.ordinaryMoveCount === undefined) {
    throw new Error(`Incomplete progression definition for level ${level + 1}`);
  }
  const complete: ProgressionLevelDefinition = {
    ...definition,
    elementCount: definition.elementCount,
    ordinaryMoveCount: definition.ordinaryMoveCount,
    mechanics: Object.freeze([...definition.mechanics]),
  };
  return Object.freeze(complete);
}

function createOrdinarySpecs(definition: Readonly<ProgressionLevelDefinition>, random: RandomSource): MoveSpec[] {
  if (definition.chapter === ProgressionChapter.ELEMENTS) {
    return shuffle(
      cycleElementPairs(
        definition.ordinaryMoveCount,
        definition.elementCount,
        definition.level,
      ),
      random,
    );
  }

  const saltSpecs = Array.from(
    { length: definition.saltPairCount ?? 0 },
    () => pair(Atom.SALT),
  );
  const saltElementSpecs = Array.from(
    { length: definition.saltElementPairCount ?? 0 },
    (_value, index) =>
      pair(
        Atom.SALT,
        ELEMENT_TYPES[(definition.level + index) % definition.elementCount],
      ),
  );
  const oppositeSpecs = Array.from(
    { length: definition.oppositePairCount ?? 0 },
    () => pair(Atom.VITAE, Atom.MORS),
  );
  const quintessenceSpecs = Array.from(
    { length: definition.quintessenceGroupCount ?? 0 },
    () => [Atom.QUINTESSENCE, ...ELEMENT_TYPES],
  );
  const elementPairCount =
    definition.ordinaryMoveCount -
    saltSpecs.length -
    saltElementSpecs.length -
    oppositeSpecs.length -
    quintessenceSpecs.length;

  if (elementPairCount < 0) throw new Error("Invalid progression composition");
  return shuffle(
    [
      ...saltSpecs,
      ...saltElementSpecs,
      ...oppositeSpecs,
      ...quintessenceSpecs,
      ...cycleElementPairs(
        elementPairCount,
        definition.elementCount,
        definition.level,
      ),
    ],
    random,
  );
}

function interleaveMetalSpecs(ordinarySpecs: readonly MoveSpec[], metalDepth: number): MoveSpec[] {
  if (metalDepth === 0) return [...ordinarySpecs];
  const result = [...ordinarySpecs];
  const pairedMetals = METAL_CHAIN.slice(0, Math.min(5, metalDepth));
  let minimumIndex = 0;

  pairedMetals.forEach((metal, index) => {
    const fraction = (index + 1) / (pairedMetals.length + 1);
    const insertionIndex = Math.max(
      minimumIndex,
      Math.min(result.length, Math.round(fraction * result.length)),
    );
    result.splice(insertionIndex, 0, pair(metal, Atom.QUICKSILVER));
    minimumIndex = insertionIndex + 1;
  });

  if (metalDepth === METAL_CHAIN.length) result.push([Atom.GOLD]);
  return result;
}

function hasThreeEmptyNeighbours(position: HexCoord, occupied: ReadonlySet<string>): boolean {
  let run = 0;
  let longest = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const offset of ADJACENT_OFFSETS) {
      if (occupied.has(hexKey(addHex(position, offset)))) run = 0;
      else longest = Math.max(longest, ++run);
    }
  }
  return longest >= 3;
}

function geometricFreePositions(positions: readonly HexCoord[]): HexCoord[] {
  const occupied = new Set(positions.map(hexKey));
  return positions.filter((position) =>
    hasThreeEmptyNeighbours(position, occupied),
  );
}

function growConnectedMask(plateCells: readonly HexCoord[], count: number, random: RandomSource, family: MaskFamily = "compact"): HexCoord[] {
  const plateByKey = new Map(plateCells.map((cell) => [hexKey(cell), cell]));
  const selected = new Map<string, HexCoord>();
  if (family === "hollow") {
    const hole = addHex(BOARD_CENTER, ADJACENT_OFFSETS[0]);
    for (const offset of ADJACENT_OFFSETS) {
      const ringCell = addHex(hole, offset);
      const available = plateByKey.get(hexKey(ringCell));
      if (available) selected.set(hexKey(available), { ...available });
    }
    plateByKey.delete(hexKey(hole));
  } else {
    selected.set(hexKey(BOARD_CENTER), { ...BOARD_CENTER });
  }

  while (selected.size < count) {
    const candidates = new Map<string, HexCoord>();
    for (const cell of selected.values()) {
      for (const offset of ADJACENT_OFFSETS) {
        const neighbour = addHex(cell, offset);
        const key = hexKey(neighbour);
        if (!selected.has(key) && plateByKey.has(key)) {
          const available = plateByKey.get(key);
          if (available) candidates.set(key, available);
        }
      }
    }
    if (candidates.size === 0) throw new Error("Could not grow progression mask");

    const ranked = [...candidates.values()]
      .map((cell) => {
        const adjacentSelected = ADJACENT_OFFSETS.filter((offset) =>
          selected.has(hexKey(addHex(cell, offset))),
        ).length;
        const radius = hexDistance(cell, BOARD_CENTER);
        const q = cell.q - BOARD_CENTER.q;
        const r = cell.r - BOARD_CENTER.r;
        let structureScore = adjacentSelected * 1.4 - radius * 0.28;
        if (family === "wide") {
          structureScore =
            adjacentSelected * 0.9 + Math.abs(q) * 0.75 - Math.abs(r) * 0.32;
        } else if (family === "diagonal") {
          structureScore =
            adjacentSelected * 0.9 + Math.abs(r) * 0.72 - Math.abs(q) * 0.28;
        } else if (family === "branches") {
          structureScore = adjacentSelected * 0.35 + radius * 0.68;
        } else if (family === "hollow") {
          const targetRadius = Math.max(2, Math.ceil(count / 14));
          structureScore =
            adjacentSelected * 0.5 - Math.abs(radius - targetRadius) * 0.9;
        }
        return {
          cell,
          score: structureScore + random() * 3.2,
        };
      })
      .sort((left, right) => right.score - left.score);
    const choiceWindow = Math.min(ranked.length, 3 + Math.floor(count / 15));
    const chosen = ranked[Math.floor(random() * choiceWindow)]?.cell;
    if (!chosen) throw new Error("Could not choose a progression mask cell");
    selected.set(hexKey(chosen), { ...chosen });
  }

  return [...selected.values()];
}

function chooseMovePositions(free: readonly HexCoord[], count: number, random: RandomSource): HexCoord[] {
  return free
    .map((cell) => ({
      cell,
      score: hexDistance(cell, BOARD_CENTER) * 10 + random() * 20,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map(({ cell }) => cell);
}

function assignSchedule(mask: readonly HexCoord[], moveSpecs: readonly MoveSpec[], random: RandomSource): { pieces: BoardPiece[]; solution: Solution } | undefined {
  const centerKey = hexKey(BOARD_CENTER);
  const hasGold = moveSpecs.some(
    (types) => types.length === 1 && types[0] === Atom.GOLD,
  );
  const remaining = new Map(mask.map((cell) => [hexKey(cell), cell]));
  const pieces: BoardPiece[] = [];
  const solution: Solution = [];

  for (const types of moveSpecs) {
    if (types.length === 1 && types[0] === Atom.GOLD) {
      if (remaining.size !== 1 || !remaining.has(centerKey)) return undefined;
      pieces.push({ ...BOARD_CENTER, type: Atom.GOLD });
      solution.push([{ ...BOARD_CENTER }]);
      remaining.delete(centerKey);
      continue;
    }

    const free = geometricFreePositions([...remaining.values()]).filter(
      (cell) => !(hasGold && hexKey(cell) === centerKey),
    );
    if (free.length < types.length) return undefined;
    const positions = chooseMovePositions(free, types.length, random);
    const move: HexCoord[] = [];
    positions.forEach((position, index) => {
      remaining.delete(hexKey(position));
      const type = types[index];
      if (type === undefined) throw new Error("Progression move schedule is incomplete");
      pieces.push({ ...position, type });
      move.push({ ...position });
    });
    solution.push(move);
  }

  if (remaining.size !== 0) return undefined;
  return { pieces, solution };
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

function analyzeReachableRoutes(pieces: readonly BoardPiece[]) {
  // Exact route analysis is intentionally limited to the compact onboarding
  // boards. The full 55-piece chapters have far too many reachable states for
  // this metric to belong on the synchronous generation path.
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
        if (index === undefined) throw new Error("Difficulty piece index is missing");
        nextMask &= ~(1n << BigInt(index));
      }
      return visit(nextMask);
    });
    const deadEndDistances = children.flatMap((child) =>
      child.shortestDeadEndMove === null ? [] : [child.shortestDeadEndMove + 1],
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

function sampleRouteWinProbability(pieces: readonly BoardPiece[], trials = 32): number {
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

function rolloutWinProbability(initialBoard: GardenBoard, seed: string, trials: number): number {
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

function movePositionSignature(move: readonly HexCoord[]): string {
  return move
    .map(hexKey)
    .sort()
    .join("|");
}

function analyzeEarlyDecisionConsequences(pieces: readonly BoardPiece[], solution: readonly (readonly HexCoord[])[]) {
  const board = new GardenBoard(pieces);
  const analyzedSteps = Math.min(10, solution.length);
  let choiceSteps = 0;
  let alternativesAnalyzed = 0;
  let riskyAlternativeMoves = 0;
  let riskyDecisionSteps = 0;
  let deceptiveRiskyMoves = 0;
  let deceptiveDecisionSteps = 0;
  let firstRiskyDecisionStep = null;
  let firstDeceptiveRiskStep = null;

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
  });
}

function previewCandidate(record: ProgressionRecord) {
  const board = new GardenBoard(record.pieces);
  const analyzedSteps = Math.min(10, record.solution.length);
  let choiceSteps = 0;
  let spatialChoiceSteps = 0;
  let totalLegalMoves = 0;

  for (let step = 0; step < analyzedSteps; step += 1) {
    const legalMoves = board.legalMoves();
    const typeSignatures = new Set(legalMoves.map(moveTypeSignature));
    totalLegalMoves += legalMoves.length;
    if (legalMoves.length > 1) choiceSteps += 1;
    if (legalMoves.length > typeSignatures.size) spatialChoiceSteps += 1;
    const certificateMove = record.solution[step];
    if (!certificateMove) break;
    applyMove(board, certificateMove);
  }

  const progress =
    record.definition.level / Math.max(1, PROGRESSION_LEVEL_COUNT - 1);
  const targetWinProbability = 0.58 - progress * 0.38;
  const routeFit = Math.max(
    0,
    1 -
      Math.abs(
        record.sampledRouteWinProbability - targetWinProbability,
      ) /
        0.55,
  );
  const averageLegalMoves = totalLegalMoves / Math.max(1, analyzedSteps);
  const overloadPenalty = Math.max(0, averageLegalMoves - 11) * 2;
  const score = Math.max(
    0,
    Math.round(
      routeFit * 50 +
        Math.min(1, choiceSteps / 6) * 20 +
        Math.min(1, spatialChoiceSteps / 5) * 30 -
        overloadPenalty,
    ),
  );
  return Object.freeze({
    score,
    analyzedSteps,
    choiceSteps,
    spatialChoiceSteps,
    averageLegalMoves,
  });
}

function analyzeCertificateDecisionPressure(pieces: readonly BoardPiece[], solution: readonly (readonly HexCoord[])[]) {
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
      if (index === undefined) throw new Error("Certificate piece index is missing");
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
    const movesBySignature = new Map<string, { winning: number; losing: number }>();
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

function challengeScoreForMetrics(metrics: ChallengeMetricInput, definition: Readonly<ProgressionLevelDefinition>): number {
  const progress = definition.level / Math.max(1, PROGRESSION_LEVEL_COUNT - 1);
  const targetWinProbability = 0.58 - progress * 0.38;
  const winProbability = metrics.sampledRouteWinProbability;
  const routeFit =
    winProbability === null
      ? 0
      : Math.max(0, 1 - Math.abs(winProbability - targetWinProbability) / 0.55);
  const choicePressure = Math.min(1, metrics.earlyChoiceSteps / 6);
  const consequencePressure = Math.min(1, metrics.earlyRiskyDecisionSteps / 4);
  const deceptivePressure = Math.min(1, metrics.earlyDeceptiveDecisionSteps / 3);
  const overloadPenalty = Math.max(0, metrics.initialLegalMoveCount - 12) * 1.5;
  return Math.max(
    0,
    Math.round(
      routeFit * 35 +
        choicePressure * 20 +
        consequencePressure * 30 +
        deceptivePressure * 15 -
        overloadPenalty,
    ),
  );
}

export function analyzeProgressionDifficulty(record: ProgressionRecord) {
  const board = new GardenBoard(record.pieces);
  const snapshots = [];

  for (const move of record.solution) {
    const freeCount = board.pieces().filter((piece) => board.isFree(piece)).length;
    const legalMoves = board.legalMoves();
    const legalMoveCount = legalMoves.length;
    const meaningfulMoveCount = new Set(legalMoves.map(moveTypeSignature)).size;
    snapshots.push({ freeCount, legalMoveCount, meaningfulMoveCount });
    applyMove(board, move);
  }

  const legalCounts = snapshots.map(({ legalMoveCount }) => legalMoveCount);
  const freeCounts = snapshots.map(({ freeCount }) => freeCount);
  const meaningfulCounts = snapshots.map(
    ({ meaningfulMoveCount }) => meaningfulMoveCount,
  );
  const routeAnalysis = analyzeReachableRoutes(record.pieces);
  const decisionPressure = analyzeCertificateDecisionPressure(
    record.pieces,
    record.solution,
  );
  const earlyConsequences = analyzeEarlyDecisionConsequences(
    record.pieces,
    record.solution,
  );
  const metrics = {
    tier: record.definition.chapterNumber,
    pieceCount: record.pieces.length,
    moveCount: record.solution.length,
    plateFill: record.pieces.length / record.plateCells.length,
    initialFreeCount: freeCounts[0] ?? 0,
    initialLegalMoveCount: legalCounts[0] ?? 0,
    minimumLegalMoveCount: Math.min(...legalCounts),
    maximumLegalMoveCount: Math.max(...legalCounts),
    averageLegalMoveCount:
      legalCounts.reduce((sum, count) => sum + count, 0) / legalCounts.length,
    forcedCertificateSteps: legalCounts.filter((count) => count === 1).length,
    initialMeaningfulMoveCount: meaningfulCounts[0] ?? 0,
    minimumMeaningfulMoveCount: Math.min(...meaningfulCounts),
    maximumMeaningfulMoveCount: Math.max(...meaningfulCounts),
    averageMeaningfulMoveCount:
      meaningfulCounts.reduce((sum, count) => sum + count, 0) /
      meaningfulCounts.length,
    sampledRouteWinProbability:
      record.sampledRouteWinProbability ??
      routeAnalysis.randomRouteWinProbability,
    ...decisionPressure,
    ...routeAnalysis,
    ...earlyConsequences,
  };
  const challengeScore = challengeScoreForMetrics(metrics, record.definition);
  return Object.freeze({
    ...metrics,
    challengeScore,
    challengeQualified:
      metrics.sampledRouteWinProbability !== null &&
      metrics.sampledRouteWinProbability >= 0.03 &&
      metrics.sampledRouteWinProbability <= 0.8 &&
      metrics.earlyChoiceSteps >= 3 &&
      metrics.earlyRiskyDecisionSteps >= 1,
  });
}

function generateCuratedOpeningBoard(
  definition: Readonly<ProgressionLevelDefinition>,
  random: RandomSource,
  openingIndex = definition.chapterLevel,
): GeneratedProgressionBoard {
  const opening = CURATED_CAMPAIGN_OPENINGS[openingIndex];
  const template = opening
    ? CURATED_OPENING_LEVELS[opening.templateIndex]
    : undefined;
  if (!opening || !template) {
    throw new Error(`Missing curated opening level ${definition.level + 1}`);
  }

  const authoredTypeByPosition = new Map<string, AtomType>();
  template.solution.forEach((move, index) => {
    for (const position of move) {
      const type = opening.moveTypes[index];
      if (type === undefined) throw new Error("Curated opening move type is missing");
      authoredTypeByPosition.set(hexKey(position), type);
    }
  });
  const turns = Math.floor(random() * 6);
  const activeTypes = ELEMENT_TYPES.slice(0, definition.elementCount);
  const permutedTypes = shuffle(activeTypes, random);
  const typeMap = new Map<AtomType, AtomType>(
    activeTypes.map((type, index): [AtomType, AtomType] => {
      const mapped = permutedTypes[index];
      if (mapped === undefined) throw new Error("Element permutation is incomplete");
      return [type, mapped];
    }),
  );
  const transformPosition = (position: HexCoord): HexCoord =>
    rotateHexAround(position, BOARD_CENTER, turns);
  const pieces: BoardPiece[] = template.pieces.map((item) => {
    const authored = authoredTypeByPosition.get(hexKey(item));
    if (authored === undefined) throw new Error("Curated opening piece type is missing");
    const type = typeMap.get(authored);
    if (type === undefined) throw new Error("Curated opening type permutation is missing");
    return { ...transformPosition(item), type };
  });
  const solution = template.solution.map((certifiedMove) =>
    certifiedMove.map(transformPosition),
  );

  replaySolution(pieces, solution);
  return {
    variant: definition.variant,
    shape: "campaign-r3-curated",
    plateRadius: definition.plateRadius,
    plateCells: enumerateHexPlate(definition.plateRadius),
    pieces,
    solution,
    board: new GardenBoard(pieces),
  };
}

function generateCustomProgressionBoard(definition: Readonly<ProgressionLevelDefinition>, random: RandomSource): GeneratedProgressionBoard {
  const ordinarySpecs = createOrdinarySpecs(definition, random);
  const moveSpecs = interleaveMetalSpecs(ordinarySpecs, definition.metalDepth);
  const pieceCount = moveSpecs.reduce((sum, move) => sum + move.length, 0);
  const plateCells = enumerateHexPlate(definition.plateRadius);
  const family: MaskFamily =
    definition.level < 9
      ? "compact"
      : CAMPAIGN_MASK_FAMILIES[(definition.level - 9) % CAMPAIGN_MASK_FAMILIES.length] ?? "compact";

  if (pieceCount > plateCells.length) {
    throw new Error(
      `Level ${definition.level + 1} needs ${pieceCount} cells on a ${plateCells.length}-cell plate`,
    );
  }

  for (let maskAttempt = 0; maskAttempt < 300; maskAttempt += 1) {
    const mask = growConnectedMask(plateCells, pieceCount, random, family);
    for (let placementAttempt = 0; placementAttempt < 120; placementAttempt += 1) {
      const result = assignSchedule(mask, moveSpecs, random);
      if (!result) continue;
      replaySolution(result.pieces, result.solution);
      const finalized = { ...result };
      return {
        variant: definition.variant,
        shape:
          definition.level < 9
            ? `campaign-r${definition.plateRadius}`
            : `campaign-${family}-r${definition.plateRadius}`,
        plateRadius: definition.plateRadius,
        plateCells:
          definition.level < 9
            ? plateCells
            : mask.map((cell) => ({ ...cell })),
        ...finalized,
        board: new GardenBoard(finalized.pieces),
      };
    }
  }

  throw new Error(`Could not construct progression level ${definition.level + 1}`);
}

export function generateProgressionLevel(
  level: number,
  { campaignSeed = DEFAULT_PROGRESSION_SEED }: { campaignSeed?: string } = {},
) {
  const definition = getProgressionLevelDefinition(level);
  const seed = `${campaignSeed}:progression:${level}`;
  const candidateCount = definition.chapter === ProgressionChapter.ELEMENTS ? 8 : 6;
  const candidates = [];

  for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
    const candidateSeed = `${seed}:candidate:${candidateIndex}`;
    const random = createSeededRandom(candidateSeed);
    let generated;

    if (definition.chapter === ProgressionChapter.ELEMENTS) {
      generated = generateCuratedOpeningBoard(
        definition,
        random,
        candidateIndex % CURATED_CAMPAIGN_OPENINGS.length,
      );
    } else if (definition.fullComposition) {
      generated = generateSolvableBoard({
        random,
        variant: definition.variant,
      });
      generated = {
        ...generated,
        shape: `campaign-${generated.shape}`,
        plateRadius: definition.plateRadius,
        plateCells: generated.pieces.map(({ q, r }) => ({ q, r })),
      };
    } else {
      generated = generateCustomProgressionBoard(definition, random);
    }

    const record = {
      level,
      seed: candidateSeed,
      candidateIndex,
      definition,
      ...generated,
      sampledRouteWinProbability: sampleRouteWinProbability(
        generated.pieces,
        32,
      ),
    };
    candidates.push({
      ...record,
      preview: previewCandidate(record),
    });
  }

  const previewRanked = candidates.sort(
    (left, right) =>
      right.preview.score - left.preview.score ||
      left.candidateIndex - right.candidateIndex,
  );
  const evaluated = [];
  for (const candidate of previewRanked) {
    evaluated.push({
      ...candidate,
      difficulty: analyzeProgressionDifficulty(candidate),
    });
    const qualifiedCount = evaluated.filter(
      (item) => item.difficulty.challengeQualified,
    ).length;
    if (qualifiedCount >= 2 || evaluated.length >= 3) break;
  }
  const qualified = evaluated.filter(
    (candidate) => candidate.difficulty.challengeQualified,
  );
  const ranked = (qualified.length > 0 ? qualified : evaluated).sort(
    (left, right) =>
      right.difficulty.challengeScore - left.difficulty.challengeScore ||
      left.candidateIndex - right.candidateIndex,
  );
  const selected = ranked[0];
  if (!selected) throw new Error(`No progression candidate for level ${level + 1}`);
  return {
    ...selected,
    difficulty: Object.freeze({
      ...selected.difficulty,
      candidatePoolSize: candidates.length,
      evaluatedCandidateCount: evaluated.length,
      qualifiedCandidateCount: qualified.length,
    }),
  };
}
