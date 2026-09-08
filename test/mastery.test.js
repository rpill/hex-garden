import test from "node:test";
import assert from "node:assert/strict";
import * as api from "../src/index.js";

test("mastery thresholds match the product design", () => {
  assert.ok(api.MasteryRank, "MasteryRank is exported");
  assert.equal(api.masteryRank(0), api.MasteryRank.NOVICE);
  assert.equal(api.masteryRank(4), api.MasteryRank.NOVICE);
  assert.equal(api.masteryRank(5), api.MasteryRank.APPRENTICE);
  assert.equal(api.masteryRank(14), api.MasteryRank.APPRENTICE);
  assert.equal(api.masteryRank(15), api.MasteryRank.ADEPT);
  assert.equal(api.masteryRank(29), api.MasteryRank.ADEPT);
  assert.equal(api.masteryRank(30), api.MasteryRank.STRATEGIST);
  assert.equal(api.masteryRank(39), api.MasteryRank.STRATEGIST);
  assert.equal(api.masteryRank(40), api.MasteryRank.EXPERT);
  assert.equal(api.masteryRank(49), api.MasteryRank.EXPERT);
  assert.equal(api.masteryRank(50), api.MasteryRank.MASTER);
});

test("continue advances campaign then targets earliest missing clean", () => {
  assert.equal(typeof api.campaignContinueTarget, "function");
  assert.deepEqual(
    api.campaignContinueTarget({ solvedLevels: [0, 1], cleanLevels: [0] }),
    { kind: "campaign", level: 2 },
  );
  assert.deepEqual(
    api.campaignContinueTarget({ solvedLevels: [0, 2], cleanLevels: [0, 2] }),
    { kind: "campaign", level: 1 },
  );
  assert.deepEqual(
    api.campaignContinueTarget({
      solvedLevels: Array.from({ length: 50 }, (_, i) => i),
      cleanLevels: [0, 1],
    }),
    { kind: "mastery", level: 2 },
  );
  assert.deepEqual(
    api.campaignContinueTarget({
      solvedLevels: Array.from({ length: 50 }, (_, i) => i),
      cleanLevels: Array.from({ length: 50 }, (_, i) => i),
    }),
    { kind: "complete" },
  );
});
