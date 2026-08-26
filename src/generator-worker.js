import { generateCampaignLevel } from "./campaign.js";

globalThis.addEventListener("message", (event) => {
  const { requestId, level, campaignSeed, variant } = event.data;
  try {
    const { board: _board, ...result } = generateCampaignLevel(level, {
      campaignSeed,
      variant,
    });
    globalThis.postMessage({ requestId, result });
  } catch (error) {
    globalThis.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
