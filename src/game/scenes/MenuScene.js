import Phaser from "phaser";
import { PlayMode } from "../modes.js";
import { makeButton, makeText } from "../ui.js";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create() {
    this.title = makeText(this, "HEX GARDEN", 30, "#ededed").setOrigin(0.5);
    this.subtitle = makeText(
      this,
      "SELECT MODE",
      14,
      "#8f8f8f",
    ).setOrigin(0.5);
    this.campaignButton = makeButton(this, "CAMPAIGN", () => {
      this.scene.start("level-select");
    });
    this.standardButton = makeButton(this, "STANDARD  /  ENDLESS", () => {
      this.scene.start("board", { mode: PlayMode.STANDARD, level: 0 });
    });
    this.quintessenceButton = makeButton(
      this,
      "Q MODE  /  ENDLESS",
      () => {
        this.scene.start("board", {
          mode: PlayMode.QUINTESSENCE,
          level: 0,
        });
      },
    );
    this.note = makeText(
      this,
      "CAMPAIGN PROGRESS IS SAVED ON THIS DEVICE",
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
    this.campaignButton.setPosition(centerX, centerY - 30);
    this.standardButton.setPosition(centerX, centerY + 28);
    this.quintessenceButton.setPosition(centerX, centerY + 86);
    this.note
      .setFontSize(compact ? 9 : 11)
      .setPosition(centerX, Math.min(height - 24, centerY + 156));
  }
}
