export interface BoardViewportClassification { compact: boolean; portrait: boolean; sideDock: boolean; }
export function classifyBoardViewport(width: number, height: number): Readonly<BoardViewportClassification> {
  const compact = width < 600;
  const portrait = height > width * 1.12;
  const sideDock = !portrait && height < 620 && width > 700;
  return Object.freeze({ compact, portrait, sideDock });
}

export interface BoardFloatingMetrics {
  compact: boolean;
  portrait: boolean;
  actionRail: boolean;
  contentLeft: number;
  contentWidth: number;
  topInset: number;
  boardTopGap: number;
  boardBottomGap: number;
}

export function boardFloatingMetrics(
  width: number,
  height: number,
): Readonly<BoardFloatingMetrics> {
  const viewport = classifyBoardViewport(width, height);
  const actionRail = viewport.sideDock;
  const contentLeft = actionRail
    ? Math.round(Math.max(96, Math.min(112, width * 0.12)))
    : 0;

  return Object.freeze({
    compact: viewport.compact,
    portrait: viewport.portrait,
    actionRail,
    contentLeft,
    contentWidth: width - contentLeft,
    topInset: viewport.portrait ? 116 : 68,
    boardTopGap: viewport.portrait ? 10 : 6,
    boardBottomGap: actionRail ? 16 : 34,
  });
}

export function isShortLandscape(width: number, height: number): boolean { return height < 520 && width > height; }
