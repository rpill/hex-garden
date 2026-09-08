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
