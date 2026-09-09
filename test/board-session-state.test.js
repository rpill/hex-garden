import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  canRescueAttempt,
  createAttemptState,
  isActualDeadEnd,
  markRescueUsed,
  markSolverAssisted,
  restartAttempt,
} from "../src/game/board/attempt-state.js";
import { isRescueEligible } from "../src/game/board-session-state.js";
import { PlayMode } from "../src/game/modes.js";

test("only solver assistance invalidates clean and restart restores it", () => {
  const initial = createAttemptState();
  assert.deepEqual(initial, { cleanEligible: true, rescueUsed: false });

  const hinted = markSolverAssisted(initial);
  assert.equal(hinted.cleanEligible, false);
  assert.equal(hinted.rescueUsed, false);

  const rescued = markRescueUsed(initial);
  assert.equal(rescued.cleanEligible, false);
  assert.equal(rescued.rescueUsed, true);

  assert.deepEqual(restartAttempt(hinted), { cleanEligible: true, rescueUsed: false });
  assert.deepEqual(restartAttempt(rescued), { cleanEligible: true, rescueUsed: false });
});

test("rescue is one-use and only at a visible dead end", () => {
  const initial = createAttemptState();
  const deadEnd = { won: false, legalMoveCount: 0 };

  assert.equal(isActualDeadEnd(deadEnd), true);
  assert.equal(isActualDeadEnd({ won: false, legalMoveCount: 1 }), false);
  assert.equal(isActualDeadEnd({ won: true, legalMoveCount: 0 }), false);

  assert.equal(canRescueAttempt(initial, deadEnd), true);
  assert.equal(canRescueAttempt(initial, { won: false, legalMoveCount: 1 }), false);
  assert.equal(canRescueAttempt(markRescueUsed(initial), deadEnd), false);
});

test("legacy rescue eligibility no longer restricts rescue to Endless", () => {
  for (const mode of [PlayMode.CAMPAIGN, PlayMode.DAILY, PlayMode.ENDLESS]) {
    assert.equal(isRescueEligible({ mode, actualDeadEnd: true }), true);
    assert.equal(isRescueEligible({ mode, actualDeadEnd: false }), false);
  }
});

test("BoardScene exposes only visible dead-end state, not solver doom", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /positionDeadEnd/);
  assert.match(source, /actualDeadEnd/);
});

test("Endless BoardScene owns one run session and routes visible dead ends through End Run / Rescue Run", async () => {
  const [boardSource, hudSource] = await Promise.all([
    readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/board/BoardHud.ts", import.meta.url), "utf8"),
  ]);

  assert.match(boardSource, /import \{ EndlessBoardSession \} from "\.\.\/board\/EndlessBoardSession\.js"/);
  assert.match(boardSource, /endlessRunSeed/);
  assert.match(boardSource, /endless-v2:/);
  assert.match(boardSource, /new EndlessLevelPrefetch/);
  assert.match(boardSource, /generateEndlessRun\(level, \{ runSeed: this\.endlessRunSeed \}\)/);
  assert.match(boardSource, /endlessPrefetch\.take\(this\.level\)/);
  assert.doesNotMatch(boardSource, /campaignSeed: CAMPAIGN_SEED/);
  assert.match(boardSource, /this\.endlessSession\.recordBeforeRemoval\(beforeRemovalPieces\)/);
  assert.match(boardSource, /this\.endlessSession\.clearBoard\(\)/);
  assert.match(boardSource, /this\.endlessSession\.enterDeadEnd\(\)/);
  assert.match(boardSource, /requestEndlessRescue/);
  assert.match(boardSource, /requestEndlessHint/);
  assert.doesNotMatch(boardSource, /awardEndlessClear/);
  assert.doesNotMatch(boardSource, /scoreClearedBoard/);

  assert.match(hudSource, /setEndlessDeadEndState\(/);
  assert.match(hudSource, /END RUN/);
  assert.match(hudSource, /RESCUE RUN/);
});
