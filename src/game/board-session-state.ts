import type { PlayModeValue } from "./modes.js";

export {
  isActualDeadEnd,
  type BoardAvailabilityInput,
} from "./board/attempt-state.js";

/**
 * Transitional compatibility input for the legacy BoardScene.
 * Rescue eligibility is no longer tied to a play mode; attempt-level one-use
 * policy lives in board/attempt-state.ts.
 */
export interface RescueEligibilityInput {
  mode: PlayModeValue;
  actualDeadEnd: boolean;
}

/** @deprecated Use canRescueAttempt with AttemptState. */
export function isRescueEligible({
  actualDeadEnd,
}: RescueEligibilityInput): boolean {
  return actualDeadEnd;
}
