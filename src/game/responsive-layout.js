export function classifyBoardViewport(width, height) {
  const compact = width < 600;
  const portrait = height > width * 1.12;
  const sideDock = !portrait && height < 620 && width > 700;
  return Object.freeze({ compact, portrait, sideDock });
}

export function boardChromeMetrics(width, height) {
  const viewport = classifyBoardViewport(width, height);
  const contentLeft = viewport.sideDock
    ? Math.round(Math.max(104, Math.min(116, width * 0.126)))
    : 0;
  return Object.freeze({
    ...viewport,
    contentLeft,
    contentWidth: width - contentLeft,
    topBarHeight: viewport.portrait ? 142 : viewport.sideDock ? 56 : 86,
    boardTopGap: viewport.sideDock ? 4 : 10,
    boardBottomGap: viewport.sideDock ? 18 : 44,
  });
}

export function isShortLandscape(width, height) {
  return height < 520 && width > height;
}
