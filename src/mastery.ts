import { CAMPAIGN_LEVEL_COUNT } from "./plates.js";

export const MasteryRank = Object.freeze({
  NOVICE: "novice",
  APPRENTICE: "apprentice",
  ADEPT: "adept",
  STRATEGIST: "strategist",
  EXPERT: "expert",
  MASTER: "master",
} as const);

export type MasteryRankValue = (typeof MasteryRank)[keyof typeof MasteryRank];

const RANKS: readonly Readonly<{ threshold: number; rank: MasteryRankValue }>[] = Object.freeze([
  { threshold: 50, rank: MasteryRank.MASTER },
  { threshold: 40, rank: MasteryRank.EXPERT },
  { threshold: 30, rank: MasteryRank.STRATEGIST },
  { threshold: 15, rank: MasteryRank.ADEPT },
  { threshold: 5, rank: MasteryRank.APPRENTICE },
  { threshold: 0, rank: MasteryRank.NOVICE },
]);

export type CampaignContinueTarget =
  | Readonly<{ kind: "campaign"; level: number }>
  | Readonly<{ kind: "mastery"; level: number }>
  | Readonly<{ kind: "complete" }>;

export interface CampaignMasteryProgress {
  solvedLevels: readonly number[];
  cleanLevels: readonly number[];
}

function validLevelSet(levels: readonly number[]): Set<number> {
  return new Set(
    levels.filter(
      (level) => Number.isSafeInteger(level) && level >= 0 && level < CAMPAIGN_LEVEL_COUNT,
    ),
  );
}

export function masteryRank(cleanCount: number): MasteryRankValue {
  if (!Number.isSafeInteger(cleanCount) || cleanCount < 0 || cleanCount > CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`cleanCount must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT}`);
  }

  for (const entry of RANKS) {
    if (cleanCount >= entry.threshold) return entry.rank;
  }

  return MasteryRank.NOVICE;
}

export function campaignContinueTarget(snapshot: CampaignMasteryProgress): CampaignContinueTarget {
  const solved = validLevelSet(snapshot.solvedLevels);
  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    if (!solved.has(level)) return { kind: "campaign", level };
  }

  const clean = validLevelSet(snapshot.cleanLevels);
  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    if (!clean.has(level)) return { kind: "mastery", level };
  }

  return { kind: "complete" };
}
