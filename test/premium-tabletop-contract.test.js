import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("physical premium palette exposes felt, walnut, and brass material tokens", async () => {
  const source = await read("src/art-assets.ts");
  assert.match(source, /canvas:\s*0x162a24/i);
  assert.match(source, /walnut:\s*0x4c2e1d/i);
  assert.match(source, /walnutDark:\s*0x2b1b12/i);
  assert.match(source, /brass:\s*0xb88a45/i);
  assert.match(source, /brassSoft:\s*0xd1ae72/i);
  assert.match(source, /PHYSICAL_MATERIAL_FRAMES/);
});

test("physical premium uses renderer-owned material roles instead of B5 raster UI", async () => {
  const source = await read("src/game/ui.ts");
  assert.match(source, /export type MaterialRole/);
  assert.match(source, /"walnut-tray"/);
  assert.match(source, /"system-control"/);
  assert.match(source, /setMaterialRole/);
  assert.match(source, /scene\.add\.nineslice/);
  assert.doesNotMatch(source, /class RasterSurface/);
  assert.doesNotMatch(source, /return USES_RASTER_UI\s*\?/);
});

test("legacy physical inventory remains isolated from the new minimal board HUD", async () => {
  const inventory = await read("src/game/board/BoardInventory.ts");
  const hud = await read("src/game/board/BoardHud.ts");
  assert.match(inventory, /setMaterialRole\("walnut-tray"\)/);
  assert.match(hud, /from "\.\.\/minimal-ui\.js"/);
  assert.match(hud, /makeMinimalButton/);
  assert.doesNotMatch(hud, /setMaterialRole/);
  assert.doesNotMatch(hud, /PHYSICAL_MATERIAL_FRAMES/);
});

test("premium candidate does not cycle rejected Adventure RPG Space themes", async () => {
  const theme = await read("src/art-theme.ts");
  const main = await read("src/main.ts");
  assert.doesNotMatch(theme, /"adventure"/);
  assert.doesNotMatch(theme, /"rpg"/);
  assert.doesNotMatch(theme, /"space"/);
  assert.match(theme, /"premium"/);
  assert.doesNotMatch(main, /cycleArtTheme/);
});
