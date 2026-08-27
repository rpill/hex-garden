import { Atom, ELEMENT_TYPES } from "./atom-types.js";
import { GardenBoard } from "./board.js";
import { BoardVariant, replaySolution } from "./generator.js";
import {
  ADJACENT_OFFSETS,
  addHex,
  enumerateHexPlate,
  hexKey,
} from "./hex.js";
import { CURATED_OPENING_LEVELS } from "./opening-levels.js";

export const TUTORIAL_GUIDED_MOVE_COUNT = 2;

export function findLongestEmptyNeighbourRun(pieces, position) {
  const occupied = new Set(pieces.map(hexKey));
  let longest = [];

  for (let start = 0; start < ADJACENT_OFFSETS.length; start += 1) {
    const run = [];
    for (let length = 0; length < ADJACENT_OFFSETS.length; length += 1) {
      const offset = ADJACENT_OFFSETS[(start + length) % ADJACENT_OFFSETS.length];
      const neighbour = addHex(position, offset);
      if (occupied.has(hexKey(neighbour))) break;
      run.push(neighbour);
    }
    if (run.length > longest.length) longest = run;
  }

  return longest;
}

export function createTutorialLevel() {
  const template = CURATED_OPENING_LEVELS[0];
  const typeByPosition = new Map();
  template.solution.forEach((move, index) => {
    for (const position of move) {
      typeByPosition.set(hexKey(position), ELEMENT_TYPES[index]);
    }
  });
  const pieces = template.pieces.map((piece) => ({
    ...piece,
    type: typeByPosition.get(hexKey(piece)),
  }));
  const solution = template.solution.map((move) =>
    move.map((position) => ({ ...position })),
  );

  replaySolution(pieces, solution);
  return {
    variant: BoardVariant.STANDARD,
    shape: "tutorial-r3",
    plateRadius: 3,
    plateCells: enumerateHexPlate(3),
    pieces,
    solution,
    board: new GardenBoard(pieces),
    definition: Object.freeze({
      chapter: "basics",
      mechanics: Object.freeze(["elements", "free-atoms"]),
    }),
  };
}
