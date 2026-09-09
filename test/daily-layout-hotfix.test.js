import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Home Daily card reserves separate vertical bands for status, week strip, and Archive CTA", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");

  assert.match(menu, /const dailyHeight = metrics\.shortLandscape \? 76 : 132/);
  assert.match(menu, /const archiveHeight = metrics\.shortLandscape \? 20 : 32/);
  assert.match(menu, /const dailyY = metrics\.primaryY \+ \(metrics\.shortLandscape \? 69 : 104\)/);
  assert.match(menu, /dailyY - \(metrics\.shortLandscape \? 30 : 48\)/);
  assert.match(menu, /dailyY - \(metrics\.shortLandscape \? 9 : 18\)/);
  assert.match(menu, /dailyY \+ \(metrics\.shortLandscape \? 5 : 7\)/);
});

test("Daily Archive anchors calendar directly below weekdays instead of centering it in leftover viewport height", async () => {
  const archive = await read("../src/game/scenes/DailyArchiveScene.ts");

  assert.doesNotMatch(archive, /\(maxGridHeight - gridHeight\) \/ 2/);
  assert.match(archive, /const top = gridTop \+ \(shortLandscape \? 4 : 8\)/);
  assert.match(archive, /const legendY = Math\.min\(/);
  assert.match(archive, /top \+ gridHeight \+ \(shortLandscape \? 12 : 20\)/);
});
