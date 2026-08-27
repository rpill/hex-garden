import test from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENT_TYPES,
  TUTORIAL_GUIDED_MOVE_COUNT,
  createTutorialLevel,
  replaySolution,
} from "../src/index.js";

test("tutorial demonstrates all four elements on a certified compact board", () => {
  const record = createTutorialLevel();
  const counts = new Map();
  for (const piece of record.pieces) {
    counts.set(piece.type, (counts.get(piece.type) ?? 0) + 1);
  }

  assert.equal(record.shape, "tutorial-r3");
  assert.equal(record.plateCells.length, 37);
  assert.equal(record.solution.length, 4);
  assert.equal(TUTORIAL_GUIDED_MOVE_COUNT, 2);
  assert.deepEqual(
    ELEMENT_TYPES.map((type) => counts.get(type)),
    [2, 2, 2, 2],
  );
  assert.equal(replaySolution(record.pieces, record.solution), true);
  assert.ok(record.board.pieces().some((piece) => !record.board.isFree(piece)));
});
