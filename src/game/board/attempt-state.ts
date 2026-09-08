export interface AttemptState {
  cleanEligible: boolean;
  rescueUsed: boolean;
}

export interface BoardAvailabilityInput {
  won: boolean;
  legalMoveCount: number;
}

export function createAttemptState(): Readonly<AttemptState> {
  return Object.freeze({
    cleanEligible: true,
    rescueUsed: false,
  });
}

export function markSolverAssisted(
  state: AttemptState,
): Readonly<AttemptState> {
  return Object.freeze({
    ...state,
    cleanEligible: false,
  });
}

export function markRescueUsed(
  state: AttemptState,
): Readonly<AttemptState> {
  return Object.freeze({
    ...state,
    cleanEligible: false,
    rescueUsed: true,
  });
}

export function restartAttempt(_state: AttemptState): Readonly<AttemptState> {
  return createAttemptState();
}

export function isActualDeadEnd({
  won,
  legalMoveCount,
}: BoardAvailabilityInput): boolean {
  return !won && legalMoveCount === 0;
}

export function canRescueAttempt(
  state: AttemptState,
  availability: BoardAvailabilityInput,
): boolean {
  return !state.rescueUsed && isActualDeadEnd(availability);
}
