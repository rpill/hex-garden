import { Atom, ELEMENT_TYPES, type AtomType } from "./atom-types.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import {
  BoardVariant,
  createSeededRandom,
  replaySolution,
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
  type HexCoord,
} from "./hex.js";
import { plateSpec, type PlateSizeValue } from "./plates.js";

export interface PuzzleComposition {
  saltPairCount: number;
  saltElementPairCount: number;
  oppositePairCount: number;
  metalDepth: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export interface PuzzleCandidateOptions {
  seed: string;
  plateSize: PlateSizeValue;
  targetPieceCount: number;
  composition: Readonly<PuzzleComposition>;
  maskAttempts?: number;
  placementAttempts?: number;
}

export interface GeneratedPuzzleCandidate {
  seed: string;
  variant: typeof BoardVariant.STANDARD;
  plateSize: PlateSizeValue;
  plateRadius: 3 | 4 | 5;
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  board: GardenBoard;
}

type MoveSpec = AtomType[];

const METAL_CHAIN = Object.freeze([
  Atom.LEAD,
  Atom.TIN,
  Atom.IRON,
  Atom.COPPER,
  Atom.SILVER,
  Atom.GOLD,
] as const satisfies readonly AtomType[]);

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
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

function cycleElementPairs(count: number, offset = 0): MoveSpec[] {
  return Array.from({ length: count }, (_value, index) => {
    const type = ELEMENT_TYPES[(index + offset) % ELEMENT_TYPES.length];
    if (type === undefined) throw new Error("Element cycle index is invalid");
    return pair(type);
  });
}

function interleaveMetalSpecs(ordinarySpecs: readonly MoveSpec[], metalDepth: PuzzleComposition["metalDepth"]): MoveSpec[] {
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

function createMoveSpecs(
  targetPieceCount: number,
  composition: Readonly<PuzzleComposition>,
  random: RandomSource,
): MoveSpec[] {
  assertNonNegativeInteger(composition.saltPairCount, "saltPairCount");
  assertNonNegativeInteger(composition.saltElementPairCount, "saltElementPairCount");
  assertNonNegativeInteger(composition.oppositePairCount, "oppositePairCount");
  if (!Number.isSafeInteger(composition.metalDepth) || composition.metalDepth < 0 || composition.metalDepth > 6) {
    throw new RangeError("metalDepth must be an integer from 0 to 6");
  }

  const metalPairCount = Math.min(5, composition.metalDepth);
  const goldPieceCount = composition.metalDepth === 6 ? 1 : 0;
  const fixedPairCount =
    composition.saltPairCount +
    composition.saltElementPairCount +
    composition.oppositePairCount +
    metalPairCount;
  const fixedPieceCount = fixedPairCount * 2 + goldPieceCount;
  const remainingPieceCount = targetPieceCount - fixedPieceCount;

  if (remainingPieceCount < 0 || remainingPieceCount % 2 !== 0) {
    throw new RangeError(
      `Target piece count ${targetPieceCount} cannot match the requested puzzle composition`,
    );
  }

  const elementPairCount = remainingPieceCount / 2;
  const elementOffset = Math.floor(random() * ELEMENT_TYPES.length);
  const saltSpecs = Array.from({ length: composition.saltPairCount }, () => pair(Atom.SALT));
  const saltElementSpecs = Array.from({ length: composition.saltElementPairCount }, (_value, index) => {
    const element = ELEMENT_TYPES[(elementOffset + index) % ELEMENT_TYPES.length];
    if (element === undefined) throw new Error("Salt-element cycle index is invalid");
    return pair(Atom.SALT, element);
  });
  const oppositeSpecs = Array.from({ length: composition.oppositePairCount }, () => pair(Atom.VITAE, Atom.MORS));
  const elementSpecs = cycleElementPairs(elementPairCount, elementOffset);
  const ordinarySpecs = shuffle(
    [...saltSpecs, ...saltElementSpecs, ...oppositeSpecs, ...elementSpecs],
    random,
  );

  const moveSpecs = interleaveMetalSpecs(ordinarySpecs, composition.metalDepth);
  const scheduledPieceCount = moveSpecs.reduce((sum, move) => sum + move.length, 0);
  if (scheduledPieceCount !== targetPieceCount) {
    throw new Error(`Puzzle move schedule produced ${scheduledPieceCount} pieces instead of ${targetPieceCount}`);
  }
  return moveSpecs;
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
  return positions.filter((position) => hasThreeEmptyNeighbours(position, occupied));
}

function growConnectedMask(plateCells: readonly HexCoord[], count: number, random: RandomSource): HexCoord[] {
  const plateByKey = new Map(plateCells.map((cell) => [hexKey(cell), cell]));
  const center = plateByKey.get(hexKey(BOARD_CENTER));
  if (!center) throw new Error("Canonical plate does not contain the board center");

  const selected = new Map<string, HexCoord>([[hexKey(center), { ...center }]]);

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
    if (candidates.size === 0) throw new Error("Could not grow connected puzzle occupancy mask");

    const ranked = [...candidates.values()]
      .map((cell) => {
        const adjacentSelected = ADJACENT_OFFSETS.filter((offset) =>
          selected.has(hexKey(addHex(cell, offset))),
        ).length;
        const radius = hexDistance(cell, BOARD_CENTER);
        const structureScore = adjacentSelected * 1.1 - radius * 0.18 + random() * 3.2;
        return { cell, score: structureScore };
      })
      .sort((left, right) => right.score - left.score);

    const choiceWindow = Math.min(ranked.length, 3 + Math.floor(count / 15));
    const chosen = ranked[Math.floor(random() * choiceWindow)]?.cell;
    if (!chosen) throw new Error("Could not choose a connected puzzle occupancy cell");
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

function assignSchedule(
  mask: readonly HexCoord[],
  moveSpecs: readonly MoveSpec[],
  random: RandomSource,
): { pieces: BoardPiece[]; solution: Solution } | undefined {
  const centerKey = hexKey(BOARD_CENTER);
  const hasGold = moveSpecs.some((types) => types.length === 1 && types[0] === Atom.GOLD);
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
      if (type === undefined) throw new Error("Puzzle move schedule is incomplete");
      pieces.push({ ...position, type });
      move.push({ ...position });
    });
    solution.push(move);
  }

  if (remaining.size !== 0) return undefined;
  return { pieces, solution };
}

export function generatePuzzleCandidate({
  seed,
  plateSize,
  targetPieceCount,
  composition,
  maskAttempts = 300,
  placementAttempts = 120,
}: PuzzleCandidateOptions): GeneratedPuzzleCandidate {
  if (typeof seed !== "string" || seed.length === 0) {
    throw new TypeError("seed must be a non-empty string");
  }
  assertPositiveInteger(targetPieceCount, "target piece count");
  assertPositiveInteger(maskAttempts, "maskAttempts");
  assertPositiveInteger(placementAttempts, "placementAttempts");

  const spec = plateSpec(plateSize);
  if (targetPieceCount > spec.cellCount) {
    throw new RangeError(
      `Target piece count ${targetPieceCount} exceeds the ${spec.cellCount}-cell ${plateSize} plate capacity`,
    );
  }

  const random = createSeededRandom(seed);
  const moveSpecs = createMoveSpecs(targetPieceCount, composition, random);
  const plateCells = enumerateHexPlate(spec.radius);

  for (let maskAttempt = 0; maskAttempt < maskAttempts; maskAttempt += 1) {
    const mask = growConnectedMask(plateCells, targetPieceCount, random);
    for (let placementAttempt = 0; placementAttempt < placementAttempts; placementAttempt += 1) {
      const result = assignSchedule(mask, moveSpecs, random);
      if (!result) continue;
      replaySolution(result.pieces, result.solution);
      return {
        seed,
        variant: BoardVariant.STANDARD,
        plateSize,
        plateRadius: spec.radius,
        plateCells: plateCells.map((cell) => ({ ...cell })),
        pieces: result.pieces,
        solution: result.solution,
        board: new GardenBoard(result.pieces),
      };
    }
  }

  throw new Error(
    `Could not construct puzzle candidate ${seed} on ${plateSize} after ${maskAttempts} mask attempts`,
  );
}
