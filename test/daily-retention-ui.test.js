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

test("Home keeps Archive inside the Daily card footprint instead of below it as a separate mode", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");

  assert.match(menu, /dailyArchiveInset/);
  assert.match(menu, /dailyY \+ dailyHeight \/ 2 - dailyArchiveInset/);
  assert.doesNotMatch(menu, /dailyHeight \/ 2 \+ archiveGap \+ archiveHeight \/ 2/);
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

test("short landscape keeps the unified Daily card compact enough for lower navigation", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");

  assert.match(menu, /const dailyHeight = metrics\.shortLandscape \? 76 : 132/);
  assert.match(menu, /const endlessHeight = metrics\.shortLandscape \? 68 : 68/);
  assert.match(menu, /const dailyY = metrics\.primaryY \+ \(metrics\.shortLandscape \? 69 : 104\)/);
});
