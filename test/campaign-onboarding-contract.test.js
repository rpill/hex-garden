import assert from "node:assert/strict";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const onboardingUrl = new URL("../src/campaign-onboarding.ts", import.meta.url);
const onboardingPath = fileURLToPath(onboardingUrl);

test("campaign fixed onboarding follows the gradual L2-L9 rule introduction", async () => {
  assert.equal(fs.existsSync(onboardingPath), true, "campaign-onboarding.ts must exist");
  const { campaignRuleIntroForLevel } = await import(onboardingUrl.href);

  assert.equal(campaignRuleIntroForLevel(0), undefined);

  const salt = campaignRuleIntroForLevel(1);
  assert.ok(salt);
  assert.match(salt.textRu, /Sa/);
  assert.match(salt.textRu, /ЛЮБОЙ СТИХИЕЙ/i);
  assert.deepEqual(salt.requiredTypes, [1]);

  const vitaeMors = campaignRuleIntroForLevel(2);
  assert.ok(vitaeMors);
  assert.match(vitaeMors.textRu, /V.*M|M.*V/);
  assert.match(vitaeMors.textRu, /ТОЛЬКО.*ВМЕСТЕ/i);
  assert.deepEqual(vitaeMors.requiredTypes, [13, 14]);

  const lead = campaignRuleIntroForLevel(3);
  assert.ok(lead);
  assert.match(lead.textRu, /Hg/);
  assert.match(lead.textRu, /Pb/);
  assert.deepEqual(lead.requiredTypes, [6, 12]);

  const steps = [
    [4, /Sn/, [11]],
    [5, /Fe/, [10]],
    [6, /Cu/, [9]],
    [7, /Ag/, [8]],
    [8, /Au/, [7]],
  ];
  for (const [level, symbol, requiredTypes] of steps) {
    const rule = campaignRuleIntroForLevel(level);
    assert.ok(rule, `L${Number(level) + 1} must teach its new metal`);
    assert.match(rule.textRu, symbol);
    assert.deepEqual(rule.requiredTypes, requiredTypes);
  }

  assert.equal(campaignRuleIntroForLevel(9), undefined);
});

test("campaign rule card appears after the board reveal, blocks play, and closes only by clicking the card", async () => {
  const source = await readFile(new URL("../src/game/scenes/BoardScene.ts", import.meta.url), "utf8");

  assert.match(source, /campaignRuleCardVisible/);
  assert.match(source, /maybeShowCampaignRuleCard\(\)/);
  assert.match(source, /onComplete:\s*\(\)\s*=>\s*\{[\s\S]{0,260}maybeShowCampaignRuleCard\(\)/);
  assert.match(source, /campaignRuleCardHitZone[\s\S]{0,220}pointerdown[\s\S]{0,160}dismissCampaignRuleCard/);
  assert.match(source, /selectPiece\([^)]*\): void \{[\s\S]{0,260}campaignRuleCardVisible/);
  assert.match(source, /undoLastRemoval\(\): void \{[\s\S]{0,220}campaignRuleCardVisible/);
  assert.match(source, /usePrimaryHint\(\): void \{[\s\S]{0,360}campaignRuleCardVisible/);
  assert.doesNotMatch(source, /campaignRuleCard[\s\S]{0,220}delayedCall/);
});
