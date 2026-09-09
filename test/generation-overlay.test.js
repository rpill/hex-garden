import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const boardSource = () => readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
const overlaySource = () => readFile(new URL("../src/game/board/BoardGenerationOverlay.ts", import.meta.url), "utf8");

test("BoardScene owns a dedicated generation overlay", async () => {
  const source = await boardSource();
  assert.match(source, /BoardGenerationOverlay/);
  assert.match(source, /generationOverlay/);
});

test("generation overlay is shown only when the requested Endless board is not prefetched", async () => {
  const source = await boardSource();
  assert.match(source, /PlayMode\.ENDLESS && !this\.endlessPrefetch\?\.isReady\(this\.level\)/);
  assert.doesNotMatch(source, /PlayMode\.DAILY \|\| this\.mode === PlayMode\.ENDLESS/);
  assert.match(source, /generationOverlay\.show\(/);
  assert.match(source, /generationOverlay\.hide\(/);
});

test("generation overlay uses visible central copy and animated dots without fake progress", async () => {
  const source = await overlaySource();
  assert.match(source, /ГЕНЕРАЦИЯ УРОВНЯ|GENERATING LEVEL/);
  assert.match(source, /delayedCall|addEvent|time\.addEvent/);
  assert.doesNotMatch(source, /setText\([^\n]*%|PROGRESS|PERCENT|ПРОЦЕНТ/i);
});
