import type Phaser from "phaser";
import { CampaignProgressStore } from "../campaign-progress.js";
import { isCampaignTestMode } from "./campaign-test-mode.js";
const REGISTRY_KEY="campaign-progress";
export function getCampaignProgress(scene:Phaser.Scene):CampaignProgressStore{
  let progress=scene.registry.get(REGISTRY_KEY) as CampaignProgressStore|undefined;
  if(!progress){const testMode=isCampaignTestMode();progress=new CampaignProgressStore({unlockAll:testMode});scene.registry.set(REGISTRY_KEY,progress);}
  return progress;
}
