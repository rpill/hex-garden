import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful removals use a quiet link-and-settle feedback before the views are rebuilt", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /animateRemovalFeedback\(result\.removed/);
  assert.match(source, /REMOVAL_FEEDBACK_DURATION_MS/);
  assert.match(source, /removalFeedbackActive/);
  assert.match(source, /linkProgress/);
  assert.match(source, /strokeCircle/);
});

test("a winning removal gets to finish its feedback before the completion overlay opens", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /scheduleWonBoardCompletion/);
  assert.match(source, /REMOVAL_FEEDBACK_DURATION_MS/);
  assert.match(source, /delayedCall/);
});

test("inventory counts acknowledge normal-play removals instead of snapping silently", async () => {
  const source = await readFile(
    new URL("../src/game/board/BoardInventory.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /lastRenderedCount/);
  assert.match(source, /entry\.count < previousCount/);
  assert.match(source, /targets: view\.count/);
  assert.match(source, /Cubic\.Out/);
});
