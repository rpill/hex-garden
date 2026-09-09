import test from "node:test";
import assert from "node:assert/strict";

const qualityModule = await import("../src/daily-fast-quality.js").catch(() => ({}));

test("fast Daily quality analyzer is available for offline candidate selection", () => {
  assert.equal(typeof qualityModule.analyzeFastDailyQuality, "function");
});

test("fast Daily ranker chooses candidates by the requested quality profile instead of source order", () => {
  assert.equal(typeof qualityModule.rankFastDailyCandidatesForProfile, "function");
  if (typeof qualityModule.rankFastDailyCandidatesForProfile !== "function") return;

  const candidates = [
    { id: "first", plateSize: "medium", quality: { averageMeaningfulMoveCount: 2, forcedStepRatio: 0.8, constrainedStepRatio: 0.9, ambiguousMoveRatio: 0.1, sampledRouteSurvivalProbability: 1 } },
    { id: "middle", plateSize: "medium", quality: { averageMeaningfulMoveCount: 4, forcedStepRatio: 0.4, constrainedStepRatio: 0.5, ambiguousMoveRatio: 0.5, sampledRouteSurvivalProbability: 0.5 } },
    { id: "last", plateSize: "medium", quality: { averageMeaningfulMoveCount: 7, forcedStepRatio: 0, constrainedStepRatio: 0.1, ambiguousMoveRatio: 0.9, sampledRouteSurvivalProbability: 0 } },
  ];
  const middleProfile = {
    weights: { freedom: 0.25, constrained: 0.25, ambiguity: 0.25, route: 0.25 },
    target: { freedom: 0.5, constrained: 0.5, ambiguity: 0.5, routeSurvival: 0.5 },
  };
  const challengeProfile = {
    weights: { freedom: 0.25, constrained: 0.25, ambiguity: 0.25, route: 0.25 },
    target: { freedom: 1, constrained: 0, ambiguity: 1, routeSurvival: 0 },
  };

  assert.equal(qualityModule.rankFastDailyCandidatesForProfile(candidates, middleProfile)[0].candidate.id, "middle");
  assert.equal(qualityModule.rankFastDailyCandidatesForProfile(candidates, challengeProfile)[0].candidate.id, "last");
});

test("fast Daily selection profiles make weekend boards less forced and less random-route resilient", () => {
  assert.equal(typeof qualityModule.fastDailySelectionProfileForBand, "function");
  if (typeof qualityModule.fastDailySelectionProfileForBand !== "function") return;
  const medium = qualityModule.fastDailySelectionProfileForBand("medium");
  const challenge = qualityModule.fastDailySelectionProfileForBand("challenge");
  assert.ok(challenge.target.freedom > medium.target.freedom);
  assert.ok(challenge.target.constrained < medium.target.constrained);
  assert.ok(challenge.target.ambiguity > medium.target.ambiguity);
  assert.ok(challenge.target.routeSurvival < medium.target.routeSurvival);
});

test("fast Daily profiles rank constrained early steps rather than relying only on exact forced moves", () => {
  assert.equal(typeof qualityModule.fastDailySelectionProfileForBand, "function");
  const medium = qualityModule.fastDailySelectionProfileForBand?.("medium");
  const challenge = qualityModule.fastDailySelectionProfileForBand?.("challenge");
  assert.equal(typeof medium?.target?.constrained, "number");
  assert.ok(challenge.target.constrained < medium.target.constrained);
});
