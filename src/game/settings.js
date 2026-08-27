import { SettingsStore } from "../settings.js";

const REGISTRY_KEY = "settings";

export function applySettings(scene, snapshot) {
  if (scene.sound) scene.sound.mute = !snapshot.soundEnabled;
  if (globalThis.document?.documentElement) {
    globalThis.document.documentElement.lang = snapshot.language;
  }
}

export function getSettings(scene) {
  let settings = scene.registry.get(REGISTRY_KEY);
  if (!settings) {
    settings = new SettingsStore();
    scene.registry.set(REGISTRY_KEY, settings);
  }
  applySettings(scene, settings.snapshot);
  return settings;
}
