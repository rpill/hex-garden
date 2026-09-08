import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  BoardVariant,
  createSeededRandom,
  encodeBoardDatabase,
  replaySolution,
} from "../src/index.js";
import { generateLegacyDatabaseBoard } from "../src/legacy-database-generation.js";

const outputPath = resolve(process.argv[2] ?? "data/generated-standard.dat");
const count = Number.parseInt(process.argv[3] ?? "1000", 10);
const seed = process.argv[4] ?? "garden-js-v1";
const variant = process.argv[5] ?? BoardVariant.STANDARD;
const solutionsPath = resolve(
  process.argv[6] ?? outputPath.replace(/(?:\.[^./\\]+)?$/i, ".solutions.json"),
);

if (!Number.isInteger(count) || count < 1) throw new RangeError("count must be positive");
if (!Object.values(BoardVariant).includes(variant)) {
  throw new RangeError(`variant must be ${Object.values(BoardVariant).join(" or ")}`);
}

const random = createSeededRandom(seed);
const records = [];
const signatures = new Set();

while (records.length < count) {
  const record = generateLegacyDatabaseBoard({ random, variant });
  const signature = record.pieces
    .map(({ q, r, type }) => `${q},${r}:${type}`)
    .sort()
    .join("|");
  if (signatures.has(signature)) continue;
  signatures.add(signature);
  replaySolution(record.pieces, record.solution);
  records.push(record);

  if (records.length % 100 === 0 || records.length === count) {
    process.stdout.write(`\rGenerated and replay-verified ${records.length}/${count}`);
  }
}
process.stdout.write("\n");

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(solutionsPath), { recursive: true });
await writeFile(outputPath, encodeBoardDatabase(records));
await writeFile(
  solutionsPath,
  JSON.stringify(
    {
      format: "garden-js-solutions-v1",
      seed,
      variant,
      boards: records.map(({ solution }) => solution),
    },
    null,
    2,
  ),
);

console.log(`Database: ${outputPath}`);
console.log(`Solutions: ${solutionsPath}`);
