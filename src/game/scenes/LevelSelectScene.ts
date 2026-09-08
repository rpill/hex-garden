import Phaser from "phaser";
import { CAMPAIGN_LEVEL_COUNT } from "../../plates.js";
import {
  CAMPAIGN_CHAPTERS,
  CampaignLevelState,
  campaignLevelState,
} from "../chapter-model.js";
import { getCampaignProgress } from "../campaign-progress.js";
import {
  MINIMAL_UI_COLORS,
  type MinimalButton,
  layoutMinimalButton,
  makeMinimalButton,
  makeMinimalText,
} from "../minimal-ui.js";
import { PlayMode } from "../modes.js";
import { chapterGridMetrics } from "../presentation-layout.js";
import { getSettings } from "../settings.js";

type LevelButtonView = {
  level: number;
  button: MinimalButton;
};

export class LevelSelectScene extends Phaser.Scene {
  levelButtons: LevelButtonView[] = [];
  chapterLabels: Phaser.GameObjects.Text[] = [];
  progress!: ReturnType<typeof getCampaignProgress>;
  english = false;
  title!: Phaser.GameObjects.Text;
  summary!: Phaser.GameObjects.Text;
  backButton!: MinimalButton;

  constructor() {
    super("level-select");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    this.progress = getCampaignProgress(this);
    this.english = getSettings(this).snapshot.language === "en";

    this.title = makeMinimalText(
      this,
      this.progress.testMode
        ? this.english ? "CHAPTERS · TEST" : "ГЛАВЫ · ТЕСТ"
        : this.english ? "CHAPTERS" : "ГЛАВЫ",
      24,
    ).setOrigin(0.5);
    this.summary = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted).setOrigin(0.5);
    this.backButton = makeMinimalButton(this, this.english ? "BACK" : "НАЗАД", () => {
      this.scene.start("menu");
    });

    this.chapterLabels = CAMPAIGN_CHAPTERS.map((chapter) =>
      makeMinimalText(
        this,
        this.english ? chapter.titleEn : chapter.titleRu,
        13,
        MINIMAL_UI_COLORS.textMuted,
      ).setOrigin(0, 0.5),
    );

    this.levelButtons = Array.from({ length: CAMPAIGN_LEVEL_COUNT }, (_, level) => ({
      level,
      button: makeMinimalButton(this, "", () => this.startLevel(level)),
    }));

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });

    this.refresh();
    this.layout();
  }

  refresh(): void {
    const snapshot = this.progress.snapshot;
    this.summary.setText(
      this.english
        ? `SOLVED ${snapshot.solvedLevels.length}/${CAMPAIGN_LEVEL_COUNT}  ·  ◆ ${snapshot.cleanLevels.length}/${CAMPAIGN_LEVEL_COUNT}`
        : `ПРОЙДЕНО ${snapshot.solvedLevels.length}/${CAMPAIGN_LEVEL_COUNT}  ·  ◆ ЧИСТО ${snapshot.cleanLevels.length}/${CAMPAIGN_LEVEL_COUNT}`,
    );

    for (const { level, button } of this.levelButtons) {
      const state = campaignLevelState(snapshot, level, { unlockAll: this.progress.testMode });
      const mark = state === CampaignLevelState.CLEAN
        ? "◆"
        : state === CampaignLevelState.SOLVED
          ? "✓"
          : "";
      const number = String(level + 1).padStart(2, "0");
      button
        .setLabel(mark ? `${number}\n${mark}` : number)
        .setEnabled(state !== CampaignLevelState.LOCKED);
    }
  }

  startLevel(level: number): void {
    if (!this.progress.isUnlocked(level)) return;
    this.scene.start("board", { mode: PlayMode.CAMPAIGN, level });
  }

  layout(): void {
    const { width, height } = this.scale;
    const shortLandscape = height < 520 && width > height;
    const compact = width < 520;
    const headerY = shortLandscape ? 27 : 34;
    const backWidth = compact ? 86 : 102;
    const backHeight = shortLandscape ? 34 : 38;

    this.title
      .setFontSize(compact ? 20 : shortLandscape ? 20 : 24)
      .setPosition(width / 2, headerY);
    layoutMinimalButton(
      this.backButton,
      12 + backWidth / 2,
      headerY,
      backWidth,
      backHeight,
    );
    this.backButton.label.setFontSize(shortLandscape ? 11 : 12);

    const summaryY = shortLandscape ? 54 : 68;
    this.summary
      .setFontSize(compact ? 10 : 12)
      .setPosition(width / 2, summaryY);

    const contentTop = shortLandscape ? 72 : 92;
    const metrics = chapterGridMetrics(width, height, contentTop);
    const left = (width - metrics.gridWidth) / 2;
    const availableHeight = Math.max(0, height - contentTop - (shortLandscape ? 8 : 12));
    const top = contentTop + Math.max(0, (availableHeight - metrics.totalHeight) / 2);

    CAMPAIGN_CHAPTERS.forEach((chapter, chapterIndex) => {
      const sectionTop = top + chapterIndex * (metrics.sectionHeight + metrics.chapterGap);
      const chapterLabel = this.chapterLabels[chapterIndex];
      chapterLabel
        ?.setFontSize(shortLandscape ? 10 : compact ? 11 : 13)
        .setPosition(left, sectionTop + metrics.labelHeight / 2);

      for (let localIndex = 0; localIndex < 10; localIndex += 1) {
        const level = chapter.startLevel + localIndex;
        const view = this.levelButtons[level];
        if (!view) continue;
        const column = localIndex % metrics.columns;
        const row = Math.floor(localIndex / metrics.columns);
        const x = left + column * (metrics.tileWidth + metrics.gapX) + metrics.tileWidth / 2;
        const y =
          sectionTop +
          metrics.labelHeight +
          row * (metrics.tileHeight + metrics.gapY) +
          metrics.tileHeight / 2;
        layoutMinimalButton(view.button, x, y, metrics.tileWidth, metrics.tileHeight);
        view.button.label.setFontSize(
          Math.max(10, Math.min(14, Math.floor(metrics.tileHeight * 0.3))),
        );
      }
    });
  }
}
