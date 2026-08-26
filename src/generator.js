import { Atom, ELEMENT_TYPES } from "./atom-types.js";
import { SigmarsGardenBoard } from "./board.js";
import {
  ADJACENT_OFFSETS,
  BOARD_CENTER,
  addHex,
  enumerateBoardCells,
  hexDistance,
  hexKey,
  rotateHexAround,
} from "./hex.js";

export const BoardVariant = Object.freeze({
  STANDARD: "standard",
  QUINTESSENCE: "quintessence",
});

export const BoardShape = Object.freeze({
  SIXFOLD: "sixfold",
  THREEFOLD: "threefold",
  TWOFOLD: "twofold",
  OUTER_RINGS: "outer-rings",
});

function hashSeed(seed) {
  const text = String(seed);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic Mulberry32 PRNG suitable for reproducible board generation. */
export function createSeededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function shuffle(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pair(typeA, typeB = typeA) {
  return [typeA, typeB];
}

function repeatedPairs(count, typeA, typeB = typeA) {
  return Array.from({ length: count }, () => pair(typeA, typeB));
}

function createOrdinaryMoveSpecs(variant, random) {
  if (variant === BoardVariant.STANDARD) {
    return shuffle(
      [
        ...repeatedPairs(4, Atom.VITAE, Atom.MORS),
        ...repeatedPairs(2, Atom.SALT),
        ...ELEMENT_TYPES.flatMap((type) => repeatedPairs(4, type)),
      ],
      random,
    );
  }

  if (variant === BoardVariant.QUINTESSENCE) {
    return shuffle(
      [
        ...repeatedPairs(3, Atom.VITAE, Atom.MORS),
        ...repeatedPairs(2, Atom.SALT),
        ...ELEMENT_TYPES.flatMap((type) => repeatedPairs(3, type)),
        ...Array.from({ length: 2 }, () => [Atom.QUINTESSENCE, ...ELEMENT_TYPES]),
      ],
      random,
    );
  }

  throw new RangeError(`Unknown board variant: ${variant}`);
}

/**
 * A forward solution schedule with the original metal dependency preserved.
 * Silver is the final pair, therefore Gold unlocks only for the final move.
 */
function createMoveSpecs(variant, random) {
  const moves = createOrdinaryMoveSpecs(variant, random);
  const earlyMetals = [Atom.LEAD, Atom.TIN, Atom.IRON, Atom.COPPER];
  let minimumIndex = 0;

  earlyMetals.forEach((metal, index) => {
    const anchor = (index + 0.5) / earlyMetals.length;
    const insertionIndex = Math.max(
      minimumIndex,
      Math.min(
        moves.length,
        Math.round(anchor * moves.length) + randomInteger(random, -1, 1),
      ),
    );
    moves.splice(insertionIndex, 0, pair(metal, Atom.QUICKSILVER));
    minimumIndex = insertionIndex + 1;
  });

  moves.push(pair(Atom.SILVER, Atom.QUICKSILVER));
  moves.push([Atom.GOLD]);
  return moves;
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
  return positions.filter((position) => hasThreeEmptyNeighbours(position, occupied));
}

function buildRotationalOrbits(turns, expectedCount, expectedSize) {
  const seen = new Set([hexKey(BOARD_CENTER)]);
  const orbits = [];
  for (const cell of enumerateBoardCells()) {
    if (seen.has(hexKey(cell))) continue;
    const orbit = [];
    const orbitKeys = new Set();
    for (const turn of turns) {
      const rotated = rotateHexAround(cell, BOARD_CENTER, turn);
      const key = hexKey(rotated);
      if (!orbitKeys.has(key)) orbit.push(rotated);
      orbitKeys.add(key);
      seen.add(key);
    }
    if (orbit.length !== expectedSize) {
      throw new Error(`Expected a ${expectedSize}-cell rotational orbit`);
    }
    orbits.push(Object.freeze(orbit));
  }
  if (orbits.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} rotational board orbits`);
  }
  return Object.freeze(orbits);
}

const SIXFOLD_ORBITS = buildRotationalOrbits([0, 1, 2, 3, 4, 5], 15, 6);
const THREEFOLD_ORBITS = buildRotationalOrbits([0, 2, 4], 30, 3);
const TWOFOLD_ORBITS = buildRotationalOrbits([0, 3], 45, 2);

function weightedOrbitSelection(orbits, random, count, excluded = new Set()) {
  const ringWeights = [0, 1, 2, 1.5, 1.4, 1.1];
  const candidates = orbits.filter((orbit) => !excluded.has(orbit));
  const selected = [];

  while (selected.length < count) {
    const weights = candidates.map(
      (orbit) => ringWeights[hexDistance(orbit[0], BOARD_CENTER)],
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = random() * total;
    let selectedIndex = weights.length - 1;
    for (let index = 0; index < weights.length; index += 1) {
      cursor -= weights[index];
      if (cursor <= 0) {
        selectedIndex = index;
        break;
      }
    }
    selected.push(candidates.splice(selectedIndex, 1)[0]);
  }
  return selected;
}

function createSymmetricMask(orbits, orbitCount, ringOneCount, random) {
  const ringOneOrbits = orbits.filter(
    (orbit) => hexDistance(orbit[0], BOARD_CENTER) === 1,
  );
  const selected = shuffle(ringOneOrbits, random).slice(0, ringOneCount);
  const excluded = new Set(ringOneOrbits);
  selected.push(
    ...weightedOrbitSelection(
      orbits,
      random,
      orbitCount - selected.length,
      excluded,
    ),
  );
  return [{ ...BOARD_CENTER }, ...selected.flatMap((orbit) => orbit.map((cell) => ({ ...cell })))];
}

function pickShape(random) {
  const roll = random();
  if (roll < 0.04408) return BoardShape.OUTER_RINGS;
  if (roll < 0.55484) return BoardShape.SIXFOLD;
  if (roll < 0.95822) return BoardShape.THREEFOLD;
  return BoardShape.TWOFOLD;
}

function pickRingOneCount(shape, random) {
  const roll = random();
  if (shape === BoardShape.SIXFOLD) return roll < 0.6822 ? 1 : 0;
  if (shape === BoardShape.THREEFOLD) {
    if (roll < 0.6572) return 2;
    if (roll < 0.9928) return 1;
    return 0;
  }
  if (shape === BoardShape.TWOFOLD) {
    if (roll < 0.3772) return 3;
    if (roll < 0.7879) return 2;
    if (roll < 0.955) return 1;
    return 0;
  }
  return 0;
}

function createMask(shape, ringOneCount, random) {
  if (shape === BoardShape.OUTER_RINGS) return createOuterRingsMask();
  if (shape === BoardShape.SIXFOLD) {
    return createSymmetricMask(SIXFOLD_ORBITS, 9, ringOneCount, random);
  }
  if (shape === BoardShape.THREEFOLD) {
    return createSymmetricMask(THREEFOLD_ORBITS, 18, ringOneCount, random);
  }
  return createSymmetricMask(TWOFOLD_ORBITS, 27, ringOneCount, random);
}

function createOuterRingsMask() {
  return [
    { ...BOARD_CENTER },
    ...SIXFOLD_ORBITS
      .filter((orbit) => hexDistance(orbit[0], BOARD_CENTER) >= 4)
      .flatMap((orbit) => orbit.map((cell) => ({ ...cell }))),
  ];
}

function radialMaskIsUseful(mask, shape, ringOneCount) {
  if (mask.length !== 55 || new Set(mask.map(hexKey)).size !== 55) return false;
  const free = geometricFreePositions(mask).length;
  const maximumFree =
    shape === BoardShape.SIXFOLD || shape === BoardShape.OUTER_RINGS
      ? 8
      : shape === BoardShape.THREEFOLD && ringOneCount > 0
        ? 10
        : 18;
  return free >= 5 && free <= maximumFree;
}

function chooseMovePositions(free, count, random) {
  return free
    .map((cell) => ({
      cell,
      score: hexDistance(cell, BOARD_CENTER) * 10 + random() * 22,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ cell }) => cell);
}

function tryShellMask(mask, moveSpecs, random) {
  const centerKey = hexKey(BOARD_CENTER);
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
      (cell) => hexKey(cell) !== centerKey,
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

  if (remaining.size !== 0 || pieces.length !== 55) return undefined;
  return { pieces, solution };
}

/** Replay a supplied solution and throw on the first invalid move. */
export function replaySolution(boardOrPieces, solution) {
  const board =
    boardOrPieces instanceof SigmarsGardenBoard
      ? boardOrPieces.clone()
      : new SigmarsGardenBoard(boardOrPieces);

  solution.forEach((move, moveIndex) => {
    let lastResult;
    for (const index of move) {
      lastResult = board.select(index);
      if (lastResult.kind === "locked" || lastResult.kind === "empty") {
        throw new Error(
          `Generated solution failed at move ${moveIndex}: ${lastResult.kind} at ${hexKey(index)}`,
        );
      }
    }
    if (lastResult?.kind !== "removed") {
      throw new Error(`Generated solution failed to remove move ${moveIndex}`);
    }
  });

  if (!board.won) throw new Error(`Generated solution left ${board.size} atoms`);
  return true;
}

/**
 * Build a new rotationally structured mask, assign a fresh certified solution, and
 * verify that solution through the public board API. No original coordinates
 * or original type placement are loaded by the generator.
 */
export function generateSolvableBoard({
  random = Math.random,
  variant = BoardVariant.STANDARD,
  boardAttempts = 1000,
  placementAttempts = 200,
  shape,
} = {}) {
  if (typeof random !== "function") throw new TypeError("random must be a function");
  if (shape !== undefined && !Object.values(BoardShape).includes(shape)) {
    throw new RangeError(`Unknown board shape: ${shape}`);
  }
  const selectedShape = shape ?? pickShape(random);
  const ringOneCount = pickRingOneCount(selectedShape, random);

  for (let boardAttempt = 0; boardAttempt < boardAttempts; boardAttempt += 1) {
    const mask = createMask(selectedShape, ringOneCount, random);
    if (!radialMaskIsUseful(mask, selectedShape, ringOneCount)) continue;

    for (let attempt = 0; attempt < placementAttempts; attempt += 1) {
      const moveSpecs = createMoveSpecs(variant, random);
      const result = tryShellMask(mask, moveSpecs, random);
      if (!result) continue;
      replaySolution(result.pieces, result.solution);
      return {
        variant,
        shape: selectedShape,
        ...result,
        board: new SigmarsGardenBoard(result.pieces),
      };
    }
  }

  throw new Error(
    `Could not construct a structured ${variant} ${selectedShape}/${ringOneCount} board after ${boardAttempts} attempts`,
  );
}
