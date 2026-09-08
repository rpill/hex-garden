import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy premium art registry may remain while live BoardScene no longer depends on its board cells", async () => {
  const art = await read("src/art-assets.ts");
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(art, /boardCell:\s*"physical-board-cell"/);
  assert.match(art, /pieceBall:\s*"physical-piece-ball"/);
  assert.doesNotMatch(board, /renderPhysicalCells\(\)/);
  assert.doesNotMatch(board, /PHYSICAL_MATERIAL_FRAMES\.boardCell/);
});

test("live board cells are primitive slots rendered for every plate cell", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /for \(const cell of this\.plateCells\)/);
  assert.match(board, /primitiveMetrics\.slotRadius/);
  assert.match(board, /\.fillCircle\(position\.x, position\.y, primitiveMetrics\.slotRadius\)/);
  assert.doesNotMatch(board, /GAMEPLAY_FRAMES\.hexIdle/);
});

test("live board pieces use primitive containers rather than dedicated physical sprites", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /const circle = this\.add\.graphics\(\)/);
  assert.match(board, /\.container\(0, 0, \[circle, label\]\)/);
  assert.match(board, /ATOM_LABELS\[piece\.type\]/);
  assert.doesNotMatch(board, /physicalPieceFrameForType\(piece\.type\)/);
});

test("legacy inventory can still reuse physical assets until its later cleanup", async () => {
  const inventory = await read("src/game/board/BoardInventory.ts");
  assert.match(inventory, /physicalPieceFrameForType\(type\)/);
  assert.match(inventory, /PHYSICAL_MATERIAL_FRAMES\.pieceBall/);
});

test("legacy mechanic cards can still reuse physical assets until their later cleanup", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /setMechanicCardGlyphTypes[\s\S]{0,700}physicalPieceFrameForType\(type\)/);
});

test("primitive piece containers are positioned exactly on the hex center", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /view\.container[\s\S]{0,180}\.setPosition\(position\.x, position\.y\)/);
  assert.doesNotMatch(board, /view\.container[\s\S]{0,180}position\.y \+ this\.hexSize/);
});

test("dormant physical scale constants no longer control live board token size", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  const inventory = await read("src/game/board/BoardInventory.ts");
  const layout = await read("src/game/physical-asset-layout.ts");
  assert.match(layout, /PHYSICAL_BOARD_CANVAS_SCALE\s*=\s*2\.35/);
  assert.match(layout, /PHYSICAL_PIECE_CANVAS_SCALE\s*=\s*2\.34/);
  assert.match(layout, /PHYSICAL_PIECE_UI_CANVAS_SCALE\s*=\s*1\.54/);
  assert.doesNotMatch(board, /PHYSICAL_BOARD_CANVAS_SCALE/);
  assert.doesNotMatch(board, /PHYSICAL_PIECE_CANVAS_SCALE/);
  assert.match(inventory, /radius \* 2\.12 \* PHYSICAL_PIECE_UI_CANVAS_SCALE/);
});
