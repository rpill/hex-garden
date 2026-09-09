import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const boardSource = () => readFile(
  new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
  "utf8",
);

test("BoardScene init keeps Daily target date and return target explicit", async () => {
  const source = await boardSource();
  assert.match(source, /dailyDateKey\?:/);
  assert.match(source, /dailyReturnTarget\?:/);
  assert.match(source, /"home"\s*\|\s*"daily-archive"/);
});

test("Daily packaged lookup uses requested archive date after trusted-window validation", async () => {
  const source = await boardSource();
  assert.match(source, /isDailyArchiveDateAvailable\(/);
  assert.match(source, /getDailyLevel\(dailyDateKeyToPlay\)/);
  assert.doesNotMatch(source, /generator\.generateDaily\(/);
});

test("archive-origin Daily result returns through an interstitial to archive", async () => {
  const source = await boardSource();
  assert.match(source, /BACK TO ARCHIVE|В АРХИВ/);
  assert.match(source, /dailyReturnTarget/);
  assert.match(source, /runInterstitialBefore\([\s\S]*daily-archive/);
});

test("Daily result no longer treats any date rollover as an automatic expiry", async () => {
  const source = await boardSource();
  assert.doesNotMatch(source, /NEW DAILY AVAILABLE|ДОСТУПНА НОВАЯ ЕЖЕДНЕВНАЯ ЗАДАЧА/);
  assert.match(source, /outside-window/);
});

test("Daily HUD keeps the selected target date visible", async () => {
  const source = await boardSource();
  assert.match(source, /dailySession\?\.daily\.dateKey/);
});

test("invalid Daily launch returns safely to its navigation origin", async () => {
  const source = await boardSource();
  assert.match(
    source,
    /catch \(error\) \{[\s\S]*this\.mode === PlayMode\.DAILY[\s\S]*error instanceof RangeError[\s\S]*returnFromDailyBoard\(\)/,
  );
});
