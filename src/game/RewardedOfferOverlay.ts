import Phaser from "phaser";
import type { RewardedOfferKind } from "./board/BoardAssistance.js";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "./minimal-ui.js";

interface RewardedOfferCopy {
  eyebrow: string;
  title: string;
  detail: string;
  reward: string;
  accept: string;
  cancel: string;
}

function rewardedOfferCopy(kind: RewardedOfferKind, english: boolean): RewardedOfferCopy {
  if (kind === "rescue") {
    return english
      ? {
          eyebrow: "AD FOR A REWARD",
          title: "RESCUE ATTEMPT",
          detail: "Watch a rewarded ad to rescue this attempt.",
          reward: "REWARD: RETURN TO THE LAST SOLVABLE POSITION.",
          accept: "WATCH AD",
          cancel: "NOT NOW",
        }
      : {
          eyebrow: "РЕКЛАМА ЗА НАГРАДУ",
          title: "СПАСТИ ПОПЫТКУ",
          detail: "Посмотри рекламу, чтобы спасти эту попытку.",
          reward: "НАГРАДА: ВОЗВРАТ К ПОСЛЕДНЕЙ РЕШАЕМОЙ ПОЗИЦИИ.",
          accept: "СМОТРЕТЬ РЕКЛАМУ",
          cancel: "НЕ СЕЙЧАС",
        };
  }

  return english
    ? {
        eyebrow: "AD FOR A REWARD",
        title: "HINT",
        detail: "Watch a rewarded ad to reveal a verified move.",
        reward: "REWARD: HIGHLIGHT A MOVE WITH A VERIFIED PATH TO A FULL CLEAR.",
        accept: "WATCH AD",
        cancel: "NOT NOW",
      }
    : {
        eyebrow: "РЕКЛАМА ЗА НАГРАДУ",
        title: "ПОДСКАЗКА",
        detail: "Посмотри рекламу, чтобы получить проверенный ход.",
        reward: "НАГРАДА: ПОДСВЕТИТЬ ХОД, ИЗ КОТОРОГО ЕСТЬ ПУТЬ ДО ПОЛНОЙ ЗАЧИСТКИ.",
        accept: "СМОТРЕТЬ РЕКЛАМУ",
        cancel: "НЕ СЕЙЧАС",
      };
}

export class RewardedOfferOverlay {
  readonly scene: Phaser.Scene;
  readonly backdrop: Phaser.GameObjects.Graphics;
  readonly blocker: Phaser.GameObjects.Zone;
  readonly card: Phaser.GameObjects.Graphics;
  readonly eyebrow: Phaser.GameObjects.Text;
  readonly title: Phaser.GameObjects.Text;
  readonly detail: Phaser.GameObjects.Text;
  readonly reward: Phaser.GameObjects.Text;
  readonly acceptButton: MinimalButton;
  readonly cancelButton: MinimalButton;
  visible = false;

  #resolve: ((accepted: boolean) => void) | undefined;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.backdrop = scene.add.graphics().setDepth(110).setVisible(false);
    this.blocker = scene.add.zone(0, 0, 1, 1)
      .setDepth(110)
      .setVisible(false)
      .setInteractive();
    this.card = makeMinimalCard(scene, 430, 300).setDepth(111).setVisible(false);
    this.eyebrow = makeMinimalText(scene, "", 11, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(112)
      .setVisible(false);
    this.title = makeMinimalText(scene, "", 24)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(112)
      .setVisible(false);
    this.detail = makeMinimalText(scene, "", 14, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setDepth(112)
      .setVisible(false);
    this.reward = makeMinimalText(scene, "", 14)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(112)
      .setVisible(false);
    this.acceptButton = makeMinimalButton(scene, "", () => this.finish(true))
      .setDepth(112)
      .setVisible(false);
    this.cancelButton = makeMinimalButton(scene, "", () => this.finish(false))
      .setDepth(112)
      .setVisible(false);
  }

  request(kind: RewardedOfferKind, { english = false }: { english?: boolean } = {}): Promise<boolean> {
    this.cancel();
    const copy = rewardedOfferCopy(kind, english);
    this.visible = true;
    this.eyebrow.setText(copy.eyebrow).setVisible(true);
    this.title.setText(copy.title).setVisible(true);
    this.detail.setText(copy.detail).setVisible(true);
    this.reward.setText(copy.reward).setVisible(true);
    this.acceptButton.setLabel(copy.accept).setVisible(true).setEnabled(true);
    this.cancelButton.setLabel(copy.cancel).setVisible(true).setEnabled(true);
    this.backdrop.setVisible(true);
    this.blocker.setVisible(true).setInteractive();
    this.card.setVisible(true);
    this.layout(this.scene.scale.width, this.scene.scale.height);

    return new Promise<boolean>((resolve) => {
      this.#resolve = resolve;
    });
  }

  cancel(): void {
    if (!this.visible && !this.#resolve) return;
    this.finish(false);
  }

  layout(width: number, height: number): void {
    if (!this.visible) return;
    const compact = width < 560;
    const shortLandscape = height < 520 && width > height;
    const cardWidth = Math.min(width - 28, shortLandscape ? 520 : 450);
    const cardHeight = Math.min(height - 24, shortLandscape ? 300 : 330);
    const centerX = width / 2;
    const centerY = height / 2;
    const top = centerY - cardHeight / 2;
    const contentWidth = cardWidth - (compact ? 34 : 52);
    const buttonGap = shortLandscape ? 10 : 12;
    const buttonHeight = shortLandscape ? 38 : 44;
    const buttonWidth = Math.min(contentWidth, 330);

    this.backdrop
      .clear()
      .fillStyle(0x000000, 0.74)
      .fillRect(0, 0, width, height);
    this.blocker.setPosition(centerX, centerY).setSize(width, height);
    const blockerArea = this.blocker.input?.hitArea;
    if (blockerArea instanceof Phaser.Geom.Rectangle) blockerArea.setTo(0, 0, width, height);

    this.card
      .setPosition(centerX, centerY)
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 1)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
      .lineStyle(1, MINIMAL_UI_COLORS.borderActive, 1)
      .strokeRoundedRect(-cardWidth / 2 + 0.5, -cardHeight / 2 + 0.5, cardWidth - 1, cardHeight - 1, 12);

    this.eyebrow
      .setFontSize(shortLandscape ? 9 : 11)
      .setPosition(centerX, top + (shortLandscape ? 23 : 28));
    this.title
      .setFontSize(shortLandscape ? 19 : compact ? 21 : 24)
      .setPosition(centerX, top + (shortLandscape ? 50 : 62));
    this.detail
      .setFontSize(shortLandscape ? 11 : compact ? 12 : 14)
      .setWordWrapWidth(contentWidth)
      .setPosition(centerX, top + (shortLandscape ? 88 : 108));
    this.reward
      .setFontSize(shortLandscape ? 10 : compact ? 11 : 13)
      .setWordWrapWidth(contentWidth)
      .setLineSpacing(4)
      .setPosition(centerX, top + (shortLandscape ? 130 : 164));

    const cancelY = top + cardHeight - (shortLandscape ? 27 : 32) - buttonHeight / 2;
    const acceptY = cancelY - buttonHeight - buttonGap;
    this.acceptButton
      .setPosition(centerX, acceptY)
      .setSize(buttonWidth, buttonHeight);
    this.cancelButton
      .setPosition(centerX, cancelY)
      .setSize(buttonWidth, buttonHeight);
    this.acceptButton.label.setFontSize(shortLandscape ? 11 : 13);
    this.cancelButton.label.setFontSize(shortLandscape ? 11 : 13);
  }

  destroy(): void {
    this.cancel();
    for (const object of [
      this.backdrop,
      this.blocker,
      this.card,
      this.eyebrow,
      this.title,
      this.detail,
      this.reward,
      this.acceptButton,
      this.cancelButton,
    ]) {
      object.destroy();
    }
  }

  private finish(accepted: boolean): void {
    const resolve = this.#resolve;
    this.#resolve = undefined;
    this.visible = false;
    this.backdrop.clear().setVisible(false);
    this.blocker.setVisible(false).disableInteractive();
    this.card.setVisible(false);
    for (const object of [
      this.eyebrow,
      this.title,
      this.detail,
      this.reward,
      this.acceptButton,
      this.cancelButton,
    ]) {
      object.setVisible(false);
    }
    this.acceptButton.setEnabled(false);
    this.cancelButton.setEnabled(false);
    resolve?.(accepted);
  }
}
