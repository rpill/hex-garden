import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_REQUIRED_COMPLETIONS,
  ENDLESS_REQUIRED_COMPLETIONS,
  dailyAccess,
  endlessAccess,
} from "../src/index.js";
import { PlayMode } from "../src/game/modes.js";

const snapshot = (count) => ({
  solvedLevels: Array.from({ length: count }, (_value, level) => level),
});

test("daily unlocks after level five and endless after level ten", () => {
  assert.equal(DAILY_REQUIRED_COMPLETIONS, 5);
  assert.equal(ENDLESS_REQUIRED_COMPLETIONS, 10);

  assert.deepEqual(dailyAccess(snapshot(4)), {
    unlocked: false,
    requiredCompletedLevels: 5,
    completedRequiredLevels: 4,
    remainingLevels: 1,
  });
  assert.equal(dailyAccess(snapshot(5)).unlocked, true);

  assert.deepEqual(endlessAccess(snapshot(9)), {
    unlocked: false,
    requiredCompletedLevels: 10,
    completedRequiredLevels: 9,
    remainingLevels: 1,
  });
  assert.equal(endlessAccess(snapshot(10)).unlocked, true);
});

test("mode access counts only the contiguous solved prefix", () => {
  const nonContiguous = { solvedLevels: [0, 1, 2, 3, 5, 6, 7, 8, 9, 10] };
  assert.equal(dailyAccess(nonContiguous).completedRequiredLevels, 4);
  assert.equal(dailyAccess(nonContiguous).unlocked, false);
  assert.equal(endlessAccess(nonContiguous).completedRequiredLevels, 4);
  assert.equal(endlessAccess(nonContiguous).unlocked, false);
});

test("test mode can bypass access locks without mutating progress", () => {
  assert.equal(dailyAccess({ solvedLevels: [] }, { unlockAll: true }).unlocked, true);
  assert.equal(endlessAccess({ solvedLevels: [] }, { unlockAll: true }).unlocked, true);
});

test("public play modes are tutorial, campaign, daily, and endless", () => {
  assert.deepEqual(PlayMode, {
    TUTORIAL: "tutorial",
    CAMPAIGN: "campaign",
    DAILY: "daily",
    ENDLESS: "endless",
  });
});
