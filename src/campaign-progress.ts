import { CAMPAIGN_LEVEL_COUNT } from "./plates.js";
import { isRecord, type StorageLike } from "./persistence.js";

export const CAMPAIGN_PROGRESS_STORAGE_KEY = "garden-js.campaign-progress.v3";

export interface CampaignProgressSnapshotV3 {
  version: 3;
  tutorialCompleted: boolean;
  solvedLevels: number[];
  cleanLevels: number[];
  highestUnlocked: number;
  campaignCompleted: boolean;
}

/**
 * Temporary runtime shape for legacy scenes that are removed later in the redesign.
 * The deprecated fields are projections only and are never persisted in the v3 save format.
 */
export interface CampaignProgressSnapshot extends CampaignProgressSnapshotV3 {
  /** @deprecated Use solvedLevels. */
  completedLevels: number[];
  /** @deprecated Campaign score is removed; this is always zero during migration. */
  levelScores: number[];
  /** @deprecated Campaign score is removed; this is always zero during migration. */
  campaignScore: number;
}

export type CampaignProgressRuntimeSnapshot = CampaignProgressSnapshot;

function assertLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`);
  }
}

function initialSnapshot(): CampaignProgressSnapshotV3 {
  return {
    version: 3,
    tutorialCompleted: false,
    solvedLevels: [],
    cleanLevels: [],
    highestUnlocked: 0,
    campaignCompleted: false,
  };
}

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function safeLevelArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value.filter(
      (item): item is number =>
        Number.isSafeInteger(item) && item >= 0 && item < CAMPAIGN_LEVEL_COUNT,
    ),
  )].sort((left, right) => left - right);
}

function contiguousSolvedCount(solvedLevels: readonly number[]): number {
  const solved = new Set(solvedLevels);
  let count = 0;
  while (count < CAMPAIGN_LEVEL_COUNT && solved.has(count)) count += 1;
  return count;
}

export function normalizeCampaignProgress(value: unknown): CampaignProgressSnapshotV3 {
  if (!isRecord(value)) return initialSnapshot();

  const solvedLevels = safeLevelArray(value.solvedLevels);
  const solved = new Set(solvedLevels);
  const cleanLevels = safeLevelArray(value.cleanLevels).filter((level) => solved.has(level));
  const contiguous = contiguousSolvedCount(solvedLevels);

  return {
    version: 3,
    tutorialCompleted: value.tutorialCompleted === true || solvedLevels.length > 0,
    solvedLevels,
    cleanLevels,
    highestUnlocked: Math.min(contiguous, CAMPAIGN_LEVEL_COUNT - 1),
    campaignCompleted: solvedLevels.length === CAMPAIGN_LEVEL_COUNT,
  };
}

export interface CampaignProgressStoreOptions {
  storage?: StorageLike;
  storageKey?: string;
  unlockAll?: boolean;
}

function cloneSnapshot(snapshot: CampaignProgressSnapshotV3): CampaignProgressSnapshotV3 {
  return {
    ...snapshot,
    solvedLevels: [...snapshot.solvedLevels],
    cleanLevels: [...snapshot.cleanLevels],
  };
}

function runtimeSnapshot(snapshot: CampaignProgressSnapshotV3): CampaignProgressRuntimeSnapshot {
  return {
    ...cloneSnapshot(snapshot),
    completedLevels: [...snapshot.solvedLevels],
    levelScores: Array<number>(CAMPAIGN_LEVEL_COUNT).fill(0),
    campaignScore: 0,
  };
}

export class CampaignProgressStore {
  #snapshot: CampaignProgressSnapshotV3;
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
    this.#snapshot = this.#load();
  }

  get snapshot(): CampaignProgressRuntimeSnapshot {
    return runtimeSnapshot(this.#snapshot);
  }

  get solvedCount(): number {
    return this.#snapshot.solvedLevels.length;
  }

  get cleanCount(): number {
    return this.#snapshot.cleanLevels.length;
  }

  get testMode(): boolean {
    return this.#unlockAll;
  }

  isUnlocked(level: number): boolean {
    assertLevel(level);
    return this.#unlockAll || level <= this.#snapshot.highestUnlocked;
  }

  isSolved(level: number): boolean {
    assertLevel(level);
    return this.#snapshot.solvedLevels.includes(level);
  }

  isClean(level: number): boolean {
    assertLevel(level);
    return this.#snapshot.cleanLevels.includes(level);
  }

  /** @deprecated Use isSolved. */
  isCompleted(level: number): boolean {
    return this.isSolved(level);
  }

  complete(
    level: number,
    { clean = false }: { clean?: boolean; score?: number } = {},
  ): CampaignProgressRuntimeSnapshot {
    assertLevel(level);
    if (!this.isUnlocked(level)) {
      throw new Error(`Campaign level ${level + 1} is locked`);
    }

    const solved = new Set(this.#snapshot.solvedLevels);
    const cleanLevels = new Set(this.#snapshot.cleanLevels);
    const wasSolved = solved.has(level);
    const wasClean = cleanLevels.has(level);

    solved.add(level);
    if (clean) cleanLevels.add(level);

    if (wasSolved && (wasClean || !clean)) return this.snapshot;

    this.#snapshot = normalizeCampaignProgress({
      version: 3,
      tutorialCompleted: true,
      solvedLevels: [...solved],
      cleanLevels: [...cleanLevels],
    });
    this.#persist();
    return this.snapshot;
  }

  completeTutorial(): CampaignProgressRuntimeSnapshot {
    if (this.#snapshot.tutorialCompleted) return this.snapshot;
    this.#snapshot = { ...this.#snapshot, tutorialCompleted: true };
    this.#persist();
    return this.snapshot;
  }

  reset(): CampaignProgressRuntimeSnapshot {
    this.#snapshot = initialSnapshot();
    try {
      this.#storage?.removeItem(this.#storageKey);
    } catch {
      // Progress remains usable in memory when browser storage is unavailable.
    }
    return this.snapshot;
  }

  #load(): CampaignProgressSnapshotV3 {
    try {
      const serialized = this.#storage?.getItem(this.#storageKey);
      return serialized ? normalizeCampaignProgress(JSON.parse(serialized) as unknown) : initialSnapshot();
    } catch {
      return initialSnapshot();
    }
  }

  #persist(): void {
    if (this.#unlockAll) return;
    try {
      this.#storage?.setItem(this.#storageKey, JSON.stringify(this.#snapshot));
    } catch {
      // A storage quota/privacy failure must not make the campaign unplayable.
    }
  }
}
