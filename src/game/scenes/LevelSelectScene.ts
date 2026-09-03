import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEconomy } from "../economy.js";
import { PlayMode } from "../modes.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import { levelGridMetrics } from "../presentation-layout.js";
import { getSettings } from "../settings.js";
import {
  makeButton,
  makeCurrencyDisplay,
  makeCartIconButton,
  makeIconButton,
  makeLevelButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
  setButtonEnabled,
} from "../ui.js";

type LevelButtonView = {
  level: number;
  button: ReturnType<typeof makeLevelButton>;
  stateIcon: Phaser.GameObjects.Image;
};

export class LevelSelectScene extends Phaser.Scene {
  levelButtons: LevelButtonView[] = [];
  paperBackground!: ReturnType<typeof createPaperBackground>;
  progress!: ReturnType<typeof getCampaignProgress>;
  economy!: ReturnType<typeof getEconomy>;
  english = false;
  titlePanel!: ReturnType<typeof makePanel>;
  title!: Phaser.GameObjects.Text;
  summary!: Phaser.GameObjects.Text;
  backButton!: ReturnType<typeof makeButton>;
  shopButton!: ReturnType<typeof makeCartIconButton>;
  settingsButton!: ReturnType<typeof makeIconButton>;
  dust!: ReturnType<typeof makeCurrencyDisplay>;
  tutorialButton!: ReturnType<typeof makeLevelButton>;
  constructor() {
    super("level-select");
  }

  preload(): void {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create(): void {
    this.paperBackground = createPaperBackground(this);
    this.progress = getCampaignProgress(this);
    this.economy = getEconomy(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.titlePanel = makePanel(this, UI_FRAMES.panelHeader).setVisible(false);
    this.title = makeText(
      this,
      this.progress.testMode ? "CAMPAIGN TEST" : this.english ? "CAMPAIGN" : "КАМПАНИЯ",
      24,
      "#eef3f8",
    ).setOrigin(0.5);
    this.summary = makeText(this, "", 12, "#9aa7b5").setOrigin(0.5);
    this.backButton = makeButton(this, this.english ? "BACK" : "НАЗАД", () => {
      this.scene.start("menu");
    }, 14).setIcon(GAMEPLAY_UI_FRAMES.back, 22);
    this.shopButton = makeCartIconButton(this, () => {
      this.scene.start("shop", { returnScene: "level-select" });
    }, { size: 46 });
    this.settingsButton = makeIconButton(this, GAMEPLAY_UI_FRAMES.settings, () => {
      this.scene.start("settings", { returnScene: "level-select" });
    }, { size: 46, glyphSize: 32 });
    this.dust = makeCurrencyDisplay(
      this,
      GAMEPLAY_UI_FRAMES.dust,
      0,
      { iconSize: 22, fontSize: 13 },
    );
    this.tutorialButton = makeLevelButton(
      this,
      this.english ? "00\nLEARN" : "00\nУЧИТЬСЯ",
      () => this.scene.start("board", { mode: PlayMode.TUTORIAL }),
      12,
    );
    this.tutorialButton.setAlign("center").setColor("#eef3f8");

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
        const stateIcon = this.add
          .image(0, 0, GAMEPLAY_UI_FRAMES.check)
          .setVisible(false);
        return { level, button, stateIcon };
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

  refresh(): void {
    const snapshot = this.progress.snapshot;
    const score = snapshot.campaignScore.toLocaleString("ru-RU");
    this.summary.setText(
      this.progress.testMode
        ? `ALL ${PROGRESSION_LEVEL_COUNT} LEVELS UNLOCKED`
        : snapshot.campaignCompleted
        ? this.english ? `CAMPAIGN COMPLETE  ·  SCORE ${score}` : `КАМПАНИЯ ПРОЙДЕНА  ·  СЧЁТ ${score}`
        : this.english
        ? `COMPLETED ${snapshot.completedLevels.length}/${PROGRESSION_LEVEL_COUNT}  ·  SCORE ${score}`
        : `ПРОЙДЕНО ${snapshot.completedLevels.length}/${PROGRESSION_LEVEL_COUNT}  ·  СЧЁТ ${score}`,
    );
    this.dust.setValue(this.economy.snapshot.dust);

    for (const { level, button, stateIcon } of this.levelButtons) {
      const completed = this.progress.isCompleted(level);
      const unlocked = this.progress.isUnlocked(level);
      button.setText(String(level + 1).padStart(2, "0"));
      button
        .setColor(unlocked ? "#eef3f8" : "#657080")
        .setLevelState(
          completed
            ? "completed"
            : !unlocked
            ? "locked"
            : level === snapshot.highestUnlocked
            ? "current"
            : "idle",
        );
      stateIcon
        .setTexture(GAMEPLAY_UI_FRAMES.check)
        .setVisible(completed);
      setButtonEnabled(button, unlocked);
    }
  }

  startLevel(level: number): void {
    if (!this.progress.isUnlocked(level)) return;
    this.scene.start("board", {
      mode: PlayMode.CAMPAIGN,
      level,
    });
  }

  layout(): void {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const header = layoutSceneHeader(
      {
        title: this.title,
        backButton: this.backButton,
        utilityButtons: [this.settingsButton, this.shopButton],
      },
      width,
      height,
    );
    this.titlePanel.setVisible(false);

    const compact = width < 520;
    const summaryY = header.contentTop + (compact ? 10 : 14);
    this.summary
      .setFontSize(compact ? 9 : 12)
      .setPosition(width / 2, summaryY);
    this.dust
      .setFontSize(compact ? 10 : 12)
      .setPosition(
        compact ? width / 2 : width - 64,
        compact ? summaryY + 22 : summaryY,
      );

    const gridTop = header.contentTop + (compact ? 52 : 42);
    const metrics = levelGridMetrics(
      width,
      height,
      PROGRESSION_LEVEL_COUNT + 1,
      gridTop,
    );
    const left = (width - metrics.gridWidth) / 2;
    const freeHeight = Math.max(0, height - gridTop - metrics.gridHeight - 14);
    const top = gridTop + freeHeight / 2;

    const placeAt = (button: ReturnType<typeof makeLevelButton>, itemIndex: number): { x: number; y: number } => {
      const column = itemIndex % metrics.columns;
      const row = Math.floor(itemIndex / metrics.columns);
      const x = left + column * (metrics.tileWidth + metrics.gapX) + metrics.tileWidth / 2;
      const y = top + row * (metrics.tileHeight + metrics.gapY) + metrics.tileHeight / 2;
      button
        .setPosition(x, y)
        .setFixedSize(metrics.tileWidth, metrics.tileHeight)
        .setFontSize(Math.max(15, Math.min(24, metrics.tileHeight * 0.24)));
      return { x, y };
    };

    placeAt(this.tutorialButton, 0);
    this.tutorialButton
      .setText(this.english ? "00\nLEARN" : "00\nУЧЕБА")
      .setLevelState(
        this.progress.snapshot.tutorialCompleted ? "completed" : "current",
      );

    for (const { level, button, stateIcon } of this.levelButtons) {
      const { x, y } = placeAt(button, level + 1);
      stateIcon
        .setDisplaySize(Math.max(18, metrics.tileHeight * 0.22), Math.max(18, metrics.tileHeight * 0.22))
        .setPosition(
          x + metrics.tileWidth / 2 - Math.max(16, metrics.tileHeight * 0.18),
          y - metrics.tileHeight / 2 + Math.max(16, metrics.tileHeight * 0.18),
        );
    }
  }}
