import Phaser from "phaser";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { PlayMode } from "../modes.js";
import { makeButton, makeText, setButtonEnabled } from "../ui.js";

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super("level-select");
    this.levelButtons = [];
  }

  create() {
    this.progress = getCampaignProgress(this);
    this.title = makeText(this, "CAMPAIGN", 24, "#ededed").setOrigin(0.5);
    this.summary = makeText(this, "", 12, "#8f8f8f").setOrigin(0.5);
    this.backButton = makeButton(this, "< MENU", () => {
      this.scene.start("menu");
    }, 14);

    this.levelButtons = Array.from(
      { length: PROGRESSION_LEVEL_COUNT },
      (_, level) => {
        const button = makeButton(
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
    this.summary.setText(
      snapshot.campaignCompleted
        ? "CAMPAIGN COMPLETE"
        : `COMPLETED ${snapshot.completedLevels.length}/${PROGRESSION_LEVEL_COUNT}`,
    );

    for (const { level, button } of this.levelButtons) {
      const completed = this.progress.isCompleted(level);
      const unlocked = this.progress.isUnlocked(level);
      const state = completed ? "DONE" : unlocked ? "PLAY" : "LOCK";
      button.setText(
        `${String(level + 1).padStart(2, "0")}\n${state}`,
      );
      button.setColor(
        completed ? "#a9c6a1" : unlocked ? "#f0d58a" : "#777777",
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
    const columns = width < 520 ? 5 : 10;
    const rows = Math.ceil(PROGRESSION_LEVEL_COUNT / columns);
    const availableWidth = Math.max(240, width - 20);
    const cellWidth = Math.min(76, availableWidth / columns);
    const availableHeight = Math.max(180, height - 142);
    const stepY = Math.min(54, availableHeight / rows);
    const cellHeight = Math.max(28, stepY - 6);
    const gridWidth = cellWidth * columns;
    const gridHeight = stepY * rows;
    const left = (width - gridWidth) / 2;
    const top = 76 + Math.max(0, (availableHeight - gridHeight) / 2);

    this.title
      .setFontSize(width < 520 ? 19 : 24)
      .setPosition(width / 2, 24);
    this.summary.setPosition(width / 2, 52);
    this.backButton.setPosition(58, height - 24);

    for (const { level, button } of this.levelButtons) {
      const column = level % columns;
      const row = Math.floor(level / columns);
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
