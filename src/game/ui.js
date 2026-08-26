export function makeText(scene, text, size, color = "#d8d8d8") {
  return scene.add.text(0, 0, text, {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: `${size}px`,
    color,
    align: "center",
  });
}

export function makeButton(scene, label, onClick, size = 16) {
  const text = makeText(scene, label, size, "#e5e5e5")
    .setOrigin(0.5)
    .setPadding(12, 8)
    .setBackgroundColor("#292929")
    .setInteractive({ useHandCursor: true });
  text.on("pointerdown", onClick);
  return text;
}

export function setButtonEnabled(button, enabled) {
  button.setAlpha(enabled ? 1 : 0.28);
  if (enabled) button.setInteractive({ useHandCursor: true });
  else button.disableInteractive();
}
