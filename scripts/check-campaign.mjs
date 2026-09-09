import {
  CAMPAIGN_LEVEL_COUNT,
  getCampaignLevel,
  replaySolution,
} from "../src/index.js";

const count = Number.parseInt(process.argv[2] ?? String(CAMPAIGN_LEVEL_COUNT), 10);
if (!Number.isSafeInteger(count) || count < 1 || count > CAMPAIGN_LEVEL_COUNT) {
  throw new RangeError(`count must be an integer from 1 to ${CAMPAIGN_LEVEL_COUNT}`);
}

for (let level = 0; level < count; level += 1) {
  const record = getCampaignLevel(level);
  replaySolution(record.pieces, record.solution);

  if ((level + 1) % 10 === 0 || level + 1 === count) {
    process.stdout.write(
      `\rReplay-verified frozen campaign levels: ${level + 1}/${count}`,
    );
  }
}
process.stdout.write("\n");
