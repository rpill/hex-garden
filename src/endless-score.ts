export const SCORE_PER_REMOVED_ATOM = 10;

export const ENDLESS_BOARD_BASE_SCORE = Object.freeze({
  compact: 1000,
  medium: 1500,
  large: 2000,
});

export const STREAK_MULTIPLIER_STEPS = Object.freeze([
  Object.freeze({ streak: 0, multiplier: 1 }),
  Object.freeze({ streak: 3, multiplier: 1.25 }),
  Object.freeze({ streak: 5, multiplier: 1.5 }),
  Object.freeze({ streak: 8, multiplier: 2 }),
  Object.freeze({ streak: 12, multiplier: 2.5 }),
]);

export interface EndlessScoreState {
  score: number;
  streak: number;
}

export interface ScoreAwardResult {
  state: Readonly<EndlessScoreState>;
  award: number;
  baseScore: number;
  multiplier: number;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function normalizeState(state: Partial<EndlessScoreState> = {}): EndlessScoreState {
  const score = state.score ?? 0;
  const streak = state.streak ?? 0;
  assertNonNegativeInteger(score, "score");
  assertNonNegativeInteger(streak, "streak");
  return { score, streak };
}

export function createEndlessScoreState(): Readonly<EndlessScoreState> {
  return Object.freeze({ score: 0, streak: 0 });
}

export function streakMultiplier(streak: number): number {
  assertNonNegativeInteger(streak, "streak");
  return STREAK_MULTIPLIER_STEPS.reduce(
    (current, step) => (streak >= step.streak ? step.multiplier : current),
    1,
  );
}

export function nextStreakMultiplier(streak: number): (typeof STREAK_MULTIPLIER_STEPS)[number] | null {
  assertNonNegativeInteger(streak, "streak");
  return STREAK_MULTIPLIER_STEPS.find((step) => step.streak > streak) ?? null;
}

export function boardClearBaseScore(plateCellCount: number): number {
  if (!Number.isFinite(plateCellCount) || plateCellCount <= 0) {
    throw new RangeError("plateCellCount must be positive");
  }
  if (plateCellCount <= 37) return ENDLESS_BOARD_BASE_SCORE.compact;
  if (plateCellCount <= 61) return ENDLESS_BOARD_BASE_SCORE.medium;
  return ENDLESS_BOARD_BASE_SCORE.large;
}

export function scoreRemovedAtoms(state: Partial<EndlessScoreState>, removedAtomCount: number): Readonly<ScoreAwardResult> {
  const current = normalizeState(state);
  assertNonNegativeInteger(removedAtomCount, "removedAtomCount");
  const multiplier = streakMultiplier(current.streak);
  const baseScore = removedAtomCount * SCORE_PER_REMOVED_ATOM;
  const award = Math.round(baseScore * multiplier);
  return Object.freeze({
    state: Object.freeze({ score: current.score + award, streak: current.streak }),
    award,
    baseScore,
    multiplier,
  });
}

export function scoreClearedBoard(state: Partial<EndlessScoreState>, plateCellCount: number): Readonly<ScoreAwardResult> {
  const current = normalizeState(state);
  const streak = current.streak + 1;
  const multiplier = streakMultiplier(streak);
  const baseScore = boardClearBaseScore(plateCellCount);
  const award = Math.round(baseScore * multiplier);
  return Object.freeze({
    state: Object.freeze({ score: current.score + award, streak }),
    award,
    baseScore,
    multiplier,
  });
}
