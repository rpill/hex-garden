import {
  DAILY_LEVEL_PACK_START_DATE_KEY,
  FROZEN_DAILY_LEVEL_COUNT,
  getDailyLevel,
  offsetDailyDateKey,
  replaySolution,
} from "../src/index.js";

for (let index = 0; index < FROZEN_DAILY_LEVEL_COUNT; index += 1) {
  const dateKey = offsetDailyDateKey(DAILY_LEVEL_PACK_START_DATE_KEY, index);
  const level = getDailyLevel(dateKey);
  if (!replaySolution(level.pieces, level.solution)) {
    throw new Error(`Frozen Daily ${dateKey} failed its solution certificate`);
  }
}

console.log(`Frozen Daily pack OK: ${FROZEN_DAILY_LEVEL_COUNT} levels`);
