import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EndlessLevelPrefetch } from "../src/game/board/EndlessLevelPrefetch.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("prefetch generates a level once and take reuses the ready result", async () => {
  const pending = deferred();
  const calls = [];
  const prefetch = new EndlessLevelPrefetch((level) => {
    calls.push(level);
    return pending.promise;
  });

  prefetch.prefetch(1);
  assert.equal(prefetch.isReady(1), false);
  assert.deepEqual(calls, [1]);

  pending.resolve({ level: 1, id: "ready" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(prefetch.isReady(1), true);

  const result = await prefetch.take(1);
  assert.deepEqual(result, { level: 1, id: "ready" });
  assert.deepEqual(calls, [1]);
  assert.equal(prefetch.isReady(1), false);
});

test("take generates directly when the requested level was not prefetched", async () => {
  const calls = [];
  const prefetch = new EndlessLevelPrefetch(async (level) => {
    calls.push(level);
    return { level };
  });

  assert.deepEqual(await prefetch.take(0), { level: 0 });
  assert.deepEqual(calls, [0]);
});

test("failed prefetch is retried when the level is actually needed", async () => {
  let attempts = 0;
  const prefetch = new EndlessLevelPrefetch(async (level) => {
    attempts += 1;
    if (attempts === 1) throw new Error("prefetch failed");
    return { level, attempts };
  });

  prefetch.prefetch(2);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(prefetch.isReady(2), false);
  assert.deepEqual(await prefetch.take(2), { level: 2, attempts: 2 });
  assert.equal(attempts, 2);
});

test("BoardScene consumes prefetched Endless boards and immediately queues the next one", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");
  assert.match(source, /EndlessLevelPrefetch/);
  assert.match(source, /endlessPrefetch\.take\(this\.level\)/);
  assert.match(source, /endlessPrefetch\.prefetch\(this\.level \+ 1\)/);
  assert.match(source, /endlessPrefetch\?\.isReady\(this\.level\)/);
});
