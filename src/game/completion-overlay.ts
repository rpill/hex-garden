import type Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../art-assets.js";
import {
  COMPLETION_DEPTHS,
  completionActionMetrics,
  completionCardMetrics,
} from "./presentation-layout.js";
import {
  makeButton,
  makeCurrencyDisplay,
  makePanel,
  makeText,
  resizeNineSlice,
} from "./ui.js";

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}


export interface CompletionOverlayData {
  title: string;
  subtitle: string;
  scoreAward: number;
  totalScore: number;
  dustAward: number;
  dustTotal: number;
  progressStart: number;
  progressEnd: number;
  progressMax: number;
  progressText: (value: number) => string;
  unlockText?: string;
  continueLabel: string;
  exitLabel: string;
  compactTransition?: boolean;
}

export interface CompletionOverlayActions {
  onContinue: () => void;
  onExit: () => void;
}

type CompletionScene = Phaser.Scene & { english?: boolean };

export class CompletionOverlay {
  readonly scene: CompletionScene;
  visible: boolean;
  data: CompletionOverlayData | undefined;
  counter: { score: number; dust: number; progress: number };
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly card: ReturnType<typeof makePanel>;
  readonly progressGraphics: Phaser.GameObjects.Graphics;
  readonly hitZone: Phaser.GameObjects.Zone;
  readonly icon: Phaser.GameObjects.Image;
  readonly title: Phaser.GameObjects.Text;
  readonly subtitle: Phaser.GameObjects.Text;
  readonly score: Phaser.GameObjects.Text;
  readonly total: Phaser.GameObjects.Text;
  readonly dust: ReturnType<typeof makeCurrencyDisplay>;
  readonly dustBalance: Phaser.GameObjects.Text;
  readonly progress: Phaser.GameObjects.Text;
  readonly unlock: Phaser.GameObjects.Text;
  readonly continueButton: ReturnType<typeof makeButton>;
  readonly exitButton: ReturnType<typeof makeButton>;
  onContinue: (() => void) | undefined;
  onExit: (() => void) | undefined;
  fadeTween: Phaser.Tweens.Tween | undefined;
  countTween: Phaser.Tweens.Tween | undefined;
  buttonTween: Phaser.Tweens.Tween | undefined;
  revealTimer: Phaser.Time.TimerEvent | undefined;
  cardWidth = 0;
  cardHeight = 0;
  cardX = 0;
  cardY = 0;
  constructor(scene: CompletionScene) {
    this.scene = scene;
    this.visible = false;
    this.data = undefined;
    this.counter = { score: 0, dust: 0, progress: 0 };
    this.graphics = scene.add.graphics().setDepth(COMPLETION_DEPTHS.dim).setVisible(false);
    this.card = makePanel(scene, UI_FRAMES.panelMainMedium, COMPLETION_DEPTHS.card).setVisible(false);
    this.progressGraphics = scene.add.graphics().setDepth(COMPLETION_DEPTHS.progress).setVisible(false);
    this.hitZone = scene.add.zone(0, 0, 1, 1).setDepth(COMPLETION_DEPTHS.card + 1).setVisible(false);
    this.icon = scene.add
      .image(0, 0, GAMEPLAY_UI_FRAMES.success)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.title = makeText(scene, "", 24, "#eef3f8")
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.subtitle = makeText(scene, "", 11, "#9aa7b5")
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.score = makeText(scene, "", 22, "#77dc91")
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.total = makeText(scene, "", 12, "#9aa7b5")
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.dust = makeCurrencyDisplay(
      scene,
      GAMEPLAY_UI_FRAMES.dust,
      0,
      { iconSize: 23, fontSize: 16, color: "#f3c94f" },
    )
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.dustBalance = makeText(scene, "", 12, "#9aa7b5")
      .setOrigin(0, 0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.progress = makeText(scene, "", 12, "#eef3f8")
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.unlock = makeText(scene, "", 12, "#f3c94f")
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.continueButton = makeButton(scene, "ДАЛЬШЕ", () => this.continue(), 14)
      .setIcon(GAMEPLAY_UI_FRAMES.next, 20)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false)
      .disableInteractive();
    this.exitButton = makeButton(scene, "К УРОВНЯМ", () => this.exit(), 12)
      .setIcon(GAMEPLAY_UI_FRAMES.back, 18)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false)
      .disableInteractive();
  }

  show(data: CompletionOverlayData, { onContinue, onExit }: CompletionOverlayActions): void {
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

    const compactTransition = data.compactTransition === true;
    this.graphics.setVisible(true).setAlpha(0);
    this.progressGraphics.setVisible(!compactTransition).setAlpha(0);
    this.card.setVisible(true).setAlpha(0);
    this.icon.setVisible(true).setAlpha(0);
    this.hitZone.setVisible(true).setInteractive();

    const resultItems = [
      this.subtitle,
      this.score,
      this.total,
      this.dust,
      this.dustBalance,
      this.progress,
      this.unlock,
    ];
    this.title.setVisible(true).setAlpha(0).setText(data.title);
    for (const item of resultItems) {
      item.setVisible(!compactTransition).setAlpha(0);
    }
    this.subtitle.setText(data.subtitle);
    this.unlock.setText(data.unlockText ?? "");
    this.continueButton
      .setText(data.continueLabel)
      .setVisible(true)
      .setAlpha(0)
      .disableInteractive();
    this.exitButton
      .setText(data.exitLabel)
      .setVisible(!compactTransition)
      .setAlpha(0)
      .disableInteractive();

    if (!compactTransition) this.updateText();
    this.layout(this.scene.scale.width, this.scene.scale.height);
    this.draw();

    const fadeTargets = compactTransition
      ? [this.graphics, this.card, this.icon, this.title]
      : [
          this.graphics,
          this.progressGraphics,
          this.card,
          this.icon,
          this.title,
          ...resultItems,
        ];
    this.fadeTween = this.scene.tweens.add({
      targets: fadeTargets,
      alpha: 1,
      duration: compactTransition ? 180 : 240,
      ease: "Cubic.Out",
    });

    if (!compactTransition) {
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
    }

    this.revealTimer = this.scene.time.delayedCall(
      compactTransition ? 260 : 850,
      () => {
        if (!this.visible) return;
        this.continueButton.setInteractive({ useHandCursor: true });
        if (!compactTransition) {
          this.exitButton.setInteractive({ useHandCursor: true });
        }
        const buttonTargets = compactTransition
          ? [this.continueButton]
          : [this.continueButton, this.exitButton];
        this.buttonTween = this.scene.tweens.add({
          targets: buttonTargets,
          alpha: 1,
          duration: 220,
          ease: "Cubic.Out",
        });
      },
    );
  }

  updateText(): void {
    if (!this.data || this.data.compactTransition) return;
    const english = this.scene.english;
    const scoreAward = Math.round(this.counter.score);
    const dustAward = Math.round(this.counter.dust);
    const totalStart = this.data.totalScore - this.data.scoreAward;
    const dustStart = this.data.dustTotal - this.data.dustAward;
    this.score.setText(
      this.data.scoreAward > 0
        ? `+${formatNumber(scoreAward)}`
        : english
        ? "SCORE ALREADY CLAIMED"
        : "ОЧКИ УЖЕ ЗАСЧИТАНЫ",
    );
    this.total.setText(
      `${english ? "TOTAL SCORE" : "ОБЩИЙ СЧЁТ"}  ${formatNumber(
        totalStart + scoreAward,
      )}`,
    );
    if (this.data.dustAward > 0) {
      this.dust.setSignedValue(dustAward);
      this.dustBalance.setText(`→ ${formatNumber(dustStart + dustAward)}`);
    } else {
      this.dust.setValue(this.data.dustTotal);
      this.dustBalance.setText("");
    }
    this.progress.setText(this.data.progressText(this.counter.progress));
  }

  layout(width: number, height: number): void {
    if (!this.visible || !this.data) return;
    const compactTransition = this.data.compactTransition === true;
    if (compactTransition) {
      this.cardWidth = Math.min(width - 24, 440);
      this.cardHeight = Math.min(height - 20, 230);
      this.cardX = (width - this.cardWidth) / 2;
      this.cardY = (height - this.cardHeight) / 2;
      const centerX = width / 2;
      const y = this.cardY;
      this.hitZone.setPosition(width / 2, height / 2).setSize(width, height);
      if (this.hitZone.input?.hitArea) {
        this.hitZone.input.hitArea.setTo(0, 0, width, height);
      }
      resizeNineSlice(this.card, this.cardWidth, this.cardHeight);
      this.card.setPosition(centerX, y + this.cardHeight / 2);
      this.icon.setDisplaySize(52, 52).setPosition(centerX, y + 52);
      this.title.setFontSize(width < 560 ? 20 : 24).setPosition(centerX, y + 105);
      this.continueButton
        .setFontSize(width < 560 ? 12 : 14)
        .setFixedSize(Math.min(this.cardWidth - 52, 330), 46)
        .setPosition(centerX, y + 174);
      this.exitButton.setVisible(false).disableInteractive();
      this.draw();
      return;
    }

    const metrics = completionCardMetrics(width, height, {
      hasUnlock: Boolean(this.data.unlockText),
    });
    const compact = metrics.compact;
    const short = metrics.short;
    this.cardWidth = metrics.width;
    this.cardHeight = metrics.height;
    this.cardX = (width - this.cardWidth) / 2;
    this.cardY = (height - this.cardHeight) / 2;
    const centerX = width / 2;
    const y = this.cardY;
    const hasUnlock = Boolean(this.data.unlockText);

    this.hitZone.setPosition(width / 2, height / 2).setSize(width, height);
    if (this.hitZone.input?.hitArea) {
      this.hitZone.input.hitArea.setTo(0, 0, width, height);
    }
    resizeNineSlice(this.card, this.cardWidth, this.cardHeight);
    this.card.setPosition(centerX, y + this.cardHeight / 2);

    const iconSize = short ? 42 : 50;
    this.icon
      .setDisplaySize(iconSize, iconSize)
      .setPosition(centerX, y + (short ? 32 : 36));
    this.title
      .setFontSize(short ? 18 : compact ? 20 : 23)
      .setPosition(centerX, y + (short ? 65 : 74));
    this.subtitle
      .setFontSize(short ? 9 : 11)
      .setPosition(centerX, y + (short ? 87 : 98));
    this.score
      .setFontSize(short ? 18 : 23)
      .setPosition(centerX, y + (short ? 118 : 132));
    this.total
      .setFontSize(short ? 10 : 12)
      .setPosition(centerX, y + (short ? 146 : 162));

    const rewardY = y + (short ? 176 : 194);
    this.dust.setFontSize(short ? 13 : 16).setPosition(centerX - 18, rewardY);
    this.dustBalance
      .setFontSize(short ? 10 : 12)
      .setPosition(centerX + 38, rewardY);
    this.progress
      .setFontSize(short ? 10 : 12)
      .setPosition(centerX, y + (short ? 207 : 226));
    this.unlock
      .setFontSize(short ? 9 : 11)
      .setWordWrapWidth(this.cardWidth - 56)
      .setPosition(centerX, y + (short ? 246 : 268))
      .setVisible(hasUnlock);

    const primaryHeight = short ? 34 : 40;
    const secondaryHeight = short ? 30 : 34;
    const actions = completionActionMetrics(this.cardHeight, {
      primaryHeight,
      secondaryHeight,
      gap: short ? 10 : 12,
      bottomPadding: short ? 14 : 18,
    });
    this.continueButton
      .setFontSize(short ? 11 : 13)
      .setFixedSize(Math.min(this.cardWidth - 52, 330), primaryHeight)
      .setPosition(centerX, y + actions.primaryY);
    this.exitButton
      .setFontSize(short ? 10 : 11)
      .setFixedSize(Math.min(this.cardWidth - 90, 250), secondaryHeight)
      .setPosition(centerX, y + actions.secondaryY);
    this.draw();
  }

  draw(): void {
    if (!this.visible || !this.data) return;
    const { width, height } = this.scene.scale;
    if (this.data.compactTransition) {
      this.graphics.clear();
      this.graphics.fillStyle(0x000000, 0.72).fillRect(0, 0, width, height);
      this.progressGraphics.clear().setVisible(false);
      return;
    }
    const barWidth = this.cardWidth - 86;
    const barHeight = 9;
    const barX = (width - barWidth) / 2;
    const barY = this.progress.y + 19;
    const range = Math.max(1, this.data.progressMax);
    const ratio = Math.max(0, Math.min(1, this.counter.progress / range));
    this.graphics.clear();
    this.graphics.fillStyle(0x000000, 0.72).fillRect(0, 0, width, height);
    this.progressGraphics.clear();
    this.progressGraphics.fillStyle(0x0b0f14, 1).fillRoundedRect(
      barX,
      barY,
      barWidth,
      barHeight,
      5,
    );
    this.progressGraphics.lineStyle(1, 0x4a5664, 0.8).strokeRoundedRect(
      barX,
      barY,
      barWidth,
      barHeight,
      5,
    );
    if (ratio > 0) {
      this.progressGraphics.fillStyle(0x68cf75, 1).fillRoundedRect(
        barX,
        barY,
        barWidth * ratio,
        barHeight,
        5,
      );
    }
  }

  continue(): void {
    if (!this.visible || this.continueButton.alpha < 1) return;
    const callback = this.onContinue;
    this.hide();
    callback?.();
  }

  exit(): void {
    if (!this.visible || this.exitButton.alpha < 1) return;
    const callback = this.onExit;
    this.hide();
    callback?.();
  }

  hide(): void {
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
    this.progressGraphics.clear().setVisible(false);
    this.card.setVisible(false);
    this.icon.setVisible(false);
    this.hitZone.setVisible(false).disableInteractive();
    for (const item of [
      this.title,
      this.subtitle,
      this.score,
      this.total,
      this.dust,
      this.dustBalance,
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
