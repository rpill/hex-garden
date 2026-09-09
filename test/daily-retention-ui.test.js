import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Home Daily card exposes streak and an explicit action for each completion state", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");

  assert.match(menu, /dailyStreak/);
  assert.match(menu, /НОВАЯ · ИГРАТЬ/);
  assert.match(menu, /ПРОЙДЕНО · УЛУЧШИТЬ ДО ◆/);
  assert.match(menu, /◆ ЧИСТО/);
  assert.match(menu, /СЕРИЯ/);
});

test("Home groups Today and Archive as two separated Daily actions inside one bracketed section", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");

  assert.match(menu, /dailyGroupBracket/);
  assert.match(menu, /drawDailyGroupBracket/);
  assert.match(menu, /homeDailyGroupMetrics\(metrics\)/);
  assert.match(menu, /this\.dailyButton[\s\S]*setPosition\(metrics\.centerX, dailyActionY\)/);
  assert.match(menu, /this\.dailyArchiveButton[\s\S]*setPosition\(metrics\.centerX, archiveY\)/);
  assert.doesNotMatch(menu, /dailyArchiveInset/);
});

test("Daily Archive explains symbols and highlights today without adding a second text marker", async () => {
  const archive = await read("../src/game/scenes/DailyArchiveScene.ts");

  assert.match(archive, /legendText/);
  assert.match(archive, /НЕ СЫГРАНО/);
  assert.match(archive, /✓ ПРОЙДЕНО/);
  assert.match(archive, /◆ ЧИСТО/);
  assert.match(archive, /setHighlighted\(cell\.today\)/);
  assert.doesNotMatch(archive, /todayMark/);
});

test("MinimalButton has a persistent highlighted state for semantic emphasis", async () => {
  const minimalUi = await read("../src/game/minimal-ui.ts");

  assert.match(minimalUi, /highlighted = false/);
  assert.match(minimalUi, /setHighlighted\(highlighted: boolean\)/);
  assert.match(minimalUi, /this\.highlighted/);
});

test("short landscape uses the same Daily group metrics as regular Home", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");

  assert.match(menu, /const dailyGroup = homeDailyGroupMetrics\(metrics\)/);
  assert.match(menu, /const endlessHeight = 68/);
});
