import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("premium tabletop is the default visual candidate with only the old baseline retained for comparison", async () => {
  const themeSource = await read("src/art-theme.ts");
  const mainSource = await read("src/main.ts");

  assert.match(themeSource, /ART_THEME_IDS\s*=\s*\["premium",\s*"chequered"\]/);
  assert.match(themeSource, /:\s*"premium"/);
  assert.doesNotMatch(themeSource, /"adventure"|"rpg"|"space"/);
  assert.doesNotMatch(mainSource, /F2|cycleArtTheme/);
});

test("premium tabletop stays renderer-owned and keeps current Chequered pieces", async () => {
  const artSource = await read("src/art-assets.ts");
  const uiSource = await read("src/game/ui.ts");

  assert.match(artSource, /CHEQUERED_ROOT/);
  assert.match(artSource, /chequeredUrl\("gems"/);
  assert.doesNotMatch(artSource, /ART_SURFACE_URLS|RASTER_UI_ROOTS|shared-gems/);
  assert.match(uiSource, /class RendererSurface/);
  assert.doesNotMatch(uiSource, /class RasterSurface/);
});

test("functional board cells use the minimal UI palette instead of the legacy art palette", async () => {
  const source = await read("src/game/scenes/BoardScene.ts");
  assert.match(source, /fillStyle\(MINIMAL_UI_COLORS\.surface,\s*primitiveMetrics\.slotAlpha\)/);
  assert.match(source, /MINIMAL_UI_COLORS\.border/);
  assert.doesNotMatch(source, /THEME_COLORS\.cellFillNumber|THEME_COLORS\.cellLineNumber/);
});
