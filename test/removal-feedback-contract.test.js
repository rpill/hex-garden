import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("successful removals disappear immediately with no transient piece animation", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /animateRemovalFeedback/);
  assert.doesNotMatch(source, /REMOVAL_FEEDBACK_DURATION_MS/);
  assert.doesNotMatch(source, /removalFeedbackActive/);
  assert.doesNotMatch(source, /view\.tokenBase\.texture\.key/);
  assert.doesNotMatch(source, /targets:\s*transient/);
  assert.match(source, /result\.kind === "removed"/);
  assert.match(source, /this\.rebuildPieceViews\(\)/);
});

test("winning removals do not wait for removal feedback before completion", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /REMOVAL_FEEDBACK_DURATION_MS/);
  assert.doesNotMatch(source, /scheduleWonBoardCompletion/);
  assert.doesNotMatch(source, /delayedCall\([^\n]*REMOVAL/);
  assert.match(source, /this\.progress\.completeTutorial\(\);[\s\S]{0,220}this\.scene\.restart\(\{ mode: PlayMode\.CAMPAIGN, level: 0 \}\)/);
  assert.match(source, /this\.showCampaignCompletion\(/);
  assert.match(source, /this\.showEndlessCompletion\(/);
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

test("removal path contains no connector line, pulse, ring, shrink, fade, or pull animation", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /straightRemovalPoint|lineDrawProgress|pulseProgress|lineWidthScale/);
  assert.doesNotMatch(source, /feedback\.lineBetween|feedback\.fillCircle|feedback\.strokeCircle/);
  assert.doesNotMatch(source, /targetScaleX|targetScaleY|pull = Math\.min/);
});
