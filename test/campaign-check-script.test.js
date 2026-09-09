import test from "node:test";
import assert from "node:assert/strict";

test("campaign check validates the complete frozen fifty-level campaign by default", async () => {
  const originalArgv = process.argv;
  const originalWrite = process.stdout.write;
  const output = [];

  process.argv = [process.execPath, "scripts/check-campaign.mjs"];
  process.stdout.write = (chunk) => {
    output.push(String(chunk));
    return true;
  };

  try {
    await import(`../scripts/check-campaign.mjs?acceptance=${Date.now()}`);
  } finally {
    process.argv = originalArgv;
    process.stdout.write = originalWrite;
  }

  const text = output.join("");
  assert.match(text, /Replay-verified frozen campaign levels: 50\/50/);
  assert.doesNotMatch(text, /250/);
});
