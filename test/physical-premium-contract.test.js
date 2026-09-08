import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("physical premium registers real material frames and a deep felt palette", async () => {
  const art = await read("src/art-assets.ts");
  assert.match(art, /PHYSICAL_MATERIAL_FRAMES/);
  assert.match(art, /feltTable/);
  assert.match(art, /surfaceCard/);
  assert.match(art, /surfaceTray/);
  assert.match(art, /surfaceButton/);
  assert.match(art, /surfaceSystem/);
  assert.match(art, /tokenBase/);
  assert.match(art, /coin/);
  assert.match(art, /canvas:\s*0x162a24/i);
  assert.match(art, /cellFillNumber:\s*0x1b342d/i);
});

test("premium renderer uses NineSlice material surfaces and a tiled felt background", async () => {
  const ui = await read("src/game/ui.ts");
  const background = await read("src/scene-background.ts");
  assert.match(ui, /scene\.add\.nineslice/);
  assert.match(ui, /physicalFrameForRole/);
  assert.match(background, /TileSprite/);
  assert.match(background, /PHYSICAL_MATERIAL_FRAMES\.feltTable/);
});

test("board pieces and inventory share the dedicated physical piece family", async () => {
  const art = await read("src/art-assets.ts");
  const board = await read("src/game/scenes/BoardScene.ts");
  const inventory = await read("src/game/board/BoardInventory.ts");
  assert.match(art, /PHYSICAL_PIECE_FRAMES_BY_TYPE/);
  assert.match(board, /physicalPieceFrameForType\(piece\.type\)/);
  assert.match(inventory, /physicalPieceFrameForType\(type\)/);
});

test("functional board HUD uses the minimal Back Undo Hint Overflow contract", async () => {
  const hud = await read("src/game/board/BoardHud.ts");
  assert.match(hud, /makeMinimalButton/);
  assert.match(hud, /ОТМЕНА/);
  assert.match(hud, /ПОДСКАЗКА/);
  assert.match(hud, /•••/);
  assert.match(hud, /ОСТАЛОСЬ/);
  assert.doesNotMatch(hud, /ПАУЗА/);
  assert.doesNotMatch(hud, /МАГАЗИН/);
  assert.doesNotMatch(hud, /setMaterialRole/);
});
