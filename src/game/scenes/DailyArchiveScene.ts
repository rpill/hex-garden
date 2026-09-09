import Phaser from "phaser";
import {
  createDailyArchiveMonth,
  type DailyArchiveMonthModel,
} from "../../daily-archive.js";
import { dailyDateKey } from "../../daily-calendar.js";
import { DailyProgressStore } from "../../daily-progress.js";
import { getTrustedClock } from "../../platform/trusted-clock.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { ContextMenuOverlay } from "../ContextMenuOverlay.js";
import {
  MINIMAL_UI_COLORS,
  layoutMinimalButton,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "../minimal-ui.js";
import { PlayMode } from "../modes.js";
import { getSettings } from "../settings.js";
import { openUtilityScene } from "../utility-navigation.js";

const WEEKDAY_LABELS = Object.freeze({
  ru: Object.freeze(["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]),
  en: Object.freeze(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
} as const);

const MONTH_LABELS = Object.freeze({
  ru: Object.freeze([
    "ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ",
    "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ",
  ]),
  en: Object.freeze([
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
  ]),
} as const);

export class DailyArchiveScene extends Phaser.Scene {
  currentDateKey = "";
  monthKey = "";
  english = false;
  loading = true;
  progress!: DailyProgressStore;
  monthModel: DailyArchiveMonthModel | null = null;
  dayButtons: MinimalButton[] = [];
  dayDateKeys: Array<string | null> = Array.from({ length: 42 }, () => null);

  title!: Phaser.GameObjects.Text;
  status!: Phaser.GameObjects.Text;
  monthTitle!: Phaser.GameObjects.Text;
  streakText!: Phaser.GameObjects.Text;
  legendText!: Phaser.GameObjects.Text;
  weekdayTexts: Phaser.GameObjects.Text[] = [];
  calendarCard!: Phaser.GameObjects.Graphics;
  backButton!: MinimalButton;
  menuButton!: MinimalButton;
  previousButton!: MinimalButton;
  nextButton!: MinimalButton;
  retryButton!: MinimalButton;
  contextMenu!: ContextMenuOverlay;

  constructor() {
    super("daily-archive");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    void getYandexGamesAdapter().showStickyBanner();
    this.progress = new DailyProgressStore();
    this.english = getSettings(this).snapshot.language === "en";

    this.title = makeMinimalText(
      this,
      this.english ? "DAILY ARCHIVE" : "АРХИВ DAILY",
      24,
    ).setOrigin(0.5).setFontStyle("bold");
    this.status = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted).setOrigin(0.5);
    this.monthTitle = makeMinimalText(this, "", 16).setOrigin(0.5).setFontStyle("bold");
    this.streakText = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted).setOrigin(0.5);
    this.legendText = makeMinimalText(
      this,
      this.english
        ? "· NOT PLAYED   ✓ SOLVED   ◆ CLEAN"
        : "· НЕ СЫГРАНО   ✓ ПРОЙДЕНО   ◆ ЧИСТО",
      10,
      MINIMAL_UI_COLORS.textMuted,
    ).setOrigin(0.5).setVisible(false);
    this.calendarCard = makeMinimalCard(this, 520, 330);
    this.backButton = makeMinimalButton(this, "←", () => this.scene.start("menu"));
    this.menuButton = makeMinimalButton(this, "☰", () => this.openContextMenu()).setDepth(70);
    this.previousButton = makeMinimalButton(this, "‹", () => this.changeMonth(-1)).setEnabled(false);
    this.nextButton = makeMinimalButton(this, "›", () => this.changeMonth(1)).setEnabled(false);
    this.retryButton = makeMinimalButton(
      this,
      this.english ? "RETRY" : "ПОВТОРИТЬ",
      () => void this.loadTrustedDate(),
    ).setVisible(false);
    this.contextMenu = new ContextMenuOverlay(this);

    const labels = this.english ? WEEKDAY_LABELS.en : WEEKDAY_LABELS.ru;
    this.weekdayTexts = labels.map((label) =>
      makeMinimalText(this, label, 11, MINIMAL_UI_COLORS.textMuted)
        .setOrigin(0.5)
        .setFontStyle("bold"),
    );

    this.dayButtons = Array.from({ length: 42 }, (_value, index) =>
      makeMinimalButton(this, "", () => this.activateCell(index)).setEnabled(false),
    );

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.contextMenu.visible) this.contextMenu.close();
      else this.scene.start("menu");
    });
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });

    this.setLoadingState();
    this.layout();
    void this.loadTrustedDate();
  }

  private uiText(russian: string, english: string): string {
    return this.english ? english : russian;
  }

  private setLoadingState(): void {
    this.loading = true;
    this.status.setText(this.uiText("ЗАГРУЗКА…", "LOADING…"));
    this.retryButton.setVisible(false);
    this.legendText.setVisible(false);
    this.previousButton.setEnabled(false);
    this.nextButton.setEnabled(false);
    for (let index = 0; index < this.dayButtons.length; index += 1) {
      this.dayDateKeys[index] = null;
      this.dayButtons[index]?.setLabel("").setEnabled(false);
    }
  }

  private async loadTrustedDate(): Promise<void> {
    this.setLoadingState();
    const trustedNow = await getTrustedClock().now();
    if (!this.sys.isActive()) return;

    if (!trustedNow) {
      this.loading = false;
      this.currentDateKey = "";
      this.monthKey = "";
      this.monthModel = null;
      this.status.setText(this.uiText(
        "АРХИВ ВРЕМЕННО НЕДОСТУПЕН\nНе удалось получить время Яндекса.",
        "ARCHIVE TEMPORARILY UNAVAILABLE\nCould not get Yandex time.",
      ));
      this.monthTitle.setText("");
      this.streakText.setText("");
      this.legendText.setVisible(false);
      this.retryButton.setVisible(true).setEnabled(true);
      this.layout();
      return;
    }

    this.currentDateKey = dailyDateKey(trustedNow);
    this.progress.prune(this.currentDateKey);
    this.monthKey = this.currentDateKey.slice(0, 7);
    this.loading = false;
    this.retryButton.setVisible(false);
    this.status.setText("");
    this.refreshMonth();
    this.layout();
  }

  private refreshMonth(): void {
    if (!this.currentDateKey || !this.monthKey) return;
    this.monthModel = createDailyArchiveMonth(
      this.currentDateKey,
      this.monthKey,
      this.progress.snapshot,
    );

    const monthNames = this.english ? MONTH_LABELS.en : MONTH_LABELS.ru;
    const monthName = monthNames[this.monthModel.month - 1] ?? this.monthKey;
    this.monthTitle.setText(`${monthName} ${this.monthModel.year}`);
    const streak = this.progress.streakSummary(this.currentDateKey);
    this.streakText.setText(
      this.english
        ? `STREAK ${streak.currentStreak} · BEST ${streak.bestStreak}`
        : `СЕРИЯ ${streak.currentStreak} · ЛУЧШАЯ ${streak.bestStreak}`,
    );
    this.legendText.setVisible(true);

    this.previousButton.setEnabled(Boolean(this.monthModel.previousMonthKey));
    this.nextButton.setEnabled(Boolean(this.monthModel.nextMonthKey));

    this.monthModel.cells.forEach((cell, index) => {
      const button = this.dayButtons[index];
      if (!button) return;
      if (!cell) {
        this.dayDateKeys[index] = null;
        button.setLabel("").setHighlighted(false).setEnabled(false);
        return;
      }

      this.dayDateKeys[index] = cell.dateKey;
      const mark = cell.state === "clean" ? "◆" : cell.state === "solved" ? "✓" : "·";
      button
        .setLabel(`${cell.dayOfMonth}\n${mark}`)
        .setHighlighted(cell.today)
        .setEnabled(cell.enabled);
    });
  }

  private changeMonth(direction: -1 | 1): void {
    if (!this.monthModel) return;
    const nextKey = direction < 0
      ? this.monthModel.previousMonthKey
      : this.monthModel.nextMonthKey;
    if (!nextKey) return;
    this.monthKey = nextKey;
    this.refreshMonth();
    this.layout();
  }

  private activateCell(index: number): void {
    const dateKey = this.dayDateKeys[index];
    const cell = this.monthModel?.cells[index];
    if (!dateKey || !cell?.enabled) return;
    this.scene.start("board", {
      mode: PlayMode.DAILY,
      dailyDateKey: dateKey,
      dailyReturnTarget: "daily-archive",
    });
  }

  private openContextMenu(): void {
    this.contextMenu.open({
      title: this.uiText("МЕНЮ", "MENU"),
      items: [
        {
          id: "rules",
          label: this.uiText("ПРАВИЛА", "RULES"),
          onSelect: () => openUtilityScene(this, "rules", { returnScene: "daily-archive" }),
        },
        {
          id: "settings",
          label: this.uiText("НАСТРОЙКИ", "SETTINGS"),
          onSelect: () => openUtilityScene(this, "settings", { returnScene: "daily-archive" }),
        },
        {
          id: "home",
          label: this.uiText("ГЛАВНОЕ МЕНЮ", "MAIN MENU"),
          onSelect: () => this.scene.start("menu"),
        },
      ],
    });
  }

  layout(): void {
    const { width, height } = this.scale;
    const shortLandscape = height < 520 && width > height;
    const compact = width < 560;
    const headerY = shortLandscape ? 27 : 34;
    const controlSize = shortLandscape ? 34 : 40;

    this.title
      .setFontSize(compact ? 19 : 22)
      .setPosition(width / 2, headerY);
    layoutMinimalButton(this.backButton, 12 + controlSize / 2, headerY, controlSize, controlSize);
    layoutMinimalButton(this.menuButton, width - 12 - controlSize / 2, headerY, controlSize, controlSize);
    this.backButton.label.setFontSize(shortLandscape ? 15 : 17);
    this.menuButton.label.setFontSize(shortLandscape ? 15 : 17);

    const statusY = shortLandscape ? 53 : 62;
    this.status
      .setFontSize(shortLandscape ? 10 : 12)
      .setPosition(width / 2, statusY);

    if (!this.currentDateKey || !this.monthModel) {
      this.monthTitle.setPosition(width / 2, statusY + 28);
      this.streakText.setPosition(width / 2, statusY + 52);
      layoutMinimalButton(
        this.retryButton,
        width / 2,
        Math.min(height - 44, statusY + 94),
        Math.min(220, width - 40),
        shortLandscape ? 36 : 42,
      );
      this.contextMenu.layout(width, height);
      return;
    }

    const monthY = shortLandscape ? 62 : 78;
    const arrowWidth = shortLandscape ? 36 : 42;
    const arrowHeight = shortLandscape ? 30 : 34;
    const monthGap = Math.min(150, Math.max(92, width * 0.18));
    this.monthTitle
      .setFontSize(shortLandscape ? 13 : 16)
      .setPosition(width / 2, monthY);
    layoutMinimalButton(this.previousButton, width / 2 - monthGap, monthY, arrowWidth, arrowHeight);
    layoutMinimalButton(this.nextButton, width / 2 + monthGap, monthY, arrowWidth, arrowHeight);
    this.previousButton.label.setFontSize(18);
    this.nextButton.label.setFontSize(18);

    const streakY = monthY + (shortLandscape ? 23 : 26);
    const weekdaysY = streakY + (shortLandscape ? 24 : 28);
    const legendY = height - (shortLandscape ? 14 : 20);
    const gridTop = weekdaysY + (shortLandscape ? 12 : 16);
    const gridBottom = legendY - (shortLandscape ? 14 : 20);
    const horizontalMargin = compact ? 14 : 24;
    const maxGridWidth = Math.min(width - horizontalMargin * 2, 620);
    const maxGridHeight = Math.max(120, gridBottom - gridTop);
    const gap = shortLandscape ? 3 : 5;
    const cellWidth = Math.max(30, (maxGridWidth - gap * 6) / 7);
    const cellHeight = Math.max(24, (maxGridHeight - gap * 5) / 6);
    const actualCellWidth = Math.min(cellWidth, shortLandscape ? 70 : 76);
    const actualCellHeight = Math.min(cellHeight, shortLandscape ? 42 : 48);
    const gridWidth = actualCellWidth * 7 + gap * 6;
    const gridHeight = actualCellHeight * 6 + gap * 5;
    const left = (width - gridWidth) / 2;
    const top = gridTop + Math.max(0, (maxGridHeight - gridHeight) / 2);

    this.calendarCard
      .setPosition(width / 2, top + gridHeight / 2)
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.72)
      .fillRoundedRect(-gridWidth / 2 - 8, -gridHeight / 2 - 8, gridWidth + 16, gridHeight + 16, 12)
      .lineStyle(1, MINIMAL_UI_COLORS.border, 1)
      .strokeRoundedRect(-gridWidth / 2 - 7.5, -gridHeight / 2 - 7.5, gridWidth + 15, gridHeight + 15, 12);

    for (let column = 0; column < 7; column += 1) {
      const x = left + column * (actualCellWidth + gap) + actualCellWidth / 2;
      this.weekdayTexts[column]
        ?.setFontSize(shortLandscape ? 9 : 11)
        .setPosition(x, weekdaysY);
    }

    for (let index = 0; index < this.dayButtons.length; index += 1) {
      const row = Math.floor(index / 7);
      const column = index % 7;
      const x = left + column * (actualCellWidth + gap) + actualCellWidth / 2;
      const y = top + row * (actualCellHeight + gap) + actualCellHeight / 2;
      const button = this.dayButtons[index];
      if (!button) continue;
      layoutMinimalButton(button, x, y, actualCellWidth, actualCellHeight);
      button.label.setFontSize(shortLandscape ? 9 : compact ? 10 : 11);
    }

    this.streakText
      .setFontSize(shortLandscape ? 10 : 12)
      .setPosition(width / 2, streakY);
    this.legendText
      .setFontSize(shortLandscape ? 8 : compact ? 9 : 10)
      .setPosition(width / 2, legendY);
    this.contextMenu.layout(width, height);
  }
}
