import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("live board cells are asset-free primitive slots rendered for every plate cell", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /for \(const cell of this\.plateCells\)/);
  assert.match(board, /primitiveMetrics\.slotRadius/);
  assert.match(board, /\.fillPoints\(points, true\)/);
  assert.match(board, /\.strokePoints\(points, true\)/);
  assert.doesNotMatch(board, /\.fillCircle\(position\.x, position\.y, primitiveMetrics\.slotRadius\)/);
  assert.doesNotMatch(board, /GAMEPLAY_FRAMES\.hexIdle/);
  assert.doesNotMatch(board, /PHYSICAL_MATERIAL_FRAMES\.boardCell/);
});

test("live board pieces use primitive containers rather than dedicated texture families", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /const circle = this\.add\.graphics\(\)/);
  assert.match(board, /\.container\(0, 0, \[circle, label\]\)/);
  assert.match(board, /ATOM_LABELS\[piece\.type\]/);
  assert.doesNotMatch(board, /physicalPieceFrameForType\(piece\.type\)/);
});

test("primitive piece containers are positioned exactly on the hex center", async () => {
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(board, /view\.container[\s\S]{0,180}\.setPosition\(position\.x, position\.y\)/);
  assert.doesNotMatch(board, /view\.container[\s\S]{0,180}position\.y \+ this\.hexSize/);
});
