import type Phaser from "phaser";
import { utilityReturnPlan, type UtilitySceneKey } from "./presentation-model.js";
function sceneKey(scene:Phaser.Scene):string{return scene.sys?.settings?.key??scene.scene.key;}
export function openUtilityScene(scene:Phaser.Scene,target:UtilitySceneKey,{returnScene=sceneKey(scene)}:{returnScene?:string}={}):void{
  const plugin=scene.scene; const data={returnScene}; if(plugin.isSleeping(target))plugin.wake(target,data); else if(!plugin.isActive(target))plugin.launch(target,data); plugin.bringToTop(target); plugin.pause(sceneKey(scene));
}
export function closeUtilityScene(scene:Phaser.Scene,returnScene:string|undefined):void{
  const plugin=scene.scene; const current=sceneKey(scene); const plan=utilityReturnPlan(returnScene);
  if(plan.kind==="resume"){plugin.stop(current);plugin.resume(plan.scene);plugin.bringToTop(plan.scene);return;} plugin.start(plan.scene);
}
