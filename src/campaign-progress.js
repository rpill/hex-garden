import { PROGRESSION_LEVEL_COUNT } from "./progression.js";

export const CAMPAIGN_PROGRESS_STORAGE_KEY =
  "garden-js.campaign-progress.v1";

function assertLevel(level) {
  if (
    !Number.isSafeInteger(level) ||
    level < 0 ||
    level >= PROGRESSION_LEVEL_COUNT
  ) {
    throw new RangeError(
      `level must be an integer from 0 to ${PROGRESSION_LEVEL_COUNT - 1}`,
    );
  }
}

function initialSnapshot() {
  return {
    version: 2,
    tutorialCompleted: false,
    completedLevels: [],
    levelScores: Array(PROGRESSION_LEVEL_COUNT).fill(0),
    campaignScore: 0,
    highestUnlocked: 0,
    campaignCompleted: false,
  };
}

function allUnlockedSnapshot(
  completedLevels = [],
  levelScores = Array(PROGRESSION_LEVEL_COUNT).fill(0),
) {
  const normalizedScores = Array.from(
    { length: PROGRESSION_LEVEL_COUNT },
    (_value, level) =>
      completedLevels.includes(level) &&
      Number.isSafeInteger(levelScores[level]) &&
      levelScores[level] >= 0
        ? levelScores[level]
        : 0,
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

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function normalizeCampaignProgress(value) {
  if (!value || typeof value !== "object") return initialSnapshot();

  const supplied = new Set(
    Array.isArray(value.completedLevels)
      ? value.completedLevels.filter(
          (level) =>
            Number.isSafeInteger(level) &&
            level >= 0 &&
            level < PROGRESSION_LEVEL_COUNT,
        )
      : [],
  );
  const completedLevels = [];
  for (let level = 0; level < PROGRESSION_LEVEL_COUNT; level += 1) {
    if (!supplied.has(level)) break;
    completedLevels.push(level);
  }
  const suppliedScores = Array.isArray(value.levelScores)
    ? value.levelScores
    : [];
  const levelScores = Array.from(
    { length: PROGRESSION_LEVEL_COUNT },
    (_value, level) =>
      completedLevels.includes(level) &&
      Number.isSafeInteger(suppliedScores[level]) &&
      suppliedScores[level] >= 0
        ? suppliedScores[level]
        : 0,
  );

  return {
    version: 2,
    tutorialCompleted:
      value.tutorialCompleted === true || completedLevels.length > 0,
    completedLevels,
    levelScores,
    campaignScore: levelScores.reduce((sum, score) => sum + score, 0),
    highestUnlocked: Math.min(
      completedLevels.length,
      PROGRESSION_LEVEL_COUNT - 1,
    ),
    campaignCompleted: completedLevels.length === PROGRESSION_LEVEL_COUNT,
  };
}

export class CampaignProgressStore {
  #snapshot;
  #storage;
  #storageKey;
  #unlockAll;

  constructor({
    storage = defaultStorage(),
    storageKey = CAMPAIGN_PROGRESS_STORAGE_KEY,
    unlockAll = false,
  } = {}) {
    this.#unlockAll = unlockAll === true;
    this.#storage = this.#unlockAll ? undefined : storage;
    this.#storageKey = storageKey;
    this.#snapshot = this.#unlockAll
      ? allUnlockedSnapshot()
      : this.#load();
  }

  get snapshot() {
    return {
      ...this.#snapshot,
      completedLevels: [...this.#snapshot.completedLevels],
      levelScores: [...this.#snapshot.levelScores],
    };
  }

  get testMode() {
    return this.#unlockAll;
  }

  isUnlocked(level) {
    assertLevel(level);
    return this.#unlockAll || level <= this.#snapshot.highestUnlocked;
  }

  isCompleted(level) {
    assertLevel(level);
    return this.#snapshot.completedLevels.includes(level);
  }

  complete(level, { score = 0 } = {}) {
    assertLevel(level);
    if (!Number.isSafeInteger(score) || score < 0) {
      throw new RangeError("score must be a non-negative safe integer");
    }
    if (!this.isUnlocked(level)) {
      throw new Error(`Campaign level ${level + 1} is locked`);
    }
    if (this.isCompleted(level)) {
      if (score === 0 || this.#snapshot.levelScores[level] > 0) {
        return this.snapshot;
      }
      const levelScores = [...this.#snapshot.levelScores];
      levelScores[level] = score;
      if (this.#unlockAll) {
        this.#snapshot = allUnlockedSnapshot(
          this.#snapshot.completedLevels,
          levelScores,
        );
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
      this.#snapshot = allUnlockedSnapshot(
        [...this.#snapshot.completedLevels, level],
        levelScores,
      );
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

  completeTutorial() {
    if (this.#snapshot.tutorialCompleted) return this.snapshot;
    this.#snapshot = {
      ...this.#snapshot,
      tutorialCompleted: true,
    };
    this.#persist();
    return this.snapshot;
  }

  reset() {
    this.#snapshot = this.#unlockAll
      ? allUnlockedSnapshot()
      : initialSnapshot();
    try {
      this.#storage?.removeItem?.(this.#storageKey);
    } catch {
      // Progress remains usable in memory when browser storage is unavailable.
    }
    return this.snapshot;
  }

  #load() {
    try {
      const serialized = this.#storage?.getItem?.(this.#storageKey);
      return serialized
        ? normalizeCampaignProgress(JSON.parse(serialized))
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
      // A storage quota/privacy failure must not make the campaign unplayable.
    }
  }
}
