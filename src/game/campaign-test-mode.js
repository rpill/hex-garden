export const CAMPAIGN_TEST_QUERY = "test";
export const CAMPAIGN_TEST_VALUE = "all";

export function isCampaignTestMode(
  search = globalThis.location?.search ?? "",
) {
  if (typeof search !== "string") return false;
  return (
    new URLSearchParams(search).get(CAMPAIGN_TEST_QUERY) ===
    CAMPAIGN_TEST_VALUE
  );
}
