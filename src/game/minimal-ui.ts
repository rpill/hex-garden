import Phaser from "phaser";

export const MINIMAL_UI_COLORS = Object.freeze({
  background: 0x171a1f,
  surface: 0x22272e,
  surfaceHover: 0x2a313a,
  surfacePressed: 0x303943,
  surfaceDisabled: 0x1b1f24,
  border: 0x66707c,
  borderActive: 0x9aa7b5,
  text: "#f2f4f7",
  textMuted: "#aab2bd",
} as const);

const DEFAULT_BUTTON_WIDTH = 220;
const DEFAULT_BUTTON_HEIGHT = 52;
const DEFAULT_RADIUS = 10;

function drawRoundedSurface(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  fill: number,
  stroke: number,
  alpha = 1,
): void {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const radius = Math.min(DEFAULT_RADIUS, safeWidth / 2, safeHeight / 2);
  graphics
    .clear()
    .fillStyle(fill, alpha)
    .fillRoundedRect(-safeWidth / 2, -safeHeight / 2, safeWidth, safeHeight, radius)
    .lineStyle(1, stroke, 1)
    .strokeRoundedRect(-safeWidth / 2 + 0.5, -safeHeight / 2 + 0.5, safeWidth - 1, safeHeight - 1, radius);
}

export function makeMinimalText(
  scene: Phaser.Scene,
  text: string,
  size = 18,
  color: string = MINIMAL_UI_COLORS.text,
): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, text, {
    fontFamily: 'Arial, "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    color,
    align: "center",
  }).setResolution(Math.min(2, globalThis.devicePixelRatio || 1));
}

export function makeMinimalCard(
  scene: Phaser.Scene,
  width = 320,
  height = 180,
): Phaser.GameObjects.Graphics {
  const card = scene.add.graphics();
  drawRoundedSurface(
    card,
    width,
    height,
    MINIMAL_UI_COLORS.surface,
    MINIMAL_UI_COLORS.border,
  );
  return card;
}

export class MinimalButton extends Phaser.GameObjects.Container {
  readonly background: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  enabled = true;
  hovered = false;
  pressed = false;
  buttonWidth = DEFAULT_BUTTON_WIDTH;
  buttonHeight = DEFAULT_BUTTON_HEIGHT;

  readonly #onClick: () => void;

  constructor(scene: Phaser.Scene, label: string, onClick: () => void) {
    const background = scene.add.graphics();
    const text = makeMinimalText(scene, label, 17)
      .setOrigin(0.5)
      .setFontStyle("bold");
    super(scene, 0, 0, [background, text]);
    scene.add.existing(this);

    this.background = background;
    this.label = text;
    this.#onClick = onClick;

    this.setSize(DEFAULT_BUTTON_WIDTH, DEFAULT_BUTTON_HEIGHT);
    this.installInteraction();
    this.redraw();
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.hovered = false;
    this.pressed = false;

    if (this.input) {
      this.input.enabled = enabled;
      this.input.cursor = enabled ? "pointer" : "default";
    } else if (enabled) {
      this.installInteraction();
    }

    this.redraw();
    return this;
  }

  override setSize(width: number, height: number): this {
    this.buttonWidth = Math.max(1, width);
    this.buttonHeight = Math.max(1, height);
    super.setSize(this.buttonWidth, this.buttonHeight);
    this.label.setFixedSize(Math.max(1, this.buttonWidth - 28), 0).setOrigin(0.5);

    const hitArea = this.input?.hitArea;
    if (hitArea instanceof Phaser.Geom.Rectangle) {
      hitArea.setTo(
        0,
        0,
        this.buttonWidth,
        this.buttonHeight,
      );
    }

    this.redraw();
    return this;
  }

  private installInteraction(): void {
    const hitArea = new Phaser.Geom.Rectangle(
      0,
      0,
      this.buttonWidth,
      this.buttonHeight,
    );
    Phaser.GameObjects.Container.prototype.setInteractive.call(
      this,
      hitArea,
      Phaser.Geom.Rectangle.Contains,
    );
    if (this.input) this.input.cursor = "pointer";

    this.on("pointerover", () => {
      if (!this.enabled) return;
      this.hovered = true;
      this.redraw();
    });
    this.on("pointerout", () => {
      this.hovered = false;
      this.pressed = false;
      this.redraw();
    });
    this.on("pointerdown", () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.redraw();
    });
    this.on("pointerup", () => {
      if (!this.enabled || !this.pressed) return;
      this.pressed = false;
      this.redraw();
      this.#onClick();
    });
  }

  private redraw(): void {
    const fill = !this.enabled
      ? MINIMAL_UI_COLORS.surfaceDisabled
      : this.pressed
        ? MINIMAL_UI_COLORS.surfacePressed
        : this.hovered
          ? MINIMAL_UI_COLORS.surfaceHover
          : MINIMAL_UI_COLORS.surface;
    const stroke = this.enabled && (this.hovered || this.pressed)
      ? MINIMAL_UI_COLORS.borderActive
      : MINIMAL_UI_COLORS.border;

    drawRoundedSurface(this.background, this.buttonWidth, this.buttonHeight, fill, stroke);
    this.label
      .setColor(this.enabled ? MINIMAL_UI_COLORS.text : MINIMAL_UI_COLORS.textMuted)
      .setPosition(0, this.pressed ? 1 : 0);
    this.setAlpha(this.enabled ? 1 : 0.7);
  }
}

export function makeMinimalButton(
  scene: Phaser.Scene,
  label: string,
  onClick: () => void,
): MinimalButton {
  return new MinimalButton(scene, label, onClick);
}

export function layoutMinimalButton(
  button: MinimalButton,
  x: number,
  y: number,
  width = DEFAULT_BUTTON_WIDTH,
  height = DEFAULT_BUTTON_HEIGHT,
): MinimalButton {
  return button.setPosition(x, y).setSize(width, height);
}
