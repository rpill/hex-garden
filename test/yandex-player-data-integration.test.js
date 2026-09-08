import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("game boot hydrates platform player storage before Phaser scenes are constructed", async () => {
  const main = await source("src/main.ts");
  const hydrate = main.indexOf("await initializePlayerDataStorage(platform)");
  const game = main.indexOf("new Phaser.Game");
  assert.notEqual(hydrate, -1);
  assert.notEqual(game, -1);
  assert.ok(hydrate < game);
});

test("campaign progress and settings consume the hydrated player storage boundary", async () => {
  const campaign = await source("src/game/campaign-progress.ts");
  const settings = await source("src/game/settings.ts");
  assert.match(campaign, /getPlayerDataStorage\(\)/);
  assert.match(campaign, /new CampaignProgressStore\(\{[\s\S]*storage/);
  assert.match(settings, /getPlayerDataStorage\(\)/);
  assert.match(settings, /new SettingsStore\(\{[\s\S]*storage/);
});


test("endless progress uses the hydrated player storage boundary", async () => {
  const endless = await source("src/game/endless-progress.ts");
  assert.match(endless, /getPlayerDataStorage\(\)/);
  assert.match(endless, /new EndlessProgressStore\(\{\s*storage/s);
});
