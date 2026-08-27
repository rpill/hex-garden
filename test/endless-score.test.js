import test from "node:test";
import assert from "node:assert/strict";
import {
  boardClearBaseScore,
  createEndlessScoreState,
  nextStreakMultiplier,
  scoreClearedBoard,
  scoreRemovedAtoms,
  streakMultiplier,
} from "../src/index.js";

test("streak multipliers are explicit, capped, and expose the next threshold", () => {
  assert.deepEqual(
    [0, 2, 3, 4, 5, 7, 8, 11, 12, 50].map(streakMultiplier),
    [1, 1, 1.25, 1.25, 1.5, 1.5, 2, 2, 2.5, 2.5],
  );
  assert.deepEqual(nextStreakMultiplier(2), { streak: 3, multiplier: 1.25 });
  assert.deepEqual(nextStreakMultiplier(8), { streak: 12, multiplier: 2.5 });
  assert.equal(nextStreakMultiplier(12), null);
});

test("removed atoms score immediately with the current streak multiplier", () => {
  const result = scoreRemovedAtoms({ score: 120, streak: 5 }, 2);
  assert.deepEqual(result, {
    state: { score: 150, streak: 5 },
    award: 30,
    baseScore: 20,
    multiplier: 1.5,
  });
});

test("clearing a board advances the streak and awards its size bonus", () => {
  assert.equal(boardClearBaseScore(37), 1000);
  assert.equal(boardClearBaseScore(61), 1500);
  assert.equal(boardClearBaseScore(91), 2000);

  const first = scoreClearedBoard(createEndlessScoreState(), 37);
  assert.deepEqual(first, {
    state: { score: 1000, streak: 1 },
    award: 1000,
    baseScore: 1000,
    multiplier: 1,
  });
  const third = scoreClearedBoard({ score: 2500, streak: 2 }, 91);
  assert.equal(third.state.streak, 3);
  assert.equal(third.award, 2500);
  assert.equal(third.multiplier, 1.25);
});
