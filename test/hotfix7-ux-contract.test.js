import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("restart is a permanent board HUD action and is not duplicated in pause menu", async () => {
  const [hud, board] = await Promise.all([
    source("src/game/board/BoardHud.ts"),
    source("src/game/scenes/BoardScene.ts"),
  ]);
  assert.match(hud, /onRestart:/);
  assert.match(hud, /restartButton/);
  assert.match(hud, /this\.restartButton/);
  assert.match(board, /onRestart:\s*\(\) => this\.restartLevel\(\)/);
  const menuStart = board.indexOf("openPauseMenu(): void");
  const menuEnd = board.indexOf("closePauseMenu(): void", menuStart);
  assert.ok(menuStart >= 0 && menuEnd > menuStart);
  const menuBlock = board.slice(menuStart, menuEnd);
  assert.doesNotMatch(menuBlock, /id:\s*"restart"/);
  assert.doesNotMatch(menuBlock, /restartFromPause/);
});

test("tutorial guide waits until the board intro animation is fully finished", async () => {
  const board = await source("src/game/scenes/BoardScene.ts");
  const start = board.indexOf("renderTutorialGuide(): void");
  const end = board.indexOf("hideTutorialNeighbourLabels(): void", start);
  assert.ok(start >= 0 && end > start);
  const block = board.slice(start, end);
  assert.match(block, /this\.introAnimator\?\.active !== true/);
});

test("rules card keeps diagram, copy, and paging controls inside the card", async () => {
  const rules = await source("src/game/scenes/RulesScene.ts");
  assert.match(rules, /ruleCardLayout/);
  assert.match(rules, /diagramCenterY/);
  assert.match(rules, /bodyY/);
  assert.match(rules, /navY/);
  assert.doesNotMatch(rules, /const centerY = height \/ 2 \+ 4/);
  assert.doesNotMatch(rules, /const navY = cardTop \+ cardHeight \+/);
});
