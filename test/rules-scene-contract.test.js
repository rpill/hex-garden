import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rules = fs.existsSync(new URL('../src/game/scenes/RulesScene.ts', import.meta.url))
  ? fs.readFileSync(new URL('../src/game/scenes/RulesScene.ts', import.meta.url), 'utf8')
  : '';

test('rules are presented as illustrated gameplay cards with real atom examples', () => {
  assert.match(rules, /drawToken/);
  assert.match(rules, /Wa/);
  assert.match(rules, /Sa/);
  assert.match(rules, /Fi/);
  assert.match(rules, /V/);
  assert.match(rules, /M/);
  assert.match(rules, /Hg/);
  assert.match(rules, /Pb/);
  assert.match(rules, /Sn/);
  assert.match(rules, /Fe/);
  assert.match(rules, /Cu/);
  assert.match(rules, /Ag/);
  assert.match(rules, /Au/);
});

test('rules screen is pageable so it remains readable on phone landscape', () => {
  assert.match(rules, /previousButton/);
  assert.match(rules, /nextButton/);
  assert.match(rules, /pageIndex/);
  assert.match(rules, /RULE_PAGES/);
});
