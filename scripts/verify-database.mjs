import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  SigmarsGardenDatabase,
  replaySolution,
} from "../src/index.js";

const databasePath = resolve(
  process.argv[2] ?? "data/generated-standard-1000.dat",
);
const solutionsPath = resolve(
  process.argv[3] ?? databasePath.replace(/(?:\.[^./\\]+)?$/i, ".solutions.json"),
);

const database = new SigmarsGardenDatabase(await readFile(databasePath));
const certificate = JSON.parse(await readFile(solutionsPath, "utf8"));
if (certificate.format !== "sigmars-garden-js-solutions-v1") {
  throw new Error(`Unsupported solution certificate: ${certificate.format}`);
}
if (!Array.isArray(certificate.boards) || certificate.boards.length !== database.count) {
  throw new Error(
    `Certificate has ${certificate.boards?.length} solutions for ${database.count} boards`,
  );
}

for (let index = 0; index < database.count; index += 1) {
  replaySolution(database.createBoard(index), certificate.boards[index]);
  if ((index + 1) % 100 === 0 || index + 1 === database.count) {
    process.stdout.write(`\rReplay-verified ${index + 1}/${database.count}`);
  }
}
process.stdout.write("\n");
console.log(`Seed: ${certificate.seed}`);
console.log(`Variant: ${certificate.variant}`);
console.log("Every serialized board reaches an empty board using its certificate.");
