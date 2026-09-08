import Phaser from "phaser";
import { dailyDateKey } from "../../daily-calendar.js";
import { DailyProgressStore } from "../../daily-progress.js";
import { CAMPAIGN_LEVEL_COUNT } from "../../plates.js";
import { getTrustedClock } from "../../platform/trusted-clock.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import {
  createHomeModel,
  type HomeDailyState,
  type HomeModel,
} from "../home-model.js";
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

const WEEKDAY_LABELS = Object.freeze({
  ru: Object.freeze(["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]),
  en: Object.freeze(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
} as const);

function rankLabel(rank: HomeModel["rank"], english: boolean): string {
  const labels = RANK_LABELS[rank];
  return english ? labels.en : labels.ru;
}

function dailyStateMark(state: HomeDailyState): string {
  return state === "clean" ? "◆" : state === "solved" ? "✓" : "·";
}

function dailyTodayLabel(state: HomeDailyState, english: boolean): string {
  if (state === "clean") return "◆";
  if (state === "solved") return "✓";
  return english ? "NEW" : "НОВАЯ";
}

export class MenuScene extends Phaser.Scene {
  progress!: ReturnType<typeof getCampaignProgress>;
  dailyProgress!: DailyProgressStore;
  settings!: ReturnType<typeof getSettings>;
  model!: Readonly<HomeModel>;
  english = false;
  dailyReady = false;
  dailyClockUnavailable = false;

  title!: Phaser.GameObjects.Text;
  subtitle!: Phaser.GameObjects.Text;
  progressText!: Phaser.GameObjects.Text;
  rankText!: Phaser.GameObjects.Text;
  primaryButton!: MinimalButton;
  dailyButton!: MinimalButton;
  dailyTitle!: Phaser.GameObjects.Text;
  dailyStatus!: Phaser.GameObjects.Text;
  dailyWeek!: Phaser.GameObjects.Text;
  chaptersButton!: MinimalButton;
  settingsButton!: MinimalButton;

  constructor() {
    super("menu");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    this.progress = getCampaignProgress(this);
    this.dailyProgress = new DailyProgressStore();
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
    this.dailyButton = makeMinimalButton(this, "", () => this.activateDaily())
      .setEnabled(false)
      .setVisible(false);
    this.dailyButton.label.setVisible(false);
    this.dailyTitle = makeMinimalText(
      this,
      this.english ? "DAILY PUZZLE" : "ЕЖЕДНЕВНАЯ ЗАДАЧА",
      13,
    )
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setVisible(false);
    this.dailyStatus = makeMinimalText(this, "", 13, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setVisible(false);
    this.dailyWeek = makeMinimalText(this, "", 11, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setVisible(false);
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
    void this.refreshDailyModel();
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
      this.setDailyVisible(false);
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

    this.refreshDailyCard();

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

  private refreshDailyCard(): void {
    const visible = this.model.showDaily;
    this.setDailyVisible(visible);
    if (!visible) return;

    const daily = this.model.daily;
    if (daily) {
      const labels = this.english ? WEEKDAY_LABELS.en : WEEKDAY_LABELS.ru;
      const marks = daily.weekStates.map((day) => dailyStateMark(day.state));
      this.dailyStatus.setText(dailyTodayLabel(daily.todayState, this.english));
      this.dailyWeek.setText(`${labels.join("   ")}\n${marks.join("    ")}`);
      this.dailyButton.setEnabled(this.dailyReady);
      return;
    }

    this.dailyStatus.setText(
      this.dailyClockUnavailable
        ? this.english ? "YANDEX TIME UNAVAILABLE" : "ВРЕМЯ ЯНДЕКСА НЕДОСТУПНО"
        : this.english ? "LOADING…" : "ЗАГРУЗКА…",
    );
    this.dailyWeek.setText("");
    this.dailyButton.setEnabled(false);
  }

  private setDailyVisible(visible: boolean): void {
    this.dailyButton.setVisible(visible);
    this.dailyTitle.setVisible(visible);
    this.dailyStatus.setVisible(visible);
    this.dailyWeek.setVisible(visible);
  }

  private async refreshDailyModel(): Promise<void> {
    if (!this.model.showDaily) return;

    const trustedNow = await getTrustedClock().now();
    if (!this.sys.isActive()) return;
    if (!trustedNow) {
      this.dailyReady = false;
      this.dailyClockUnavailable = true;
      this.refreshPresentation();
      this.layout();
      return;
    }

    const dateKey = dailyDateKey(trustedNow);
    this.dailyProgress.prune(dateKey);
    this.dailyReady = true;
    this.dailyClockUnavailable = false;
    this.model = createHomeModel(this.progress.snapshot, {
      unlockAll: this.progress.testMode,
      daily: {
        dateKey,
        weekSummary: this.dailyProgress.weekSummary(dateKey),
      },
    });
    this.refreshPresentation();
    this.layout();
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

  private activateDaily(): void {
    if (!this.model.showDaily || !this.dailyReady || !this.model.daily) return;
    this.scene.start("board", { mode: PlayMode.DAILY });
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

    let secondaryY = metrics.secondaryY;
    if (this.model.showDaily) {
      const dailyHeight = metrics.shortLandscape ? 62 : 76;
      const dailyY = metrics.primaryY + (metrics.shortLandscape ? 68 : 80);
      secondaryY = dailyY + (metrics.shortLandscape ? 63 : 73);
      this.dailyButton
        .setPosition(metrics.centerX, dailyY)
        .setSize(metrics.primaryWidth, dailyHeight);
      this.dailyTitle
        .setFontSize(metrics.compact ? 11 : 13)
        .setPosition(metrics.centerX, dailyY - (metrics.shortLandscape ? 18 : 22));
      this.dailyStatus
        .setFontSize(metrics.compact ? 11 : 13)
        .setPosition(metrics.centerX, dailyY - 1);
      this.dailyWeek
        .setFontSize(metrics.compact ? 9 : 10)
        .setPosition(metrics.centerX, dailyY + (metrics.shortLandscape ? 18 : 23));
    }

    this.chaptersButton
      .setPosition(metrics.centerX - secondaryHalfSpan, secondaryY)
      .setSize(metrics.secondaryWidth, metrics.secondaryHeight);
    this.settingsButton
      .setPosition(metrics.centerX + secondaryHalfSpan, secondaryY)
      .setSize(metrics.secondaryWidth, metrics.secondaryHeight);
  }
}
