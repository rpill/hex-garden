import {
  PROGRESSION_LEVEL_COUNT,
  getProgressionLevelDefinition,
} from "./progression.js";
import { isRecord } from "./persistence.js";

const standardEndlessUnlockLevel = Array.from(
  { length: PROGRESSION_LEVEL_COUNT },
  (_value, level) => level,
).find((level) => getProgressionLevelDefinition(level).mechanics.includes("gold"));

if (standardEndlessUnlockLevel === undefined) {
  throw new Error("Campaign never unlocks the complete standard rules");
}

export const STANDARD_ENDLESS_UNLOCK_LEVEL: number = standardEndlessUnlockLevel;
export const STANDARD_ENDLESS_REQUIRED_COMPLETIONS = STANDARD_ENDLESS_UNLOCK_LEVEL + 1;

export interface EndlessAccessSnapshot {
  unlocked: boolean;
  unlockLevel: number;
  requiredCompletedLevels: number;
  completedRequiredLevels: number;
  remainingLevels: number;
}

export function standardEndlessAccess(
  snapshot: unknown,
  { unlockAll = false }: { unlockAll?: boolean } = {},
): Readonly<EndlessAccessSnapshot> {
  const record = isRecord(snapshot) ? snapshot : {};
  const completedLevels = Array.isArray(record.completedLevels)
    ? record.completedLevels.filter((level): level is number => Number.isSafeInteger(level))
    : [];
  const completed = new Set(completedLevels);
  const completedRequiredLevels = unlockAll
    ? STANDARD_ENDLESS_REQUIRED_COMPLETIONS
    : Array.from(
        { length: STANDARD_ENDLESS_REQUIRED_COMPLETIONS },
        (_value, level) => level,
      ).filter((level) => completed.has(level)).length;
  const remainingLevels = STANDARD_ENDLESS_REQUIRED_COMPLETIONS - completedRequiredLevels;

  return Object.freeze({
    unlocked: remainingLevels === 0,
    unlockLevel: STANDARD_ENDLESS_UNLOCK_LEVEL,
    requiredCompletedLevels: STANDARD_ENDLESS_REQUIRED_COMPLETIONS,
    completedRequiredLevels,
    remainingLevels,
  });
}
