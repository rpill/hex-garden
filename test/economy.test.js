import test from "node:test";
import assert from "node:assert/strict";
import {
  ECONOMY_STORAGE_KEY,
  EconomyStore,
  HintType,
  STARTING_DUST,
  dustRewardForPlate,
  endlessDustReward,
  normalizeEconomy,
  productForHint,
} from "../src/economy.js";

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

test("economy starts with dust and empty purchased hint inventory", () => {
  const store = new EconomyStore({ storage: new MemoryStorage() });
  assert.equal(store.snapshot.dust, STARTING_DUST);
  assert.deepEqual(store.snapshot.hints, {
    move: 0,
    undo: 0,
    rescue: 0,
  });
});

test("an isolated test economy can start with a large disposable balance", () => {
  const store = new EconomyStore({ storage: null, startingDust: 999_999 });
  assert.equal(store.snapshot.dust, 999_999);
  store.purchase(productForHint(HintType.RESCUE).id);
  assert.equal(store.snapshot.dust, 999_939);
  assert.equal(store.reset().dust, 999_999);
  assert.throws(
    () => new EconomyStore({ storage: null, startingDust: -1 }),
    /startingDust/,
  );
});

test("shop purchases charges rather than direct hint effects", () => {
  const store = new EconomyStore({ storage: new MemoryStorage() });
  const product = productForHint(HintType.MOVE);
  const result = store.purchase(product.id);
  assert.equal(result.ok, true);
  assert.equal(store.snapshot.dust, STARTING_DUST - product.price);
  assert.equal(store.snapshot.hints.move, product.amount);
  assert.equal(store.consumeHint(HintType.MOVE), true);
  assert.equal(store.snapshot.hints.move, product.amount - 1);
});

test("an unaffordable purchase leaves wallet and inventory unchanged", () => {
  const store = new EconomyStore({ storage: new MemoryStorage() });
  const before = store.snapshot;
  const result = store.purchase(productForHint(HintType.RESCUE).id);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "insufficient-dust");
  assert.deepEqual(store.snapshot, before);
});

test("campaign dust is idempotent and endless dust follows field size", () => {
  assert.deepEqual([37, 61, 91].map(dustRewardForPlate), [8, 12, 18]);
  assert.deepEqual([37, 61, 91].map(endlessDustReward), [2, 4, 6]);
  const store = new EconomyStore({ storage: new MemoryStorage() });
  assert.equal(store.claimCampaignLevel(0, 37).award, 8);
  assert.equal(store.claimCampaignLevel(0, 37).award, 0);
  assert.equal(store.awardEndlessClear(61).award, 4);
  assert.equal(store.snapshot.dust, STARTING_DUST + 12);
});

test("economy persists and normalizes damaged fields independently", () => {
  const storage = new MemoryStorage();
  const first = new EconomyStore({ storage });
  first.purchase(productForHint(HintType.MOVE).id);
  const second = new EconomyStore({ storage });
  assert.equal(second.snapshot.hints.move, 3);
  assert.equal(JSON.parse(storage.getItem(ECONOMY_STORAGE_KEY)).version, 1);

  assert.deepEqual(
    normalizeEconomy({
      dust: -4,
      hints: { move: 2, undo: "9", rescue: 1 },
      claimedCampaignLevels: [2, 0, 2, -1, "3"],
    }),
    {
      version: 1,
      dust: STARTING_DUST,
      hints: { move: 2, undo: 0, rescue: 1 },
      claimedCampaignLevels: [0, 2],
    },
  );
});
