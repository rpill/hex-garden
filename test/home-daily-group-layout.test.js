import assert from "node:assert/strict";
import test from "node:test";

import {
  homeDailyGroupMetrics,
  homeLayoutMetrics,
} from "../src/game/navigation-layout.js";

test("short landscape Daily group leaves Chapters fully inside a 390px viewport", () => {
  const home = homeLayoutMetrics(844, 390);
  const daily = homeDailyGroupMetrics(home);
  const chaptersBottom = daily.groupY + daily.groupHeight / 2 + 10 + home.secondaryHeight;

  assert.ok(chaptersBottom <= 390, `chapters bottom ${chaptersBottom} must fit 390px viewport`);
});

test("Daily action and Archive regions have a real vertical gap", () => {
  const home = homeLayoutMetrics(597, 675);
  const daily = homeDailyGroupMetrics(home);
  const actionBottom = daily.actionY + daily.actionHeight / 2;
  const archiveTop = daily.archiveY - daily.archiveHeight / 2;

  assert.equal(archiveTop - actionBottom, daily.sectionGap);
  assert.ok(daily.sectionGap >= 8);
});
