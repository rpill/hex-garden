import Phaser from "phaser";
import { standardEndlessAccess } from "../../mode-access.js";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { isCampaignTestMode } from "../campaign-test-mode.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEconomy } from "../economy.js";
import { PlayMode } from "../modes.js";
import { makeButton, makeText } from "../ui.js";

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

  create() {
    this.campaignTestMode = isCampaignTestMode();
    this.progress = getCampaignProgress(this);
    this.economy = getEconomy(this);
    this.endlessAccess = standardEndlessAccess(this.progress.snapshot, {
      unlockAll: this.progress.testMode,
    });
    this.title = makeText(this, "HEX GARDEN", 30, "#ededed").setOrigin(0.5);
    this.subtitle = makeText(
      this,
      "SELECT MODE",
      14,
      "#8f8f8f",
    ).setOrigin(0.5);
    this.campaignButton = makeButton(this, "CAMPAIGN", () => {
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
        ? "ENDLESS"
        : `ENDLESS  /  LOCKED  ${this.endlessAccess.completedRequiredLevels}/${this.endlessAccess.requiredCompletedLevels}`,
      () => {
        if (!this.endlessAccess.unlocked) {
          const remaining = this.endlessAccess.remainingLevels;
          this.note
            .setText(
              `БЕСКОНЕЧНЫЙ РЕЖИМ ОТКРОЕТСЯ ПОСЛЕ УРОВНЯ ${this.endlessAccess.unlockLevel + 1}\n` +
                `ПРОЙДИТЕ ЕЩЁ ${remaining} ${russianLevelWord(remaining)} КАМПАНИИ`,
            )
            .setColor("#f0d58a");
          return;
        }
        this.scene.start("board", { mode: PlayMode.STANDARD, level: 0 });
      },
    );
    if (!this.endlessAccess.unlocked) this.standardButton.setAlpha(0.55);
    this.shopButton = makeButton(this, "МАГАЗИН", () => {
      this.scene.start("shop", { returnScene: "menu" });
    });
    this.wallet = makeText(
      this,
      `ПЫЛЬ  ${this.economy.snapshot.dust.toLocaleString("ru-RU")}`,
      13,
      "#f0d58a",
    ).setOrigin(0.5);
    this.note = makeText(
      this,
      this.campaignTestMode
        ? `TEST MODE: ALL ${PROGRESSION_LEVEL_COUNT} CAMPAIGN LEVELS UNLOCKED`
        : this.progress.snapshot.campaignCompleted
        ? `CAMPAIGN SCORE ${this.progress.snapshot.campaignScore.toLocaleString("ru-RU")}`
        : "CAMPAIGN PROGRESS AND SCORE ARE SAVED ON THIS DEVICE",
      11,
      "#666666",
    ).setOrigin(0.5);

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.layout();
  }

  layout() {
    const { width, height } = this.scale;
    const compact = width < 520;
    const centerX = width / 2;
    const centerY = height / 2;

    this.title
      .setFontSize(compact ? 24 : 30)
      .setPosition(centerX, Math.max(54, centerY - 145));
    this.subtitle.setPosition(centerX, Math.max(90, centerY - 98));
    this.wallet.setPosition(centerX, Math.max(116, centerY - 70));
    this.campaignButton.setPosition(centerX, centerY - 28);
    this.standardButton.setPosition(centerX, centerY + 34);
    this.shopButton.setPosition(centerX, centerY + 96);
    this.note
      .setFontSize(compact ? 9 : 11)
      .setWordWrapWidth(Math.max(240, width - 28))
      .setPosition(centerX, Math.min(height - 28, centerY + 158));
  }
}
