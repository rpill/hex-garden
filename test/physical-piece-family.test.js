import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const physicalPieces = [
  ["salt", "piece-salt.png"],
  ["air", "piece-air.png"],
  ["fire", "piece-fire.png"],
  ["water", "piece-water.png"],
  ["earth", "piece-earth.png"],
  ["quicksilver", "piece-quicksilver.png"],
  ["gold", "piece-gold.png"],
  ["silver", "piece-silver.png"],
  ["copper", "piece-copper.png"],
  ["iron", "piece-iron.png"],
  ["tin", "piece-tin.png"],
  ["lead", "piece-lead.png"],
  ["vitae", "piece-vitae.png"],
  ["mors", "piece-mors.png"],
  ["quintessence", "piece-quintessence.png"],
];

test("dormant premium art registry still contains every physical atom sprite", async () => {
  const art = await read("src/art-assets.ts");
  for (const [key, file] of physicalPieces) {
    assert.match(art, new RegExp(`${key}:\\s*\\"physical-piece-${key}\\"`));
    assert.match(art, new RegExp(`physicalUrl\\(\\"${file.replace('.', '\\.')}\\"\\)`));
  }
});

test("live BoardScene intentionally ignores the dormant physical piece family", async () => {
  const art = await read("src/art-assets.ts");
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(art, /const PHYSICAL_PIECE_FRAMES_BY_TYPE/);
  assert.match(art, /return PHYSICAL_PIECE_FRAMES_BY_TYPE\[type\]/);
  assert.doesNotMatch(board, /physicalPieceFrameForType\(piece\.type\)/);
  assert.match(board, /ATOM_LABELS\[piece\.type\]/);
});

test("legacy inventory and mechanic cards may keep physical sprites until cleanup", async () => {
  const inventory = await read("src/game/board/BoardInventory.ts");
  const board = await read("src/game/scenes/BoardScene.ts");
  assert.match(inventory, /physicalPieceFrameForType\(type\)/);
  assert.match(board, /setMechanicCardGlyphTypes[\s\S]{0,900}physicalPieceFrameForType\(type\)/);
});
