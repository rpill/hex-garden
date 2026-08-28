import { isShortLandscape } from "./responsive-layout.js";

export function sceneHeaderMetrics(width, height) {
  const shortLandscape = isShortLandscape(width, height);
  const compact = width < 520;
  const headerHeight = shortLandscape ? 52 : 64;
  const controlHeight = shortLandscape ? 40 : 42;
  const margin = compact ? 10 : 14;
  const backWidth = compact ? 92 : 108;
  const utilitySize = controlHeight;
  return Object.freeze({
    compact,
    shortLandscape,
    headerHeight,
    controlHeight,
    y: headerHeight / 2,
    backX: margin + backWidth / 2,
    backWidth,
    titleX: width / 2,
    rightX: width - margin - utilitySize / 2,
    utilitySize,
    contentTop: headerHeight + 8,
  });
}

export function layoutSceneHeader(
  { title, backButton, utilityButton, utilityText },
  width,
  height,
) {
  const metrics = sceneHeaderMetrics(width, height);
  title
    ?.setFontSize(metrics.compact ? 19 : metrics.shortLandscape ? 20 : 24)
    .setPosition(metrics.titleX, metrics.y);
  backButton
    ?.setFontSize(metrics.compact ? 11 : 12)
    .setFixedSize(metrics.backWidth, metrics.controlHeight)
    .setPosition(metrics.backX, metrics.y);
  utilityButton
    ?.setFixedSize(metrics.utilitySize, metrics.controlHeight)
    .setPosition(metrics.rightX, metrics.y);
  utilityText
    ?.setFontSize(metrics.compact ? 10 : 12)
    .setPosition(width - 14, metrics.y);
  return metrics;
}
