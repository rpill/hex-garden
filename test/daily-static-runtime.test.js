import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("BoardScene loads packaged Daily data after trusted-window validation", async () => {
  const source = await read("../src/game/scenes/BoardScene.ts");
  assert.match(source, /import \{ getDailyLevel \} from "\.\.\/\.\.\/daily-levels\.js"/);
  assert.match(source, /isDailyArchiveDateAvailable\(/);
  assert.match(source, /getDailyLevel\(dailyDateKeyToPlay\)/);
  assert.doesNotMatch(source, /generator\.generateDaily\(/);
});

test("Daily no longer exists as a browser generator-worker request", async () => {
  const [browser, worker] = await Promise.all([
    read("../src/browser.ts"),
    read("../src/generator-worker.ts"),
  ]);
  assert.doesNotMatch(browser, /generateDaily\(/);
  assert.doesNotMatch(worker, /generateDailyPuzzle|kind:\s*"daily"|request\.kind === "daily"/);
});

test("generation overlay is reserved for Endless runtime generation", async () => {
  const source = await read("../src/game/scenes/BoardScene.ts");
  assert.match(source, /const runtimeGenerated =\s*this\.mode === PlayMode\.ENDLESS/);
  assert.doesNotMatch(source, /const runtimeGenerated = this\.mode === PlayMode\.DAILY \|\|/);
});

test("Campaign and Daily do not even start the generator worker", async () => {
  const source = await read("../src/game/scenes/BoardScene.ts");
  assert.match(source, /if \(this\.mode === PlayMode\.ENDLESS\) \{[\s\S]*new BrowserLevelGenerator\(\)/);
  assert.doesNotMatch(source, /this\.generator = new BrowserLevelGenerator\(\);\s*this\.endlessPrefetch/);
});
