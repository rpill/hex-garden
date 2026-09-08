import test from "node:test";
import assert from "node:assert/strict";
import {
  PlateSize,
  analyzePuzzleDifficulty,
  generatePuzzleCandidate,
} from "../src/index.js";

const composition = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 4,
});

function candidate(seed) {
  return generatePuzzleCandidate({
    seed,
    plateSize: PlateSize.SMALL,
    targetPieceCount: 30,
    composition,
  });
}

test("difficulty analysis is independent of removed progression metadata", () => {
  const record = candidate("difficulty-api");
  const metrics = analyzePuzzleDifficulty({
    pieces: record.pieces,
    solution: record.solution,
    plateCells: record.plateCells,
    sampleSeed: "difficulty-api",
  });

  assert.ok(metrics.initialLegalMoveCount >= 0);
  assert.ok(metrics.averageMeaningfulMoveCount >= 0);
  assert.ok(metrics.earlyRiskyDecisionSteps >= 0);
  assert.ok(metrics.earlyDeceptiveDecisionSteps >= 0);
  assert.ok(
    metrics.sampledRouteWinProbability >= 0 &&
      metrics.sampledRouteWinProbability <= 1,
  );
  assert.ok(
    metrics.consequenceDepthMedian === null ||
      metrics.consequenceDepthMedian >= 1,
  );
  assert.ok(
    metrics.consequenceDepthMax === null ||
      (metrics.consequenceDepthMedian !== null &&
        metrics.consequenceDepthMax >= metrics.consequenceDepthMedian),
  );
});

test("difficulty sampling is deterministic for the same puzzle and sample seed", () => {
  const record = candidate("difficulty-determinism");
  const input = {
    pieces: record.pieces,
    solution: record.solution,
    plateCells: record.plateCells,
    sampleSeed: "difficulty-determinism",
  };

  assert.deepEqual(
    analyzePuzzleDifficulty(input),
    analyzePuzzleDifficulty(input),
  );
});
