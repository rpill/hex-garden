import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("small square MinimalButton keeps enough label width for icon glyphs", async () => {
  const minimal = await source("src/game/minimal-ui.ts");
  assert.doesNotMatch(minimal, /this\.buttonWidth - 28/);
  assert.match(minimal, /labelWidthForButton/);
});

test("Campaign and Daily dead end waits before showing a non-blocking notice", async () => {
  const [board, hud] = await Promise.all([
    source("src/game/scenes/BoardScene.ts"),
    source("src/game/board/BoardHud.ts"),
  ]);

  assert.match(board, /CAMPAIGN_DEAD_END_DELAY_MS\s*=\s*800/);
  assert.match(board, /scheduleCampaignDeadEndState\(\)/);
  assert.match(board, /delayedCall\(CAMPAIGN_DEAD_END_DELAY_MS/);
  assert.match(hud, /setCampaignDeadEndState\(/);
  assert.match(hud, /"ЗАНОВО"/);
  assert.match(hud, /"СПАСТИ"/);

  const layoutStart = board.indexOf("layoutCampaignDeadEnd(width: number, height: number)");
  const layoutEnd = board.indexOf("layoutPauseMenu(width: number, height: number)", layoutStart);
  assert.ok(layoutStart >= 0 && layoutEnd > layoutStart);
  const layoutBlock = board.slice(layoutStart, layoutEnd);
  assert.doesNotMatch(layoutBlock, /fillRect\(0, 0, width, height\)/);
  assert.doesNotMatch(layoutBlock, /centerY\s*=\s*height\s*\/\s*2/);
});

test("Rescue remembers the losing move without painting it as a hint", async () => {
  const board = await source("src/game/scenes/BoardScene.ts");
  assert.match(board, /blockedMoveKey/);
  assert.match(board, /wouldCompleteBlockedMove/);
  assert.doesNotMatch(board, /blocked:\s*isBlocked/);
  assert.doesNotMatch(board, /feedback === "blocked"/);
});

test("unfinished Tutorial exits to Home and never exposes Level Select", async () => {
  const board = await source("src/game/scenes/BoardScene.ts");

  assert.match(
    board,
    /onBack:\s*\(\) => \{[\s\S]{0,260}this\.mode === PlayMode\.TUTORIAL[\s\S]{0,120}this\.openMainMenu\(\)/,
  );
  assert.match(
    board,
    /openLevelSelect\(\): void \{[\s\S]{0,180}this\.mode !== PlayMode\.CAMPAIGN/,
  );
  assert.match(
    board,
    /this\.mode === PlayMode\.CAMPAIGN && !completionVisible/,
  );
});
