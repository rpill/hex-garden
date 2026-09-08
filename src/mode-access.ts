import { isRecord } from "./persistence.js";

export const DAILY_REQUIRED_COMPLETIONS = 5;
export const ENDLESS_REQUIRED_COMPLETIONS = 10;

export interface ModeAccessSnapshot {
  unlocked: boolean;
  requiredCompletedLevels: number;
  completedRequiredLevels: number;
  remainingLevels: number;
}

function contiguousSolvedPrefix(snapshot: unknown): number {
  const record = isRecord(snapshot) ? snapshot : {};
  const solvedLevels = Array.isArray(record.solvedLevels)
    ? record.solvedLevels.filter(
        (level): level is number =>
          typeof level === "number" && Number.isSafeInteger(level) && level >= 0,
      )
    : [];
  const solved = new Set(solvedLevels);
  let count = 0;
  while (solved.has(count)) count += 1;
  return count;
}

function accessForRequiredCompletions(
  snapshot: unknown,
  requiredCompletedLevels: number,
  { unlockAll = false }: { unlockAll?: boolean } = {},
): Readonly<ModeAccessSnapshot> {
  const completedRequiredLevels = unlockAll
    ? requiredCompletedLevels
    : Math.min(requiredCompletedLevels, contiguousSolvedPrefix(snapshot));
  const remainingLevels = requiredCompletedLevels - completedRequiredLevels;

  return Object.freeze({
    unlocked: remainingLevels === 0,
    requiredCompletedLevels,
    completedRequiredLevels,
    remainingLevels,
  });
}

export function dailyAccess(
  snapshot: unknown,
  options: { unlockAll?: boolean } = {},
): Readonly<ModeAccessSnapshot> {
  return accessForRequiredCompletions(snapshot, DAILY_REQUIRED_COMPLETIONS, options);
}

export function endlessAccess(
  snapshot: unknown,
  options: { unlockAll?: boolean } = {},
): Readonly<ModeAccessSnapshot> {
  return accessForRequiredCompletions(snapshot, ENDLESS_REQUIRED_COMPLETIONS, options);
}
