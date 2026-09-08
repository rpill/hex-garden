import { isRecord, type StorageLike } from "./persistence.js";
import { getPlayerDataStorage } from "./platform/player-data-storage.js";

export const ENDLESS_PROGRESS_STORAGE_KEY = "garden-js.endless-progress.v1";

export interface EndlessProgressSnapshot {
  version: 1;
  bestUnassistedBoards: number;
  bestAssistedBoards: number;
}

export interface EndlessProgressStoreOptions {
  storage?: StorageLike;
  storageKey?: string;
}

export interface EndlessRunResult {
  boardsCleared: number;
  assisted: boolean;
}

function initialSnapshot(): EndlessProgressSnapshot {
  return {
    version: 1,
    bestUnassistedBoards: 0,
    bestAssistedBoards: 0,
  };
}

function normalizeBoardCount(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : 0;
}

function assertBoardCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("boardsCleared must be a non-negative safe integer");
  }
}

export function normalizeEndlessProgress(value: unknown): EndlessProgressSnapshot {
  if (!isRecord(value) || value.version !== 1) return initialSnapshot();

  return {
    version: 1,
    bestUnassistedBoards: normalizeBoardCount(value.bestUnassistedBoards),
    bestAssistedBoards: normalizeBoardCount(value.bestAssistedBoards),
  };
}

export class EndlessProgressStore {
  #snapshot: EndlessProgressSnapshot;
  readonly #storage: StorageLike;
  readonly #storageKey: string;

  constructor({
    storage = getPlayerDataStorage(),
    storageKey = ENDLESS_PROGRESS_STORAGE_KEY,
  }: EndlessProgressStoreOptions = {}) {
    this.#storage = storage;
    this.#storageKey = storageKey;
    this.#snapshot = this.#load();
  }

  get snapshot(): EndlessProgressSnapshot {
    return { ...this.#snapshot };
  }

  submit({ boardsCleared, assisted }: EndlessRunResult): EndlessProgressSnapshot {
    assertBoardCount(boardsCleared);

    const key = assisted ? "bestAssistedBoards" : "bestUnassistedBoards";
    if (boardsCleared <= this.#snapshot[key]) return this.snapshot;

    this.#snapshot[key] = boardsCleared;
    this.#persist();
    return this.snapshot;
  }

  #load(): EndlessProgressSnapshot {
    try {
      const serialized = this.#storage.getItem(this.#storageKey);
      return serialized
        ? normalizeEndlessProgress(JSON.parse(serialized) as unknown)
        : initialSnapshot();
    } catch {
      return initialSnapshot();
    }
  }

  #persist(): void {
    try {
      this.#storage.setItem(this.#storageKey, JSON.stringify(this.#snapshot));
    } catch {
      // Endless remains usable in memory if persistence is temporarily unavailable.
    }
  }
}
