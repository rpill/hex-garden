import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  CAMPAIGN_LEVEL_COUNT,
  analyzePuzzleDifficulty,
  campaignDifficultyProfile,
  campaignPlateSize,
  createSeededRandom,
  generatePuzzleCandidate,
  plateSpec,
  rankCandidatesForProfile,
} from "../src/index.js";

const OUTPUT_PATH = resolve("build/campaign-shortlist.json");
const STANDARD_COMPOSITION = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
});
const ONBOARDING_COMPOSITIONS = Object.freeze([
  Object.freeze({ saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 0, metalDepth: 0 }),
  Object.freeze({ saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 0, metalDepth: 0 }),
  Object.freeze({ saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 1, metalDepth: 0 }),
  Object.freeze({ saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 1, metalDepth: 3 }),
  Object.freeze({ saltPairCount: 1, saltElementPairCount: 1, oppositePairCount: 1, metalDepth: 3 }),
]);

function candidateCountForPlate(plateSize) {
  if (plateSize === "small") return 64;
  if (plateSize === "medium") return 48;
  if (plateSize === "large") return 32;
  throw new RangeError(`Unknown campaign plate size: ${String(plateSize)}`);
}

function compositionForLevel(level) {
  return level < ONBOARDING_COMPOSITIONS.length
    ? ONBOARDING_COMPOSITIONS[level]
    : STANDARD_COMPOSITION;
}

function targetPieceCountForLevel(level, plateSize, composition) {
  const { minPieces, maxPieces } = plateSpec(plateSize);
  const parity = composition.metalDepth === 6 ? 1 : 0;
  const compatible = [];
  for (let count = minPieces; count <= maxPieces; count += 1) {
    if (count >= 25 && count % 2 === parity) compatible.push(count);
  }
  if (compatible.length === 0) {
    throw new Error(`No parity-compatible occupancy for campaign level ${level + 1}`);
  }
  const random = createSeededRandom(`campaign-v2:level:${level}`);
  const selected = compatible[Math.floor(random() * compatible.length)];
  if (selected === undefined) throw new Error(`Could not choose occupancy for campaign level ${level + 1}`);
  return selected;
}

const levels = [];
for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
  const plateSize = campaignPlateSize(level);
  const spec = plateSpec(plateSize);
  const composition = compositionForLevel(level);
  const targetPieceCount = targetPieceCountForLevel(level, plateSize, composition);
  const poolSize = candidateCountForPlate(plateSize);
  const candidates = [];

  for (let candidateIndex = 0; candidateIndex < poolSize; candidateIndex += 1) {
    const seed = `campaign-v2:level:${level}:candidate:${candidateIndex}`;
    const generated = generatePuzzleCandidate({
      seed,
      plateSize,
      targetPieceCount,
      composition,
    });
    const metrics = analyzePuzzleDifficulty({
      pieces: generated.pieces,
      solution: generated.solution,
      plateCells: generated.plateCells,
      sampleSeed: seed,
    });
    candidates.push({
      seed,
      plateSize,
      plateRadius: generated.plateRadius,
      plateCells: generated.plateCells,
      pieces: generated.pieces,
      solution: generated.solution,
      metrics,
    });
  }

  const ranked = rankCandidatesForProfile(candidates, campaignDifficultyProfile(level));
  if (ranked.length < 5) {
    throw new Error(`Campaign level ${level + 1} produced only ${ranked.length} rankable candidates`);
  }

  levels.push({
    level,
    plateSize,
    plateRadius: spec.radius,
    targetPieceCount,
    candidates: ranked.slice(0, 5).map(({ candidate, percentiles, score }) => ({
      seed: candidate.seed,
      plateSize: candidate.plateSize,
      plateRadius: candidate.plateRadius,
      plateCells: candidate.plateCells,
      pieces: candidate.pieces,
      solution: candidate.solution,
      metrics: candidate.metrics,
      percentiles,
      score,
    })),
  });

  process.stdout.write(`\rAuthored campaign shortlist: ${level + 1}/${CAMPAIGN_LEVEL_COUNT}`);
}
process.stdout.write("\n");

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify({ format: "hex-garden-campaign-shortlist-v1", levels }, null, 2)}\n`,
  "utf8",
);
console.log(`Campaign shortlist: ${OUTPUT_PATH}`);
