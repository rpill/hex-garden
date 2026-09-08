import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const overlayUrl = new URL("../src/game/completion-overlay.ts", import.meta.url);
const modelUrl = new URL("../src/game/completion-presentation.ts", import.meta.url);
const boardSceneUrl = new URL("../src/game/scenes/BoardScene.ts", import.meta.url);

test("completion overlay is a minimal Solved/Clean surface with no economy presentation", () => {
  const source = fs.readFileSync(overlayUrl, "utf8");
  assert.doesNotMatch(source, /dust|score|multiplier|shop|inventory|GAMEPLAY_UI_FRAMES|UI_FRAMES|makeCurrencyDisplay/i);
  assert.match(source, /MinimalButton|makeMinimalButton/);
  assert.match(source, /onTryClean/);
  assert.match(source, /onNext/);
  assert.match(source, /onHome/);
});

test("campaign completion model offers Try Clean only after assisted completion", async () => {
  assert.ok(
    fs.existsSync(fileURLToPath(modelUrl)),
    "completion-presentation.ts must exist before its model can be exercised",
  );
  const { createCampaignCompletionPresentation } = await import("../src/game/completion-presentation.js");

  const assisted = createCampaignCompletionPresentation({
    level: 7,
    clean: false,
    cleanCount: 3,
    chapterComplete: false,
  });
  assert.equal(assisted.showTryClean, true);
  assert.equal(assisted.status, "assisted");

  const clean = createCampaignCompletionPresentation({
    level: 7,
    clean: true,
    cleanCount: 4,
    chapterComplete: false,
  });
  assert.equal(clean.showTryClean, false);
  assert.equal(clean.status, "clean");
});

test("endless result keeps clean best canonical while assisted best remains separate", async () => {
  const { createEndlessCompletionPresentation } = await import("../src/game/completion-presentation.js");
  const { EndlessProgressStore } = await import("../src/endless-progress.js");

  class MemoryStorage {
    values = new Map();
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
  }

  const store = new EndlessProgressStore({ storage: new MemoryStorage() });
  store.submit({ boardsCleared: 6, assisted: false });

  const cleanSnapshot = store.submit({ boardsCleared: 8, assisted: false });
  const clean = createEndlessCompletionPresentation({
    boardsCleared: 8,
    assisted: false,
    bestUnassistedBoards: cleanSnapshot.bestUnassistedBoards,
  });
  assert.deepEqual(clean, {
    boardsCleared: 8,
    assisted: false,
    bestCleanBoards: 8,
  });

  const assistedSnapshot = store.submit({ boardsCleared: 12, assisted: true });
  const assisted = createEndlessCompletionPresentation({
    boardsCleared: 12,
    assisted: true,
    bestUnassistedBoards: assistedSnapshot.bestUnassistedBoards,
  });
  assert.deepEqual(assisted, {
    boardsCleared: 12,
    assisted: true,
    bestCleanBoards: 8,
  });
  assert.equal(assistedSnapshot.bestAssistedBoards, 12);
});

test("campaign clear persists attempt Clean state instead of score or currency rewards", () => {
  const source = fs.readFileSync(boardSceneUrl, "utf8");
  assert.match(source, /const clean = this\.campaignSession\?\.cleanEligible === true/);
  assert.match(source, /this\.progress\.complete\(this\.level, \{\s*clean,?\s*\}\)/s);
  assert.doesNotMatch(source, /claimCampaignLevel\(/);
  assert.doesNotMatch(source, /syncCampaignScore\(snapshot\.campaignScore\)/);
});
