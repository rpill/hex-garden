import { readFile } from "node:fs/promises";
import {
  ADJACENT_OFFSETS,
  Atom,
  GardenDatabase,
  GardenBoard,
  addHex,
  hexDistance,
  hexKey,
  rotateHexAround,
} from "../src/index.js";

const path = String.raw`D:\Games\The Zachtronics Solitaire Collection\Content\solitaire.dat`;
const database = new GardenDatabase(await readFile(path));
const profiles = new Map();
const goldNeighbourHistogram = Array(7).fill(0);
let goldGeometricallyFree = 0;
const rotationalSymmetry = {
  sixfold: 0,
  threefold: 0,
  twofold: 0,
  none: 0,
};
const symmetryGoldNeighbours = {
  sixfold: Array(7).fill(0),
  threefold: Array(7).fill(0),
  twofold: Array(7).fill(0),
  none: Array(7).fill(0),
};
const symmetryAvailability = Object.fromEntries(
  ["sixfold", "threefold", "twofold", "none"].map((key) => [
    key,
    { boards: 0, geometricFree: 0, available: 0 },
  ]),
);

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

for (let index = 0; index < database.count; index += 1) {
  const pieces = database.readPieces(index);
  const rings = Array(6).fill(0);
  for (const piece of pieces) rings[hexDistance(piece, { q: 5, r: 0 })] += 1;
  const key = rings.join(",");
  profiles.set(key, (profiles.get(key) ?? 0) + 1);

  const occupied = new Set(pieces.map(hexKey));
  const invariantAt = (turn) =>
    pieces.every((piece) => occupied.has(hexKey(rotateHexAround(piece, { q: 5, r: 0 }, turn))));
  let symmetry;
  if (invariantAt(1)) symmetry = "sixfold";
  else if (invariantAt(2)) symmetry = "threefold";
  else if (invariantAt(3)) symmetry = "twofold";
  else symmetry = "none";
  rotationalSymmetry[symmetry] += 1;
  const board = new GardenBoard(pieces);
  const geometricFreeCount = pieces.filter((piece) =>
    hasThreeEmptyNeighbours(piece, occupied),
  ).length;
  symmetryAvailability[symmetry].boards += 1;
  symmetryAvailability[symmetry].geometricFree += geometricFreeCount;
  symmetryAvailability[symmetry].available += pieces.filter((piece) => board.isFree(piece)).length;
  const gold = pieces.find((piece) => piece.type === Atom.GOLD);
  const neighbours = ADJACENT_OFFSETS.filter((offset) =>
    occupied.has(hexKey(addHex(gold, offset))),
  ).length;
  goldNeighbourHistogram[neighbours] += 1;
  symmetryGoldNeighbours[symmetry][neighbours] += 1;
  if (hasThreeEmptyNeighbours(gold, occupied)) goldGeometricallyFree += 1;
}

const topProfiles = [...profiles.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([profile, count]) => ({ profile, count, percent: (count / database.count) * 100 }));

console.log(JSON.stringify({
  boards: database.count,
  distinctRingProfiles: profiles.size,
  outerRingsProfile: profiles.get("1,0,0,0,24,30") ?? 0,
  goldNeighbourHistogram,
  goldGeometricallyFree,
  rotationalSymmetry,
  symmetryGoldNeighbours,
  symmetryAvailability: Object.fromEntries(
    Object.entries(symmetryAvailability).map(([key, value]) => [key, {
      averageGeometricFree: value.boards ? value.geometricFree / value.boards : 0,
      averageAvailable: value.boards ? value.available / value.boards : 0,
    }]),
  ),
  topProfiles,
}, null, 2));
