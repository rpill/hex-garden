import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { standardEndlessAccess } from "../../mode-access.js";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { isCampaignTestMode } from "../campaign-test-mode.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEconomy } from "../economy.js";
import { getLeaderboard } from "../leaderboard.js";
import { PlayMode } from "../modes.js";
import { sceneHeaderMetrics } from "../navigation-layout.js";
import { isShortLandscape } from "../responsive-layout.js";
import { getSettings } from "../settings.js";
import {
  makeButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
} from "../ui.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";

function russianLevelWord(count) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "УРОВНЕЙ";
  if (mod10 === 1) return "УРОВЕНЬ";
  if (mod10 >= 2 && mod10 <= 4) return "УРОВНЯ";
  return "УРОВНЕЙ";
}

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  preload() {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create() {
    this.paperBackground = createPaperBackground(this);
    this.campaignTestMode = isCampaignTestMode();
    this.progress = getCampaignProgress(this);
    this.economy = getEconomy(this);
    this.settings = getSettings(this);
    this.leaderboard = getLeaderboard(this);
    this.leaderboard.syncCampaignScore(this.progress.snapshot.campaignScore);
    this.english = this.settings.snapshot.language === "en";
    this.endlessAccess = standardEndlessAccess(this.progress.snapshot, {
      unlockAll: this.progress.testMode,
    });
    this.background = makePanel(this, UI_FRAMES.panelMainLarge);
    this.title = makeText(this, "HEX GARDEN", 34, "#303632").setOrigin(0.5);
    this.subtitle = makeText(
      this,
      this.english ? "ALCHEMY PUZZLE" : "АЛХИМИЧЕСКАЯ ГОЛОВОЛОМКА",
      14,
      "#8f8f8f",
    ).setOrigin(0.5);
    this.campaignButton = makeButton(this, this.english ? "CAMPAIGN" : "КАМПАНИЯ", () => {
      this.scene.start(
        this.progress.snapshot.tutorialCompleted ? "level-select" : "board",
        this.progress.snapshot.tutorialCompleted
          ? undefined
          : { mode: PlayMode.TUTORIAL },
      );
    });
    this.standardButton = makeButton(
      this,
      this.endlessAccess.unlocked
        ? (this.english ? "ENDLESS" : "БЕСКОНЕЧНЫЙ РЕЖИМ")
        : `${this.english ? "ENDLESS · LOCKED" : "БЕСКОНЕЧНЫЙ · ЗАКРЫТ"}  ${this.endlessAccess.completedRequiredLevels}/${this.endlessAccess.requiredCompletedLevels}`,
      () => {
        if (!this.endlessAccess.unlocked) {
          const remaining = this.endlessAccess.remainingLevels;
          this.note
            .setText(
              this.english
                ? `ENDLESS UNLOCKS AFTER LEVEL ${this.endlessAccess.unlockLevel + 1}\nCOMPLETE ${remaining} MORE CAMPAIGN LEVELS`
                : `БЕСКОНЕЧНЫЙ РЕЖИМ ОТКРОЕТСЯ ПОСЛЕ УРОВНЯ ${this.endlessAccess.unlockLevel + 1}\n` +
                  `ПРОЙДИТЕ ЕЩЁ ${remaining} ${russianLevelWord(remaining)} КАМПАНИИ`,
            )
            .setColor("#f0d58a");
          return;
        }
        this.scene.start("board", { mode: PlayMode.STANDARD, level: 0 });
      },
    );
    if (!this.endlessAccess.unlocked) this.standardButton.setAlpha(0.55);
    this.shopButton = makeButton(this, this.english ? "SHOP" : "МАГАЗИН", () => {
      this.scene.start("shop", { returnScene: "menu" });
    });
    this.leaderboardButton = makeButton(this, this.english ? "RANKING" : "РЕЙТИНГ", () => {
      this.scene.start("leaderboard");
    }).setIcon(GAMEPLAY_UI_FRAMES.rating, 22);
    this.settingsButton = makeButton(this, this.english ? "SETTINGS" : "НАСТРОЙКИ", () => {
      this.scene.start("settings", { returnScene: "menu" });
    }).setIcon(GAMEPLAY_UI_FRAMES.settings, 22, true);
    this.wallet = makeText(
      this,
      `${this.english ? "DUST" : "ПЫЛЬ"}  ${this.economy.snapshot.dust.toLocaleString("ru-RU")}`,
      13,
      "#795a1e",
    ).setOrigin(1, 0.5);
    this.note = makeText(
      this,
      this.campaignTestMode
        ? `TEST MODE: ALL ${PROGRESSION_LEVEL_COUNT} CAMPAIGN LEVELS UNLOCKED`
        : this.progress.snapshot.campaignCompleted
        ? `${this.english ? "CAMPAIGN SCORE" : "СЧЁТ КАМПАНИИ"} ${this.progress.snapshot.campaignScore.toLocaleString("ru-RU")}`
        : this.english
        ? "CAMPAIGN PROGRESS AND SCORE ARE SAVED ON THIS DEVICE"
        : "ПРОГРЕСС И СЧЁТ СОХРАНЯЮТСЯ НА ЭТОМ УСТРОЙСТВЕ",
      11,
      "#666666",
    ).setOrigin(0.5);

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.layout();
    getYandexGamesAdapter().notifyGameReady();
  }

  layout() {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const compact = width < 520;
    const shortLandscape = isShortLandscape(width, height);
    const header = sceneHeaderMetrics(width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const cardWidth = Math.min(width - 28, shortLandscape ? 760 : 560);
    const cardHeight = Math.min(height - 30, compact ? 590 : 620);
    const cardX = (width - cardWidth) / 2;
    const cardY = (height - cardHeight) / 2;
    const mainWidth = Math.min(cardWidth - 42, 390);
    const secondaryWidth = Math.min((mainWidth - 10) / 2, 190);

    resizeNineSlice(this.background, cardWidth, cardHeight);
    this.background.setPosition(centerX, centerY);

    if (shortLandscape) {
      const leftCenter = cardX + cardWidth * 0.28;
      const rightCenter = cardX + cardWidth * 0.7;
      const landscapeMainWidth = Math.min(330, cardWidth * 0.42);
      const landscapeSecondaryWidth = (landscapeMainWidth - 10) / 2;
      this.title.setFontSize(29).setPosition(leftCenter, cardY + 70);
      this.subtitle.setFontSize(11).setPosition(leftCenter, cardY + 109);
      this.wallet
        .setFontSize(11)
        .setPosition(header.rightX - header.utilitySize / 2 - 10, header.y);
      this.settingsButton
        .setFontSize(18)
        .setText("⚙")
        .setFixedSize(header.utilitySize, header.controlHeight)
        .setPosition(header.rightX, header.y);
      this.note
        .setFontSize(9)
        .setWordWrapWidth(cardWidth * 0.42)
        .setPosition(leftCenter, cardY + cardHeight - 64);
      this.campaignButton.setFixedSize(landscapeMainWidth, 54).setPosition(rightCenter, cardY + 72);
      this.standardButton.setFixedSize(landscapeMainWidth, 54).setPosition(rightCenter, cardY + 138);
      this.shopButton
        .setFontSize(11)
        .setFixedSize(landscapeSecondaryWidth, 48)
        .setPosition(rightCenter - landscapeSecondaryWidth / 2 - 5, cardY + 210);
      this.leaderboardButton
        .setFontSize(11)
        .setFixedSize(landscapeSecondaryWidth, 48)
        .setPosition(rightCenter + landscapeSecondaryWidth / 2 + 5, cardY + 210);
      return;
    }

    this.title
      .setFontSize(compact ? 28 : 34)
      .setFontStyle("bold")
      .setPosition(centerX, cardY + 76);
    this.subtitle.setPosition(centerX, cardY + 116);
    this.wallet
      .setFontSize(compact ? 10 : 12)
      .setPosition(header.rightX - header.utilitySize / 2 - 10, header.y);
    this.settingsButton
      .setFontSize(18)
      .setText("⚙")
      .setFixedSize(header.utilitySize, header.controlHeight)
      .setPosition(header.rightX, header.y);
    this.campaignButton.setFixedSize(mainWidth, 58).setPosition(centerX, cardY + 224);
    this.standardButton.setFixedSize(mainWidth, 58).setPosition(centerX, cardY + 296);
    this.shopButton.setFontSize(12).setFixedSize(secondaryWidth, 50).setPosition(centerX - secondaryWidth / 2 - 5, cardY + 374);
    this.leaderboardButton.setFontSize(12).setFixedSize(secondaryWidth, 50).setPosition(centerX + secondaryWidth / 2 + 5, cardY + 374);
    this.note
      .setFontSize(compact ? 9 : 11)
      .setWordWrapWidth(cardWidth - 38)
      .setPosition(centerX, cardY + cardHeight - 52);
  }
}
