import test from "node:test";
import assert from "node:assert/strict";
import {
  BoardVariant,
  PlateSize,
  createSeededRandom,
  generatePuzzleCandidate,
  replaySolution,
} from "../src/index.js";

const composition = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
});

test("seeded random remains deterministic for canonical generators", () => {
  const first = createSeededRandom("repeatable");
  const second = createSeededRandom("repeatable");
  assert.deepEqual(
    Array.from({ length: 8 }, () => first()),
    Array.from({ length: 8 }, () => second()),
  );
});

test("generic puzzle candidates replace legacy shape-family generation", () => {
  const options = {
    seed: "canonical-generator-contract",
    plateSize: PlateSize.MEDIUM,
    targetPieceCount: 43,
    composition,
  };
  const first = generatePuzzleCandidate(options);
  const second = generatePuzzleCandidate(options);

  assert.equal(first.variant, BoardVariant.STANDARD);
  assert.equal(first.plateCells.length, 61);
  assert.equal(first.pieces.length, 43);
  assert.deepEqual(first.pieces, second.pieces);
  assert.deepEqual(first.solution, second.solution);
  assert.equal(replaySolution(first.pieces, first.solution), true);
  assert.equal("shape" in first, false);
});
