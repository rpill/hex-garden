import test from "node:test";
import assert from "node:assert/strict";
import { YandexTrustedClock } from "../src/platform/trusted-clock.js";
import { dailyDateKey } from "../src/daily-calendar.js";

test("trusted clock converts Yandex server milliseconds to a Date for Daily calendar use", async () => {
  const timestamp = Date.parse("2026-09-07T21:00:00.000Z");
  const clock = new YandexTrustedClock({ serverTime: async () => timestamp });
  const now = await clock.now();

  assert.ok(now instanceof Date);
  assert.equal(now.getTime(), timestamp);
  assert.equal(dailyDateKey(now), "2026-09-08");
});

test("trusted clock stays unavailable when Yandex server time is unavailable", async () => {
  const clock = new YandexTrustedClock({ serverTime: async () => null });
  assert.equal(await clock.nowMs(), null);
  assert.equal(await clock.now(), null);
});
