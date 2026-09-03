import { PlayMode, type PlayModeValue } from "./modes.js";

export interface BoardAvailabilityInput {
  won: boolean;
  legalMoveCount: number;
}

export function isActualDeadEnd({
  won,
  legalMoveCount,
}: BoardAvailabilityInput): boolean {
  return !won && legalMoveCount === 0;
}

export interface RescueEligibilityInput {
  mode: PlayModeValue;
  actualDeadEnd: boolean;
}

export function isRescueEligible({
  mode,
  actualDeadEnd,
}: RescueEligibilityInput): boolean {
  return mode === PlayMode.STANDARD && actualDeadEnd;
}
