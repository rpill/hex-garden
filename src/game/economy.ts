import type Phaser from "phaser";
import { EconomyStore } from "../economy.js";
import { getProgressionLevelDefinition } from "../progression.js";
import { getCampaignProgress } from "./campaign-progress.js";
const REGISTRY_KEY="economy"; export const CAMPAIGN_TEST_DUST=999_999;
export function getEconomy(scene:Phaser.Scene):EconomyStore{
  let economy=scene.registry.get(REGISTRY_KEY) as EconomyStore|undefined;
  if(!economy){const progress=getCampaignProgress(scene);economy=new EconomyStore({...(progress.testMode?{storage:null,startingDust:CAMPAIGN_TEST_DUST}:{})});scene.registry.set(REGISTRY_KEY,economy);}
  for(const level of getCampaignProgress(scene).snapshot.completedLevels)economy.claimCampaignLevel(level,getProgressionLevelDefinition(level).plateCellCount);
  return economy;
}
