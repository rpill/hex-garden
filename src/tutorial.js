import { Atom, ELEMENT_TYPES } from "./atom-types.js";
import { GardenBoard } from "./board.js";
import { BoardVariant, replaySolution } from "./generator.js";
import { enumerateHexPlate, hexKey } from "./hex.js";
import { CURATED_OPENING_LEVELS } from "./opening-levels.js";

export const TUTORIAL_GUIDED_MOVE_COUNT = 2;

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
