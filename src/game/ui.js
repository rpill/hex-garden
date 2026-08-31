import { GAMEPLAY_FONT } from "../art-assets.js";

export function makeText(scene, text, size, color = "#d8d8d8") {
  const value = scene.add.text(0, 0, text, {
    fontFamily: `${GAMEPLAY_FONT.family}, Arial, "Segoe UI", sans-serif`,
    fontSize: `${size}px`,
    color,
    align: "center",
  });
  return value.setResolution(Math.min(2, globalThis.devicePixelRatio || 1));
}

export function makeButton(scene, label, onClick, size = 16) {
  const text = makeText(scene, label, size, "#e5e5e5")
    .setOrigin(0.5)
    .setPadding(16, 11)
    .setFontStyle("bold")
    .setBackgroundColor("#29332e")
    .setInteractive({ useHandCursor: true });
  text.on("pointerdown", onClick);
  return text;
}

export function setButtonEnabled(button, enabled) {
  button.setAlpha(enabled ? 1 : 0.28);
  if (enabled) button.setInteractive({ useHandCursor: true });
  else button.disableInteractive();
}
