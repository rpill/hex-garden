import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_CENTER,
  enumerateBoardCells,
  hexDistance,
  isBoardCell,
  rotateHexAround,
} from "../src/index.js";

test("the board plate is a radius-5 hex with 91 cells", () => {
  const cells = enumerateBoardCells();
  assert.equal(cells.length, 91);
  assert.equal(cells.every(isBoardCell), true);
  assert.equal(Math.max(...cells.map((cell) => hexDistance(cell, BOARD_CENTER))), 5);
});

test("six rotations around the board centre restore every coordinate", () => {
  for (const cell of enumerateBoardCells()) {
    assert.deepEqual(rotateHexAround(cell, BOARD_CENTER, 6), cell);
    assert.equal(isBoardCell(rotateHexAround(cell, BOARD_CENTER, 1)), true);
  }
});
