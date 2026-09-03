import { PROGRESSION_LEVEL_COUNT } from "./progression.js";
import { isRecord, type StorageLike } from "./persistence.js";

export const CAMPAIGN_PROGRESS_STORAGE_KEY = "garden-js.campaign-progress.v1";

export interface CampaignProgressSnapshot {
  version: 2;
  tutorialCompleted: boolean;
  completedLevels: number[];
  levelScores: number[];
  campaignScore: number;
  highestUnlocked: number;
  campaignCompleted: boolean;
}

function assertLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0 || level >= PROGRESSION_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${PROGRESSION_LEVEL_COUNT - 1}`);
  }
}

function initialSnapshot(): CampaignProgressSnapshot {
  return {
    version: 2,
    tutorialCompleted: false,
    completedLevels: [],
    levelScores: Array<number>(PROGRESSION_LEVEL_COUNT).fill(0),
    campaignScore: 0,
    highestUnlocked: 0,
    campaignCompleted: false,
  };
}

function allUnlockedSnapshot(
  completedLevels: readonly number[] = [],
  levelScores: readonly number[] = Array<number>(PROGRESSION_LEVEL_COUNT).fill(0),
): CampaignProgressSnapshot {
  const normalizedScores = Array.from(
    { length: PROGRESSION_LEVEL_COUNT },
    (_value, level) => {
      const score = levelScores[level];
      return completedLevels.includes(level) && Number.isSafeInteger(score) && (score ?? -1) >= 0
        ? (score as number)
        : 0;
    },
  );
  return {
    version: 2,
    tutorialCompleted: true,
    completedLevels: [...completedLevels].sort((left, right) => left - right),
    levelScores: normalizedScores,
    campaignScore: normalizedScores.reduce((sum, score) => sum + score, 0),
    highestUnlocked: PROGRESSION_LEVEL_COUNT - 1,
    campaignCompleted: completedLevels.length === PROGRESSION_LEVEL_COUNT,
  };
}

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function safeIntegerArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => Number.isSafeInteger(item));
}

export function normalizeCampaignProgress(value: unknown): CampaignProgressSnapshot {
  if (!isRecord(value)) return initialSnapshot();

  const supplied = new Set(
    safeIntegerArray(value.completedLevels).filter(
      (level) => level >= 0 && level < PROGRESSION_LEVEL_COUNT,
    ),
  );
  const completedLevels: number[] = [];
  for (let level = 0; level < PROGRESSION_LEVEL_COUNT; level += 1) {
    if (!supplied.has(level)) break;
    completedLevels.push(level);
  }
  const suppliedScores = Array.isArray(value.levelScores) ? value.levelScores : [];
  const levelScores = Array.from(
    { length: PROGRESSION_LEVEL_COUNT },
    (_value, level) => {
      const score = suppliedScores[level];
      return completedLevels.includes(level) && Number.isSafeInteger(score) && (score as number) >= 0
        ? (score as number)
        : 0;
    },
  );

  return {
    version: 2,
    tutorialCompleted: value.tutorialCompleted === true || completedLevels.length > 0,
    completedLevels,
    levelScores,
    campaignScore: levelScores.reduce((sum, score) => sum + score, 0),
    highestUnlocked: Math.min(completedLevels.length, PROGRESSION_LEVEL_COUNT - 1),
    campaignCompleted: completedLevels.length === PROGRESSION_LEVEL_COUNT,
  };
}

export interface CampaignProgressStoreOptions {
  storage?: StorageLike;
  storageKey?: string;
  unlockAll?: boolean;
}

export class CampaignProgressStore {
  #snapshot: CampaignProgressSnapshot;
  #storage: StorageLike | undefined;
  #storageKey: string;
  #unlockAll: boolean;

  constructor({
    storage = defaultStorage(),
    storageKey = CAMPAIGN_PROGRESS_STORAGE_KEY,
    unlockAll = false,
  }: CampaignProgressStoreOptions = {}) {
    this.#unlockAll = unlockAll === true;
    this.#storage = this.#unlockAll ? undefined : storage;
    this.#storageKey = storageKey;
    this.#snapshot = this.#unlockAll ? allUnlockedSnapshot() : this.#load();
  }

  get snapshot(): CampaignProgressSnapshot {
    return {
      ...this.#snapshot,
      completedLevels: [...this.#snapshot.completedLevels],
      levelScores: [...this.#snapshot.levelScores],
    };
  }

  get testMode(): boolean {
    return this.#unlockAll;
  }

  isUnlocked(level: number): boolean {
    assertLevel(level);
    return this.#unlockAll || level <= this.#snapshot.highestUnlocked;
  }

  isCompleted(level: number): boolean {
    assertLevel(level);
    return this.#snapshot.completedLevels.includes(level);
  }

  complete(level: number, { score = 0 }: { score?: number } = {}): CampaignProgressSnapshot {
    assertLevel(level);
    if (!Number.isSafeInteger(score) || score < 0) {
      throw new RangeError("score must be a non-negative safe integer");
    }
    if (!this.isUnlocked(level)) {
      throw new Error(`Campaign level ${level + 1} is locked`);
    }
    if (this.isCompleted(level)) {
      if (score === 0 || (this.#snapshot.levelScores[level] ?? 0) > 0) {
        return this.snapshot;
      }
      const levelScores = [...this.#snapshot.levelScores];
      levelScores[level] = score;
      if (this.#unlockAll) {
        this.#snapshot = allUnlockedSnapshot(this.#snapshot.completedLevels, levelScores);
      } else {
        this.#snapshot = normalizeCampaignProgress({
          tutorialCompleted: this.#snapshot.tutorialCompleted,
          completedLevels: this.#snapshot.completedLevels,
          levelScores,
        });
        this.#persist();
      }
      return this.snapshot;
    }

    if (this.#unlockAll) {
      const levelScores = [...this.#snapshot.levelScores];
      levelScores[level] = score;
      this.#snapshot = allUnlockedSnapshot([...this.#snapshot.completedLevels, level], levelScores);
      return this.snapshot;
    }

    const levelScores = [...this.#snapshot.levelScores];
    levelScores[level] = score;
    this.#snapshot = normalizeCampaignProgress({
      completedLevels: [...this.#snapshot.completedLevels, level],
      levelScores,
    });
    this.#persist();
    return this.snapshot;
  }

  completeTutorial(): CampaignProgressSnapshot {
    if (this.#snapshot.tutorialCompleted) return this.snapshot;
    this.#snapshot = { ...this.#snapshot, tutorialCompleted: true };
    this.#persist();
    return this.snapshot;
  }

  reset(): CampaignProgressSnapshot {
    this.#snapshot = this.#unlockAll ? allUnlockedSnapshot() : initialSnapshot();
    try {
      this.#storage?.removeItem(this.#storageKey);
    } catch {
      // Progress remains usable in memory when browser storage is unavailable.
    }
    return this.snapshot;
  }

  #load(): CampaignProgressSnapshot {
    try {
      const serialized = this.#storage?.getItem(this.#storageKey);
      return serialized ? normalizeCampaignProgress(JSON.parse(serialized) as unknown) : initialSnapshot();
    } catch {
      return initialSnapshot();
    }
  }

  #persist(): void {
    try {
      this.#storage?.setItem(this.#storageKey, JSON.stringify(this.#snapshot));
    } catch {
      // A storage quota/privacy failure must not make the campaign unplayable.
    }
  }
}
