import {
  DAILY_LEVEL_PACK_START_DATE_KEY,
  FROZEN_DAILY_LEVEL_COUNT,
  getDailyLevel,
  offsetDailyDateKey,
  replaySolution,
} from "../src/index.js";
import { analyzeFastDailyQuality } from "../src/daily-fast-quality.js";

const BAND_ORDER = ["medium", "mediumHard", "hard", "challenge"];
const candidateIndexes = [];
const qualityByBand = new Map(BAND_ORDER.map((band) => [band, []]));

for (let index = 0; index < FROZEN_DAILY_LEVEL_COUNT; index += 1) {
  const dateKey = offsetDailyDateKey(DAILY_LEVEL_PACK_START_DATE_KEY, index);
  const level = getDailyLevel(dateKey);
  if (!replaySolution(level.pieces, level.solution)) {
    throw new Error(`Frozen Daily ${dateKey} failed its solution certificate`);
  }

  const candidateIndex = Number(level.candidateSeed.split(":").at(-1));
  candidateIndexes.push(candidateIndex);
  qualityByBand.get(level.band)?.push(analyzeFastDailyQuality({
    pieces: level.pieces,
    solution: level.solution,
    sampleSeed: level.candidateSeed,
  }));
}

const distinctCandidateIndexes = new Set(candidateIndexes).size;
const nonZeroCandidates = candidateIndexes.filter((index) => index !== 0).length;
if (distinctCandidateIndexes < 6 || nonZeroCandidates < FROZEN_DAILY_LEVEL_COUNT / 2) {
  throw new Error(
    `Frozen Daily ranking collapsed: ${distinctCandidateIndexes} candidate indexes, ${nonZeroCandidates}/${FROZEN_DAILY_LEVEL_COUNT} non-zero`,
  );
}

function average(rows, key) {
  return rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
}

const summary = Object.fromEntries(BAND_ORDER.map((band) => {
  const rows = qualityByBand.get(band) ?? [];
  if (rows.length === 0) throw new Error(`Frozen Daily pack has no ${band} levels`);
  return [band, {
    count: rows.length,
    meaningful: average(rows, "averageMeaningfulMoveCount"),
    forced: average(rows, "forcedStepRatio"),
    constrained: average(rows, "constrainedStepRatio"),
    ambiguity: average(rows, "ambiguousMoveRatio"),
    routeSurvival: average(rows, "sampledRouteSurvivalProbability"),
  }];
}));

for (let index = 1; index < BAND_ORDER.length; index += 1) {
  const easier = summary[BAND_ORDER[index - 1]];
  const harder = summary[BAND_ORDER[index]];
  if (!(harder.meaningful > easier.meaningful)) {
    throw new Error(`Daily meaningful-choice gradient regressed at ${BAND_ORDER[index]}`);
  }
  if (!(harder.constrained < easier.constrained)) {
    throw new Error(`Daily constrained-step gradient regressed at ${BAND_ORDER[index]}`);
  }
  if (!(harder.ambiguity > easier.ambiguity)) {
    throw new Error(`Daily ambiguity gradient regressed at ${BAND_ORDER[index]}`);
  }
}
if (!(summary.challenge.routeSurvival < summary.hard.routeSurvival)) {
  throw new Error("Challenge Daily random-route survival must be lower than hard");
}

console.log(
  `Frozen Daily pack OK: ${FROZEN_DAILY_LEVEL_COUNT} levels; ${distinctCandidateIndexes} candidate indexes; ${nonZeroCandidates} non-zero selections`,
);
for (const band of BAND_ORDER) {
  const row = summary[band];
  console.log(
    `${band}: n=${row.count} meaningful=${row.meaningful.toFixed(3)} constrained=${row.constrained.toFixed(3)} ambiguity=${row.ambiguity.toFixed(3)} route=${row.routeSurvival.toFixed(3)}`,
  );
}
