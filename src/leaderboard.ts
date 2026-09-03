import { isRecord, type StorageLike } from "./persistence.js";

export const LEADERBOARD_STORAGE_KEY = "garden-js.leaderboard.v1";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  isPlayer?: boolean;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
}

export interface LeaderboardProfile {
  version: 1;
  campaignScore: number;
  endlessBest: number;
}

export interface LeaderboardSnapshot extends LeaderboardProfile {
  totalScore: number;
}

export const FAKE_LEADERBOARD_ENTRIES: readonly Readonly<LeaderboardEntry>[] = Object.freeze([
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

function safeStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function safeScore(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : 0;
}

export function normalizeLeaderboardProfile(value?: unknown): Readonly<LeaderboardProfile> {
  const record = isRecord(value) ? value : {};
  return Object.freeze({
    version: 1,
    campaignScore: safeScore(record.campaignScore),
    endlessBest: safeScore(record.endlessBest),
  });
}

export interface LocalLeaderboardStoreOptions {
  storage?: StorageLike | null;
  storageKey?: string;
}

export interface SubmitEndlessResult {
  accepted: boolean;
  snapshot: Readonly<LeaderboardSnapshot>;
}

export interface StandingsResult {
  entries: readonly Readonly<RankedLeaderboardEntry>[];
  playerEntry: Readonly<RankedLeaderboardEntry>;
  profile: Readonly<LeaderboardSnapshot>;
}

export class LocalLeaderboardStore {
  #storage: StorageLike | null;
  #storageKey: string;
  #profile: Readonly<LeaderboardProfile>;

  constructor({ storage, storageKey = LEADERBOARD_STORAGE_KEY }: LocalLeaderboardStoreOptions = {}) {
    this.#storage = safeStorage(storage);
    this.#storageKey = storageKey;
    this.#profile = this.#load();
  }

  get snapshot(): Readonly<LeaderboardSnapshot> {
    const totalScore = this.#profile.campaignScore + this.#profile.endlessBest;
    return Object.freeze({ ...this.#profile, totalScore });
  }

  syncCampaignScore(score: number): Readonly<LeaderboardSnapshot> {
    const normalized = safeScore(score);
    if (normalized <= this.#profile.campaignScore) return this.snapshot;
    this.#profile = normalizeLeaderboardProfile({ ...this.#profile, campaignScore: normalized });
    this.#persist();
    return this.snapshot;
  }

  submitEndlessScore(score: number, { assisted = false }: { assisted?: boolean } = {}): Readonly<SubmitEndlessResult> {
    const normalized = safeScore(score);
    if (assisted || normalized <= this.#profile.endlessBest) {
      return Object.freeze({ accepted: false, snapshot: this.snapshot });
    }
    this.#profile = normalizeLeaderboardProfile({ ...this.#profile, endlessBest: normalized });
    this.#persist();
    return Object.freeze({ accepted: true, snapshot: this.snapshot });
  }

  standings({ limit = 10, playerName = "YOU" }: { limit?: number; playerName?: string } = {}): Readonly<StandingsResult> {
    const maximum = Math.max(1, Math.floor(limit));
    const player: LeaderboardEntry = {
      id: "local-player",
      name: playerName,
      score: this.snapshot.totalScore,
      isPlayer: true,
    };
    const ranked: Readonly<RankedLeaderboardEntry>[] = [...FAKE_LEADERBOARD_ENTRIES, player]
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .map((entry, index) => Object.freeze({ ...entry, rank: index + 1 }));
    const playerEntry = ranked.find((entry) => entry.isPlayer);
    if (!playerEntry) throw new Error("Local leaderboard player entry is missing");
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

  #load(): Readonly<LeaderboardProfile> {
    try {
      const value = this.#storage?.getItem(this.#storageKey);
      return value ? normalizeLeaderboardProfile(JSON.parse(value) as unknown) : normalizeLeaderboardProfile();
    } catch {
      return normalizeLeaderboardProfile();
    }
  }

  #persist(): void {
    try {
      this.#storage?.setItem(this.#storageKey, JSON.stringify(this.#profile));
    } catch {
      // The local board remains usable in memory when storage is unavailable.
    }
  }
}
