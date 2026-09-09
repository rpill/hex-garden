import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { dailyDifficultyProfile } from "../src/daily.js";
import { generatePuzzleCandidate } from "../src/puzzle-generation.js";

const DEFAULT_START = "2026-01-01";
const DEFAULT_END = "2027-12-31";
const OUTPUT_PATH = resolve("src/data/daily-levels.json");
const DAY_MS = 86_400_000;
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
  for (let candidateIndex = 0; candidateIndex < DAILY_CANDIDATE_COUNT; candidateIndex += 1) {
    try {
      const generated = generatePuzzleCandidate({
        seed: `${seed}:candidate:${candidateIndex}`,
        plateSize: profile.plateSize,
        targetPieceCount: profile.targetPieceCount,
        composition: DAILY_COMPOSITION,
      });
      return [candidateIndex, packPieces(generated.pieces), packSolution(generated.solution)];
    } catch {
      // Release packs need a deterministic solver-certified board. Deep difficulty
      // scoring remains an optional authoring/curation tool, not a freeze blocker.
    }
  }
  throw new Error(`Could not freeze a valid Daily puzzle for ${dateKey}`);
}

const startDateKey = argValue("--start", DEFAULT_START);
const endDateKey = argValue("--end", DEFAULT_END);
const dates = datesBetween(startDateKey, endDateKey);
console.log(`Freezing ${dates.length} solver-certified Daily puzzles...`);
const levels = dates.map(freezeDate);

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify({
    format: "hex-garden-daily-pack-v1",
    startDateKey,
    endDateKey,
    levels,
  })}\n`,
  "utf8",
);
console.log(`Frozen Daily pack: ${OUTPUT_PATH} (${levels.length} levels)`);
