export const LEADERBOARD_STORAGE_KEY = "garden-js.leaderboard.v1";

export const FAKE_LEADERBOARD_ENTRIES = Object.freeze([
  Object.freeze({ id: "ember", name: "EmberFox", score: 86240 }),
  Object.freeze({ id: "selena", name: "Selena", score: 69480 }),
  Object.freeze({ id: "hexer", name: "Hexer", score: 58120 }),
  Object.freeze({ id: "mira", name: "Mira", score: 44960 }),
  Object.freeze({ id: "albedo", name: "Albedo", score: 36730 }),
  Object.freeze({ id: "north", name: "NorthWind", score: 28940 }),
  Object.freeze({ id: "lisa", name: "Lisa", score: 21860 }),
  Object.freeze({ id: "copper", name: "CopperCat", score: 16420 }),
  Object.freeze({ id: "sage", name: "Sage", score: 11280 }),
  Object.freeze({ id: "rook", name: "Rook", score: 7360 }),
  Object.freeze({ id: "moss", name: "Moss", score: 4210 }),
  Object.freeze({ id: "nova", name: "Nova", score: 1850 }),
]);

function safeStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function safeScore(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function normalizeLeaderboardProfile(value) {
  return Object.freeze({
    version: 1,
    campaignScore: safeScore(value?.campaignScore),
    endlessBest: safeScore(value?.endlessBest),
  });
}

export class LocalLeaderboardStore {
  #storage;
  #storageKey;
  #profile;

  constructor({ storage, storageKey = LEADERBOARD_STORAGE_KEY } = {}) {
    this.#storage = safeStorage(storage);
    this.#storageKey = storageKey;
    this.#profile = this.#load();
  }

  get snapshot() {
    const totalScore = this.#profile.campaignScore + this.#profile.endlessBest;
    return Object.freeze({ ...this.#profile, totalScore });
  }

  syncCampaignScore(score) {
    const normalized = safeScore(score);
    if (normalized <= this.#profile.campaignScore) return this.snapshot;
    this.#profile = normalizeLeaderboardProfile({
      ...this.#profile,
      campaignScore: normalized,
    });
    this.#persist();
    return this.snapshot;
  }

  submitEndlessScore(score, { assisted = false } = {}) {
    const normalized = safeScore(score);
    if (assisted || normalized <= this.#profile.endlessBest) {
      return Object.freeze({ accepted: false, snapshot: this.snapshot });
    }
    this.#profile = normalizeLeaderboardProfile({
      ...this.#profile,
      endlessBest: normalized,
    });
    this.#persist();
    return Object.freeze({ accepted: true, snapshot: this.snapshot });
  }

  standings({ limit = 10, playerName = "YOU" } = {}) {
    const maximum = Math.max(1, Math.floor(limit));
    const player = {
      id: "local-player",
      name: playerName,
      score: this.snapshot.totalScore,
      isPlayer: true,
    };
    const ranked = [...FAKE_LEADERBOARD_ENTRIES, player]
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .map((entry, index) => Object.freeze({ ...entry, rank: index + 1 }));
    const playerEntry = ranked.find((entry) => entry.isPlayer);
    let entries = ranked.slice(0, maximum);
    if (playerEntry.rank > maximum) {
      entries = [...ranked.slice(0, Math.max(0, maximum - 1)), playerEntry];
    }
    return Object.freeze({
      entries: Object.freeze(entries),
      playerEntry,
      profile: this.snapshot,
    });
  }

  #load() {
    try {
      const value = this.#storage?.getItem?.(this.#storageKey);
      return value
        ? normalizeLeaderboardProfile(JSON.parse(value))
        : normalizeLeaderboardProfile();
    } catch {
      return normalizeLeaderboardProfile();
    }
  }

  #persist() {
    try {
      this.#storage?.setItem?.(this.#storageKey, JSON.stringify(this.#profile));
    } catch {
      // The local board remains usable in memory when storage is unavailable.
    }
  }
}
