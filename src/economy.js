export const ECONOMY_STORAGE_KEY = "garden-js.economy.v1";
export const STARTING_DUST = 30;

export const HintType = Object.freeze({
  MOVE: "move",
  UNDO: "undo",
  RESCUE: "rescue",
});

export const HINT_PRODUCTS = Object.freeze([
  Object.freeze({
    id: "move-3",
    hint: HintType.MOVE,
    title: "НАМЁК",
    description: "Показывает один доступный ход",
    amount: 3,
    price: 30,
  }),
  Object.freeze({
    id: "undo-2",
    hint: HintType.UNDO,
    title: "ОТМЕНА",
    description: "Возвращает состояние до последнего удаления",
    amount: 2,
    price: 50,
  }),
  Object.freeze({
    id: "rescue-1",
    hint: HintType.RESCUE,
    title: "СПАСЕНИЕ",
    description: "Продолжает Endless после тупика без рейтинга",
    amount: 1,
    price: 60,
  }),
]);

const HINT_TYPES = Object.freeze(Object.values(HintType));
const PRODUCT_BY_ID = new Map(HINT_PRODUCTS.map((product) => [product.id, product]));
const PRODUCT_BY_HINT = new Map(
  HINT_PRODUCTS.map((product) => [product.hint, product]),
);

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function nonNegativeInteger(value, fallback = 0) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function safeAdd(left, right) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError("economy balance exceeds the safe integer range");
  }
  return result;
}

function initialSnapshot() {
  return {
    version: 1,
    dust: STARTING_DUST,
    hints: Object.fromEntries(HINT_TYPES.map((type) => [type, 0])),
    claimedCampaignLevels: [],
  };
}

export function normalizeEconomy(value) {
  if (!value || typeof value !== "object") return initialSnapshot();
  const claimedCampaignLevels = [
    ...new Set(
      Array.isArray(value.claimedCampaignLevels)
        ? value.claimedCampaignLevels.filter(
            (level) => Number.isSafeInteger(level) && level >= 0,
          )
        : [],
    ),
  ].sort((left, right) => left - right);
  return {
    version: 1,
    dust: nonNegativeInteger(value.dust, STARTING_DUST),
    hints: Object.fromEntries(
      HINT_TYPES.map((type) => [
        type,
        nonNegativeInteger(value.hints?.[type]),
      ]),
    ),
    claimedCampaignLevels,
  };
}

export function dustRewardForPlate(plateCellCount) {
  if (!Number.isFinite(plateCellCount) || plateCellCount <= 0) {
    throw new RangeError("plateCellCount must be positive");
  }
  if (plateCellCount <= 37) return 8;
  if (plateCellCount <= 61) return 12;
  return 18;
}

export function endlessDustReward(plateCellCount) {
  if (!Number.isFinite(plateCellCount) || plateCellCount <= 0) {
    throw new RangeError("plateCellCount must be positive");
  }
  if (plateCellCount <= 37) return 2;
  if (plateCellCount <= 61) return 4;
  return 6;
}

export function productForHint(type) {
  return PRODUCT_BY_HINT.get(type) ?? null;
}

export class EconomyStore {
  #snapshot;
  #storage;
  #storageKey;

  constructor({ storage = defaultStorage(), storageKey = ECONOMY_STORAGE_KEY } = {}) {
    this.#storage = storage;
    this.#storageKey = storageKey;
    this.#snapshot = this.#load();
  }

  get snapshot() {
    return {
      ...this.#snapshot,
      hints: { ...this.#snapshot.hints },
      claimedCampaignLevels: [...this.#snapshot.claimedCampaignLevels],
    };
  }

  purchase(productId) {
    const product = PRODUCT_BY_ID.get(productId);
    if (!product) throw new RangeError(`Unknown economy product: ${productId}`);
    if (this.#snapshot.dust < product.price) {
      return Object.freeze({
        ok: false,
        reason: "insufficient-dust",
        product,
        snapshot: this.snapshot,
      });
    }
    this.#snapshot = {
      ...this.#snapshot,
      dust: this.#snapshot.dust - product.price,
      hints: {
        ...this.#snapshot.hints,
        [product.hint]: safeAdd(
          this.#snapshot.hints[product.hint],
          product.amount,
        ),
      },
    };
    this.#persist();
    return Object.freeze({
      ok: true,
      reason: "purchased",
      product,
      snapshot: this.snapshot,
    });
  }

  consumeHint(type) {
    if (!HINT_TYPES.includes(type)) {
      throw new RangeError(`Unknown hint type: ${type}`);
    }
    if (this.#snapshot.hints[type] <= 0) return false;
    this.#snapshot = {
      ...this.#snapshot,
      hints: {
        ...this.#snapshot.hints,
        [type]: this.#snapshot.hints[type] - 1,
      },
    };
    this.#persist();
    return true;
  }

  claimCampaignLevel(level, plateCellCount) {
    if (!Number.isSafeInteger(level) || level < 0) {
      throw new RangeError("level must be a non-negative safe integer");
    }
    if (this.#snapshot.claimedCampaignLevels.includes(level)) {
      return Object.freeze({ award: 0, snapshot: this.snapshot });
    }
    const award = dustRewardForPlate(plateCellCount);
    this.#snapshot = {
      ...this.#snapshot,
      dust: safeAdd(this.#snapshot.dust, award),
      claimedCampaignLevels: [
        ...this.#snapshot.claimedCampaignLevels,
        level,
      ].sort((left, right) => left - right),
    };
    this.#persist();
    return Object.freeze({ award, snapshot: this.snapshot });
  }

  awardEndlessClear(plateCellCount) {
    const award = endlessDustReward(plateCellCount);
    this.#snapshot = {
      ...this.#snapshot,
      dust: safeAdd(this.#snapshot.dust, award),
    };
    this.#persist();
    return Object.freeze({ award, snapshot: this.snapshot });
  }

  reset() {
    this.#snapshot = initialSnapshot();
    try {
      this.#storage?.removeItem?.(this.#storageKey);
    } catch {
      // The in-memory economy remains usable when storage is unavailable.
    }
    return this.snapshot;
  }

  #load() {
    try {
      const serialized = this.#storage?.getItem?.(this.#storageKey);
      return serialized
        ? normalizeEconomy(JSON.parse(serialized))
        : initialSnapshot();
    } catch {
      return initialSnapshot();
    }
  }

  #persist() {
    try {
      this.#storage?.setItem?.(
        this.#storageKey,
        JSON.stringify(this.#snapshot),
      );
    } catch {
      // A quota/privacy failure must not make the game unplayable.
    }
  }
}
