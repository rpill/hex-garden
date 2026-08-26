import test from "node:test";
import assert from "node:assert/strict";
import {
  BoardVariant,
  BoardShape,
  SigmarsGardenDatabase,
  createSeededRandom,
  encodeBoardDatabase,
  generateSolvableBoard,
  isBoardCell,
  replaySolution,
  rotateHexAround,
} from "../src/index.js";

function occupiedSet(pieces) {
  return new Set(pieces.map(({ q, r }) => `${q},${r}`));
}

function isInvariantAt(pieces, turns) {
  const occupied = occupiedSet(pieces);
  return pieces.every((piece) => {
    const rotated = rotateHexAround(piece, { q: 5, r: 0 }, turns);
    return occupied.has(`${rotated.q},${rotated.r}`);
  });
}

test("seeded generation is deterministic and standard boards replay to completion", () => {
  const first = generateSolvableBoard({ random: createSeededRandom("repeatable") });
  const second = generateSolvableBoard({ random: createSeededRandom("repeatable") });
  assert.deepEqual(first.pieces, second.pieces);
  assert.deepEqual(first.solution, second.solution);
  assert.equal(first.pieces.length, 55);
  assert.equal(first.pieces.every(isBoardCell), true);
  assert.equal(replaySolution(first.pieces, first.solution), true);
});

test("quintessence boards are constructively solvable", () => {
  const record = generateSolvableBoard({
    random: createSeededRandom("quintessence"),
    variant: BoardVariant.QUINTESSENCE,
  });
  assert.equal(record.solution.filter((move) => move.length === 5).length, 2);
  assert.equal(replaySolution(record.board, record.solution), true);
});

test("all original-style rotational families are generated and solvable", () => {
  const cases = [
    [BoardShape.SIXFOLD, 1],
    [BoardShape.THREEFOLD, 2],
    [BoardShape.TWOFOLD, 3],
    [BoardShape.OUTER_RINGS, 1],
  ];
  for (const [shape, invariantTurn] of cases) {
    const record = generateSolvableBoard({
      random: createSeededRandom(`shape:${shape}`),
      shape,
    });
    assert.equal(record.shape, shape);
    assert.equal(isInvariantAt(record.pieces, invariantTurn), true);
    assert.equal(replaySolution(record.pieces, record.solution), true);
  }
});

test("the outer-rings family is one centre plus two complete outer rings", () => {
  const record = generateSolvableBoard({
    random: createSeededRandom("outer-rings-contract"),
    shape: BoardShape.OUTER_RINGS,
  });
  const rings = Array(6).fill(0);
  for (const piece of record.pieces) {
    const distance = Math.max(
      Math.abs(piece.q - 5),
      Math.abs(piece.r),
      Math.abs(-(piece.q - 5) - piece.r),
    );
    rings[distance] += 1;
  }
  assert.deepEqual(rings, [1, 0, 0, 0, 24, 30]);
});

test("generated boards round-trip through an independent database", () => {
  const random = createSeededRandom("database");
  const records = Array.from({ length: 10 }, () => generateSolvableBoard({ random }));
  const bytes = encodeBoardDatabase(records);
  const database = new SigmarsGardenDatabase(bytes);
  assert.equal(database.count, 10);
  records.forEach((record, index) => {
    assert.deepEqual(database.readPieces(index), record.pieces);
    assert.equal(replaySolution(database.createBoard(index), record.solution), true);
  });
});
