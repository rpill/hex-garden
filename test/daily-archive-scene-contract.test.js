import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("DailyArchiveScene is registered and uses trusted time plus the rolling month model", async () => {
  const [main, archive] = await Promise.all([
    read("../src/main.ts"),
    read("../src/game/scenes/DailyArchiveScene.ts"),
  ]);
  assert.match(main, /DailyArchiveScene/);
  assert.match(main, /scene: \[[^\]]*DailyArchiveScene/s);
  assert.match(archive, /super\("daily-archive"\)/);
  assert.match(archive, /getTrustedClock\(\)\.now\(\)/);
  assert.match(archive, /createDailyArchiveMonth\(/);
  assert.match(archive, /streakSummary\(/);
  assert.match(archive, /showStickyBanner\(\)/);
});

test("Home exposes archive only as part of the unlocked Daily card", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");
  assert.match(menu, /dailyArchiveButton/);
  assert.match(menu, /АРХИВ · 90 ДНЕЙ/);
  assert.match(menu, /this\.model\.showDaily/);
  assert.match(menu, /scene\.start\("daily-archive"\)/);
  assert.doesNotMatch(menu, /id:\s*"daily-archive"/);
});

test("archive date selection launches explicit Daily date and archive return target", async () => {
  const archive = await read("../src/game/scenes/DailyArchiveScene.ts");
  assert.match(archive, /mode:\s*PlayMode\.DAILY/);
  assert.match(archive, /dailyDateKey:\s*dateKey/);
  assert.match(archive, /dailyReturnTarget:\s*"daily-archive"/);
});
