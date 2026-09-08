import assert from "node:assert/strict";
import test from "node:test";

import {
  GlobalAction,
  currencyPresentation,
  globalActionPresentation,
  globalActionIconSemantic,
  utilityReturnPlan,
} from "../src/game/presentation-model.js";

test("global action copy never duplicates icon symbols in text", () => {
  assert.deepEqual(globalActionPresentation(GlobalAction.BACK, false), {
    label: "НАЗАД",
    iconOnly: false,
  });
  assert.deepEqual(globalActionPresentation(GlobalAction.BACK, true), {
    label: "BACK",
    iconOnly: false,
  });
  for (const action of [GlobalAction.PAUSE, GlobalAction.SETTINGS]) {
    assert.equal(globalActionPresentation(action, false).label, "");
    assert.equal(globalActionPresentation(action, false).iconOnly, true);
  }
});

test("currency presentation carries only the dynamic numeric text", () => {
  assert.deepEqual(currencyPresentation(38), { value: 38, text: "38" });
  assert.deepEqual(currencyPresentation(8, { signed: true }), { value: 8, text: "+8" });
});


test("utility scenes resume a paused board but start ordinary return scenes", () => {
  assert.deepEqual(utilityReturnPlan("board"), { kind: "resume", scene: "board" });
  assert.deepEqual(utilityReturnPlan("settings"), { kind: "resume", scene: "settings" });
  assert.deepEqual(utilityReturnPlan("level-select"), { kind: "start", scene: "level-select" });
  assert.deepEqual(utilityReturnPlan("leaderboard"), { kind: "start", scene: "leaderboard" });
  assert.deepEqual(utilityReturnPlan("menu"), { kind: "start", scene: "menu" });
  assert.deepEqual(utilityReturnPlan("unknown"), { kind: "start", scene: "menu" });
});

