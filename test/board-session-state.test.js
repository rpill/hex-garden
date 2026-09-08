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
  assert.match(source, /isRescueEligible\(/);
  assert.match(source, /actualDeadEnd/);
});
