import test from "node:test";
import assert from "node:assert/strict";
import { analyzePuzzleDifficulty, generateProgressionLevel } from "../src/index.js";

test("difficulty analysis is independent of progression chapter metadata", () => {
  const record = generateProgressionLevel(4, { campaignSeed: "difficulty-api" });
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
  const record = generateProgressionLevel(4, {
    campaignSeed: "difficulty-determinism",
  });
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
