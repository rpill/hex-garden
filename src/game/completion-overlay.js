import {
  GAMEPLAY_ATLAS,
  GAMEPLAY_UI_FRAMES,
  UI_FRAMES,
} from "../art-assets.js";
import { makeButton, makePanel, makeText, resizeNineSlice } from "./ui.js";

function formatNumber(value) {
  return Math.round(value).toLocaleString("ru-RU");
}

export class CompletionOverlay {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.data = undefined;
    this.counter = { score: 0, dust: 0, progress: 0 };
    this.graphics = scene.add.graphics().setDepth(40).setVisible(false);
    this.card = makePanel(scene, UI_FRAMES.panelMainMedium, 40).setVisible(false);
    this.hitZone = scene.add.zone(0, 0, 1, 1).setDepth(40).setVisible(false);
    this.icon = scene.add
      .image(0, 0, GAMEPLAY_ATLAS.key, GAMEPLAY_UI_FRAMES.success)
      .setDepth(41)
      .setVisible(false);
    this.title = makeText(scene, "", 24, "#ededed")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.subtitle = makeText(scene, "", 13, "#a7a7a7")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.score = makeText(scene, "", 20, "#c8edc5")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.total = makeText(scene, "", 13, "#bdbdbd")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.dust = makeText(scene, "", 18, "#f0d58a")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.progress = makeText(scene, "", 13, "#ededed")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.unlock = makeText(scene, "", 13, "#f0d58a")
      .setOrigin(0.5)
      .setDepth(41)
      .setVisible(false);
    this.continueButton = makeButton(scene, "ДАЛЬШЕ", () => this.continue(), 14)
      .setIcon(GAMEPLAY_UI_FRAMES.next, 20)
      .setDepth(41)
      .setVisible(false)
      .disableInteractive();
    this.exitButton = makeButton(scene, "К УРОВНЯМ", () => this.exit(), 12)
      .setIcon(GAMEPLAY_UI_FRAMES.back, 18)
      .setDepth(41)
      .setVisible(false)
      .disableInteractive();
  }

  show(data, { onContinue, onExit }) {
    this.hide();
    this.visible = true;
    this.data = data;
    this.onContinue = onContinue;
    this.onExit = onExit;
    this.counter = {
      score: 0,
      dust: 0,
      progress: data.progressStart,
    };
    this.graphics.setVisible(true).setAlpha(0);
    this.card.setVisible(true).setAlpha(0);
    this.icon.setVisible(true).setAlpha(0);
    this.hitZone.setVisible(true).setInteractive();
    for (const item of [
      this.title,
      this.subtitle,
      this.score,
      this.total,
      this.dust,
      this.progress,
      this.unlock,
    ]) {
      item.setVisible(true).setAlpha(0);
    }
    this.title.setText(data.title);
    this.subtitle.setText(data.subtitle);
    this.unlock.setText(data.unlockText ?? "");
    this.continueButton
      .setText(data.continueLabel)
      .setVisible(true)
      .setAlpha(0)
      .disableInteractive();
    this.exitButton
      .setText(data.exitLabel)
      .setVisible(true)
      .setAlpha(0)
      .disableInteractive();
    this.updateText();
    this.layout(this.scene.scale.width, this.scene.scale.height);

    this.fadeTween = this.scene.tweens.add({
      targets: [
        this.graphics,
        this.card,
        this.icon,
        this.title,
        this.subtitle,
        this.score,
        this.total,
        this.dust,
        this.progress,
        this.unlock,
      ],
      alpha: 1,
      duration: 240,
      ease: "Cubic.Out",
    });
    this.countTween = this.scene.tweens.add({
      targets: this.counter,
      score: data.scoreAward,
      dust: data.dustAward,
      progress: data.progressEnd,
      duration: 900,
      ease: "Cubic.Out",
      onUpdate: () => {
        this.updateText();
        this.draw();
      },
      onComplete: () => {
        this.counter.score = data.scoreAward;
        this.counter.dust = data.dustAward;
        this.counter.progress = data.progressEnd;
        this.updateText();
        this.draw();
      },
    });
    this.revealTimer = this.scene.time.delayedCall(850, () => {
      if (!this.visible) return;
      this.continueButton.setInteractive({ useHandCursor: true });
      this.exitButton.setInteractive({ useHandCursor: true });
      this.buttonTween = this.scene.tweens.add({
        targets: [this.continueButton, this.exitButton],
        alpha: 1,
        duration: 260,
        ease: "Cubic.Out",
      });
    });
  }

  updateText() {
    if (!this.data) return;
    const english = this.scene.english;
    const scoreAward = Math.round(this.counter.score);
    const dustAward = Math.round(this.counter.dust);
    const totalStart = this.data.totalScore - this.data.scoreAward;
    const dustStart = this.data.dustTotal - this.data.dustAward;
    this.score.setText(
      this.data.scoreAward > 0
        ? `${english ? "SCORE" : "ОЧКИ"}  +${formatNumber(scoreAward)}`
        : english ? "SCORE ALREADY CLAIMED" : "ОЧКИ УЖЕ ЗАСЧИТАНЫ",
    );
    this.total.setText(
      `${english ? "TOTAL SCORE" : "ОБЩИЙ СЧЁТ"}  ${formatNumber(totalStart + scoreAward)}`,
    );
    this.dust.setText(
      this.data.dustAward > 0
        ? `${english ? "DUST" : "ПЫЛЬ"}  +${formatNumber(dustAward)}   →   ${formatNumber(dustStart + dustAward)}`
        : `${english ? "DUST" : "ПЫЛЬ"}  ${formatNumber(this.data.dustTotal)}`,
    );
    this.progress.setText(this.data.progressText(this.counter.progress));
  }

  layout(width, height) {
    if (!this.visible) return;
    const compact = width < 560;
    const short = height < 520;
    this.cardWidth = Math.min(width - 24, 560);
    this.cardHeight = Math.min(height - 20, short ? 360 : compact ? 430 : 410);
    this.cardX = (width - this.cardWidth) / 2;
    this.cardY = (height - this.cardHeight) / 2;
    const centerX = width / 2;
    const y = this.cardY;
    const scale = short ? 0.84 : 1;

    this.hitZone.setPosition(width / 2, height / 2).setSize(width, height);
    if (this.hitZone.input?.hitArea) {
      this.hitZone.input.hitArea.setTo(0, 0, width, height);
    }
    resizeNineSlice(this.card, this.cardWidth, this.cardHeight);
    this.card.setPosition(centerX, y + this.cardHeight / 2);
    this.icon
      .setDisplaySize(short ? 44 : 58, short ? 44 : 58)
      .setPosition(centerX, y + 34 * scale);
    this.title.setFontSize(short ? 19 : compact ? 21 : 24).setPosition(centerX, y + 76 * scale);
    this.subtitle.setFontSize(short ? 10 : 13).setPosition(centerX, y + 104 * scale);
    this.score.setFontSize(short ? 16 : 20).setPosition(centerX, y + 140 * scale);
    this.total.setFontSize(short ? 11 : 13).setPosition(centerX, y + 170 * scale);
    this.dust.setFontSize(short ? 14 : 18).setPosition(centerX, y + 208 * scale);
    this.progress.setFontSize(short ? 11 : 13).setPosition(centerX, y + 248 * scale);
    this.unlock
      .setFontSize(short ? 10 : 13)
      .setWordWrapWidth(this.cardWidth - 42)
      .setPosition(centerX, y + 302 * scale);
    this.continueButton
      .setFontSize(short ? 11 : 14)
      .setFixedSize(Math.min(this.cardWidth - 42, 340), short ? 34 : 40)
      .setPosition(centerX, y + this.cardHeight - (short ? 62 : 70));
    this.exitButton
      .setFontSize(short ? 10 : 12)
      .setPosition(centerX, y + this.cardHeight - 24);
    this.draw();
  }

  draw() {
    if (!this.visible || !this.data) return;
    const { width, height } = this.scene.scale;
    const barWidth = this.cardWidth - 64;
    const barHeight = 12;
    const barX = (width - barWidth) / 2;
    const barY = this.progress.y + 24;
    const range = Math.max(1, this.data.progressMax);
    const ratio = Math.max(0, Math.min(1, this.counter.progress / range));
    this.graphics.clear();
    this.graphics.fillStyle(0x000000, 0.8).fillRect(0, 0, width, height);
    this.graphics.fillStyle(0x111111, 1).fillRoundedRect(
      barX,
      barY,
      barWidth,
      barHeight,
      6,
    );
    if (ratio > 0) {
      this.graphics.fillStyle(0x8ed18c, 1).fillRoundedRect(
        barX,
        barY,
        barWidth * ratio,
        barHeight,
        6,
      );
    }
  }

  continue() {
    if (!this.visible || this.continueButton.alpha < 1) return;
    const callback = this.onContinue;
    this.hide();
    callback?.();
  }

  exit() {
    if (!this.visible || this.exitButton.alpha < 1) return;
    const callback = this.onExit;
    this.hide();
    callback?.();
  }

  hide() {
    this.fadeTween?.stop();
    this.countTween?.stop();
    this.buttonTween?.stop();
    this.revealTimer?.remove(false);
    this.fadeTween = undefined;
    this.countTween = undefined;
    this.buttonTween = undefined;
    this.revealTimer = undefined;
    this.visible = false;
    this.data = undefined;
    this.graphics.clear().setVisible(false);
    this.card.setVisible(false);
    this.icon.setVisible(false);
    this.hitZone.setVisible(false).disableInteractive();
    for (const item of [
      this.title,
      this.subtitle,
      this.score,
      this.total,
      this.dust,
      this.progress,
      this.unlock,
      this.continueButton,
      this.exitButton,
    ]) {
      item.setVisible(false);
    }
    this.continueButton.disableInteractive();
    this.exitButton.disableInteractive();
  }
}
