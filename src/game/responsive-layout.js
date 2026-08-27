export function classifyBoardViewport(width, height) {
  const compact = width < 600;
  const portrait = height > width * 1.12;
  const sideDock = !portrait && height < 620 && width > 700;
  return Object.freeze({ compact, portrait, sideDock });
}

export function isShortLandscape(width, height) {
  return height < 520 && width > height;
}
