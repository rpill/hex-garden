import {
  BoardVariant,
  generateCampaignLevel,
  replaySolution,
} from "../src/index.js";

const count = Number.parseInt(process.argv[2] ?? "250", 10);
const campaignSeed = process.argv[3] ?? "release-check";
if (!Number.isSafeInteger(count) || count < 1) {
  throw new RangeError("count must be a positive safe integer");
}

for (let level = 0; level < count; level += 1) {
  const variant =
    level % 5 === 4 ? BoardVariant.QUINTESSENCE : BoardVariant.STANDARD;
  const record = generateCampaignLevel(level, { campaignSeed, variant });
  replaySolution(record.board, record.solution);

  if ((level + 1) % 100 === 0 || level + 1 === count) {
    process.stdout.write(`\rReplay-verified campaign levels: ${level + 1}/${count}`);
  }
}
process.stdout.write("\n");
