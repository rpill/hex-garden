import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const forbidden = ["../../board.js", "../../solver.js", "../../progression.js"];

for (const file of ["BoardHud.ts", "BoardInventory.ts", "BoardTutorial.ts", "BoardIntroAnimator.ts"]) {
  test(`${file} stays presentation-only`, async () => {
    const text = await readFile(new URL(`../src/game/board/${file}`, import.meta.url), "utf8");
    for (const specifier of forbidden) {
      assert.doesNotMatch(text, new RegExp(specifier.replaceAll(".", "\\.")));
    }
  });
}


test("BoardHud owns an always-available restart action", async () => {
  const text = await readFile(
    new URL("../src/game/board/BoardHud.ts", import.meta.url),
    "utf8",
  );
  assert.match(text, /onRestart:/);
  assert.match(text, /restartButton/);
  assert.match(text, /GAMEPLAY_UI_FRAMES\.retry/);
});


test("BoardScene has no tutorial-only piece legality gate", async () => {
  const text = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(text, /tutorialAllowsPiece/);
});


test("BoardScene does not draw full-width top or bottom chrome slabs", async () => {
  const text = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(text, /fillRect\(0, 0, width, topBarHeight\)/);
  assert.doesNotMatch(text, /fillRect\(0, dockTop, width, height - dockTop\)/);
  assert.doesNotMatch(text, /boardChromeMetrics/);
  assert.match(text, /boardFloatingMetrics/);
  assert.match(text, /layoutPaperBackground\([^;]+bands:\s*false/s);
});


test("tutorial third step targets the remaining-count inventory panel", async () => {
  const text = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.match(text, /tutorialStep === 2[\s\S]{0,800}panelLayout/);
  assert.match(text, /targetBounds:/);
  assert.match(text, /preferredSides/);
});

test("tutorial completion uses one focused Level 1 transition instead of a HUD play button", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const hudSource = await readFile(
    new URL("../src/game/board/BoardHud.ts", import.meta.url),
    "utf8",
  );
  const completionSource = await readFile(
    new URL("../src/game/completion-overlay.ts", import.meta.url),
    "utf8",
  );

  assert.match(boardSource, /showTutorialCompletion/);
  assert.match(boardSource, /ОБУЧЕНИЕ ПРОЙДЕНО/);
  assert.match(boardSource, /УРОВЕНЬ 1 →/);
  assert.match(boardSource, /mode: PlayMode\.CAMPAIGN, level: 0/);
  assert.match(boardSource, /compactTransition: true/);
  assert.doesNotMatch(hudSource, /nextButton/);
  assert.doesNotMatch(hudSource, /onNext/);
  assert.match(completionSource, /compactTransition/);
});

test("restart stays in the system-control group and never joins consumable layout", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const inventorySource = await readFile(
    new URL("../src/game/board/BoardInventory.ts", import.meta.url),
    "utf8",
  );

  assert.match(boardSource, /systemRestartX/);
  assert.doesNotMatch(boardSource, /hintEntries\.length \* actionStep \+ restartWidth/);
  assert.doesNotMatch(boardSource, /hintEntries\.length \* 48\)/);
  assert.match(inventorySource, /HintType\.MOVE/);
  assert.match(inventorySource, /HintType\.UNDO/);
  assert.match(inventorySource, /HintType\.RESCUE/);
  assert.doesNotMatch(inventorySource, /GAMEPLAY_UI_FRAMES\.retry/);
});

test("board staging hides placeholder geometry and pieces until the real intro reveals them", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /levelGeometryReady\s*=\s*false/);
  assert.match(source, /if \(this\.levelGeometryReady\)[\s\S]{0,500}for \(const cell of this\.plateCells\)/);
  assert.match(source, /this\.mechanicCardVisible[\s\S]{0,300}view\.glyph\?\.setVisible\(false\)/);
  assert.match(source, /introAnimator\?\.active[\s\S]{0,500}inventory\.setPresentationVisible/);
});

test("mechanic cards show the real glyphs for every introduced atom", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /mechanicCardGlyphs/);
  assert.match(source, /introduction\.requiredTypes/);
  assert.match(source, /atomGlyphFrame\(type\)/);
  assert.match(source, /layoutMechanicCardGlyphs/);
});
