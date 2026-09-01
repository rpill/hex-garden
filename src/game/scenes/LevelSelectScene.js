import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { PlayMode } from "../modes.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import { getSettings } from "../settings.js";
import {
  makeButton,
  makeLevelButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
  setButtonEnabled,
} from "../ui.js";

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super("level-select");
    this.levelButtons = [];
  }

  preload() {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create() {
    this.paperBackground = createPaperBackground(this);
    this.progress = getCampaignProgress(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.titlePanel = makePanel(this, UI_FRAMES.panelHeader);
    this.title = makeText(
      this,
      this.progress.testMode ? "CAMPAIGN TEST" : this.english ? "CAMPAIGN" : "КАМПАНИЯ",
      24,
      "#303632",
    ).setOrigin(0.5);
    this.summary = makeText(this, "", 12, "#8f8f8f").setOrigin(0.5);
    this.backButton = makeButton(this, this.english ? "← BACK" : "← НАЗАД", () => {
      this.scene.start("menu");
    }, 14).setIcon(GAMEPLAY_UI_FRAMES.back, 20);
    this.settingsButton = makeButton(this, "⚙", () => {
      this.scene.start("settings", { returnScene: "level-select" });
    }, 18).setIcon(GAMEPLAY_UI_FRAMES.settings, 20, true);
    this.tutorialButton = makeLevelButton(
      this,
      this.english ? "00\nLEARN" : "00\nУЧИТЬСЯ",
      () => this.scene.start("board", { mode: PlayMode.TUTORIAL }),
      12,
    );
    this.tutorialButton.setAlign("center").setColor("#303632");

    this.levelButtons = Array.from(
      { length: PROGRESSION_LEVEL_COUNT },
      (_, level) => {
        const button = makeLevelButton(
          this,
          "",
          () => this.startLevel(level),
          12,
        );
        button.setAlign("center");
        return { level, button };
      },
    );

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.refresh();
    this.layout();
  }

  refresh() {
    const snapshot = this.progress.snapshot;
    const score = snapshot.campaignScore.toLocaleString("ru-RU");
    this.summary.setText(
      this.progress.testMode
        ? `ALL ${PROGRESSION_LEVEL_COUNT} LEVELS UNLOCKED`
        : snapshot.campaignCompleted
        ? this.english ? `CAMPAIGN COMPLETE   SCORE ${score}` : `КАМПАНИЯ ПРОЙДЕНА   СЧЁТ ${score}`
        : this.english
        ? `COMPLETED ${snapshot.completedLevels.length}/${PROGRESSION_LEVEL_COUNT}   SCORE ${score}`
        : `ПРОЙДЕНО ${snapshot.completedLevels.length}/${PROGRESSION_LEVEL_COUNT}   СЧЁТ ${score}`,
    );

    for (const { level, button } of this.levelButtons) {
      const completed = this.progress.isCompleted(level);
      const unlocked = this.progress.isUnlocked(level);
      const state = completed
        ? this.english ? "DONE" : "ГОТОВО"
        : unlocked ? this.english ? "PLAY" : "ИГРАТЬ"
        : this.english ? "LOCK" : "ЗАКРЫТ";
      button.setText(
        `${String(level + 1).padStart(2, "0")}\n${state}`,
      );
      button
        .setColor(unlocked ? "#303632" : "#777777")
        .setLevelState(
          completed
            ? "completed"
            : !unlocked
            ? "locked"
            : level === snapshot.highestUnlocked
            ? "current"
            : "idle",
        );
      setButtonEnabled(button, unlocked);
    }
  }

  startLevel(level) {
    if (!this.progress.isUnlocked(level)) return;
    this.scene.start("board", {
      mode: PlayMode.CAMPAIGN,
      level,
    });
  }

  layout() {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const header = layoutSceneHeader(
      {
        title: this.title,
        backButton: this.backButton,
        utilityButton: this.settingsButton,
      },
      width,
      height,
    );
    resizeNineSlice(this.titlePanel, Math.max(120, Math.min(width - 230, 320)), header.controlHeight + 8);
    this.titlePanel.setPosition(header.titleX, header.y);
    const columns = width < 520 ? 5 : 10;
    const itemCount = PROGRESSION_LEVEL_COUNT + 1;
    const rows = Math.ceil(itemCount / columns);
    const availableWidth = Math.max(240, width - 20);
    const cellWidth = Math.min(76, availableWidth / columns);
    const availableHeight = Math.max(180, height - header.contentTop - 12);
    const stepY = Math.min(54, availableHeight / rows);
    const cellHeight = Math.max(28, stepY - 6);
    const gridWidth = cellWidth * columns;
    const gridHeight = stepY * rows;
    const left = (width - gridWidth) / 2;
    const top = header.contentTop + 24 + Math.max(0, (availableHeight - gridHeight - 24) / 2);

    this.summary.setPosition(width / 2, header.contentTop + 6);

    const tutorialCellWidth = Math.max(34, cellWidth - 6);
    this.tutorialButton
      .setPosition(left + cellWidth * 0.5, top + stepY * 0.5)
      .setFixedSize(tutorialCellWidth, cellHeight)
      .setFontSize(Math.max(8, Math.min(12, cellHeight * 0.27)));
    this.tutorialButton.setLevelState(
      this.progress.snapshot.tutorialCompleted ? "completed" : "current",
    );

    for (const { level, button } of this.levelButtons) {
      const itemIndex = level + 1;
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      button
        .setPosition(
          left + cellWidth * (column + 0.5),
          top + stepY * (row + 0.5),
        )
        .setFixedSize(Math.max(34, cellWidth - 6), cellHeight)
        .setFontSize(Math.max(8, Math.min(12, cellHeight * 0.27)));
    }
  }
}
