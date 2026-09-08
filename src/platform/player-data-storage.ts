import { isRecord, type StorageLike } from "../persistence.js";
import {
  getYandexGamesAdapter,
  type YandexGamesAdapter,
} from "./yandex-games.js";

export const PLAYER_DATA_STORAGE_FIELD = "gardenJsStorageV1";

interface PlayerDataEnvelope {
  version: 1;
  values: Record<string, string>;
}

export interface PlayerDataStorage extends StorageLike {
  readonly source: "yandex" | "fallback";
  flush(): Promise<boolean>;
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function normalizeEnvelope(value: unknown): PlayerDataEnvelope {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.values)) {
    return { version: 1, values: {} };
  }

  const values: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.values)) {
    if (typeof item === "string") values[key] = item;
  }
  return { version: 1, values };
}

class MemoryStorage implements StorageLike {
  readonly #values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, String(value));
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }
}

class FallbackPlayerDataStorage implements PlayerDataStorage {
  readonly source = "fallback" as const;

  constructor(readonly storage: StorageLike) {}

  getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  async flush(): Promise<boolean> {
    return true;
  }
}

class YandexPlayerDataStorage implements PlayerDataStorage {
  readonly source = "yandex" as const;
  readonly #adapter: YandexGamesAdapter;
  readonly #values: Record<string, string>;
  #pending: Promise<boolean> = Promise.resolve(true);

  constructor(adapter: YandexGamesAdapter, envelope: PlayerDataEnvelope) {
    this.#adapter = adapter;
    this.#values = { ...envelope.values };
  }

  getItem(key: string): string | null {
    return this.#values[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values[key] = String(value);
    this.#queuePersist();
  }

  removeItem(key: string): void {
    if (!(key in this.#values)) return;
    delete this.#values[key];
    this.#queuePersist();
  }

  async flush(): Promise<boolean> {
    return this.#pending;
  }

  #queuePersist(): void {
    const envelope: PlayerDataEnvelope = {
      version: 1,
      values: { ...this.#values },
    };
    this.#pending = this.#pending
      .catch(() => false)
      .then(() => this.#adapter.setPlayerData({ [PLAYER_DATA_STORAGE_FIELD]: envelope }, true));
  }
}

export interface CreatePlayerDataStorageOptions {
  adapter?: YandexGamesAdapter;
  fallback?: StorageLike | null;
}

export async function createPlayerDataStorage({
  adapter = getYandexGamesAdapter(),
  fallback = browserStorage(),
}: CreatePlayerDataStorageOptions = {}): Promise<PlayerDataStorage> {
  const playerData = await adapter.getPlayerData([PLAYER_DATA_STORAGE_FIELD]);
  if (playerData !== null) {
    return new YandexPlayerDataStorage(
      adapter,
      normalizeEnvelope(playerData[PLAYER_DATA_STORAGE_FIELD]),
    );
  }

  return new FallbackPlayerDataStorage(fallback ?? new MemoryStorage());
}

let sharedStorage: PlayerDataStorage | undefined;

export async function initializePlayerDataStorage(
  adapter: YandexGamesAdapter = getYandexGamesAdapter(),
): Promise<PlayerDataStorage> {
  sharedStorage = await createPlayerDataStorage({ adapter });
  return sharedStorage;
}

export function getPlayerDataStorage(): PlayerDataStorage {
  sharedStorage ??= new FallbackPlayerDataStorage(browserStorage() ?? new MemoryStorage());
  return sharedStorage;
}
