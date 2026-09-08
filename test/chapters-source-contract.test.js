import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/game/scenes/LevelSelectScene.ts", import.meta.url), "utf8");

test("Chapters scene is asset-free and economy-free", () => {
  assert.doesNotMatch(source, /art-assets|scene-background|getEconomy|makeCurrencyDisplay|makeLevelButton|makePanel|preloadUiAssets|UI_FRAMES|GAMEPLAY_UI_FRAMES/);
  assert.match(source, /makeMinimalButton/);
  assert.match(source, /CAMPAIGN_CHAPTERS/);
  assert.match(source, /campaignLevelState/);
});

test("Chapters scene presents solved and clean marks without score or Dust", () => {
  assert.match(source, /✓/);
  assert.match(source, /◆/);
  assert.doesNotMatch(source, /campaignScore|SCORE|СЧ[ЕЁ]Т|dust|DUST|shop|SHOP/);
});
