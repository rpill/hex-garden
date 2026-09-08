import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_DIFFICULTY_PROFILES,
  CAMPAIGN_DIFFICULTY_RHYTHM,
  CampaignChapter,
  PlateSize,
  campaignChapterForLevel,
  campaignDifficultyProfile,
  rankCandidatesForProfile,
} from "../src/index.js";

test("campaign chapters are five fixed groups of ten", () => {
  assert.equal(campaignChapterForLevel(0), CampaignChapter.BASICS);
  assert.equal(campaignChapterForLevel(9), CampaignChapter.BASICS);
  assert.equal(campaignChapterForLevel(10), CampaignChapter.PLANNING);
  assert.equal(campaignChapterForLevel(49), CampaignChapter.MASTERY);
  assert.throws(() => campaignChapterForLevel(-1), RangeError);
  assert.throws(() => campaignChapterForLevel(50), RangeError);
});

test("false-moves profile values deception more than basics", () => {
  assert.ok(
    CAMPAIGN_DIFFICULTY_PROFILES.falseMoves.weights.deception >
      CAMPAIGN_DIFFICULTY_PROFILES.basics.weights.deception,
  );
});

test("campaign difficulty rhythm makes the tenth level the chapter peak", () => {
  assert.equal(CAMPAIGN_DIFFICULTY_RHYTHM.length, 10);
  const start = campaignDifficultyProfile(10);
  const peak = campaignDifficultyProfile(19);
  assert.ok(peak.target.risk > start.target.risk);
  assert.ok(peak.target.deception > start.target.deception);
  assert.ok(peak.target.consequence > start.target.consequence);
  assert.ok(peak.target.freedom < start.target.freedom);
  assert.ok(peak.target.routeWin < start.target.routeWin);
});

function metrics({ freedom, risk, deception, consequence, route }) {
  return {
    averageMeaningfulMoveCount: freedom,
    earlyRiskyDecisionSteps: risk,
    earlyDeceptiveDecisionSteps: deception,
    consequenceDepthMedian: consequence,
    consequenceDepthMax: consequence,
    sampledRouteWinProbability: route,
  };
}

test("relative ranking selects the same-size candidate nearest the false-moves target", () => {
  const candidates = [
    { id: "low", plateSize: PlateSize.MEDIUM, metrics: metrics({ freedom: 2, risk: 1, deception: 1, consequence: 1, route: 0.10 }) },
    { id: "lower-mid", plateSize: PlateSize.MEDIUM, metrics: metrics({ freedom: 3, risk: 3, deception: 3, consequence: 3, route: 0.30 }) },
    { id: "target", plateSize: PlateSize.MEDIUM, metrics: metrics({ freedom: 5, risk: 7, deception: 7, consequence: 5, route: 0.20 }) },
    { id: "upper-mid", plateSize: PlateSize.MEDIUM, metrics: metrics({ freedom: 7, risk: 5, deception: 5, consequence: 7, route: 0.40 }) },
    { id: "high", plateSize: PlateSize.MEDIUM, metrics: metrics({ freedom: 9, risk: 9, deception: 9, consequence: 9, route: 0.50 }) },
    { id: "rejected", plateSize: PlateSize.MEDIUM, metrics: metrics({ freedom: 1, risk: 7, deception: 7, consequence: 5, route: 0.20 }) },
  ];

  const ranked = rankCandidatesForProfile(
    candidates,
    CAMPAIGN_DIFFICULTY_PROFILES.falseMoves,
  );

  assert.equal(ranked[0]?.candidate.id, "target");
  assert.equal(ranked.some(({ candidate }) => candidate.id === "rejected"), false);
  assert.deepEqual(ranked[0]?.percentiles, {
    freedom: 0.5,
    risk: 0.75,
    deception: 0.75,
    consequence: 0.5,
    routeWin: 0.25,
  });
});
