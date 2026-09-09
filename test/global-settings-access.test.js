import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("settings stay reachable through the universal contextual menu on Home, Chapters, Board, and Leaderboard", async () => {
  const [menu, chapters, board, hud, leaderboard] = await Promise.all([
    readFile(new URL("../src/game/scenes/MenuScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/scenes/LevelSelectScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/board/BoardHud.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/scenes/LeaderboardScene.ts", import.meta.url), "utf8"),
  ]);

  assert.match(menu, /ContextMenuOverlay/);
  assert.match(menu, /openUtilityScene\(this, "settings", \{ returnScene: "menu" \}\)/);
  assert.match(chapters, /ContextMenuOverlay/);
  assert.match(chapters, /openUtilityScene\(this, "settings", \{ returnScene: "level-select" \}\)/);

  assert.match(hud, /onMenu:/);
  assert.match(hud, /menuButton/);
  assert.match(hud, /"☰"/);
  assert.match(board, /onMenu:\s*\(\) => this\.openPauseMenu\(\)/);
  assert.match(board, /this\.openUtilityScene\("settings"\)/);
  assert.match(board, /openCoveredUtilityScene\(this, key, \{ returnScene: "board" \}\)/);
  assert.match(leaderboard, /openUtilityScene\(this, "settings", \{ returnScene: "leaderboard" \}\)/);
});

test("Board chrome has one menu control instead of separate Settings and overflow controls", async () => {
  const hud = await readFile(new URL("../src/game/board/BoardHud.ts", import.meta.url), "utf8");
  assert.doesNotMatch(hud, /settingsButton|overflowButton|"⚙"|"•••"/);
  assert.match(hud, /menuButton = makeMinimalButton\(scene, "☰", actions\.onMenu\)\.setDepth\(70\)/);
  assert.match(hud, /this\.menuButton[\s\S]{0,260}setPosition/);
});
