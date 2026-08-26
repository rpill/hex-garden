import { generateCampaignLevel } from "./campaign.js";
import { generateProgressionLevel } from "./progression.js";

globalThis.addEventListener("message", (event) => {
  const { kind, requestId, level, campaignSeed, variant } = event.data;
  try {
    const generated =
      kind === "progression"
        ? generateProgressionLevel(level, { campaignSeed })
        : generateCampaignLevel(level, {
            campaignSeed,
            variant,
          });
    const { board: _board, ...result } = generated;
    globalThis.postMessage({ requestId, result });
  } catch (error) {
    globalThis.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
