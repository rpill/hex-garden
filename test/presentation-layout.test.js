import assert from "node:assert/strict";
import test from "node:test";

import {
  completionCardMetrics,
  chapterGridMetrics,
  shopGridMetrics,
} from "../src/game/presentation-layout.js";
import { boardFloatingMetrics } from "../src/game/responsive-layout.js";

test("desktop chapters use one ten-level row per chapter", () => {
  const layout = chapterGridMetrics(1280, 800, 92);
  assert.equal(layout.columns, 10);
  assert.equal(layout.rowsPerChapter, 1);
  assert.ok(layout.tileWidth >= 72);
  assert.ok(layout.tileHeight >= 38);
  assert.ok(layout.totalHeight <= 800 - 92 - 12);
});

test("portrait chapters use readable five-column sections", () => {
  const layout = chapterGridMetrics(390, 844, 96);
  assert.equal(layout.columns, 5);
  assert.equal(layout.rowsPerChapter, 2);
  assert.ok(layout.tileWidth >= 60);
  assert.ok(layout.tileHeight >= 40);
  assert.ok(layout.totalHeight <= 844 - 96 - 12);
});

test("short landscape chapters remain five compact rows", () => {
  const layout = chapterGridMetrics(844, 390, 72);
  assert.equal(layout.columns, 10);
  assert.equal(layout.rowsPerChapter, 1);
  assert.ok(layout.tileHeight >= 28);
  assert.ok(layout.totalHeight <= 390 - 72 - 8);
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


test("floating board metrics reserve space without a top-bar height contract", () => {
  const desktop = boardFloatingMetrics(1280, 800);
  const portrait = boardFloatingMetrics(390, 844);
  const landscape = boardFloatingMetrics(844, 390);

  assert.equal(desktop.contentLeft, 0);
  assert.equal(portrait.contentLeft, 0);
  assert.equal(landscape.actionRail, true);
  assert.ok(landscape.contentLeft > 0);
  for (const metrics of [desktop, portrait, landscape]) {
    assert.ok(metrics.contentWidth > 0);
    assert.ok(metrics.topInset > 0);
  }
});
