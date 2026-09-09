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


test("BoardHud is asset-free and exposes core board actions plus one contextual menu", async () => {
  const text = await readFile(
    new URL("../src/game/board/BoardHud.ts", import.meta.url),
    "utf8",
  );

  assert.match(text, /onBack:/);
  assert.match(text, /onUndo:/);
  assert.match(text, /onRestart:/);
  assert.match(text, /restartButton/);
  assert.match(text, /onHint:/);
  assert.match(text, /onMenu:/);
  assert.match(text, /menuButton/);
  assert.match(text, /"☰"/);
  assert.doesNotMatch(text, /settingsButton|overflowButton|onSettings:|onOverflow:/);
  assert.match(text, /setIdentity\(/);
  assert.match(text, /setRemaining\(/);
  assert.match(text, /setCleanEligible\(/);
  assert.match(text, /setUndoEnabled\(/);
  assert.match(text, /setHintBusy\(/);

  assert.doesNotMatch(text, /dust|shop|inventory/i);
  assert.doesNotMatch(text, /GAMEPLAY_UI_FRAMES|UI_FRAMES|art-assets|makePanel|makeCurrencyDisplay/);
  assert.doesNotMatch(text, /onRescue:|rescueButton/);
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
  assert.match(text, /backgroundGraphics[\s\S]{0,160}MINIMAL_UI_COLORS\.background/);
  assert.doesNotMatch(text, /scene-background|layoutPaperBackground|createPaperBackground/);
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

test("tutorial completion persists once and restarts directly into Campaign Level 1", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const hudSource = await readFile(
    new URL("../src/game/board/BoardHud.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    boardSource,
    /this\.progress\.completeTutorial\(\);[\s\S]{0,220}this\.scene\.restart\(\{ mode: PlayMode\.CAMPAIGN, level: 0 \}\)/,
  );
  assert.doesNotMatch(boardSource, /showTutorialCompletion/);
  assert.doesNotMatch(boardSource, /ОБУЧЕНИЕ ПРОЙДЕНО/);
  assert.doesNotMatch(boardSource, /compactTransition: true/);
  assert.doesNotMatch(hudSource, /nextButton/);
  assert.doesNotMatch(hudSource, /onNext/);
});

test("BoardScene wires the contextual menu and permanent restart into the minimal HUD", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.match(boardSource, /onBack:/);
  assert.match(boardSource, /onUndo:\s*\(\) => this\.usePrimaryUndoAction\(\)/);
  assert.match(boardSource, /onRestart:\s*\(\) => this\.restartLevel\(\)/);
  assert.match(boardSource, /onHint:\s*\(\) => this\.usePrimaryHint\(\)/);
  assert.match(boardSource, /onMenu:\s*\(\) => this\.openPauseMenu\(\)/);
  assert.match(boardSource, /this\.openUtilityScene\("settings"\)/);
  assert.match(boardSource, /this\.openUtilityScene\("rules"\)/);
  assert.match(boardSource, /this\.hud\.layout\(width, height\)/);
  assert.doesNotMatch(boardSource, /this\.(?:shopButton|settingsButton|dustHud|headerPanel)/);
});


test("Campaign BoardScene constructs a fixed CampaignBoardSession without a worker request", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );

  assert.match(boardSource, /new CampaignBoardSession\(getCampaignLevel\(this\.level\)\)/);
  assert.doesNotMatch(boardSource, /PlayMode\.CAMPAIGN\s*\?\s*await this\.generator\.generate\(this\.level\)/);
  assert.doesNotMatch(boardSource, /generateProgression\(this\.level/);
  assert.match(boardSource, /CAMPAIGN_LEVEL_COUNT/);
});

test("board staging hides placeholder geometry and pieces until the real intro reveals them", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /levelGeometryReady\s*=\s*false/);
  assert.match(source, /if \(this\.levelGeometryReady\)[\s\S]{0,500}for \(const cell of this\.plateCells\)/);
  assert.match(source, /introAnimator\?\.active[\s\S]{0,500}inventory\.setPresentationVisible/);
});

test("Campaign board startup has no legacy mechanic-introduction gate", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /mechanicIntroductionForLevel/);
  assert.doesNotMatch(source, /showMechanicCardForLevel/);
});

test("spiral reveal keeps atom inventory visible but disables board interaction", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const inventorySource = await readFile(
    new URL("../src/game/board/BoardInventory.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    boardSource,
    /const inventoryVisible\s*=\s*this\.board !== undefined/,
  );
  assert.match(
    boardSource,
    /const boardActionsEnabled\s*=\s*inventoryVisible && !introActive/,
  );
  assert.match(
    boardSource,
    /inventory\.setPresentationVisible\(inventoryVisible, boardActionsEnabled\)/,
  );
  assert.match(inventorySource, /setPresentationVisible\(visible: boolean, controlsEnabled = visible\)/);
  assert.match(inventorySource, /if \(visible && controlsEnabled\)[\s\S]{0,300}setInteractive/);
  assert.match(inventorySource, /else \{\s*view\.hitZone\.disableInteractive\(\)/);
  assert.doesNotMatch(inventorySource, /hintButtons|HintType|ХОД \+|ОТМЕНА \+|СПАСТИ \+/);
});

test("spiral reveal derives live inventory counts from revealed board pieces", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const inventorySource = await readFile(
    new URL("../src/game/board/BoardInventory.ts", import.meta.url),
    "utf8",
  );

  assert.match(boardSource, /startBoardIntro\([^)]*\): void \{[\s\S]{0,300}this\.introRevealedKeys = new Set\(\)/);
  assert.match(boardSource, /introInventoryRevealState\(\)/);
  assert.match(boardSource, /revealedCounts = new Map<AtomType, number>\(\)/);
  assert.match(boardSource, /this\.introRevealedKeys\.has\(key\)/);
  assert.match(boardSource, /entranceProgress\(key, this\.time\.now\)/);
  assert.match(boardSource, /this\.inventory\.render\(state, introReveal\)/);

  assert.match(inventorySource, /export interface BoardInventoryRevealState/);
  assert.match(inventorySource, /revealedCounts: ReadonlyMap<AtomType, number>/);
  assert.match(inventorySource, /activationProgress: ReadonlyMap<AtomType, number>/);
  assert.match(inventorySource, /revealedCount > 0/);
  assert.match(inventorySource, /`×\$\{revealedCount\}`/);
  assert.match(inventorySource, /lastIntroCount/);
});


test("Home stays asset-free and omits legacy meta destinations", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/MenuScene.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /createHomeModel/);
  assert.match(source, /makeMinimalButton/);
  assert.match(source, /PlayMode\.TUTORIAL/);
  assert.match(source, /PlayMode\.CAMPAIGN/);
  assert.match(source, /scene\.start\("level-select"\)/);
  assert.match(source, /openUtilityScene\(this, "settings", \{ returnScene: "menu" \}\)/);

  assert.doesNotMatch(source, /art-assets|scene-background|preloadUiAssets|makePanel|NineSlice/);
  assert.doesNotMatch(source, /getEconomy|getLeaderboard|makeCurrencyDisplay|makeCartIconButton/);
  assert.doesNotMatch(source, /scene\.start\("shop"|scene\.start\("leaderboard"/);
  assert.match(source, /PlayMode\.DAILY/);
  assert.match(source, /PlayMode\.ENDLESS/);
});

test("BoardScene creates the reusable context menu before the first layout pass", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const firstLayout = source.indexOf("    this.layout();");
  const contextMenu = source.indexOf("this.contextMenu = new ContextMenuOverlay(this)");

  assert.ok(firstLayout > 0, "BoardScene must perform an initial layout");
  assert.ok(contextMenu > 0 && contextMenu < firstLayout, "context menu must exist before layout");
  assert.doesNotMatch(source, /pauseMenuGraphics|pauseMenuPanel|pauseMenuHitZone/);
});

test("primitive board renders empty plate cells as hexagons instead of circles", async () => {
  const source = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("this.cellGraphics.clear();");
  const end = source.indexOf("this.atomGraphics.clear();", start);
  assert.ok(start >= 0 && end > start, "board slot rendering block must exist");
  const cellBlock = source.slice(start, end);

  assert.match(cellBlock, /strokePoints\(/);
  assert.match(cellBlock, /fillPoints\(/);
  assert.doesNotMatch(cellBlock, /fillCircle\(|strokeCircle\(/);
});

test("remaining inventory uses the same primitive token palette and labels as board pieces", async () => {
  const boardSource = await readFile(
    new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
    "utf8",
  );
  const inventorySource = await readFile(
    new URL("../src/game/board/BoardInventory.ts", import.meta.url),
    "utf8",
  );

  assert.match(boardSource, /glyphFrameForType:\s*\(\)\s*=>\s*undefined/);
  assert.doesNotMatch(boardSource, /atomGlyphFrame/);
  assert.match(inventorySource, /colorForType\(entry\.type\)/);
  assert.match(inventorySource, /fillCircle\(x, y, displayRadius\)/);
  assert.match(inventorySource, /labelForType\(type\)/);
});
