import { boardActionRowMetrics } from "./presentation-layout.js";

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
  const actionRail = false;
  const contentLeft = 0;

  return Object.freeze({
    compact: viewport.compact,
    portrait: viewport.portrait,
    actionRail,
    contentLeft,
    contentWidth: width,
    topInset: viewport.portrait ? 116 : 68,
    boardTopGap: viewport.portrait ? 10 : 6,
    boardBottomGap: actionRail ? 16 : 34,
  });
}

export function isShortLandscape(width: number, height: number): boolean { return height < 520 && width > height; }

export interface BoardHudMetrics {
  actionCount: 3;
  compact: boolean;
  portrait: boolean;
  topY: number;
  topControlSize: number;
  identityY: number;
  cleanY: number;
  remainingY: number;
  actionY: number;
  actionWidth: number;
  actionHeight: number;
  actionGap: number;
  sidePadding: number;
}

export function boardHudMetrics(width: number, height: number): Readonly<BoardHudMetrics> {
  const viewport = classifyBoardViewport(width, height);
  const compact = viewport.compact;
  const topControlSize = compact ? 42 : 46;
  const topY = compact ? 28 : 30;
  const actionRow = boardActionRowMetrics(width);
  const { sidePadding, gap: actionGap, width: actionWidth, height: actionHeight } = actionRow;
  const actionY = Math.max(topY + 120, height - sidePadding - actionHeight / 2);

  return Object.freeze({
    actionCount: 3,
    compact,
    portrait: viewport.portrait,
    topY,
    topControlSize,
    identityY: topY,
    cleanY: topY + (compact ? 34 : 36),
    remainingY: actionY - actionHeight / 2 - (compact ? 24 : 28),
    actionY,
    actionWidth,
    actionHeight,
    actionGap,
    sidePadding,
  });
}
