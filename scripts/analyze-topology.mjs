import { readFile } from "node:fs/promises";
import {
  ADJACENT_OFFSETS,
  Atom,
  BoardVariant,
  SigmarsGardenBoard,
  SigmarsGardenDatabase,
  ATOM_NAMES,
  addHex,
  generateCampaignLevel,
  hexDistance,
  hexKey,
} from "../src/index.js";

const originalPath = String.raw`D:\Games\The Zachtronics Solitaire Collection\Content\solitaire.dat`;
const sampleSize = Number.parseInt(process.argv[2] ?? "1000", 10);

function hasThreeEmptyNeighbours(position, occupied) {
  let run = 0;
  let longest = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const offset of ADJACENT_OFFSETS) {
      if (occupied.has(hexKey(addHex(position, offset)))) run = 0;
      else longest = Math.max(longest, ++run);
    }
  }
  return longest >= 3;
}

function topologyMetrics(pieces) {
  const board = new SigmarsGardenBoard(pieces);
  const occupied = new Set(pieces.map(hexKey));
  const gold = pieces.find((piece) => piece.type === Atom.GOLD);
  const goldNeighbours = ADJACENT_OFFSETS.filter((offset) =>
    occupied.has(hexKey(addHex(gold, offset))),
  ).length;
  const rings = Array(6).fill(0);
  const neighbourCounts = Array(7).fill(0);
  for (const piece of pieces) {
    rings[hexDistance(piece, { q: 5, r: 0 })] += 1;
    const neighbours = ADJACENT_OFFSETS.filter((offset) =>
      occupied.has(hexKey(addHex(piece, offset))),
    ).length;
    neighbourCounts[neighbours] += 1;
  }

  const remaining = new Map(pieces.map((piece) => [hexKey(piece), piece]));
  let goldWave = -1;
  let wave = 0;
  while (remaining.size > 0) {
    const remainingKeys = new Set(remaining.keys());
    const free = [...remaining.values()].filter((piece) =>
      hasThreeEmptyNeighbours(piece, remainingKeys),
    );
    if (free.some((piece) => piece.type === Atom.GOLD)) {
      goldWave = wave;
      break;
    }
    if (free.length === 0) break;
    for (const piece of free) remaining.delete(hexKey(piece));
    wave += 1;
  }

  return {
    rings,
    neighbourCounts,
    free: pieces.filter((piece) => board.isFree(piece)).length,
    geometricFree: pieces.filter((piece) => hasThreeEmptyNeighbours(piece, occupied)).length,
    goldNeighbours,
    goldGeometricallyFree: hasThreeEmptyNeighbours(gold, occupied) ? 1 : 0,
    goldWave,
  };
}

function summarize(name, records) {
  const metrics = records.map(topologyMetrics);
  const averageArray = (field) =>
    metrics[0][field].map((_, index) =>
      Number(
        (metrics.reduce((sum, item) => sum + item[field][index], 0) / metrics.length).toFixed(3),
      ),
    );
  const average = (field) =>
    Number((metrics.reduce((sum, item) => sum + item[field], 0) / metrics.length).toFixed(3));
  const typeDistance = {};
  for (const [type, atomName] of Object.entries(ATOM_NAMES)) {
    const distances = records.flatMap((pieces) =>
      pieces
        .filter((piece) => piece.type === Number(type))
        .map((piece) => hexDistance(piece, { q: 5, r: 0 })),
    );
    typeDistance[atomName] = Number(
      (distances.reduce((sum, distance) => sum + distance, 0) / distances.length).toFixed(3),
    );
  }
  return {
    name,
    boards: records.length,
    averageRingOccupancy: averageArray("rings"),
    averageNeighbourHistogram: averageArray("neighbourCounts"),
    averageInitiallyAvailable: average("free"),
    averageInitiallyGeometricallyFree: average("geometricFree"),
    averageGoldOccupiedNeighbours: average("goldNeighbours"),
    percentGoldInitiallyGeometricallyFree: average("goldGeometricallyFree") * 100,
    averageGoldPeelingWave: average("goldWave"),
    averageTypeDistanceFromCenter: typeDistance,
  };
}

const database = new SigmarsGardenDatabase(await readFile(originalPath));
const count = Math.min(sampleSize, database.count);
const original = Array.from({ length: count }, (_, index) => database.readPieces(index));
const generated = Array.from({ length: count }, (_, level) =>
  generateCampaignLevel(level, {
    campaignSeed: "rules-lab-v1",
    variant: BoardVariant.STANDARD,
  }).pieces,
);

console.log(JSON.stringify([
  summarize("original", original),
  summarize("current-generator", generated),
], null, 2));
