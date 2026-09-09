import test from "node:test";
import assert from "node:assert/strict";
import { InterstitialAdGate } from "../src/game/interstitial-policy.js";

test("interstitial gate suppresses ads during the first three session minutes", () => {
  let now = 0;
  const gate = new InterstitialAdGate({ now: () => now, sessionStartedAtMs: 0 });

  now = 179_999;
  assert.equal(gate.tryBegin(), false);
  now = 180_000;
  assert.equal(gate.tryBegin(), true);
});

test("interstitial gate allows at most one request every three minutes", () => {
  let now = 180_000;
  const gate = new InterstitialAdGate({ now: () => now, sessionStartedAtMs: 0 });

  assert.equal(gate.tryBegin(), true);
  now = 359_999;
  assert.equal(gate.tryBegin(), false);
  now = 360_000;
  assert.equal(gate.tryBegin(), true);
});

test("ineligible transitions never consume the cooldown", () => {
  let now = 180_000;
  const gate = new InterstitialAdGate({ now: () => now, sessionStartedAtMs: 0 });

  assert.equal(gate.tryBegin(false), false);
  assert.equal(gate.tryBegin(true), true);
});
