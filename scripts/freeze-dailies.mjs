import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dailyDifficultyProfile } from "../src/daily.js";
import {
  analyzeFastDailyQuality,
  fastDailySelectionProfileForBand,
  rankFastDailyCandidatesForProfile,
} from "../src/daily-fast-quality.js";
import { generatePuzzleCandidate } from "../src/puzzle-generation.js";

const DEFAULT_START = "2026-01-01";
const DEFAULT_END = "2027-12-31";
const OUTPUT_PATH = resolve("src/data/daily-levels.json");
const DAY_MS = 86_400_000;
const BATCH_SIZE = 60;
const DAILY_CANDIDATE_COUNT = 16;
const DAILY_COMPOSITION = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
});

function parseDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new RangeError(`Invalid date key: ${dateKey}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== dateKey) throw new RangeError(`Invalid date key: ${dateKey}`);
  return date;
}

function datesBetween(startDateKey, endDateKey) {
  const start = parseDateKey(startDateKey).getTime();
  const end = parseDateKey(endDateKey).getTime();
  if (end < start) throw new RangeError("Daily pack end date must not precede start date");
  const result = [];
  for (let time = start; time <= end; time += DAY_MS) {
    result.push(new Date(time).toISOString().slice(0, 10));
  }
  return result;
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`${name} requires a value`);
  return value;
}

function packPieces(pieces) {
  return pieces.flatMap((piece) => [piece.q, piece.r, piece.type]);
}

function packSolution(solution) {
  return solution.map((move) => move.flatMap((cell) => [cell.q, cell.r]));
}

function freezeDate(dateKey) {
  const profile = dailyDifficultyProfile(dateKey);
  const seed = `daily-v1:${dateKey}`;
  const candidates = [];

  for (let candidateIndex = 0; candidateIndex < DAILY_CANDIDATE_COUNT; candidateIndex += 1) {
    const candidateSeed = `${seed}:candidate:${candidateIndex}`;
    try {
      const generated = generatePuzzleCandidate({
        seed: candidateSeed,
        plateSize: profile.plateSize,
        targetPieceCount: profile.targetPieceCount,
        composition: DAILY_COMPOSITION,
      });
      candidates.push({
        candidateIndex,
        plateSize: generated.plateSize,
        generated,
        quality: analyzeFastDailyQuality({
          pieces: generated.pieces,
          solution: generated.solution,
          sampleSeed: candidateSeed,
        }),
      });
    } catch {
      // Failed deterministic candidates consume their slot; valid siblings are
      // still ranked by the fast offline quality profile.
    }
  }

  const selected = rankFastDailyCandidatesForProfile(
    candidates,
    fastDailySelectionProfileForBand(profile.band),
  )[0]?.candidate;
  if (!selected) throw new Error(`Could not freeze a valid Daily puzzle for ${dateKey}`);

  return [
    selected.candidateIndex,
    packPieces(selected.generated.pieces),
    packSolution(selected.generated.solution),
  ];
}

const startDateKey = argValue("--start", DEFAULT_START);
const endDateKey = argValue("--end", DEFAULT_END);
const dates = datesBetween(startDateKey, endDateKey);
const levels = [];
console.log(`Freezing ${dates.length} ranked solver-certified Daily puzzles...`);

for (let startIndex = 0; startIndex < dates.length; startIndex += BATCH_SIZE) {
  const batch = dates.slice(startIndex, startIndex + BATCH_SIZE);
  for (const dateKey of batch) levels.push(freezeDate(dateKey));
  globalThis.gc?.();
  console.log(`  ${Math.min(startIndex + batch.length, dates.length)}/${dates.length}`);
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
const tempPath = `${OUTPUT_PATH}.tmp`;
await writeFile(
  tempPath,
  `${JSON.stringify({ format: "hex-garden-daily-pack-v1", startDateKey, endDateKey, levels })}\n`,
  "utf8",
);
await rename(tempPath, OUTPUT_PATH);
console.log(`Frozen Daily pack: ${OUTPUT_PATH} (${levels.length} levels)`);
