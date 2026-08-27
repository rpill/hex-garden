export const SETTINGS_STORAGE_KEY = "garden.settings.v1";

export const Language = Object.freeze({
  RU: "ru",
  EN: "en",
});

export const DEFAULT_SETTINGS = Object.freeze({
  language: Language.RU,
  soundEnabled: true,
});

function safeStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function normalizeSettings(value) {
  return Object.freeze({
    language: Object.values(Language).includes(value?.language)
      ? value.language
      : DEFAULT_SETTINGS.language,
    soundEnabled:
      typeof value?.soundEnabled === "boolean"
        ? value.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
  });
}

export class SettingsStore {
  #snapshot;
  #storage;

  constructor({ storage } = {}) {
    this.#storage = safeStorage(storage);
    this.#snapshot = this.#load();
  }

  get snapshot() {
    return this.#snapshot;
  }

  setLanguage(language) {
    this.#snapshot = normalizeSettings({ ...this.#snapshot, language });
    this.#persist();
    return this.#snapshot;
  }

  setSoundEnabled(soundEnabled) {
    this.#snapshot = normalizeSettings({ ...this.#snapshot, soundEnabled });
    this.#persist();
    return this.#snapshot;
  }

  #load() {
    if (!this.#storage) return DEFAULT_SETTINGS;
    try {
      const raw = this.#storage.getItem(SETTINGS_STORAGE_KEY);
      return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  #persist() {
    if (!this.#storage) return;
    try {
      this.#storage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(this.#snapshot),
      );
    } catch {
      // Settings remain active in memory when storage is unavailable.
    }
  }
}
