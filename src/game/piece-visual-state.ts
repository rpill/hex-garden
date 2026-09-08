export type PieceFeedbackKind = "blocked" | "hinted" | null;
export type PieceVisualKind = "locked" | "available" | "selected";

export interface PieceFeedbackOptions {
  hinted?: boolean;
  blocked?: boolean;
}

export function pieceFeedbackKind({
  hinted = false,
  blocked = false,
}: PieceFeedbackOptions = {}): PieceFeedbackKind {
  if (blocked) return "blocked";
  if (hinted) return "hinted";
  return null;
}

export interface PieceVisualOptions {
  free?: boolean;
  selected?: boolean;
  hovered?: boolean;
}

export interface PieceVisualState {
  kind: PieceVisualKind;
  alpha: number;
  scale: number;
  depth: number;
}

export function resolvePieceVisualState({
  free = true,
  selected = false,
  hovered = false,
}: PieceVisualOptions = {}): Readonly<PieceVisualState> {
  if (selected) {
    return Object.freeze({
      kind: "selected",
      alpha: 1,
      scale: 1.03,
      depth: 4,
    });
  }

  if (free) {
    return Object.freeze({
      kind: "available",
      alpha: 1,
      scale: hovered ? 1.015 : 1,
      depth: hovered ? 3 : 2,
    });
  }

  return Object.freeze({
    kind: "locked",
    alpha: 0.42,
    scale: 1,
    depth: 1,
  });
}

export interface PieceFilterEmphasisOptions {
  filterActive?: boolean;
  matchesFilter?: boolean;
}

export interface PieceFilterEmphasis {
  alphaMultiplier: 1;
  positiveMatch: boolean;
}

export function pieceFilterEmphasis({
  filterActive = false,
  matchesFilter = false,
}: PieceFilterEmphasisOptions = {}): Readonly<PieceFilterEmphasis> {
  return Object.freeze({
    alphaMultiplier: 1,
    positiveMatch: filterActive && matchesFilter,
  });
}
