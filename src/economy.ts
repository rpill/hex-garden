import { isRecord, type StorageLike } from "./persistence.js";

export const ECONOMY_STORAGE_KEY = "garden-js.economy.v1";
export const STARTING_DUST = 30;
export const REWARDED_AD_COOLDOWN_MS = 60_000;

export const HintType = Object.freeze({
  MOVE: "move",
  UNDO: "undo",
  RESCUE: "rescue",
} as const);

export type HintTypeValue = (typeof HintType)[keyof typeof HintType];

export interface HintProduct {
  id: string;
  hint: HintTypeValue;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  amount: number;
  price: number;
}

export const HINT_PRODUCTS = Object.freeze([
  Object.freeze({
    id: "move-3",
    hint: HintType.MOVE,
    title: "НАМЁК",
    titleEn: "HINT",
    description: "Показывает один доступный ход",
    descriptionEn: "Shows one available move",
    amount: 3,
    price: 30,
  }),
  Object.freeze({
    id: "undo-2",
    hint: HintType.UNDO,
    title: "ОТМЕНА",
    titleEn: "UNDO",
    description: "Возвращает состояние до последнего удаления",
    descriptionEn: "Restores the board before the last removal",
    amount: 2,
    price: 50,
  }),
  Object.freeze({
    id: "rescue-1",
    hint: HintType.RESCUE,
    title: "СПАСЕНИЕ",
    titleEn: "RESCUE",
    description: "Возвращает к последней разрешимой позиции и блокирует тупиковый ход",
    descriptionEn: "Returns to the last solvable position and blocks the dead-end move",
    amount: 1,
    price: 60,
  }),
] as const satisfies readonly HintProduct[]);

export const REWARDED_HINT_AMOUNTS = Object.freeze({
  [HintType.MOVE]: 1,
  [HintType.UNDO]: 1,
  [HintType.RESCUE]: 1,
} satisfies Record<HintTypeValue, number>);

const HINT_TYPES = Object.freeze(Object.values(HintType));
const PRODUCT_BY_ID = new Map<string, HintProduct>(HINT_PRODUCTS.map((product) => [product.id, product]));
const PRODUCT_BY_HINT = new Map<HintTypeValue, HintProduct>(
  HINT_PRODUCTS.map((product) => [product.hint, product]),
);

export interface EconomySnapshot {
  version: 1;
  dust: number;
  hints: Record<HintTypeValue, number>;
  claimedCampaignLevels: number[];
  rewardedAvailableAt: number;
}

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : fallback;
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError("economy balance exceeds the safe integer range");
  }
  return result;
}

function emptyHints(): Record<HintTypeValue, number> {
  return { [HintType.MOVE]: 0, [HintType.UNDO]: 0, [HintType.RESCUE]: 0 };
}

function initialSnapshot(startingDust = STARTING_DUST): EconomySnapshot {
  return {
    version: 1,
    dust: startingDust,
    hints: emptyHints(),
    claimedCampaignLevels: [],
    rewardedAvailableAt: 0,
  };
}

export function normalizeEconomy(value: unknown): EconomySnapshot {
  if (!isRecord(value)) return initialSnapshot();
  const claimedCampaignLevels = [
    ...new Set(
      Array.isArray(value.claimedCampaignLevels)
        ? value.claimedCampaignLevels.filter(
            (level): level is number => Number.isSafeInteger(level) && (level as number) >= 0,
          )
        : [],
    ),
  ].sort((left, right) => left - right);
  const rawHints = isRecord(value.hints) ? value.hints : {};
  const hints = emptyHints();
  for (const type of HINT_TYPES) hints[type] = nonNegativeInteger(rawHints[type]);
  return {
    version: 1,
    dust: nonNegativeInteger(value.dust, STARTING_DUST),
    hints,
    claimedCampaignLevels,
    rewardedAvailableAt: nonNegativeInteger(value.rewardedAvailableAt),
  };
}

export function dustRewardForPlate(plateCellCount: number): number {
  if (!Number.isFinite(plateCellCount) || plateCellCount <= 0) {
    throw new RangeError("plateCellCount must be positive");
  }
  if (plateCellCount <= 37) return 8;
  if (plateCellCount <= 61) return 12;
  return 18;
}

export function endlessDustReward(plateCellCount: number): number {
  if (!Number.isFinite(plateCellCount) || plateCellCount <= 0) {
    throw new RangeError("plateCellCount must be positive");
  }
  if (plateCellCount <= 37) return 2;
  if (plateCellCount <= 61) return 4;
  return 6;
}

export function productForHint(type: HintTypeValue): HintProduct | null {
  return PRODUCT_BY_HINT.get(type) ?? null;
}

export function rewardedAmountForHint(type: HintTypeValue): number {
  return REWARDED_HINT_AMOUNTS[type] ?? 0;
}

export interface EconomyStoreOptions {
  storage?: StorageLike | null;
  storageKey?: string;
  startingDust?: number;
}

export type PurchaseResult = Readonly<{
  ok: boolean;
  reason: "insufficient-dust" | "purchased";
  product: HintProduct;
  snapshot: EconomySnapshot;
}>;

export class EconomyStore {
  #snapshot: EconomySnapshot;
  #startingDust: number;
  #storage: StorageLike | null | undefined;
  #storageKey: string;

  constructor({
    storage = defaultStorage(),
    storageKey = ECONOMY_STORAGE_KEY,
    startingDust = STARTING_DUST,
  }: EconomyStoreOptions = {}) {
    if (!Number.isSafeInteger(startingDust) || startingDust < 0) {
      throw new RangeError("startingDust must be a non-negative safe integer");
    }
    this.#startingDust = startingDust;
    this.#storage = storage;
    this.#storageKey = storageKey;
    this.#snapshot = this.#load();
  }

  get snapshot(): EconomySnapshot {
    return {
      ...this.#snapshot,
      hints: { ...this.#snapshot.hints },
      claimedCampaignLevels: [...this.#snapshot.claimedCampaignLevels],
    };
  }

  purchase(productId: string): PurchaseResult {
    const product = PRODUCT_BY_ID.get(productId);
    if (!product) throw new RangeError(`Unknown economy product: ${productId}`);
    if (this.#snapshot.dust < product.price) {
      return Object.freeze({ ok: false, reason: "insufficient-dust", product, snapshot: this.snapshot });
    }
    this.#snapshot = {
      ...this.#snapshot,
      dust: this.#snapshot.dust - product.price,
      hints: {
        ...this.#snapshot.hints,
        [product.hint]: safeAdd(this.#snapshot.hints[product.hint], product.amount),
      },
    };
    this.#persist();
    return Object.freeze({ ok: true, reason: "purchased", product, snapshot: this.snapshot });
  }

  consumeHint(type: HintTypeValue): boolean {
    if (!HINT_TYPES.includes(type)) throw new RangeError(`Unknown hint type: ${type}`);
    if (this.#snapshot.hints[type] <= 0) return false;
    this.#snapshot = {
      ...this.#snapshot,
      hints: { ...this.#snapshot.hints, [type]: this.#snapshot.hints[type] - 1 },
    };
    this.#persist();
    return true;
  }

  grantHint(type: HintTypeValue, amount = rewardedAmountForHint(type)): Readonly<{ amount: number; snapshot: EconomySnapshot }> {
    if (!HINT_TYPES.includes(type)) throw new RangeError(`Unknown hint type: ${type}`);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError("hint grant amount must be a positive safe integer");
    }
    this.#snapshot = {
      ...this.#snapshot,
      hints: { ...this.#snapshot.hints, [type]: safeAdd(this.#snapshot.hints[type], amount) },
    };
    this.#persist();
    return Object.freeze({ amount, snapshot: this.snapshot });
  }

  rewardedWaitMs(now = Date.now()): number {
    if (!Number.isFinite(now)) throw new TypeError("now must be finite");
    return Math.max(0, this.#snapshot.rewardedAvailableAt - now);
  }

  grantRewardedHint(
    type: HintTypeValue,
    {
      amount = rewardedAmountForHint(type),
      now = Date.now(),
      cooldownMs = REWARDED_AD_COOLDOWN_MS,
    }: { amount?: number; now?: number; cooldownMs?: number } = {},
  ): Readonly<{
    ok: boolean;
    reason: "cooldown" | "rewarded";
    waitMs?: number;
    amount?: number;
    snapshot: EconomySnapshot;
  }> {
    if (!HINT_TYPES.includes(type)) throw new RangeError(`Unknown hint type: ${type}`);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new RangeError("hint grant amount must be a positive safe integer");
    }
    if (!Number.isFinite(now) || !Number.isSafeInteger(cooldownMs) || cooldownMs < 0) {
      throw new RangeError("rewarded timing values are invalid");
    }
    const waitMs = this.rewardedWaitMs(now);
    if (waitMs > 0) {
      return Object.freeze({ ok: false, reason: "cooldown", waitMs, snapshot: this.snapshot });
    }
    this.#snapshot = {
      ...this.#snapshot,
      rewardedAvailableAt: Math.floor(now + cooldownMs),
      hints: { ...this.#snapshot.hints, [type]: safeAdd(this.#snapshot.hints[type], amount) },
    };
    this.#persist();
    return Object.freeze({ ok: true, reason: "rewarded", amount, snapshot: this.snapshot });
  }

  claimCampaignLevel(level: number, plateCellCount: number): Readonly<{ award: number; snapshot: EconomySnapshot }> {
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
      claimedCampaignLevels: [...this.#snapshot.claimedCampaignLevels, level].sort((left, right) => left - right),
    };
    this.#persist();
    return Object.freeze({ award, snapshot: this.snapshot });
  }

  awardEndlessClear(plateCellCount: number): Readonly<{ award: number; snapshot: EconomySnapshot }> {
    const award = endlessDustReward(plateCellCount);
    this.#snapshot = { ...this.#snapshot, dust: safeAdd(this.#snapshot.dust, award) };
    this.#persist();
    return Object.freeze({ award, snapshot: this.snapshot });
  }

  reset(): EconomySnapshot {
    this.#snapshot = initialSnapshot(this.#startingDust);
    try {
      this.#storage?.removeItem(this.#storageKey);
    } catch {
      // The in-memory economy remains usable when storage is unavailable.
    }
    return this.snapshot;
  }

  #load(): EconomySnapshot {
    try {
      const serialized = this.#storage?.getItem(this.#storageKey);
      return serialized ? normalizeEconomy(JSON.parse(serialized) as unknown) : initialSnapshot(this.#startingDust);
    } catch {
      return initialSnapshot(this.#startingDust);
    }
  }

  #persist(): void {
    try {
      this.#storage?.setItem(this.#storageKey, JSON.stringify(this.#snapshot));
    } catch {
      // A quota/privacy failure must not make the game unplayable.
    }
  }
}
