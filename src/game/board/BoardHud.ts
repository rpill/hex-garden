import type Phaser from "phaser";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalText,
  type MinimalButton,
} from "../minimal-ui.js";
import { boardHudMetrics } from "../responsive-layout.js";

export interface BoardHudActions {
  onBack: () => void;
  onUndo: () => void;
  onHint: () => void;
  onOverflow: () => void;
}

export class BoardHud {
  readonly backButton: MinimalButton;
  readonly undoButton: MinimalButton;
  readonly hintButton: MinimalButton;
  readonly overflowButton: MinimalButton;
  readonly identity: Phaser.GameObjects.Text;
  readonly remaining: Phaser.GameObjects.Text;
  readonly clean: Phaser.GameObjects.Text;

  readonly #label: (russian: string, english: string) => string;
  #hintBusy = false;
  #endlessDeadEnd = false;
  #endlessRescueAvailable = false;

  constructor(
    scene: Phaser.Scene,
    actions: BoardHudActions,
    { english = false }: { english?: boolean } = {},
  ) {
    this.#label = (russian, englishText) => english ? englishText : russian;

    this.backButton = makeMinimalButton(scene, "←", actions.onBack).setDepth(10);
    this.undoButton = makeMinimalButton(
      scene,
      this.#label("ОТМЕНА", "UNDO"),
      actions.onUndo,
    ).setDepth(10);
    this.hintButton = makeMinimalButton(
      scene,
      this.#label("ПОДСКАЗКА", "HINT"),
      actions.onHint,
    ).setDepth(10);
    this.overflowButton = makeMinimalButton(scene, "•••", actions.onOverflow).setDepth(10);

    this.identity = makeMinimalText(scene, "", 15)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(10);
    this.remaining = makeMinimalText(scene, "", 14, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setDepth(10);
    this.clean = makeMinimalText(scene, "", 12, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setDepth(10);
  }

  setIdentity(text: string): void {
    this.identity.setText(text);
  }

  setRemaining(count: number): void {
    this.remaining.setText(`${this.#label("ОСТАЛОСЬ", "LEFT")} ${Math.max(0, count)}`);
  }

  setCleanEligible(clean: boolean): void {
    this.clean
      .setText(clean ? this.#label("◆ ЧИСТО", "◆ CLEAN") : this.#label("С ПОМОЩЬЮ", "ASSISTED"))
      .setColor(clean ? MINIMAL_UI_COLORS.text : MINIMAL_UI_COLORS.textMuted);
  }

  setCleanVisible(visible: boolean): void {
    this.clean.setVisible(visible);
  }

  setUndoEnabled(enabled: boolean): void {
    if (this.#endlessDeadEnd) {
      this.undoButton.setEnabled(!this.#hintBusy);
      return;
    }
    this.undoButton.setEnabled(enabled);
  }

  setHintBusy(busy: boolean): void {
    this.#hintBusy = busy;
    this.#refreshActionPresentation();
  }

  setEndlessDeadEndState(active: boolean, rescueAvailable = false): void {
    this.#endlessDeadEnd = active;
    this.#endlessRescueAvailable = active && rescueAvailable;
    this.#refreshActionPresentation();
  }

  #refreshActionPresentation(): void {
    if (this.#endlessDeadEnd) {
      this.undoButton
        .setLabel(this.#label("ЗАВЕРШИТЬ ЗАБЕГ", "END RUN"))
        .setEnabled(!this.#hintBusy);
      this.hintButton
        .setLabel(
          this.#hintBusy
            ? this.#label("ИЩЕМ…", "CHECKING…")
            : this.#label("СПАСТИ ЗАБЕГ", "RESCUE RUN"),
        )
        .setEnabled(this.#endlessRescueAvailable && !this.#hintBusy);
      return;
    }

    this.undoButton.setLabel(this.#label("ОТМЕНА", "UNDO"));
    this.hintButton
      .setLabel(this.#hintBusy ? this.#label("ИЩЕМ…", "CHECKING…") : this.#label("ПОДСКАЗКА", "HINT"))
      .setEnabled(!this.#hintBusy);
  }

  layout(width: number, height: number): void {
    const metrics = boardHudMetrics(width, height);
    const left = metrics.sidePadding + metrics.topControlSize / 2;
    const right = width - metrics.sidePadding - metrics.topControlSize / 2;
    const actionTotal = metrics.actionWidth * 2 + metrics.actionGap;
    const actionLeft = (width - actionTotal) / 2 + metrics.actionWidth / 2;

    this.backButton
      .setPosition(left, metrics.topY)
      .setSize(metrics.topControlSize, metrics.topControlSize);
    this.overflowButton
      .setPosition(right, metrics.topY)
      .setSize(metrics.topControlSize, metrics.topControlSize);
    this.identity
      .setPosition(width / 2, metrics.identityY)
      .setFontSize(metrics.compact ? 13 : 15)
      .setFixedSize(Math.max(80, width - metrics.sidePadding * 2 - metrics.topControlSize * 2 - 24), 0);
    this.clean
      .setPosition(width / 2, metrics.cleanY)
      .setFontSize(metrics.compact ? 11 : 12);
    this.remaining
      .setPosition(width / 2, metrics.remainingY)
      .setFontSize(metrics.compact ? 13 : 14);
    this.undoButton
      .setPosition(actionLeft, metrics.actionY)
      .setSize(metrics.actionWidth, metrics.actionHeight);
    this.hintButton
      .setPosition(actionLeft + metrics.actionWidth + metrics.actionGap, metrics.actionY)
      .setSize(metrics.actionWidth, metrics.actionHeight);
  }

  destroy(): void {
    for (const object of [
      this.backButton,
      this.undoButton,
      this.hintButton,
      this.overflowButton,
      this.identity,
      this.remaining,
      this.clean,
    ]) {
      object.destroy();
    }
  }
}
