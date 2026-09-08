import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const boardSourceUrl = new URL("../src/game/scenes/BoardScene.ts", import.meta.url);
const uiSourceUrl = new URL("../src/game/ui.ts", import.meta.url);

test("BoardScene primitive PieceView respects Phaser input contracts", async () => {
  const source = await readFile(boardSourceUrl, "utf8");
  assert.match(source, /circle:\s*Phaser\.GameObjects\.Graphics;/);
  assert.match(source, /label:\s*Phaser\.GameObjects\.Text;/);
  assert.match(source, /hitZone:\s*Phaser\.GameObjects\.Zone;/);
  assert.doesNotMatch(source, /glyph:\s*Phaser\.GameObjects\.Image/);
  assert.match(source, /if\s*\(hitZone\.input\)\s*hitZone\.input\.cursor\s*=\s*"pointer"/);
  assert.match(source, /const hitArea = view\.hitZone\.input\?\.hitArea/);
  assert.match(source, /override\s+update\(\):\s*void/);
});

test("AtlasButton icon and padding wrappers satisfy real Phaser contracts", async () => {
  const source = await readFile(uiSourceUrl, "utf8");
  assert.match(source, /type PositionableIcon\s*=\s*Phaser\.GameObjects\.Image\s*\|\s*Phaser\.GameObjects\.Graphics/);
  assert.match(source, /icon:\s*PositionableIcon\s*\|\s*undefined/);
  assert.match(source, /setCustomIcon\(icon:\s*PositionableIcon\s*\|\s*undefined/);
  assert.doesNotMatch(source, /this\.label\.setPadding\(left,top,right,bottom\)/);
});


test("BoardTutorial avoids explicit undefined for exact optional callout preferences", async () => {
  const source = await readFile(new URL("../src/game/board/BoardTutorial.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^\s*preferredSides:\s*state\.preferredSides,?$/m);
  assert.match(source, /\.\.\.\(state\.preferredSides \? \{ preferredSides: state\.preferredSides \} : \{\}\)/);
});
