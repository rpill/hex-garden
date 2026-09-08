import type Phaser from "phaser";
import type { MasteryRankValue } from "../mastery.js";
import { CAMPAIGN_LEVEL_COUNT } from "../plates.js";
import { CAMPAIGN_CHAPTERS } from "./chapter-model.js";
import {
  createCampaignCompletionPresentation,
  createEndlessCompletionPresentation,
  type CampaignCompletionPresentationInput,
  type EndlessCompletionPresentationInput,
} from "./completion-presentation.js";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "./minimal-ui.js";
import { COMPLETION_DEPTHS } from "./presentation-layout.js";

export interface CampaignCompletionOverlayData extends CampaignCompletionPresentationInput {
  kind: "campaign";
  chapterCleanCount: number;
}

export interface EndlessCompletionOverlayData extends EndlessCompletionPresentationInput {
  kind: "endless";
}

export interface SimpleCompletionOverlayData {
  kind: "simple";
  title: string;
  status: string;
  detail?: string;
  primaryLabel: string;
  homeLabel?: string;
  secondaryLabel?: string;
}

export type CompletionOverlayData =
  | CampaignCompletionOverlayData
  | EndlessCompletionOverlayData
  | SimpleCompletionOverlayData;

export interface CompletionOverlayActions {
  onNext?: () => void;
  onTryClean?: () => void;
  onHome?: () => void;
  onSecondary?: () => void;
}

type CompletionScene = Phaser.Scene & { english?: boolean };

type RankLabel = Readonly<{ ru: string; en: string }>;

const RANK_LABELS: Readonly<Record<MasteryRankValue, RankLabel>> = Object.freeze({
  novice: Object.freeze({ ru: "НОВИЧОК", en: "NOVICE" }),
  apprentice: Object.freeze({ ru: "УЧЕНИК", en: "APPRENTICE" }),
  adept: Object.freeze({ ru: "ЗНАТОК", en: "ADEPT" }),
  strategist: Object.freeze({ ru: "СТРАТЕГ", en: "STRATEGIST" }),
  expert: Object.freeze({ ru: "ЭКСПЕРТ", en: "EXPERT" }),
  master: Object.freeze({ ru: "МАСТЕР", en: "MASTER" }),
});

export class CompletionOverlay {
  readonly scene: CompletionScene;
  visible = false;
  data: CompletionOverlayData | undefined;
  readonly dim: Phaser.GameObjects.Graphics;
  readonly card: Phaser.GameObjects.Graphics;
  readonly hitZone: Phaser.GameObjects.Zone;
  readonly title: Phaser.GameObjects.Text;
  readonly status: Phaser.GameObjects.Text;
  readonly detail: Phaser.GameObjects.Text;
  readonly mastery: Phaser.GameObjects.Text;
  readonly rank: Phaser.GameObjects.Text;
  readonly primaryButton: MinimalButton;
  readonly secondaryButton: MinimalButton;

  #onNext: (() => void) | undefined;
  #onTryClean: (() => void) | undefined;
  #onHome: (() => void) | undefined;
  #onSecondary: (() => void) | undefined;

  constructor(scene: CompletionScene) {
    this.scene = scene;
    this.dim = scene.add.graphics().setDepth(COMPLETION_DEPTHS.dim).setVisible(false);
    this.card = makeMinimalCard(scene, 420, 300).setDepth(COMPLETION_DEPTHS.card).setVisible(false);
    this.hitZone = scene.add.zone(0, 0, 1, 1).setDepth(COMPLETION_DEPTHS.card + 1).setVisible(false);
    this.title = makeMinimalText(scene, "", 23)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.status = makeMinimalText(scene, "", 18)
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.detail = makeMinimalText(scene, "", 13, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.mastery = makeMinimalText(scene, "", 14, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.rank = makeMinimalText(scene, "", 13)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.primaryButton = makeMinimalButton(scene, "", () => this.activatePrimary())
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
    this.secondaryButton = makeMinimalButton(scene, "", () => this.activateSecondary())
      .setDepth(COMPLETION_DEPTHS.content)
      .setVisible(false);
  }

  show(data: CompletionOverlayData, actions: CompletionOverlayActions): void {
    this.hide();
    this.visible = true;
    this.data = data;
    this.#onNext = actions.onNext;
    this.#onTryClean = actions.onTryClean;
    this.#onHome = actions.onHome;
    this.#onSecondary = actions.onSecondary;

    this.dim.setVisible(true);
    this.card.setVisible(true);
    this.hitZone.setVisible(true).setInteractive();
    for (const text of [this.title, this.status, this.detail, this.mastery, this.rank]) {
      text.setVisible(true);
    }

    if (data.kind === "campaign") this.applyCampaignCopy(data);
    else if (data.kind === "endless") this.applyEndlessCopy(data);
    else this.applySimpleCopy(data);

    const hasPrimary = Boolean(this.#onNext ?? this.#onHome);
    this.primaryButton.setVisible(hasPrimary).setEnabled(hasPrimary);
    const showTryClean = data.kind === "campaign"
      ? createCampaignCompletionPresentation(data).showTryClean && Boolean(this.#onTryClean)
      : false;
    const showNonCampaignSecondary = data.kind !== "campaign" && Boolean(
      this.#onSecondary ?? (this.#onNext && this.#onHome ? this.#onHome : undefined),
    );
    const hasSecondary = showTryClean || showNonCampaignSecondary;
    this.secondaryButton.setVisible(hasSecondary).setEnabled(hasSecondary);

    if (showTryClean) {
      this.secondaryButton.setLabel(this.label("ПОПРОБОВАТЬ ЧИСТО", "TRY CLEAN"));
    } else if (showNonCampaignSecondary) {
      this.secondaryButton.setLabel(
        data.kind === "simple" && this.#onSecondary && data.secondaryLabel
          ? data.secondaryLabel
          : data.kind === "simple" && data.homeLabel
            ? data.homeLabel
            : this.label("НА ГЛАВНУЮ", "HOME"),
      );
    }

    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  layout(width: number, height: number): void {
    if (!this.visible || !this.data) return;
    const compact = width < 560;
    const cardWidth = Math.min(width - 24, compact ? 430 : 480);
    const hasSecondary = this.secondaryButton.visible;
    const cardHeight = Math.min(height - 20, hasSecondary ? 350 : 306);
    const centerX = width / 2;
    const centerY = height / 2;
    const top = centerY - cardHeight / 2;

    this.dim
      .clear()
      .fillStyle(0x000000, 0.74)
      .fillRect(0, 0, width, height);
    this.card
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 1)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
      .lineStyle(1, MINIMAL_UI_COLORS.border, 1)
      .strokeRoundedRect(-cardWidth / 2 + 0.5, -cardHeight / 2 + 0.5, cardWidth - 1, cardHeight - 1, 12)
      .setPosition(centerX, centerY);
    this.hitZone.setPosition(centerX, centerY).setSize(width, height);
    if (this.hitZone.input?.hitArea) this.hitZone.input.hitArea.setTo(0, 0, width, height);

    const textWidth = Math.max(160, cardWidth - 48);
    this.title
      .setFontSize(compact ? 20 : 23)
      .setFixedSize(textWidth, 0)
      .setPosition(centerX, top + 44);
    this.status
      .setFontSize(compact ? 16 : 18)
      .setFixedSize(textWidth, 0)
      .setPosition(centerX, top + 88);
    this.detail
      .setFontSize(compact ? 12 : 13)
      .setFixedSize(textWidth, 0)
      .setPosition(centerX, top + 126);
    this.mastery
      .setFontSize(compact ? 12 : 14)
      .setFixedSize(textWidth, 0)
      .setPosition(centerX, top + 164);
    this.rank
      .setFontSize(compact ? 12 : 13)
      .setFixedSize(textWidth, 0)
      .setPosition(centerX, top + 198);

    const buttonWidth = Math.min(cardWidth - 52, 330);
    const primaryY = top + (hasSecondary ? cardHeight - 92 : cardHeight - 54);
    this.primaryButton
      .setPosition(centerX, primaryY)
      .setSize(buttonWidth, 48);
    this.secondaryButton
      .setPosition(centerX, top + cardHeight - 36)
      .setSize(Math.min(buttonWidth, 280), 40);
  }

  continue(): void {
    this.activatePrimary();
  }

  exit(): void {
    if (!this.visible || !this.#onHome) return;
    const callback = this.#onHome;
    this.hide();
    callback();
  }

  hide(): void {
    this.visible = false;
    this.data = undefined;
    this.#onNext = undefined;
    this.#onTryClean = undefined;
    this.#onHome = undefined;
    this.#onSecondary = undefined;
    this.dim.clear().setVisible(false);
    this.card.clear().setVisible(false);
    this.hitZone.setVisible(false).disableInteractive();
    for (const item of [
      this.title,
      this.status,
      this.detail,
      this.mastery,
      this.rank,
      this.primaryButton,
      this.secondaryButton,
    ]) {
      item.setVisible(false);
    }
    this.primaryButton.setEnabled(false);
    this.secondaryButton.setEnabled(false);
  }

  private applyCampaignCopy(data: CampaignCompletionOverlayData): void {
    const presentation = createCampaignCompletionPresentation(data);
    const chapter = CAMPAIGN_CHAPTERS[presentation.chapterNumber - 1];
    const chapterTitle = chapter
      ? this.scene.english ? chapter.titleEn : chapter.titleRu
      : `${this.label("ГЛАВА", "CHAPTER")} ${presentation.chapterNumber}`;

    this.title.setText(
      presentation.campaignComplete
        ? this.label("КАМПАНИЯ ЗАВЕРШЕНА", "CAMPAIGN COMPLETE")
        : data.chapterComplete
          ? `${this.label("ГЛАВА", "CHAPTER")} ${presentation.chapterNumber} · ${chapterTitle}`
          : this.label("УРОВЕНЬ ПРОЙДЕН", "LEVEL COMPLETE"),
    );
    this.status
      .setText(data.clean
        ? this.label("◆ ЧИСТОЕ РЕШЕНИЕ", "◆ CLEAN SOLUTION")
        : this.label("ПРОЙДЕНО С ПОМОЩЬЮ", "SOLVED WITH HELP"))
      .setColor(data.clean ? MINIMAL_UI_COLORS.text : MINIMAL_UI_COLORS.textMuted);
    this.detail.setText(
      data.chapterComplete
        ? `10 / 10 ${this.label("ПРОЙДЕНО", "SOLVED")} · ◆ ${data.chapterCleanCount} / 10 ${this.label("ЧИСТО", "CLEAN")}`
        : `${this.label("УРОВЕНЬ", "LEVEL")} ${String(data.level + 1).padStart(2, "0")} / ${CAMPAIGN_LEVEL_COUNT}`,
    );
    this.mastery.setText(`◆ ${this.label("ЧИСТО", "CLEAN")} ${data.cleanCount} / ${CAMPAIGN_LEVEL_COUNT}`);
    this.rank.setText(data.newRank
      ? `${this.label("НОВЫЙ РАНГ", "NEW RANK")}: ${this.rankLabel(data.newRank)}`
      : "");

    if (this.#onNext) {
      this.primaryButton.setLabel(data.chapterComplete
        ? this.label("СЛЕДУЮЩАЯ ГЛАВА", "NEXT CHAPTER")
        : this.label("ДАЛЬШЕ", "NEXT"));
    } else {
      this.primaryButton.setLabel(this.label("НА ГЛАВНУЮ", "HOME"));
    }
  }

  private applyEndlessCopy(data: EndlessCompletionOverlayData): void {
    const presentation = createEndlessCompletionPresentation(data);
    const englishStatus = `${presentation.boardsCleared} ${
      presentation.boardsCleared === 1 ? "BOARD" : "BOARDS"
    }${presentation.assisted ? " · WITH HELP" : ""}`;
    const russianStatus = `ОЧИЩЕНО ПОЛЕЙ: ${presentation.boardsCleared}${
      presentation.assisted ? " · С ПОМОЩЬЮ" : ""
    }`;

    this.title.setText(this.label("ЗАБЕГ ЗАВЕРШЁН", "RUN COMPLETE"));
    this.status
      .setText(this.scene.english ? englishStatus : russianStatus)
      .setColor(MINIMAL_UI_COLORS.text);
    this.detail.setText(
      presentation.assisted
        ? `${this.label("ЧИСТЫЙ РЕКОРД", "BEST CLEAN")} ${presentation.bestCleanBoards}`
        : `${this.label("РЕКОРД", "BEST")} ${presentation.bestCleanBoards}`,
    );
    this.mastery.setText("");
    this.rank.setText("");
    this.primaryButton.setLabel(this.label("ЕЩЁ РАЗ", "TRY AGAIN"));
  }

  private applySimpleCopy(data: SimpleCompletionOverlayData): void {
    this.title.setText(data.title);
    this.status.setText(data.status).setColor(MINIMAL_UI_COLORS.text);
    this.detail.setText(data.detail ?? "");
    this.mastery.setText("");
    this.rank.setText("");
    this.primaryButton.setLabel(data.primaryLabel);
  }

  private activatePrimary(): void {
    if (!this.visible) return;
    const callback = this.#onNext ?? this.#onHome;
    if (!callback) return;
    this.hide();
    callback();
  }

  private activateSecondary(): void {
    if (!this.visible || !this.data) return;
    const presentation = this.data.kind === "campaign"
      ? createCampaignCompletionPresentation(this.data)
      : undefined;
    const callback = presentation?.showTryClean
      ? this.#onTryClean
      : this.data.kind === "simple" && this.#onSecondary
        ? this.#onSecondary
        : this.#onHome;
    if (!callback) return;
    this.hide();
    callback();
  }

  private label(russian: string, english: string): string {
    return this.scene.english ? english : russian;
  }

  private rankLabel(rank: MasteryRankValue): string {
    const label = RANK_LABELS[rank];
    return this.scene.english ? label.en : label.ru;
  }
}
