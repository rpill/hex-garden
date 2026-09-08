import test from "node:test";
import assert from "node:assert/strict";
import {
  ENDLESS_PROGRESS_STORAGE_KEY,
  EndlessProgressStore,
  normalizeEndlessProgress,
} from "../src/index.js";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("endless progress starts with zero boards-cleared records", () => {
  const store = new EndlessProgressStore({ storage: new MemoryStorage() });
  assert.deepEqual(store.snapshot, {
    version: 1,
    bestUnassistedBoards: 0,
    bestAssistedBoards: 0,
  });
});

test("assisted run never replaces unassisted best", () => {
  const store = new EndlessProgressStore({ storage: new MemoryStorage() });

  store.submit({ boardsCleared: 7, assisted: false });
  store.submit({ boardsCleared: 20, assisted: true });

  assert.equal(store.snapshot.bestUnassistedBoards, 7);
  assert.equal(store.snapshot.bestAssistedBoards, 20);
});

test("endless records only move upward and persist under the v1 key", () => {
  const storage = new MemoryStorage();
  const store = new EndlessProgressStore({ storage });

  store.submit({ boardsCleared: 8, assisted: false });
  store.submit({ boardsCleared: 3, assisted: false });
  store.submit({ boardsCleared: 11, assisted: true });
  store.submit({ boardsCleared: 4, assisted: true });

  assert.equal(store.snapshot.bestUnassistedBoards, 8);
  assert.equal(store.snapshot.bestAssistedBoards, 11);

  const saved = JSON.parse(storage.getItem(ENDLESS_PROGRESS_STORAGE_KEY));
  assert.deepEqual(saved, store.snapshot);
});

test("damaged endless progress is normalized without reading legacy score state", () => {
  assert.deepEqual(
    normalizeEndlessProgress({
      version: 1,
      bestUnassistedBoards: -4,
      bestAssistedBoards: 7.5,
      score: 999999,
      streak: 42,
    }),
    {
      version: 1,
      bestUnassistedBoards: 0,
      bestAssistedBoards: 0,
    },
  );
});

test("submit rejects non-negative-safe-integer violations", () => {
  const store = new EndlessProgressStore({ storage: new MemoryStorage() });

  for (const boardsCleared of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN]) {
    assert.throws(() => store.submit({ boardsCleared, assisted: false }), RangeError);
  }
});
