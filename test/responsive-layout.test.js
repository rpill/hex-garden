import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyBoardViewport,
  isShortLandscape,
} from "../src/game/responsive-layout.js";

test("phone portrait uses the compact portrait board", () => {
  assert.deepEqual(classifyBoardViewport(414, 896), {
    compact: true,
    portrait: true,
    sideDock: false,
  });
});

test("phone landscape uses a side dock without affecting desktop", () => {
  assert.equal(classifyBoardViewport(896, 414).sideDock, true);
  assert.equal(classifyBoardViewport(1920, 1080).sideDock, false);
  assert.equal(isShortLandscape(896, 414), true);
});

test("rotation changes layout class in both directions", () => {
  const portrait = classifyBoardViewport(430, 932);
  const landscape = classifyBoardViewport(932, 430);
  assert.equal(portrait.portrait, true);
  assert.equal(landscape.portrait, false);
  assert.equal(landscape.sideDock, true);
});
