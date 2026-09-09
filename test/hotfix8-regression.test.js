import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rules = fs.readFileSync(new URL("../src/game/scenes/RulesScene.ts", import.meta.url), "utf8");
const settings = fs.readFileSync(new URL("../src/game/scenes/SettingsScene.ts", import.meta.url), "utf8");
const utility = fs.readFileSync(new URL("../src/game/utility-navigation.ts", import.meta.url), "utf8");

test("rules goal page uses a real seven-cell hex neighbourhood instead of the old four-cell sketch", () => {
  assert.match(rules, /GOAL_FRAGMENT_CELLS/);
  assert.match(rules, /\{\s*q:\s*0,\s*r:\s*0\s*\}/);
  assert.match(rules, /\{\s*q:\s*1,\s*r:\s*0\s*\}/);
  assert.match(rules, /\{\s*q:\s*0,\s*r:\s*1\s*\}/);
  assert.match(rules, /\{\s*q:\s*-1,\s*r:\s*1\s*\}/);
  assert.match(rules, /\{\s*q:\s*-1,\s*r:\s*0\s*\}/);
  assert.match(rules, /\{\s*q:\s*0,\s*r:\s*-1\s*\}/);
  assert.match(rules, /\{\s*q:\s*1,\s*r:\s*-1\s*\}/);
  assert.match(rules, /drawGoalBoardFragment/);
  assert.doesNotMatch(rules, /centerX - 54 \* scale/);
});

test("settings is fully migrated to primitive minimal UI", () => {
  assert.match(settings, /MINIMAL_UI_COLORS/);
  assert.match(settings, /makeMinimalCard/);
  assert.match(settings, /makeMinimalButton/);
  assert.match(settings, /cameras\.main\.setBackgroundColor/);
  assert.doesNotMatch(settings, /art-assets|scene-background|preloadPaperBackground|createPaperBackground|layoutPaperBackground/);
  assert.doesNotMatch(settings, /makePanel|makeButton|resizeNineSlice|preloadUiAssets/);
});

test("utility navigation supports flat utility replacement and explicit exit to root scenes", () => {
  assert.match(utility, /export function switchUtilityScene/);
  assert.match(utility, /export function exitUtilityToScene/);
  assert.match(rules, /switchUtilityScene\(this, "settings"/);
  assert.match(settings, /switchUtilityScene\(this, "rules"/);
  assert.match(rules, /exitUtilityToScene\(this, "menu"/);
  assert.match(settings, /exitUtilityToScene\(this, "menu"/);
  assert.doesNotMatch(rules, /returnScene:\s*"rules"/);
  assert.doesNotMatch(settings, /returnScene:\s*"settings"/);
  assert.doesNotMatch(rules, /scene\.start\("menu"\)/);
  assert.doesNotMatch(settings, /scene\.start\("menu"\)/);
});
