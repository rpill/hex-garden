import { ELEMENT_TYPES, type AtomType } from "./atom-types.js";
import { GardenBoard, type BoardPiece } from "./board.js";
import { BoardVariant, replaySolution, type Solution } from "./generator.js";
import {
  ADJACENT_OFFSETS,
  addHex,
  enumerateHexPlate,
  hexKey,
  type HexCoord,
} from "./hex.js";
import { CURATED_OPENING_LEVELS } from "./opening-levels.js";

export const TUTORIAL_GUIDED_MOVE_COUNT = 3;
const TUTORIAL_PLATE_RADIUS = 3 as const;

export function findLongestEmptyNeighbourRun(
  pieces: readonly HexCoord[],
  position: HexCoord,
): HexCoord[] {
  const occupied = new Set(pieces.map(hexKey));
  let longest: HexCoord[] = [];

  for (let start = 0; start < ADJACENT_OFFSETS.length; start += 1) {
    const run: HexCoord[] = [];
    for (let length = 0; length < ADJACENT_OFFSETS.length; length += 1) {
      const offset = ADJACENT_OFFSETS[(start + length) % ADJACENT_OFFSETS.length];
      if (!offset) break;
      const neighbour = addHex(position, offset);
      if (occupied.has(hexKey(neighbour))) break;
      run.push(neighbour);
    }
    if (run.length > longest.length) longest = run;
  }

  return longest;
}

export interface TutorialLevel {
  variant: typeof BoardVariant.STANDARD;
  shape: "tutorial-r3";
  plateRadius: 3;
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  board: GardenBoard;
  definition: Readonly<{
    chapter: "basics";
    mechanics: readonly ["elements", "free-atoms"];
  }>;
}

export function createTutorialLevel(): TutorialLevel {
  const template = CURATED_OPENING_LEVELS[0];
  if (!template) throw new Error("Tutorial opening template is missing");
  const typeByPosition = new Map<string, AtomType>();
  template.solution.forEach((move, index) => {
    const type = ELEMENT_TYPES[index];
    if (type === undefined) throw new Error("Tutorial element schedule is incomplete");
    for (const position of move) typeByPosition.set(hexKey(position), type);
  });
  const pieces: BoardPiece[] = template.pieces.map((piece) => {
    const type = typeByPosition.get(hexKey(piece));
    if (type === undefined) throw new Error("Tutorial piece has no assigned element type");
    return { ...piece, type };
  });
  const solution: Solution = template.solution.map((move) =>
    move.map((position) => ({ ...position })),
  );

  replaySolution(pieces, solution);
  return {
    variant: BoardVariant.STANDARD,
    shape: "tutorial-r3",
    plateRadius: TUTORIAL_PLATE_RADIUS,
    plateCells: enumerateHexPlate(TUTORIAL_PLATE_RADIUS),
    pieces,
    solution,
    board: new GardenBoard(pieces),
    definition: Object.freeze({
      chapter: "basics",
      mechanics: Object.freeze(["elements", "free-atoms"] as const),
    }),
  };
}
