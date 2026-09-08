import type { CampaignProgressSnapshot } from "../campaign-progress.js";
import {
  campaignContinueTarget,
  masteryRank,
  type CampaignContinueTarget,
  type MasteryRankValue,
} from "../mastery.js";
import { dailyAccess, endlessAccess } from "../mode-access.js";

export type HomeProgressSnapshot = Pick<
  CampaignProgressSnapshot,
  "tutorialCompleted" | "solvedLevels" | "cleanLevels"
>;

export interface HomeModel {
  firstLaunch: boolean;
  continueTarget: CampaignContinueTarget;
  solvedCount: number;
  cleanCount: number;
  rank: MasteryRankValue;
  showDaily: boolean;
  showEndless: boolean;
}

export function createHomeModel(
  snapshot: HomeProgressSnapshot,
  { unlockAll = false }: { unlockAll?: boolean } = {},
): Readonly<HomeModel> {
  const solvedCount = snapshot.solvedLevels.length;
  const cleanCount = snapshot.cleanLevels.length;

  return Object.freeze({
    firstLaunch: !snapshot.tutorialCompleted,
    continueTarget: campaignContinueTarget(snapshot),
    solvedCount,
    cleanCount,
    rank: masteryRank(cleanCount),
    showDaily: dailyAccess(snapshot, { unlockAll }).unlocked,
    showEndless: endlessAccess(snapshot, { unlockAll }).unlocked,
  });
}
