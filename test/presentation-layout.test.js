import assert from "node:assert/strict";
import test from "node:test";

import {
  completionCardMetrics,
  levelGridMetrics,
  shopGridMetrics,
} from "../src/game/presentation-layout.js";

test("desktop campaign layout uses large tiles and at most six columns", () => {
  const layout = levelGridMetrics(1768, 864, 25, 80);
  assert.ok(layout.columns >= 5 && layout.columns <= 6);
  assert.ok(layout.tileWidth >= 120);
  assert.ok(layout.tileHeight >= 82);
  assert.ok(layout.gridWidth > 700);
});

test("portrait campaign layout remains readable without ten tiny columns", () => {
  const layout = levelGridMetrics(390, 844, 25, 72);
  assert.ok(layout.columns >= 3 && layout.columns <= 4);
  assert.ok(layout.tileWidth >= 80);
});

test("shop uses three cards on desktop, stays single-row in short landscape, and stacks on narrow portrait", () => {
  assert.equal(shopGridMetrics(1200, 760, 3, 80).columns, 3);
  const shortLandscape = shopGridMetrics(589, 554, 3, 72);
  assert.equal(shortLandscape.columns, 3);
  assert.ok(shortLandscape.cardHeight <= 270);
  assert.equal(shopGridMetrics(390, 844, 3, 72).columns, 1);
});

test("completion card stays compact and makes room for optional unlock row", () => {
  const plain = completionCardMetrics(1200, 760, { hasUnlock: false });
  const unlocked = completionCardMetrics(1200, 760, { hasUnlock: true });
  assert.ok(plain.width >= 500 && plain.width <= 600);
  assert.ok(unlocked.height > plain.height);
  assert.ok(unlocked.height < 500);
});
