export type PieceFeedbackKind = "blocked" | "hinted" | null;
export type PieceVisualKind = "blocked" | "hinted" | "selected" | "hover" | "idle";
export interface PieceFeedbackOptions { hinted?: boolean; blocked?: boolean; }
export function pieceFeedbackKind({ hinted = false, blocked = false }: PieceFeedbackOptions = {}): PieceFeedbackKind { if (blocked) return "blocked"; if (hinted) return "hinted"; return null; }
export interface PieceVisualOptions extends PieceFeedbackOptions { free?: boolean; selected?: boolean; hovered?: boolean; now?: number; }
export interface PieceVisualState { kind: PieceVisualKind; alpha: number; scale: number; haloAlpha: number; haloWidth: number; }
export function resolvePieceVisualState({ free = true, selected = false, hovered = false, hinted = false, blocked = false, now = 0 }: PieceVisualOptions = {}): Readonly<PieceVisualState> {
  const kind: PieceVisualKind = blocked ? "blocked" : hinted ? "hinted" : selected ? "selected" : hovered ? "hover" : "idle";
  const pulse = 0.5 + 0.5 * Math.sin(now / 180); const alpha = free ? 1 : 0.42;
  const scale = kind === "hover" ? 1.018 : kind === "selected" ? 1.025 : kind === "hinted" ? 1.018 : 1;
  const haloAlpha = kind === "hover" ? 0 : kind === "selected" ? 0.16 : kind === "hinted" ? 0.18 + pulse * 0.08 : kind === "blocked" ? 0.22 : 0;
  const haloWidth = kind === "idle" ? 0 : kind === "hover" ? 1 : 2;
  return Object.freeze({ kind, alpha, scale, haloAlpha, haloWidth });
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
