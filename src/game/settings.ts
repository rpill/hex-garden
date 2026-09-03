import type Phaser from "phaser";
import { SettingsStore, type SettingsSnapshot } from "../settings.js";
const REGISTRY_KEY="settings";
export function applySettings(scene:Phaser.Scene,snapshot:Readonly<SettingsSnapshot>):void{
  if(scene.sound)scene.sound.mute=!snapshot.soundEnabled; if(globalThis.document?.documentElement)globalThis.document.documentElement.lang=snapshot.language;
}
export function getSettings(scene:Phaser.Scene):SettingsStore{
  let settings=scene.registry.get(REGISTRY_KEY) as SettingsStore|undefined; if(!settings){settings=new SettingsStore();scene.registry.set(REGISTRY_KEY,settings);} applySettings(scene,settings.snapshot);return settings;
}
