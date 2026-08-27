import {
  PROGRESSION_LEVEL_COUNT,
  getProgressionLevelDefinition,
} from "./progression.js";

export const STANDARD_ENDLESS_UNLOCK_LEVEL = Array.from(
  { length: PROGRESSION_LEVEL_COUNT },
  (_value, level) => level,
).find((level) =>
  getProgressionLevelDefinition(level).mechanics.includes("gold"),
);

if (STANDARD_ENDLESS_UNLOCK_LEVEL === undefined) {
  throw new Error("Campaign never unlocks the complete standard rules");
}

export const STANDARD_ENDLESS_REQUIRED_COMPLETIONS =
  STANDARD_ENDLESS_UNLOCK_LEVEL + 1;

export function standardEndlessAccess(snapshot, { unlockAll = false } = {}) {
  const completed = new Set(
    Array.isArray(snapshot?.completedLevels) ? snapshot.completedLevels : [],
  );
  const completedRequiredLevels = unlockAll
    ? STANDARD_ENDLESS_REQUIRED_COMPLETIONS
    : Array.from(
        { length: STANDARD_ENDLESS_REQUIRED_COMPLETIONS },
        (_value, level) => level,
      ).filter((level) => completed.has(level)).length;
  const remainingLevels =
    STANDARD_ENDLESS_REQUIRED_COMPLETIONS - completedRequiredLevels;

  return Object.freeze({
    unlocked: remainingLevels === 0,
    unlockLevel: STANDARD_ENDLESS_UNLOCK_LEVEL,
    requiredCompletedLevels: STANDARD_ENDLESS_REQUIRED_COMPLETIONS,
    completedRequiredLevels,
    remainingLevels,
  });
}
