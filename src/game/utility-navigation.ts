import type Phaser from "phaser";
import {
  utilityReturnPlan,
  type UtilityRootSceneKey,
  type UtilitySceneKey,
} from "./presentation-model.js";

function sceneKey(scene: Phaser.Scene): string {
  return scene.sys?.settings?.key ?? scene.scene.key;
}

function showUtilityScene(
  scene: Phaser.Scene,
  target: UtilitySceneKey,
  returnScene: UtilityRootSceneKey,
): void {
  const plugin = scene.scene;
  const data = { returnScene };
  if (plugin.isSleeping(target)) plugin.wake(target, data);
  else if (!plugin.isActive(target)) plugin.launch(target, data);
  plugin.bringToTop(target);
}

export function openUtilityScene(
  scene: Phaser.Scene,
  target: UtilitySceneKey,
  { returnScene = sceneKey(scene) as UtilityRootSceneKey }: { returnScene?: UtilityRootSceneKey } = {},
): void {
  const current = sceneKey(scene);
  showUtilityScene(scene, target, returnScene);
  scene.scene.pause(current);
}

export function switchUtilityScene(
  scene: Phaser.Scene,
  target: UtilitySceneKey,
  { returnScene }: { returnScene: UtilityRootSceneKey },
): void {
  const current = sceneKey(scene);
  if (current === target) return;
  showUtilityScene(scene, target, returnScene);
  scene.scene.stop(current);
}

export function closeUtilityScene(
  scene: Phaser.Scene,
  returnScene: UtilityRootSceneKey | undefined,
): void {
  const plugin = scene.scene;
  const current = sceneKey(scene);
  const plan = utilityReturnPlan(returnScene);
  if (plan.kind === "resume") {
    plugin.stop(current);
    plugin.resume(plan.scene);
    plugin.bringToTop(plan.scene);
    return;
  }
  plugin.start(plan.scene);
}

export function exitUtilityToScene(
  scene: Phaser.Scene,
  target: UtilityRootSceneKey,
  { returnScene }: { returnScene: UtilityRootSceneKey },
): void {
  const plugin = scene.scene;
  const current = sceneKey(scene);
  plugin.stop(current);
  if (returnScene !== target && returnScene !== current) plugin.stop(returnScene);
  plugin.start(target);
}
