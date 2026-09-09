import Phaser from "phaser";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "./minimal-ui.js";

export interface ContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  enabled?: boolean;
}

export interface ContextMenuOpenOptions {
  title: string;
  items: readonly ContextMenuItem[];
}

export class ContextMenuOverlay {
  readonly scene: Phaser.Scene;
  readonly backdrop: Phaser.GameObjects.Graphics;
  readonly blocker: Phaser.GameObjects.Zone;
  readonly card: Phaser.GameObjects.Graphics;
  readonly title: Phaser.GameObjects.Text;
  buttons: MinimalButton[] = [];
  visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.backdrop = scene.add.graphics().setDepth(90).setVisible(false);
    this.blocker = scene.add.zone(0, 0, 1, 1)
      .setDepth(90)
      .setVisible(false)
      .setInteractive();
    this.card = makeMinimalCard(scene, 380, 320).setDepth(91).setVisible(false);
    this.title = makeMinimalText(scene, "", 24)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(92)
      .setVisible(false);
  }

  open({ title, items }: ContextMenuOpenOptions): void {
    this.clearButtons();
    this.visible = true;
    this.title.setText(title).setVisible(true);
    this.backdrop.setVisible(true);
    this.blocker.setVisible(true).setInteractive();
    this.card.setVisible(true);

    this.buttons = items.map((item) =>
      makeMinimalButton(this.scene, item.label, () => {
        if (item.enabled === false) return;
        this.close();
        item.onSelect();
      })
        .setDepth(92)
        .setEnabled(item.enabled !== false),
    );
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  close(): void {
    if (!this.visible && this.buttons.length === 0) return;
    this.visible = false;
    this.backdrop.clear().setVisible(false);
    this.blocker.setVisible(false).disableInteractive();
    this.card.setVisible(false);
    this.title.setVisible(false);
    this.clearButtons();
  }

  layout(width: number, height: number): void {
    if (!this.visible) return;
    const compact = width < 560;
    const shortLandscape = height < 520 && width > height;
    const itemCount = Math.max(1, this.buttons.length);
    const buttonHeight = shortLandscape ? 38 : 44;
    const gap = shortLandscape ? 7 : 10;
    const headerHeight = shortLandscape ? 54 : 68;
    const verticalPadding = shortLandscape ? 16 : 22;
    const cardWidth = Math.min(width - 28, compact ? 360 : 430);
    const desiredHeight = headerHeight + verticalPadding + itemCount * buttonHeight + (itemCount - 1) * gap;
    const cardHeight = Math.min(height - 24, desiredHeight);
    const cardX = width / 2;
    const cardY = height / 2;
    const buttonWidth = Math.min(cardWidth - 36, 340);
    const availableButtonsHeight = Math.max(1, cardHeight - headerHeight - verticalPadding);
    const step = Math.min(buttonHeight + gap, availableButtonsHeight / itemCount);
    const actualButtonHeight = Math.max(30, Math.min(buttonHeight, step - Math.min(gap, 6)));
    const startY = cardY - cardHeight / 2 + headerHeight + actualButtonHeight / 2;

    this.backdrop
      .clear()
      .fillStyle(0x000000, 0.72)
      .fillRect(0, 0, width, height);
    this.blocker.setPosition(width / 2, height / 2).setSize(width, height);
    const hitArea = this.blocker.input?.hitArea;
    if (hitArea instanceof Phaser.Geom.Rectangle) hitArea.setTo(0, 0, width, height);

    this.card
      .setPosition(cardX, cardY)
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.98)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
      .lineStyle(1, MINIMAL_UI_COLORS.border, 1)
      .strokeRoundedRect(-cardWidth / 2 + 0.5, -cardHeight / 2 + 0.5, cardWidth - 1, cardHeight - 1, 12);
    this.title
      .setFontSize(compact || shortLandscape ? 20 : 24)
      .setPosition(cardX, cardY - cardHeight / 2 + (shortLandscape ? 28 : 34));

    this.buttons.forEach((button, index) => {
      button
        .setPosition(cardX, startY + index * step)
        .setSize(buttonWidth, actualButtonHeight);
      button.label.setFontSize(shortLandscape ? 11 : compact ? 12 : 13);
    });
  }

  destroy(): void {
    this.clearButtons();
    this.backdrop.destroy();
    this.blocker.destroy();
    this.card.destroy();
    this.title.destroy();
  }

  private clearButtons(): void {
    for (const button of this.buttons) button.destroy();
    this.buttons = [];
  }
}
