import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { enumerateHexPlate } from "../src/hex.js";
import {
  boardPrimitiveMetrics,
  boardSlotKeys,
} from "../src/game/presentation-layout.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("primitive board metrics form a tight hex lattice with tokens breathing inside slots", () => {
  const metrics = boardPrimitiveMetrics(24);
  const horizontalCenterDistance = Math.sqrt(3) * 24;
  const visualHexWidth = Math.sqrt(3) * metrics.slotRadius;
  const visualGap = horizontalCenterDistance - visualHexWidth;
  const slotInradius = Math.cos(Math.PI / 6) * metrics.slotRadius;

  assert.ok(visualGap / 24 <= 0.12, "neighboring hex outlines should have only a tiny gap");
  assert.ok(
    metrics.tokenRadius / slotInradius <= 0.82,
    "tokens should leave visible breathing room inside their hex slots",
  );
  assert.ok(metrics.slotAlpha > 0 && metrics.slotAlpha < 0.3);
  assert.ok(metrics.tokenRadius >= 12);
  assert.ok(metrics.hitDiameter >= 42);

  const dense = boardPrimitiveMetrics(9);
  const denseInradius = Math.cos(Math.PI / 6) * dense.slotRadius;
  assert.ok(dense.tokenRadius / denseInradius <= 0.82);
});

test("slot model preserves every canonical plate cell independent of occupancy", () => {
  const small = enumerateHexPlate(3);
  const medium = enumerateHexPlate(4);
  const large = enumerateHexPlate(5);

  assert.equal(boardSlotKeys(small).length, 37);
  assert.equal(boardSlotKeys(medium).length, 61);
  assert.equal(boardSlotKeys(large).length, 91);
  assert.deepEqual(boardSlotKeys(small), small.map(({ q, r }) => `${q},${r}`));
});

test("BoardScene renders plate slots from plateCells and live pieces as primitive containers", async () => {
  const source = await read("src/game/scenes/BoardScene.ts");

  assert.match(source, /for \(const cell of this\.plateCells\)/);
  assert.match(source, /this\.add[\s\S]{0,40}\.container/);
  assert.match(source, /this\.add\.graphics/);
  assert.match(source, /ATOM_LABELS\[piece\.type\]/);
  assert.doesNotMatch(source, /renderPhysicalCells\(\)/);
  assert.doesNotMatch(source, /renderAtlasCells\(\)/);
  assert.doesNotMatch(source, /physicalPieceFrameForType\(piece\.type\)/);
});
