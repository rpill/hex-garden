import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const minimalUiUrl = new URL("../src/game/minimal-ui.ts", import.meta.url);

function readSource() {
  return fs.readFileSync(minimalUiUrl, "utf8");
}

test("minimal UI does not depend on generated or premium art assets", () => {
  const source = readSource();
  assert.doesNotMatch(source, /art-assets|GAMEPLAY_UI_FRAMES|UI_FRAMES|NineSlice|preloadUiAssets/);
  assert.match(source, /Phaser\.GameObjects\.Graphics|scene\.add\.graphics/);
});

test("minimal UI exposes the functional primitive contract", () => {
  const source = readSource();
  assert.match(source, /export class MinimalButton extends Phaser\.GameObjects\.Container/);
  assert.match(source, /setLabel\(text: string\): this/);
  assert.match(source, /setEnabled\(enabled: boolean\): this/);
  assert.match(source, /setSize\(width: number, height: number\): this/);
  assert.match(source, /export function makeMinimalButton/);
  assert.match(source, /export function makeMinimalCard/);
  assert.match(source, /export function makeMinimalText/);
  assert.match(source, /export function layoutMinimalButton/);
});
