import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const adapterSource = await readFile(new URL("../src/platform/yandex-games.ts", import.meta.url), "utf8");
const launcherSource = await readFile(new URL("../scripts/yandex-dev.mjs", import.meta.url), "utf8");

test("Yandex dev command uses the official SDK dev proxy", () => {
  assert.equal(packageJson.scripts["yandex:dev"], "node scripts/yandex-dev.mjs");
  assert.match(packageJson.scripts["dev:yandex"], /yandex:dev/);
  assert.match(launcherSource, /@yandex-games\/sdk-dev-proxy@0\.0\.2/);
  assert.match(launcherSource, /--dev-mode=true/);
});

test("runtime SDK adapter defaults to /sdk.js and does not simulate localhost ads", () => {
  assert.match(adapterSource, /sdkUrl\s*=\s*"\/sdk\.js"/);
  assert.match(adapterSource, /simulateRewarded\s*=\s*false/);
  assert.doesNotMatch(adapterSource, /simulateRewarded\s*\?\?\s*isLocalTest/);
});

test("runtime SDK adapter exposes trusted server time", () => {
  assert.match(adapterSource, /serverTime\?\s*:\s*\(\)\s*=>\s*number/);
  assert.match(adapterSource, /async\s+serverTime\(\)\s*:\s*Promise<number\s*\|\s*null>/);
});
