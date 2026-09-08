import { Atom, ELEMENT_TYPES, type AtomType } from "./atom-types.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import { analyzePuzzleDifficulty } from "./difficulty.js";
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
  const generic = analyzePuzzleDifficulty({
    pieces: record.pieces,
    solution: record.solution,
    plateCells: record.plateCells,
    sampleSeed: record.seed,
  });
  const metrics = {
    tier: record.definition.chapterNumber,
    ...generic,
    // Preserve the precomputed value used by candidate preview/ranking while
    // the legacy progression generator still exists. The generic analyzer
    // computes the same deterministic route sample for direct consumers.
    sampledRouteWinProbability:
      record.sampledRouteWinProbability ?? generic.sampledRouteWinProbability,
  };
  const challengeScore = challengeScoreForMetrics(metrics, record.definition);
  return Object.freeze({
    ...metrics,
    challengeScore,
    challengeQualified:
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
