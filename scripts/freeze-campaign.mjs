import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CAMPAIGN_LEVEL_COUNT } from "../src/index.js";

const SHORTLIST_PATH = resolve("build/campaign-shortlist.json");
const OUTPUT_PATH = resolve("src/data/campaign-levels.json");

function selectionPathFromArgs(args) {
  const index = args.indexOf("--selection");
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new TypeError("--selection requires a JSON file path");
  }
  return resolve(value);
}

function validateSelection(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.levels)) {
    throw new TypeError("Campaign selection must be shaped like { levels: number[] }");
  }
  if (value.levels.length !== CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`Campaign selection must contain exactly ${CAMPAIGN_LEVEL_COUNT} entries`);
  }
  return value.levels.map((candidateIndex, level) => {
    if (!Number.isSafeInteger(candidateIndex) || candidateIndex < 0 || candidateIndex > 4) {
      throw new RangeError(`Campaign selection entry ${level + 1} must be an integer from 0 to 4`);
    }
    return candidateIndex;
  });
}

const shortlist = JSON.parse(await readFile(SHORTLIST_PATH, "utf8"));
if (!shortlist || !Array.isArray(shortlist.levels) || shortlist.levels.length !== CAMPAIGN_LEVEL_COUNT) {
  throw new Error(`Campaign shortlist must contain exactly ${CAMPAIGN_LEVEL_COUNT} levels`);
}

const selectionPath = selectionPathFromArgs(process.argv.slice(2));
const selectedIndexes = selectionPath
  ? validateSelection(JSON.parse(await readFile(selectionPath, "utf8")))
  : Array.from({ length: CAMPAIGN_LEVEL_COUNT }, () => 0);

const levels = shortlist.levels.map((shortlistLevel, level) => {
  if (!shortlistLevel || shortlistLevel.level !== level || !Array.isArray(shortlistLevel.candidates)) {
    throw new Error(`Campaign shortlist level ${level + 1} is malformed`);
  }
  const selectedIndex = selectedIndexes[level];
  const candidate = shortlistLevel.candidates[selectedIndex];
  if (!candidate) throw new Error(`Campaign shortlist level ${level + 1} is missing candidate ${selectedIndex}`);
  return {
    level,
    seed: candidate.seed,
    plateSize: candidate.plateSize,
    plateRadius: candidate.plateRadius,
    plateCells: candidate.plateCells,
    pieces: candidate.pieces,
    solution: candidate.solution,
    difficulty: candidate.metrics,
  };
});

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify({ format: "hex-garden-campaign-v2", levels }, null, 2)}\n`,
  "utf8",
);
console.log(`Frozen campaign: ${OUTPUT_PATH}`);
