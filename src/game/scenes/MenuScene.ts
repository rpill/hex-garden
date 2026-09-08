import Phaser from "phaser";
import { CAMPAIGN_LEVEL_COUNT } from "../../plates.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { createHomeModel, type HomeModel } from "../home-model.js";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalText,
  type MinimalButton,
} from "../minimal-ui.js";
import { PlayMode } from "../modes.js";
import { homeLayoutMetrics } from "../navigation-layout.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getSettings } from "../settings.js";

const RANK_LABELS = Object.freeze({
  novice: { ru: "НОВИЧОК", en: "NOVICE" },
  apprentice: { ru: "УЧЕНИК", en: "APPRENTICE" },
  adept: { ru: "ЗНАТОК", en: "ADEPT" },
  strategist: { ru: "СТРАТЕГ", en: "STRATEGIST" },
  expert: { ru: "ЭКСПЕРТ", en: "EXPERT" },
  master: { ru: "МАСТЕР", en: "MASTER" },
} as const);

function rankLabel(rank: HomeModel["rank"], english: boolean): string {
  const labels = RANK_LABELS[rank];
  return english ? labels.en : labels.ru;
}

export class MenuScene extends Phaser.Scene {
  progress!: ReturnType<typeof getCampaignProgress>;
  settings!: ReturnType<typeof getSettings>;
  model!: Readonly<HomeModel>;
  english = false;

  title!: Phaser.GameObjects.Text;
  subtitle!: Phaser.GameObjects.Text;
  progressText!: Phaser.GameObjects.Text;
  rankText!: Phaser.GameObjects.Text;
  primaryButton!: MinimalButton;
  chaptersButton!: MinimalButton;
  settingsButton!: MinimalButton;

  constructor() {
    super("menu");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    this.progress = getCampaignProgress(this);
    this.settings = getSettings(this);
    this.english = this.settings.snapshot.language === "en";
    this.model = createHomeModel(this.progress.snapshot, {
      unlockAll: this.progress.testMode,
    });

    this.title = makeMinimalText(this, "HEX GARDEN", 36)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.subtitle = makeMinimalText(
      this,
      this.english ? "LOGIC PUZZLE" : "ЛОГИЧЕСКАЯ ГОЛОВОЛОМКА",
      13,
      MINIMAL_UI_COLORS.textMuted,
    ).setOrigin(0.5);
    this.progressText = makeMinimalText(this, "", 14, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5);
    this.rankText = makeMinimalText(this, "", 13)
      .setOrigin(0.5)
      .setFontStyle("bold");

    this.primaryButton = makeMinimalButton(this, "", () => this.activatePrimaryAction());
    this.chaptersButton = makeMinimalButton(
      this,
      this.english ? "CHAPTERS" : "ГЛАВЫ",
      () => this.scene.start("level-select"),
    );
    this.settingsButton = makeMinimalButton(
      this,
      this.english ? "SETTINGS" : "НАСТРОЙКИ",
      () => this.scene.start("settings", { returnScene: "menu" }),
    );

    this.refreshPresentation();
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.layout();
    getYandexGamesAdapter().notifyGameReady();
  }

  private refreshPresentation(): void {
    if (this.model.firstLaunch) {
      this.primaryButton.setLabel(this.english ? "START" : "НАЧАТЬ").setEnabled(true);
      this.chaptersButton.setVisible(false);
      this.progressText.setVisible(false);
      this.rankText.setVisible(false);
      return;
    }

    this.chaptersButton.setVisible(true);
    this.progressText
      .setVisible(true)
      .setText(
        this.english
          ? `SOLVED ${this.model.solvedCount}/${CAMPAIGN_LEVEL_COUNT}  ·  ◆ ${this.model.cleanCount}/${CAMPAIGN_LEVEL_COUNT} CLEAN`
          : `ПРОЙДЕНО ${this.model.solvedCount}/${CAMPAIGN_LEVEL_COUNT}  ·  ◆ ЧИСТО ${this.model.cleanCount}/${CAMPAIGN_LEVEL_COUNT}`,
      );
    this.rankText
      .setVisible(true)
      .setText(
        `${this.english ? "RANK" : "РАНГ"} · ${rankLabel(this.model.rank, this.english)}`,
      );

    if (this.model.continueTarget.kind === "campaign") {
      this.primaryButton
        .setLabel(
          this.english
            ? `CONTINUE · LEVEL ${this.model.continueTarget.level + 1}`
            : `ПРОДОЛЖИТЬ · УРОВЕНЬ ${this.model.continueTarget.level + 1}`,
        )
        .setEnabled(true);
      return;
    }

    if (this.model.continueTarget.kind === "mastery") {
      this.primaryButton
        .setLabel(
          this.english
            ? `CLEAN MASTERY · LEVEL ${this.model.continueTarget.level + 1}`
            : `ЧИСТОЕ ПРОХОЖДЕНИЕ · УРОВЕНЬ ${this.model.continueTarget.level + 1}`,
        )
        .setEnabled(true);
      return;
    }

    this.primaryButton
      .setLabel(this.english ? "MASTERY COMPLETE" : "МАСТЕРСТВО ЗАВЕРШЕНО")
      .setEnabled(false);
  }

  private activatePrimaryAction(): void {
    if (this.model.firstLaunch) {
      this.scene.start("board", { mode: PlayMode.TUTORIAL });
      return;
    }

    const target = this.model.continueTarget;
    if (target.kind === "complete") return;
    this.scene.start("board", { mode: PlayMode.CAMPAIGN, level: target.level });
  }

  layout(): void {
    const { width, height } = this.scale;
    const metrics = homeLayoutMetrics(width, height);
    const secondaryHalfSpan = (metrics.secondaryWidth + metrics.secondaryGap) / 2;

    this.title
      .setFontSize(metrics.compact ? 30 : 36)
      .setPosition(metrics.centerX, metrics.titleY);
    this.subtitle
      .setFontSize(metrics.compact ? 11 : 13)
      .setPosition(metrics.centerX, metrics.subtitleY);
    this.progressText
      .setFontSize(metrics.compact ? 11 : 14)
      .setPosition(metrics.centerX, metrics.progressY);
    this.rankText
      .setFontSize(metrics.compact ? 11 : 13)
      .setPosition(metrics.centerX, metrics.progressY + (metrics.shortLandscape ? 24 : 30));

    this.primaryButton
      .setPosition(metrics.centerX, metrics.primaryY)
      .setSize(metrics.primaryWidth, metrics.primaryHeight);

    if (this.model.firstLaunch) {
      this.settingsButton
        .setPosition(metrics.centerX, metrics.secondaryY)
        .setSize(metrics.secondaryWidth, metrics.secondaryHeight);
      return;
    }

    this.chaptersButton
      .setPosition(metrics.centerX - secondaryHalfSpan, metrics.secondaryY)
      .setSize(metrics.secondaryWidth, metrics.secondaryHeight);
    this.settingsButton
      .setPosition(metrics.centerX + secondaryHalfSpan, metrics.secondaryY)
      .setSize(metrics.secondaryWidth, metrics.secondaryHeight);
  }
}
