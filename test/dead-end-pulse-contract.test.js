import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const board = fs.readFileSync(new URL('../src/game/scenes/BoardScene.ts', import.meta.url), 'utf8');

test('no-moves notice uses a soft repeating pulse and the pulse is stopped when state clears', () => {
  assert.match(board, /campaignDeadEndPulse/);
  assert.match(board, /this\.tweens\.add\([\s\S]*campaignDeadEndTitle[\s\S]*yoyo:\s*true[\s\S]*repeat:\s*-1/);
  assert.match(board, /campaignDeadEndPulse\?\.stop\(\)/);
});
