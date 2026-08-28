import test from "node:test";
import assert from "node:assert/strict";
import { sceneHeaderMetrics } from "../src/game/navigation-layout.js";

test("scene header keeps navigation at the same semantic anchors", () => {
  for (const [width, height] of [[414, 896], [896, 414], [1440, 900]]) {
    const layout = sceneHeaderMetrics(width, height);
    assert.ok(layout.backX < width * 0.2);
    assert.equal(layout.titleX, width / 2);
    assert.ok(layout.rightX > width * 0.8);
    assert.equal(layout.y, layout.headerHeight / 2);
  }
});

test("scene header uses touch-sized controls", () => {
  const portrait = sceneHeaderMetrics(414, 896);
  const landscape = sceneHeaderMetrics(896, 414);
  assert.ok(portrait.controlHeight >= 42);
  assert.ok(landscape.controlHeight >= 40);
  assert.ok(portrait.backWidth >= 92);
});
