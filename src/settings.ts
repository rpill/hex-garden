import { isRecord, type StorageLike } from "./persistence.js";

export const SETTINGS_STORAGE_KEY = "garden.settings.v1";

export const Language = Object.freeze({
  RU: "ru",
  EN: "en",
} as const);

export type LanguageValue = (typeof Language)[keyof typeof Language];

export interface SettingsSnapshot {
  language: LanguageValue;
  soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: Readonly<SettingsSnapshot> = Object.freeze({
  language: Language.RU,
  soundEnabled: true,
});

function safeStorage(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function normalizeSettings(value?: unknown): Readonly<SettingsSnapshot> {
  const record = isRecord(value) ? value : {};
  const language = Object.values(Language).includes(record.language as LanguageValue)
    ? (record.language as LanguageValue)
    : DEFAULT_SETTINGS.language;
  return Object.freeze({
    language,
    soundEnabled:
      typeof record.soundEnabled === "boolean"
        ? record.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
  });
}

export interface SettingsStoreOptions {
  storage?: StorageLike | null;
}

export class SettingsStore {
  #snapshot: Readonly<SettingsSnapshot>;
  #storage: StorageLike | null;

  constructor({ storage }: SettingsStoreOptions = {}) {
    this.#storage = safeStorage(storage);
    this.#snapshot = this.#load();
  }

  get snapshot(): Readonly<SettingsSnapshot> {
    return this.#snapshot;
  }

  setLanguage(language: LanguageValue): Readonly<SettingsSnapshot> {
    this.#snapshot = normalizeSettings({ ...this.#snapshot, language });
    this.#persist();
    return this.#snapshot;
  }

  setSoundEnabled(soundEnabled: boolean): Readonly<SettingsSnapshot> {
    this.#snapshot = normalizeSettings({ ...this.#snapshot, soundEnabled });
    this.#persist();
    return this.#snapshot;
  }

  #load(): Readonly<SettingsSnapshot> {
    if (!this.#storage) return DEFAULT_SETTINGS;
    try {
      const raw = this.#storage.getItem(SETTINGS_STORAGE_KEY);
      return raw ? normalizeSettings(JSON.parse(raw) as unknown) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  #persist(): void {
    if (!this.#storage) return;
    try {
      this.#storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.#snapshot));
    } catch {
      // Settings remain active in memory when storage is unavailable.
    }
  }
}
