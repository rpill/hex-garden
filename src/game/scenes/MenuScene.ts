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
import { getEndlessProgress } from "../endless-progress.js";
import { getSettings } from "../settings.js";
import { ContextMenuOverlay } from "../ContextMenuOverlay.js";
import { openUtilityScene } from "../utility-navigation.js";

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
  endlessProgress!: ReturnType<typeof getEndlessProgress>;
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
  dailyArchiveButton!: MinimalButton;
  dailyTitle!: Phaser.GameObjects.Text;
  dailyStatus!: Phaser.GameObjects.Text;
  dailyWeek!: Phaser.GameObjects.Text;
  endlessButton!: MinimalButton;
  endlessTitle!: Phaser.GameObjects.Text;
  endlessStatus!: Phaser.GameObjects.Text;
  chaptersButton!: MinimalButton;
  menuButton!: MinimalButton;
  contextMenu!: ContextMenuOverlay;

  constructor() {
    super("menu");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    void getYandexGamesAdapter().showStickyBanner();
    this.progress = getCampaignProgress(this);
    this.dailyProgress = new DailyProgressStore();
    this.endlessProgress = getEndlessProgress(this);
    this.settings = getSettings(this);
    this.english = this.settings.snapshot.language === "en";
    this.model = createHomeModel(this.progress.snapshot, {
      unlockAll: this.progress.testMode,
      endless: this.endlessProgress.snapshot,
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
    this.dailyArchiveButton = makeMinimalButton(
      this,
      this.english ? "ARCHIVE · 90 DAYS" : "АРХИВ · 90 ДНЕЙ",
      () => this.activateDailyArchive(),
    )
      .setEnabled(false)
      .setVisible(false);
    this.endlessButton = makeMinimalButton(this, "", () => this.activateEndless())
      .setVisible(false);
    this.endlessButton.label.setVisible(false);
    this.endlessTitle = makeMinimalText(this, "ENDLESS", 13)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setVisible(false);
    this.endlessStatus = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setVisible(false);
    this.chaptersButton = makeMinimalButton(
      this,
      this.english ? "CHAPTERS" : "ГЛАВЫ",
      () => this.scene.start("level-select"),
    );
    this.menuButton = makeMinimalButton(this, "☰", () => this.openContextMenu()).setDepth(70);
    this.contextMenu = new ContextMenuOverlay(this);
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.contextMenu.visible) this.contextMenu.close();
    });

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
      this.setEndlessVisible(false);
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
    this.refreshEndlessCard();

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
      this.dailyArchiveButton.setEnabled(this.dailyReady);
      return;
    }

    this.dailyStatus.setText(
      this.dailyClockUnavailable
        ? this.english ? "YANDEX TIME UNAVAILABLE" : "ВРЕМЯ ЯНДЕКСА НЕДОСТУПНО"
        : this.english ? "LOADING…" : "ЗАГРУЗКА…",
    );
    this.dailyWeek.setText("");
    this.dailyButton.setEnabled(false);
    this.dailyArchiveButton.setEnabled(false);
  }

  private setDailyVisible(visible: boolean): void {
    this.dailyButton.setVisible(visible);
    this.dailyArchiveButton.setVisible(visible);
    this.dailyTitle.setVisible(visible);
    this.dailyStatus.setVisible(visible);
    this.dailyWeek.setVisible(visible);
  }

  private refreshEndlessCard(): void {
    const visible = this.model.showEndless;
    this.setEndlessVisible(visible);
    if (!visible) return;

    const bestBoards = this.model.endless?.bestBoards ?? 0;
    this.endlessStatus.setText(
      this.english ? `BEST: ${bestBoards} BOARDS` : `РЕКОРД: ${bestBoards} ПОЛЕЙ`,
    );
    this.endlessButton.setEnabled(true);
  }

  private setEndlessVisible(visible: boolean): void {
    this.endlessButton.setVisible(visible);
    this.endlessTitle.setVisible(visible);
    this.endlessStatus.setVisible(visible);
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
      endless: this.endlessProgress.snapshot,
    });
    this.refreshPresentation();
    this.layout();
  }

  private openContextMenu(): void {
    this.contextMenu.open({
      title: this.english ? "MENU" : "МЕНЮ",
      items: [
        ...(this.model.showEndless
          ? [{
              id: "leaderboard",
              label: this.english ? "LEADERBOARD" : "РЕЙТИНГ",
              onSelect: () => this.scene.start("leaderboard"),
            }]
          : []),
        {
          id: "rules",
          label: this.english ? "RULES" : "ПРАВИЛА",
          onSelect: () => openUtilityScene(this, "rules", { returnScene: "menu" }),
        },
        {
          id: "settings",
          label: this.english ? "SETTINGS" : "НАСТРОЙКИ",
          onSelect: () => openUtilityScene(this, "settings", { returnScene: "menu" }),
        },
      ],
    });
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
    this.scene.start("board", {
      mode: PlayMode.DAILY,
      dailyDateKey: this.model.daily.dateKey,
      dailyReturnTarget: "home",
    });
  }

  private activateDailyArchive(): void {
    if (!this.model.showDaily || !this.dailyReady) return;
    this.scene.start("daily-archive");
  }

  private activateEndless(): void {
    if (!this.model.showEndless) return;
    this.scene.start("board", { mode: PlayMode.ENDLESS, level: 0 });
  }

  layout(): void {
    const { width, height } = this.scale;
    const metrics = homeLayoutMetrics(width, height);
    const menuSize = metrics.shortLandscape ? 36 : 42;
    this.menuButton
      .setPosition(width - 14 - menuSize / 2, metrics.shortLandscape ? 27 : 34)
      .setSize(menuSize, menuSize);
    this.menuButton.label.setFontSize(metrics.shortLandscape ? 16 : 18);

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
      this.contextMenu.layout(width, height);
      return;
    }

    let secondaryY = metrics.secondaryY;
    if (this.model.showDaily) {
      const dailyHeight = metrics.shortLandscape ? 62 : 76;
      const endlessHeight = metrics.shortLandscape ? 62 : 68;
      const archiveHeight = metrics.shortLandscape ? 26 : 28;
      const archiveGap = 6;
      const dailyY = metrics.primaryY + (metrics.shortLandscape ? 68 : 80);

      if (metrics.shortLandscape && this.model.showEndless) {
        const cardGap = 12;
        const cardWidth = (metrics.primaryWidth - cardGap) / 2;
        const dailyX = metrics.centerX - (cardWidth + cardGap) / 2;
        const endlessX = metrics.centerX + (cardWidth + cardGap) / 2;
        const archiveY = dailyY + dailyHeight / 2 + archiveGap + archiveHeight / 2;
        const lowerBottom = Math.max(
          archiveY + archiveHeight / 2,
          dailyY + endlessHeight / 2,
        );
        secondaryY = lowerBottom + 8 + metrics.secondaryHeight / 2;

        this.dailyButton.setPosition(dailyX, dailyY).setSize(cardWidth, dailyHeight);
        this.dailyTitle.setFontSize(11).setPosition(dailyX, dailyY - 18);
        this.dailyStatus.setFontSize(10).setPosition(dailyX, dailyY - 1);
        this.dailyWeek.setFontSize(8).setPosition(dailyX, dailyY + 18);
        this.dailyArchiveButton
          .setPosition(dailyX, archiveY)
          .setSize(cardWidth, archiveHeight);
        this.dailyArchiveButton.label.setFontSize(9);

        this.endlessButton.setPosition(endlessX, dailyY).setSize(cardWidth, endlessHeight);
        this.endlessTitle.setFontSize(11).setPosition(endlessX, dailyY - 12);
        this.endlessStatus
          .setFontSize(9)
          .setFixedSize(Math.max(80, cardWidth - 16), 0)
          .setPosition(endlessX, dailyY + 10);
      } else {
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

        const archiveY = dailyY + dailyHeight / 2 + archiveGap + archiveHeight / 2;
        this.dailyArchiveButton
          .setPosition(metrics.centerX, archiveY)
          .setSize(metrics.primaryWidth, archiveHeight);
        this.dailyArchiveButton.label.setFontSize(metrics.compact ? 9 : 10);

        if (this.model.showEndless) {
          const endlessY = archiveY + archiveHeight / 2 + 10 + endlessHeight / 2;
          secondaryY = endlessY + endlessHeight / 2 + 10 + metrics.secondaryHeight / 2;
          this.endlessButton
            .setPosition(metrics.centerX, endlessY)
            .setSize(metrics.primaryWidth, endlessHeight);
          this.endlessTitle
            .setFontSize(metrics.compact ? 11 : 13)
            .setPosition(metrics.centerX, endlessY - 13);
          this.endlessStatus
            .setFontSize(metrics.compact ? 10 : 12)
            .setFixedSize(Math.max(120, metrics.primaryWidth - 24), 0)
            .setPosition(metrics.centerX, endlessY + 12);
        } else {
          secondaryY = archiveY + archiveHeight / 2 + 10 + metrics.secondaryHeight / 2;
        }
      }
    }

    this.chaptersButton
      .setPosition(metrics.centerX, secondaryY)
      .setSize(Math.min(metrics.primaryWidth, metrics.secondaryWidth * 1.45), metrics.secondaryHeight);
    this.contextMenu.layout(width, height);
  }
}
