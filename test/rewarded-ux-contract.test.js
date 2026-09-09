import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function sourceOrEmpty(relativeUrl) {
  try {
    return await readFile(new URL(relativeUrl, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

test("paid Hint and Rescue use an explicit rewarded-offer overlay", async () => {
  const board = await sourceOrEmpty("../src/game/scenes/BoardScene.ts");
  const overlay = await sourceOrEmpty("../src/game/RewardedOfferOverlay.ts");

  assert.match(board, /RewardedOfferOverlay/);
  assert.match(board, /new BoardAssistance\([\s\S]{0,300}rewardedOffer/);
  assert.doesNotMatch(board, /this\.assistance\.confirmReward\(true\)/);

  assert.match(overlay, /СМОТРЕТЬ РЕКЛАМУ/);
  assert.match(overlay, /WATCH AD/);
  assert.match(overlay, /НАГРАДА/);
  assert.match(overlay, /REWARD/);
  assert.match(overlay, /ПОДСКАЗ/);
  assert.match(overlay, /HINT/);
  assert.match(overlay, /РЕШАЕМ/);
  assert.match(overlay, /SOLVABLE/);
});

test("rewarded offer blocks board interaction while it is visible", async () => {
  const board = await sourceOrEmpty("../src/game/scenes/BoardScene.ts");
  assert.match(board, /selectPiece\(piece: BoardPiece\): void \{[\s\S]{0,220}this\.rewardedAdPending/);
  assert.match(board, /restartLevel\(\): void \{[\s\S]{0,220}this\.rewardedAdPending/);
});
