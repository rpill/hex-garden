import { CAMPAIGN_LEVEL_COUNT } from "../plates.js";
import {
  CampaignChapter,
  type CampaignChapterValue,
} from "../difficulty-profiles.js";

export const CampaignLevelState = Object.freeze({
  LOCKED: "locked",
  CURRENT: "current",
  SOLVED: "solved",
  CLEAN: "clean",
} as const);

export type CampaignLevelStateValue =
  (typeof CampaignLevelState)[keyof typeof CampaignLevelState];

export interface ChapterProgressSnapshot {
  solvedLevels: readonly number[];
  cleanLevels: readonly number[];
  highestUnlocked: number;
}

export interface CampaignChapterDefinition {
  id: CampaignChapterValue;
  index: number;
  startLevel: number;
  endLevel: number;
  titleRu: string;
  titleEn: string;
}

export const CAMPAIGN_CHAPTERS: readonly Readonly<CampaignChapterDefinition>[] = Object.freeze([
  Object.freeze({ id: CampaignChapter.BASICS, index: 0, startLevel: 0, endLevel: 9, titleRu: "ОСНОВЫ", titleEn: "BASICS" }),
  Object.freeze({ id: CampaignChapter.PLANNING, index: 1, startLevel: 10, endLevel: 19, titleRu: "ПЛАНИРОВАНИЕ", titleEn: "PLANNING" }),
  Object.freeze({ id: CampaignChapter.ORDER, index: 2, startLevel: 20, endLevel: 29, titleRu: "ПОРЯДОК", titleEn: "ORDER" }),
  Object.freeze({ id: CampaignChapter.FALSE_MOVES, index: 3, startLevel: 30, endLevel: 39, titleRu: "ЛОЖНЫЕ ХОДЫ", titleEn: "FALSE MOVES" }),
  Object.freeze({ id: CampaignChapter.MASTERY, index: 4, startLevel: 40, endLevel: 49, titleRu: "МАСТЕРСТВО", titleEn: "MASTERY" }),
]);

function assertCampaignLevel(level: number): void {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`);
  }
}

export function campaignLevelState(
  snapshot: ChapterProgressSnapshot,
  level: number,
  { unlockAll = false }: { unlockAll?: boolean } = {},
): CampaignLevelStateValue {
  assertCampaignLevel(level);
  if (snapshot.cleanLevels.includes(level)) return CampaignLevelState.CLEAN;
  if (snapshot.solvedLevels.includes(level)) return CampaignLevelState.SOLVED;
  if (unlockAll || level <= snapshot.highestUnlocked) return CampaignLevelState.CURRENT;
  return CampaignLevelState.LOCKED;
}
