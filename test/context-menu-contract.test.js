import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const boardHud = fs.readFileSync(new URL('../src/game/board/BoardHud.ts', import.meta.url), 'utf8');
const board = fs.readFileSync(new URL('../src/game/scenes/BoardScene.ts', import.meta.url), 'utf8');
const chapters = fs.readFileSync(new URL('../src/game/scenes/LevelSelectScene.ts', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../src/game/scenes/MenuScene.ts', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../src/game/scenes/SettingsScene.ts', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const overlayUrl = new URL('../src/game/ContextMenuOverlay.ts', import.meta.url);
const rulesUrl = new URL('../src/game/scenes/RulesScene.ts', import.meta.url);
const overlay = fs.existsSync(overlayUrl) ? fs.readFileSync(overlayUrl, 'utf8') : '';
const rules = fs.existsSync(rulesUrl) ? fs.readFileSync(rulesUrl, 'utf8') : '';

test('board chrome exposes one clear menu button and no separate settings/overflow controls', () => {
  assert.doesNotMatch(boardHud, /settingsButton|overflowButton/);
  assert.match(boardHud, /menuButton/);
  assert.match(boardHud, /makeMinimalButton\(scene, "☰"/);
  assert.match(board, /ContextMenuOverlay/);
  assert.match(board, /openUtilityScene\("rules"\)/);
  assert.match(board, /openUtilityScene\("settings"\)/);
});

test('home, chapters, settings, and rules use the same contextual menu surface', () => {
  assert.doesNotMatch(home, /settingsButton|overflowButton/);
  assert.doesNotMatch(chapters, /settingsButton|overflowButton/);
  assert.match(home, /ContextMenuOverlay/);
  assert.match(chapters, /ContextMenuOverlay/);
  assert.match(home, /menuButton/);
  assert.match(chapters, /menuButton/);
  assert.match(home, /"☰"/);
  assert.match(chapters, /"☰"/);
  assert.match(settings, /ContextMenuOverlay/);
  assert.match(settings, /menuButton/);
  assert.match(settings, /"☰"/);
  assert.match(rules, /ContextMenuOverlay/);
  assert.match(rules, /menuButton/);
  assert.match(rules, /"☰"/);
});

test('context menu is reusable and supports scene-specific item sets', () => {
  assert.match(overlay, /export class ContextMenuOverlay/);
  assert.match(overlay, /ContextMenuItem/);
  assert.match(overlay, /open\(/);
  assert.match(overlay, /close\(/);
});

test('rules scene is a visual utility scene registered in Phaser', () => {
  assert.match(main, /RulesScene/);
  assert.match(main, /scene:\s*\[[^\]]*RulesScene/s);
  assert.match(rules, /class RulesScene/);
  assert.match(rules, /drawToken/);
  assert.match(rules, /drawHex/);
  assert.match(rules, /Wa/);
  assert.match(rules, /V/);
  assert.match(rules, /M/);
  assert.match(rules, /Hg/);
  assert.match(rules, /Pb/);
  assert.match(rules, /Au/);
});
