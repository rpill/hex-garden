import Phaser from "phaser";
import {
  MINIMAL_UI_COLORS,
  makeMinimalText,
} from "../minimal-ui.js";

export class BoardGenerationOverlay {
  readonly #scene: Phaser.Scene;
  readonly #backdrop: Phaser.GameObjects.Graphics;
  readonly #blocker: Phaser.GameObjects.Zone;
  readonly #title: Phaser.GameObjects.Text;
  readonly #dots: Phaser.GameObjects.Text;
  #dotsTimer: Phaser.Time.TimerEvent | undefined;
  #dotPhase = 0;
  #visible = false;

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    this.#backdrop = scene.add.graphics().setDepth(70).setVisible(false);
    this.#blocker = scene.add.zone(0, 0, 1, 1)
      .setDepth(71)
      .setVisible(false)
      .setInteractive();
    this.#title = makeMinimalText(scene, "", 20, MINIMAL_UI_COLORS.text)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(72)
      .setVisible(false);
    this.#dots = makeMinimalText(scene, "·", 22, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setDepth(72)
      .setVisible(false);
  }

  get visible(): boolean {
    return this.#visible;
  }

  show({ english }: { english: boolean }): void {
    this.#visible = true;
    this.#dotPhase = 0;
    this.#title
      .setText(english ? "GENERATING LEVEL" : "ГЕНЕРАЦИЯ УРОВНЯ")
      .setVisible(true);
    this.#dots.setText("·").setVisible(true);
    this.#backdrop.setVisible(true);
    this.#blocker.setVisible(true);
    this.#dotsTimer?.remove(false);
    this.#dotsTimer = this.#scene.time.addEvent({
      delay: 320,
      loop: true,
      callback: () => {
        this.#dotPhase = (this.#dotPhase + 1) % 3;
        this.#dots.setText("·".repeat(this.#dotPhase + 1));
      },
    });
    this.layout(this.#scene.scale.width, this.#scene.scale.height);
  }

  hide(): void {
    this.#visible = false;
    this.#dotsTimer?.remove(false);
    this.#dotsTimer = undefined;
    this.#backdrop.setVisible(false);
    this.#blocker.setVisible(false);
    this.#title.setVisible(false);
    this.#dots.setVisible(false);
  }

  layout(width: number, height: number): void {
    if (!this.#visible) return;
    const compact = width < 560 || height < 520;
    const cardWidth = Math.min(width - 32, compact ? 300 : 360);
    const cardHeight = compact ? 126 : 144;
    const centerX = width / 2;
    const centerY = height / 2;
    const cardX = centerX - cardWidth / 2;
    const cardY = centerY - cardHeight / 2;

    this.#backdrop
      .clear()
      .fillStyle(0x000000, 0.52)
      .fillRect(0, 0, width, height)
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.98)
      .fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 12)
      .lineStyle(1, MINIMAL_UI_COLORS.borderActive, 1)
      .strokeRoundedRect(cardX + 0.5, cardY + 0.5, cardWidth - 1, cardHeight - 1, 12);

    this.#blocker.setPosition(centerX, centerY).setSize(width, height);
    const hitArea = this.#blocker.input?.hitArea;
    if (hitArea instanceof Phaser.Geom.Rectangle) hitArea.setTo(0, 0, width, height);

    this.#title
      .setFontSize(compact ? 17 : 20)
      .setPosition(centerX, centerY - 14);
    this.#dots
      .setFontSize(compact ? 20 : 22)
      .setPosition(centerX, centerY + 24);
  }

  destroy(): void {
    this.hide();
    this.#backdrop.destroy();
    this.#blocker.destroy();
    this.#title.destroy();
    this.#dots.destroy();
  }
}
