import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  isActualDeadEnd,
  isRescueEligible,
} from "../src/game/board-session-state.js";
import { PlayMode } from "../src/game/modes.js";

test("player-facing dead end requires a non-won board with zero legal moves", () => {
  assert.equal(isActualDeadEnd({ won: false, legalMoveCount: 3 }), false);
  assert.equal(isActualDeadEnd({ won: false, legalMoveCount: 1 }), false);
  assert.equal(isActualDeadEnd({ won: true, legalMoveCount: 0 }), false);
  assert.equal(isActualDeadEnd({ won: false, legalMoveCount: 0 }), true);
});

test("rescue is eligible only for an actual Endless dead end", () => {
  assert.equal(
    isRescueEligible({ mode: PlayMode.STANDARD, actualDeadEnd: true }),
    true,
  );
  assert.equal(
    isRescueEligible({ mode: PlayMode.STANDARD, actualDeadEnd: false }),
    false,
  );
  assert.equal(
    isRescueEligible({ mode: PlayMode.CAMPAIGN, actualDeadEnd: true }),
    false,
  );
  assert.equal(
    isRescueEligible({ mode: PlayMode.TUTORIAL, actualDeadEnd: true }),
    false,
  );
});


test("BoardScene does not expose solver-only dead end as rescue or selection state", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /positionDeadEnd/);
  assert.match(source, /isRescueEligible\(/);
  assert.match(source, /actualDeadEnd/);
});
