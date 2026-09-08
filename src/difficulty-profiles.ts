import type { DifficultyMetrics } from "./difficulty.js";
import { CAMPAIGN_LEVEL_COUNT, type PlateSizeValue } from "./plates.js";

export const CampaignChapter = Object.freeze({
  BASICS: "basics",
  PLANNING: "planning",
  ORDER: "order",
  FALSE_MOVES: "falseMoves",
  MASTERY: "mastery",
} as const);

export type CampaignChapterValue =
  (typeof CampaignChapter)[keyof typeof CampaignChapter];

export interface DifficultyProfile {
  weights: Readonly<{
    freedom: number;
    risk: number;
    deception: number;
    consequence: number;
    route: number;
  }>;
  target: Readonly<{
    freedom: number;
    risk: number;
    deception: number;
    consequence: number;
    routeWin: number;
  }>;
}

function freezeProfile(profile: DifficultyProfile): Readonly<DifficultyProfile> {
  return Object.freeze({
    weights: Object.freeze({ ...profile.weights }),
    target: Object.freeze({ ...profile.target }),
  });
}

export const CAMPAIGN_DIFFICULTY_PROFILES: Readonly<
  Record<CampaignChapterValue, Readonly<DifficultyProfile>>
> = Object.freeze({
  basics: freezeProfile({
    weights: {
      freedom: 0.30,
      risk: 0.20,
      deception: 0.05,
      consequence: 0.15,
      route: 0.30,
    },
    target: {
      freedom: 0.75,
      risk: 0.20,
      deception: 0.10,
      consequence: 0.15,
      routeWin: 0.65,
    },
  }),
  planning: freezeProfile({
    weights: {
      freedom: 0.25,
      risk: 0.25,
      deception: 0.10,
      consequence: 0.20,
      route: 0.20,
    },
    target: {
      freedom: 0.60,
      risk: 0.40,
      deception: 0.20,
      consequence: 0.30,
      routeWin: 0.50,
    },
  }),
  order: freezeProfile({
    weights: {
      freedom: 0.20,
      risk: 0.30,
      deception: 0.15,
      consequence: 0.20,
      route: 0.15,
    },
    target: {
      freedom: 0.52,
      risk: 0.58,
      deception: 0.38,
      consequence: 0.42,
      routeWin: 0.38,
    },
  }),
  falseMoves: freezeProfile({
    weights: {
      freedom: 0.15,
      risk: 0.30,
      deception: 0.30,
      consequence: 0.15,
      route: 0.10,
    },
    target: {
      freedom: 0.55,
      risk: 0.72,
      deception: 0.72,
      consequence: 0.55,
      routeWin: 0.25,
    },
  }),
  mastery: freezeProfile({
    weights: {
      freedom: 0.15,
      risk: 0.30,
      deception: 0.25,
      consequence: 0.20,
      route: 0.10,
    },
    target: {
      freedom: 0.48,
      risk: 0.80,
      deception: 0.75,
      consequence: 0.70,
      routeWin: 0.18,
    },
  }),
});

export const CAMPAIGN_DIFFICULTY_RHYTHM = Object.freeze([
  0.00,
  0.08,
  0.16,
  -0.06,
  0.24,
  0.05,
  0.22,
  0.32,
  0.10,
  0.40,
] as const);

function assertCampaignLevel(level: number): void {
  if (
    !Number.isSafeInteger(level) ||
    level < 0 ||
    level >= CAMPAIGN_LEVEL_COUNT
  ) {
    throw new RangeError(
      `level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`,
    );
  }
}

export function campaignChapterForLevel(level: number): CampaignChapterValue {
  assertCampaignLevel(level);
  if (level < 10) return CampaignChapter.BASICS;
  if (level < 20) return CampaignChapter.PLANNING;
  if (level < 30) return CampaignChapter.ORDER;
  if (level < 40) return CampaignChapter.FALSE_MOVES;
  return CampaignChapter.MASTERY;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function campaignDifficultyProfile(
  level: number,
): Readonly<DifficultyProfile> {
  const chapter = campaignChapterForLevel(level);
  const base = CAMPAIGN_DIFFICULTY_PROFILES[chapter];
  const delta = CAMPAIGN_DIFFICULTY_RHYTHM[level % 10] ?? 0;

  return freezeProfile({
    weights: base.weights,
    target: {
      freedom: clamp01(base.target.freedom - delta * 0.35),
      risk: clamp01(base.target.risk + delta),
      deception: clamp01(base.target.deception + delta * 0.85),
      consequence: clamp01(base.target.consequence + delta * 0.75),
      routeWin: clamp01(base.target.routeWin - delta * 0.35),
    },
  });
}

export interface DifficultyCandidate {
  plateSize: PlateSizeValue;
  metrics: Readonly<DifficultyMetrics>;
}

export interface DifficultyPercentiles {
  freedom: number;
  risk: number;
  deception: number;
  consequence: number;
  routeWin: number;
}

export interface RankedDifficultyCandidate<T extends DifficultyCandidate> {
  candidate: T;
  percentiles: Readonly<DifficultyPercentiles>;
  score: number;
}

function percentileRanks(values: readonly number[]): number[] {
  if (values.length <= 1) return values.map(() => 0.5);

  return values.map((value) => {
    let less = 0;
    let equal = 0;
    for (const other of values) {
      if (other < value) less += 1;
      else if (other === value) equal += 1;
    }
    const averageRank = less + (equal - 1) / 2;
    return averageRank / (values.length - 1);
  });
}

function candidateAxes(candidate: DifficultyCandidate): DifficultyPercentiles {
  const metrics = candidate.metrics;
  return {
    freedom: metrics.averageMeaningfulMoveCount,
    risk: metrics.earlyRiskyDecisionSteps,
    deception: metrics.earlyDeceptiveDecisionSteps,
    consequence: metrics.consequenceDepthMedian ?? 0,
    routeWin: metrics.sampledRouteWinProbability,
  };
}

function isRankableCandidate(candidate: DifficultyCandidate): boolean {
  const metrics = candidate.metrics;
  return (
    metrics.averageMeaningfulMoveCount >= 1.5 &&
    metrics.sampledRouteWinProbability > 0.01 &&
    (metrics.consequenceDepthMax === null || metrics.consequenceDepthMax <= 12)
  );
}

function weightedDistance(
  percentiles: DifficultyPercentiles,
  profile: Readonly<DifficultyProfile>,
): number {
  return (
    profile.weights.freedom *
      Math.abs(percentiles.freedom - profile.target.freedom) +
    profile.weights.risk * Math.abs(percentiles.risk - profile.target.risk) +
    profile.weights.deception *
      Math.abs(percentiles.deception - profile.target.deception) +
    profile.weights.consequence *
      Math.abs(percentiles.consequence - profile.target.consequence) +
    profile.weights.route *
      Math.abs(percentiles.routeWin - profile.target.routeWin)
  );
}

export function rankCandidatesForProfile<T extends DifficultyCandidate>(
  candidates: readonly T[],
  profile: Readonly<DifficultyProfile>,
): ReadonlyArray<Readonly<RankedDifficultyCandidate<T>>> {
  const eligible = candidates
    .map((candidate, originalIndex) => ({ candidate, originalIndex }))
    .filter(({ candidate }) => isRankableCandidate(candidate));
  const groups = new Map<PlateSizeValue, typeof eligible>();

  for (const entry of eligible) {
    const group = groups.get(entry.candidate.plateSize) ?? [];
    group.push(entry);
    groups.set(entry.candidate.plateSize, group);
  }

  const ranked: Array<
    Readonly<RankedDifficultyCandidate<T>> & { readonly originalIndex: number }
  > = [];

  for (const group of groups.values()) {
    const axes = group.map(({ candidate }) => candidateAxes(candidate));
    const freedom = percentileRanks(axes.map((axis) => axis.freedom));
    const risk = percentileRanks(axes.map((axis) => axis.risk));
    const deception = percentileRanks(axes.map((axis) => axis.deception));
    const consequence = percentileRanks(axes.map((axis) => axis.consequence));
    const routeWin = percentileRanks(axes.map((axis) => axis.routeWin));

    group.forEach((entry, index) => {
      const percentiles = Object.freeze({
        freedom: freedom[index] ?? 0.5,
        risk: risk[index] ?? 0.5,
        deception: deception[index] ?? 0.5,
        consequence: consequence[index] ?? 0.5,
        routeWin: routeWin[index] ?? 0.5,
      });
      ranked.push(
        Object.freeze({
          candidate: entry.candidate,
          percentiles,
          score: weightedDistance(percentiles, profile),
          originalIndex: entry.originalIndex,
        }),
      );
    });
  }

  ranked.sort(
    (left, right) =>
      left.score - right.score || left.originalIndex - right.originalIndex,
  );

  return ranked.map(({ candidate, percentiles, score }) =>
    Object.freeze({ candidate, percentiles, score }),
  );
}
