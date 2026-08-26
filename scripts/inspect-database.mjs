import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ATOM_NAMES,
  SigmarsGardenDatabase,
} from "../src/index.js";

const defaultPath = String.raw`D:\Games\The Zachtronics Solitaire Collection\Content\solitaire.dat`;
const path = resolve(process.argv[2] ?? defaultPath);
const index = Number.parseInt(process.argv[3] ?? "0", 10);
const rotation = Number.parseInt(process.argv[4] ?? "0", 10);

const database = new SigmarsGardenDatabase(await readFile(path));
const pieces = database.readPieces(index, { rotation });
const composition = Object.fromEntries(
  Object.entries(
    pieces.reduce((counts, piece) => {
      counts[piece.type] = (counts[piece.type] ?? 0) + 1;
      return counts;
    }, {}),
  ).map(([type, count]) => [ATOM_NAMES[type], count]),
);

console.log(JSON.stringify({ path, boards: database.count, index, rotation, composition, pieces }, null, 2));
