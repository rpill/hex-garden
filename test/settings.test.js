import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  Language,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  normalizeSettings,
} from "../src/settings.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("settings default to Russian with sound enabled", () => {
  assert.deepEqual(new SettingsStore({ storage: null }).snapshot, DEFAULT_SETTINGS);
});

test("settings persist language and sound independently", () => {
  const storage = memoryStorage();
  const settings = new SettingsStore({ storage });
  settings.setLanguage(Language.EN);
  settings.setSoundEnabled(false);
  assert.deepEqual(new SettingsStore({ storage }).snapshot, {
    language: Language.EN,
    soundEnabled: false,
  });
});

test("damaged saved settings are normalized", () => {
  const storage = memoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({ language: "xx", soundEnabled: "yes" }),
  });
  assert.deepEqual(new SettingsStore({ storage }).snapshot, normalizeSettings({}));
});
