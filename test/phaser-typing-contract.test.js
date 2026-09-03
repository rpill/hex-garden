import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const boardSourceUrl = new URL("../src/game/scenes/BoardScene.ts", import.meta.url);
const uiSourceUrl = new URL("../src/game/ui.ts", import.meta.url);

test("BoardScene respects nullable Phaser input and exact optional view fields", async () => {
  const source = await readFile(boardSourceUrl, "utf8");
  assert.match(source, /glyph:\s*Phaser\.GameObjects\.Image\s*\|\s*undefined/);
  assert.match(source, /label:\s*Phaser\.GameObjects\.Text\s*\|\s*undefined/);
  assert.match(source, /if\s*\(hitZone\.input\)\s*hitZone\.input\.cursor\s*=\s*"pointer"/);
  assert.match(source, /const hitArea = view\.hitZone\.input\?\.hitArea/);
  assert.match(source, /override\s+update\(\):\s*void/);
});

test("AtlasButton icon and padding wrappers satisfy real Phaser contracts", async () => {
  const source = await readFile(uiSourceUrl, "utf8");
  assert.match(source, /type PositionableIcon\s*=\s*Phaser\.GameObjects\.Image\s*\|\s*Phaser\.GameObjects\.Graphics/);
  assert.match(source, /icon:PositionableIcon\|undefined/);
  assert.match(source, /setCustomIcon\(icon:PositionableIcon\|undefined/);
  assert.doesNotMatch(source, /this\.label\.setPadding\(left,top,right,bottom\)/);
});
