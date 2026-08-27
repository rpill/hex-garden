import test from "node:test";
import assert from "node:assert/strict";
import {
  STANDARD_ENDLESS_REQUIRED_COMPLETIONS,
  STANDARD_ENDLESS_UNLOCK_LEVEL,
  getProgressionLevelDefinition,
  standardEndlessAccess,
} from "../src/index.js";

test("standard endless unlocks after every standard mechanic is introduced", () => {
  assert.equal(STANDARD_ENDLESS_UNLOCK_LEVEL, 8);
  assert.equal(STANDARD_ENDLESS_REQUIRED_COMPLETIONS, 9);
  assert.equal(
    getProgressionLevelDefinition(STANDARD_ENDLESS_UNLOCK_LEVEL).mechanics.includes(
      "gold",
    ),
    true,
  );

  const locked = standardEndlessAccess({
    completedLevels: [0, 1, 2, 3, 4],
  });
  assert.deepEqual(locked, {
    unlocked: false,
    unlockLevel: 8,
    requiredCompletedLevels: 9,
    completedRequiredLevels: 5,
    remainingLevels: 4,
  });

  const unlocked = standardEndlessAccess({
    completedLevels: Array.from({ length: 9 }, (_value, level) => level),
  });
  assert.equal(unlocked.unlocked, true);
  assert.equal(unlocked.remainingLevels, 0);
});

test("campaign test mode can bypass the endless lock without saved progress", () => {
  const access = standardEndlessAccess(
    { completedLevels: [] },
    { unlockAll: true },
  );
  assert.equal(access.unlocked, true);
  assert.equal(access.remainingLevels, 0);
});
