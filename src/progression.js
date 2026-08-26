import { Atom, ELEMENT_TYPES } from "./atom-types.js";
import { GardenBoard } from "./board.js";
import {
  BoardVariant,
  createSeededRandom,
  generateSolvableBoard,
  replaySolution,
} from "./generator.js";
import {
  ADJACENT_OFFSETS,
  BOARD_CENTER,
  addHex,
  enumerateHexPlate,
  hexDistance,
  hexKey,
} from "./hex.js";

export const PROGRESSION_LEVEL_COUNT = 60;
export const DEFAULT_PROGRESSION_SEED = "garden-progression-v1";

export const ProgressionChapter = Object.freeze({
  ELEMENTS: "elements",
  SALT: "salt",
  OPPOSITES: "opposites",
  METALS: "metals",
  FULL_GARDEN: "full-garden",
  QUINTESSENCE: "quintessence",
});

const CHAPTERS = Object.freeze([
  Object.freeze({
    id: ProgressionChapter.ELEMENTS,
    start: 0,
    end: 7,
    plateRadius: 3,
  }),
  Object.freeze({
    id: ProgressionChapter.SALT,
    start: 8,
    end: 15,
    plateRadius: 3,
  }),
  Object.freeze({
    id: ProgressionChapter.OPPOSITES,
    start: 16,
    end: 25,
    plateRadius: 4,
  }),
  Object.freeze({
    id: ProgressionChapter.METALS,
    start: 26,
    end: 37,
    plateRadius: 4,
  }),
  Object.freeze({
    id: ProgressionChapter.FULL_GARDEN,
    start: 38,
    end: 49,
    plateRadius: 5,
  }),
  Object.freeze({
    id: ProgressionChapter.QUINTESSENCE,
    start: 50,
    end: 59,
    plateRadius: 5,
  }),
]);

const METAL_CHAIN = Object.freeze([
  Atom.LEAD,
  Atom.TIN,
  Atom.IRON,
  Atom.COPPER,
  Atom.SILVER,
  Atom.GOLD,
]);

function assertProgressionLevel(level) {
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

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function pair(first, second = first) {
  return [first, second];
}

function cycleElementPairs(count, elementCount, offset = 0) {
  const available = ELEMENT_TYPES.slice(0, elementCount);
  return Array.from({ length: count }, (_, index) =>
    pair(available[(index + offset) % available.length]),
  );
}

function findChapter(level) {
  return CHAPTERS.find((chapter) => level >= chapter.start && level <= chapter.end);
}

export function getProgressionLevelDefinition(level) {
  assertProgressionLevel(level);
  const chapter = findChapter(level);
  const chapterIndex = CHAPTERS.indexOf(chapter);
  const index = level - chapter.start;
  const definition = {
    level,
    chapter: chapter.id,
    chapterNumber: chapterIndex + 1,
    chapterLevel: index,
    plateRadius: chapter.plateRadius,
    plateCellCount: 1 + 3 * chapter.plateRadius * (chapter.plateRadius + 1),
    variant: BoardVariant.STANDARD,
    mechanics: ["elements"],
    metalDepth: 0,
    fullComposition: false,
  };

  if (chapter.id === ProgressionChapter.ELEMENTS) {
    definition.elementCount = Math.min(4, 1 + Math.floor(index / 2));
    definition.ordinaryMoveCount = 6 + index;
  } else if (chapter.id === ProgressionChapter.SALT) {
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 11 + Math.floor((index * 4) / 7);
    definition.saltPairCount = 1 + Math.floor(index / 4);
    definition.mechanics.push("salt");
  } else if (chapter.id === ProgressionChapter.OPPOSITES) {
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 16 + Math.floor((index * 5) / 9);
    definition.saltPairCount = 2;
    definition.oppositePairCount = 1 + Math.floor(index / 3);
    definition.mechanics.push("salt", "opposites");
  } else if (chapter.id === ProgressionChapter.METALS) {
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 14 + Math.floor(index / 2);
    definition.saltPairCount = 2;
    definition.oppositePairCount = 2;
    definition.metalDepth = Math.min(6, 1 + Math.floor(index / 2));
    definition.mechanics.push("salt", "opposites", "quicksilver", "metal-chain");
    if (definition.metalDepth === 6) definition.mechanics.push("gold");
  } else if (chapter.id === ProgressionChapter.FULL_GARDEN) {
    definition.elementCount = 4;
    definition.metalDepth = 6;
    definition.fullComposition = true;
    definition.mechanics.push(
      "salt",
      "opposites",
      "quicksilver",
      "metal-chain",
      "gold",
    );
  } else {
    definition.elementCount = 4;
    definition.metalDepth = 6;
    definition.variant = BoardVariant.QUINTESSENCE;
    definition.fullComposition = index >= 4;
    definition.quintessenceGroupCount = index < 2 ? 1 : 2;
    definition.ordinaryMoveCount = 12 + Math.min(index, 3);
    definition.saltPairCount = 2;
    definition.oppositePairCount = 2;
    definition.mechanics.push(
      "salt",
      "opposites",
      "quicksilver",
      "metal-chain",
      "gold",
      "quintessence",
    );
  }

  return Object.freeze({
    ...definition,
    mechanics: Object.freeze([...definition.mechanics]),
  });
}

function createOrdinarySpecs(definition, random) {
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
    oppositeSpecs.length -
    quintessenceSpecs.length;

  if (elementPairCount < 0) throw new Error("Invalid progression composition");
  return shuffle(
    [
      ...saltSpecs,
      ...oppositeSpecs,
      ...quintessenceSpecs,
      ...cycleElementPairs(elementPairCount, 4, definition.level),
    ],
    random,
  );
}

function interleaveMetalSpecs(ordinarySpecs, metalDepth) {
  if (metalDepth === 0) return ordinarySpecs;
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

function hasThreeEmptyNeighbours(position, occupied) {
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

function geometricFreePositions(positions) {
  const occupied = new Set(positions.map(hexKey));
  return positions.filter((position) =>
    hasThreeEmptyNeighbours(position, occupied),
  );
}

function growConnectedMask(plateCells, count, random) {
  const plateByKey = new Map(plateCells.map((cell) => [hexKey(cell), cell]));
  const selected = new Map([[hexKey(BOARD_CENTER), { ...BOARD_CENTER }]]);

  while (selected.size < count) {
    const candidates = new Map();
    for (const cell of selected.values()) {
      for (const offset of ADJACENT_OFFSETS) {
        const neighbour = addHex(cell, offset);
        const key = hexKey(neighbour);
        if (!selected.has(key) && plateByKey.has(key)) {
          candidates.set(key, plateByKey.get(key));
        }
      }
    }
    if (candidates.size === 0) throw new Error("Could not grow progression mask");

    const ranked = [...candidates.values()]
      .map((cell) => {
        const adjacentSelected = ADJACENT_OFFSETS.filter((offset) =>
          selected.has(hexKey(addHex(cell, offset))),
        ).length;
        const radiusBias = hexDistance(cell, BOARD_CENTER) * 0.28;
        return {
          cell,
          score: adjacentSelected * 1.4 - radiusBias + random() * 3.2,
        };
      })
      .sort((left, right) => right.score - left.score);
    const choiceWindow = Math.min(ranked.length, 3 + Math.floor(count / 15));
    const chosen = ranked[Math.floor(random() * choiceWindow)].cell;
    selected.set(hexKey(chosen), { ...chosen });
  }

  return [...selected.values()];
}

function chooseMovePositions(free, count, random) {
  return free
    .map((cell) => ({
      cell,
      score: hexDistance(cell, BOARD_CENTER) * 10 + random() * 20,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, count)
    .map(({ cell }) => cell);
}

function assignSchedule(mask, moveSpecs, random) {
  const centerKey = hexKey(BOARD_CENTER);
  const hasGold = moveSpecs.some(
    (types) => types.length === 1 && types[0] === Atom.GOLD,
  );
  const remaining = new Map(mask.map((cell) => [hexKey(cell), cell]));
  const pieces = [];
  const solution = [];

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
    const move = [];
    positions.forEach((position, index) => {
      remaining.delete(hexKey(position));
      pieces.push({ ...position, type: types[index] });
      move.push({ ...position });
    });
    solution.push(move);
  }

  if (remaining.size !== 0) return undefined;
  return { pieces, solution };
}

function applyMove(board, move) {
  let result;
  for (const position of move) result = board.select(position);
  if (result?.kind !== "removed") {
    throw new Error("Difficulty analysis encountered an invalid certificate");
  }
}

export function analyzeProgressionDifficulty(record) {
  const board = new GardenBoard(record.pieces);
  const snapshots = [];

  for (const move of record.solution) {
    const freeCount = board.pieces().filter((piece) => board.isFree(piece)).length;
    const legalMoveCount = board.legalMoves().length;
    snapshots.push({ freeCount, legalMoveCount });
    applyMove(board, move);
  }

  const legalCounts = snapshots.map(({ legalMoveCount }) => legalMoveCount);
  const freeCounts = snapshots.map(({ freeCount }) => freeCount);
  return Object.freeze({
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
  });
}

function generateCustomProgressionBoard(definition, random) {
  const ordinarySpecs = createOrdinarySpecs(definition, random);
  const moveSpecs = interleaveMetalSpecs(ordinarySpecs, definition.metalDepth);
  const pieceCount = moveSpecs.reduce((sum, move) => sum + move.length, 0);
  const plateCells = enumerateHexPlate(definition.plateRadius);

  if (pieceCount > plateCells.length) {
    throw new Error(
      `Level ${definition.level + 1} needs ${pieceCount} cells on a ${plateCells.length}-cell plate`,
    );
  }

  for (let maskAttempt = 0; maskAttempt < 300; maskAttempt += 1) {
    const mask = growConnectedMask(plateCells, pieceCount, random);
    for (let placementAttempt = 0; placementAttempt < 120; placementAttempt += 1) {
      const result = assignSchedule(mask, moveSpecs, random);
      if (!result) continue;
      replaySolution(result.pieces, result.solution);
      return {
        variant: definition.variant,
        shape: `campaign-r${definition.plateRadius}`,
        plateRadius: definition.plateRadius,
        plateCells,
        ...result,
        board: new GardenBoard(result.pieces),
      };
    }
  }

  throw new Error(`Could not construct progression level ${definition.level + 1}`);
}

export function generateProgressionLevel(
  level,
  { campaignSeed = DEFAULT_PROGRESSION_SEED } = {},
) {
  const definition = getProgressionLevelDefinition(level);
  const seed = `${campaignSeed}:progression:${level}`;
  const random = createSeededRandom(seed);
  let generated;

  if (definition.fullComposition) {
    generated = generateSolvableBoard({
      random,
      variant: definition.variant,
    });
    generated = {
      ...generated,
      plateRadius: definition.plateRadius,
      plateCells: enumerateHexPlate(definition.plateRadius),
    };
  } else {
    generated = generateCustomProgressionBoard(definition, random);
  }

  const record = {
    level,
    seed,
    definition,
    ...generated,
  };
  return {
    ...record,
    difficulty: analyzeProgressionDifficulty(record),
  };
}
