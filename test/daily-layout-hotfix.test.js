import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Home Daily layout delegates Today/Archive separation to reusable group metrics", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");
  const layout = await read("../src/game/navigation-layout.ts");

  assert.match(menu, /homeDailyGroupMetrics\(metrics\)/);
  assert.match(layout, /const sectionGap = home\.shortLandscape \? 5 : 8/);
  assert.match(layout, /const archiveY = actionY \+ actionHeight \/ 2 \+ sectionGap \+ archiveHeight \/ 2/);
});

test("Daily Archive anchors calendar directly below weekdays instead of centering it in leftover viewport height", async () => {
  const archive = await read("../src/game/scenes/DailyArchiveScene.ts");

  assert.doesNotMatch(archive, /\(maxGridHeight - gridHeight\) \/ 2/);
  assert.match(archive, /const top = gridTop \+ \(shortLandscape \? 4 : 8\)/);
  assert.match(archive, /const legendY = Math\.min\(/);
  assert.match(archive, /top \+ gridHeight \+ \(shortLandscape \? 12 : 20\)/);
});
