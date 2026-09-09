import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live Home and Board HUD stay independent of frozen art-theme assets", async () => {
  const menu = await read("src/game/scenes/MenuScene.ts");
  const hud = await read("src/game/board/BoardHud.ts");

  assert.doesNotMatch(menu, /art-assets|scene-background|preloadUiAssets|PHYSICAL_|physicalPiece/);
  assert.doesNotMatch(hud, /art-assets|scene-background|preloadUiAssets|PHYSICAL_|physicalPiece/);
});

test("functional board cells use the minimal UI palette instead of the legacy art palette", async () => {
  const source = await read("src/game/scenes/BoardScene.ts");
  assert.match(source, /fillStyle\(MINIMAL_UI_COLORS\.surface,\s*primitiveMetrics\.slotAlpha\)/);
  assert.match(source, /MINIMAL_UI_COLORS\.border/);
  assert.doesNotMatch(source, /THEME_COLORS\.cellFillNumber|THEME_COLORS\.cellLineNumber/);
});

test("functional runtime never defaults to the frozen premium theme when its assets are absent", async () => {
  const theme = await read("src/art-theme.ts");
  const physicalAssets = new URL("../public/assets/physical-premium/", import.meta.url);

  await assert.rejects(readFile(new URL("felt-table.jpg", physicalAssets), "utf8"));
  assert.match(theme, /return requested === "premium" \? "premium" : "chequered";/);
});

test("chequered startup does not preload frozen physical-premium files", async () => {
  const assets = await read("src/art-assets.ts");
  assert.match(assets, /const PHYSICAL_ASSET_URLS[\s\S]*ACTIVE_ART_THEME === "premium"\s*\? PHYSICAL_ASSET_URLS\s*:\s*\{\}/);
});
