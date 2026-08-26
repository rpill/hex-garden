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
    // Teach the matching rule quickly, then spend the rest of the chapter on
    // spatial decisions. Repeating each newly introduced element for two
    // whole levels made the opening feel like mechanical pair clicking.
    definition.elementCount = Math.min(4, 1 + index);
    definition.ordinaryMoveCount =
      index < 4 ? 4 + index * 2 : 12;
  } else if (chapter.id === ProgressionChapter.SALT) {
    // The player already knows all four elements. Salt should create planning
    // pressure immediately instead of restarting the chapter as a tutorial.
    definition.elementCount = 4;
    definition.ordinaryMoveCount = 12 + Math.min(index, 4);
    definition.saltElementPairCount = 1 + Math.min(index, 3);
    definition.saltPairCount =
      index < 2 ? 0 : 1 + Math.floor((index - 2) / 3);
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

function moveTypeSignature(move) {
  return move
    .map((piece) => piece.type)
    .sort((left, right) => left - right)
    .join("+");
}

function analyzeReachableRoutes(pieces) {
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

  const pieceIndex = new Map(
    pieces.map((piece, index) => [hexKey(piece), index]),
  );
  const fullMask = (1n << BigInt(pieces.length)) - 1n;
  const memo = new Map();

  const visit = (mask) => {
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
        nextMask &= ~(1n << BigInt(index));
      }
      return visit(nextMask);
    });
    const deadEndDistances = children
      .filter((child) => child.shortestDeadEndMove !== null)
      .map((child) => child.shortestDeadEndMove + 1);
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

function sampleRouteWinProbability(pieces, trials = 32) {
  const sampleSeed = pieces
    .map((piece) => `${piece.q},${piece.r},${piece.type}`)
    .sort()
    .join("|");
  const random = createSeededRandom(`route-sample:${sampleSeed}`);
  let wins = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const board = new GardenBoard(pieces);
    while (!board.won) {
      const legalMoves = board.legalMoves();
      if (legalMoves.length === 0) break;
      const move = legalMoves[Math.floor(random() * legalMoves.length)];
      applyMove(board, move);
    }
    if (board.won) wins += 1;
  }

  return wins / trials;
}

function candidateChoicePressure(candidate) {
  const board = new GardenBoard(candidate.pieces);
  const sampleLength = Math.max(
    1,
    Math.ceil(candidate.solution.length * 0.7),
  );
  const meaningfulCounts = [];

  for (const move of candidate.solution.slice(0, sampleLength)) {
    meaningfulCounts.push(
      new Set(board.legalMoves().map(moveTypeSignature)).size,
    );
    applyMove(board, move);
  }

  return {
    initial: meaningfulCounts[0] ?? 0,
    average:
      meaningfulCounts.reduce((sum, count) => sum + count, 0) /
      meaningfulCounts.length,
  };
}

function scoreOnboardingCandidate(candidate) {
  const pressure = candidateChoicePressure(candidate);
  return (
    (1 - candidate.sampledRouteWinProbability) * 100 +
    pressure.initial * 2 +
    pressure.average
  );
}

function selectOnboardingCandidate(candidates) {
  const shortlisted = candidates
    .map((candidate) => ({
      candidate,
      score: scoreOnboardingCandidate(candidate),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  return shortlisted
    .map(({ candidate, score }) => ({
      candidate,
      score,
      exactWinProbability: analyzeReachableRoutes(candidate.pieces)
        .randomRouteWinProbability,
    }))
    .sort(
      (left, right) =>
        left.exactWinProbability - right.exactWinProbability ||
        right.score - left.score,
    )[0].candidate;
}

export function analyzeProgressionDifficulty(record) {
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
    initialMeaningfulMoveCount: meaningfulCounts[0] ?? 0,
    minimumMeaningfulMoveCount: Math.min(...meaningfulCounts),
    maximumMeaningfulMoveCount: Math.max(...meaningfulCounts),
    averageMeaningfulMoveCount:
      meaningfulCounts.reduce((sum, count) => sum + count, 0) /
      meaningfulCounts.length,
    sampledRouteWinProbability:
      record.sampledRouteWinProbability ??
      routeAnalysis.randomRouteWinProbability,
    ...routeAnalysis,
  });
}

function generateCustomProgressionBoard(definition, random) {
  const ordinarySpecs = createOrdinarySpecs(definition, random);
  const moveSpecs = interleaveMetalSpecs(ordinarySpecs, definition.metalDepth);
  const pieceCount = moveSpecs.reduce((sum, move) => sum + move.length, 0);
  const plateCells = enumerateHexPlate(definition.plateRadius);
  const chooseChallengingOnboarding =
    definition.chapter === ProgressionChapter.ELEMENTS &&
    definition.chapterLevel >= 4;
  const candidateTarget = chooseChallengingOnboarding ? 48 : 1;
  const candidates = [];

  if (pieceCount > plateCells.length) {
    throw new Error(
      `Level ${definition.level + 1} needs ${pieceCount} cells on a ${plateCells.length}-cell plate`,
    );
  }

  for (let maskAttempt = 0; maskAttempt < 300; maskAttempt += 1) {
    const mask = growConnectedMask(plateCells, pieceCount, random);
    let candidatesFromMask = 0;
    for (let placementAttempt = 0; placementAttempt < 120; placementAttempt += 1) {
      const result = assignSchedule(mask, moveSpecs, random);
      if (!result) continue;
      replaySolution(result.pieces, result.solution);
      const candidate = {
        ...result,
        sampledRouteWinProbability: sampleRouteWinProbability(result.pieces),
      };
      candidates.push(candidate);
      candidatesFromMask += 1;

      if (candidates.length >= candidateTarget) {
        const selected = chooseChallengingOnboarding
          ? selectOnboardingCandidate(candidates)
          : candidate;
        return {
          variant: definition.variant,
          shape: `campaign-r${definition.plateRadius}`,
          plateRadius: definition.plateRadius,
          plateCells,
          ...selected,
          board: new GardenBoard(selected.pieces),
        };
      }
      if (chooseChallengingOnboarding && candidatesFromMask >= 4) break;
    }
  }

  if (candidates.length > 0) {
    const selected = selectOnboardingCandidate(candidates);
    return {
      variant: definition.variant,
      shape: `campaign-r${definition.plateRadius}`,
      plateRadius: definition.plateRadius,
      plateCells,
      ...selected,
      board: new GardenBoard(selected.pieces),
    };
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
