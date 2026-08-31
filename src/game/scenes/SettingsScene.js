import Phaser from "phaser";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { Language } from "../../settings.js";
import { applySettings, getSettings } from "../settings.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import { makeButton, makeText } from "../ui.js";

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("settings");
  }

  preload() {
    preloadPaperBackground(this);
  }

  create(data = {}) {
    this.paperBackground = createPaperBackground(this);
    this.returnScene = ["menu", "level-select"].includes(data.returnScene)
      ? data.returnScene
      : "menu";
    this.settings = getSettings(this);
    this.panel = this.add.graphics();
    this.title = makeText(this, "НАСТРОЙКИ", 28, "#f2efe5").setOrigin(0.5);
    this.languageLabel = makeText(this, "ЯЗЫК", 13, "#93a09a").setOrigin(0.5);
    this.languageButton = makeButton(this, "", () => this.toggleLanguage(), 15);
    this.soundLabel = makeText(this, "ЗВУК", 13, "#93a09a").setOrigin(0.5);
    this.soundButton = makeButton(this, "", () => this.toggleSound(), 15);
    this.note = makeText(
      this,
      "Настройки сохраняются на этом устройстве",
      12,
      "#7f8984",
    ).setOrigin(0.5);
    this.backButton = makeButton(this, "←  НАЗАД", () => this.goBack(), 14);

    this.input.keyboard?.on("keydown-ESC", () => this.goBack());
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.refresh();
    this.layout();
  }

  toggleLanguage() {
    const language =
      this.settings.snapshot.language === Language.RU ? Language.EN : Language.RU;
    applySettings(this, this.settings.setLanguage(language));
    this.refresh();
  }

  toggleSound() {
    applySettings(
      this,
      this.settings.setSoundEnabled(!this.settings.snapshot.soundEnabled),
    );
    this.refresh();
  }

  refresh() {
    const { language, soundEnabled } = this.settings.snapshot;
    const english = language === Language.EN;
    this.title.setText(english ? "SETTINGS" : "НАСТРОЙКИ");
    this.languageLabel.setText(english ? "LANGUAGE" : "ЯЗЫК");
    this.languageButton.setText(english ? "ENGLISH  ›  РУССКИЙ" : "РУССКИЙ  ›  ENGLISH");
    this.soundLabel.setText(english ? "SOUND" : "ЗВУК");
    this.soundButton.setText(
      soundEnabled
        ? english ? "ON  🔊" : "ВКЛЮЧЁН  🔊"
        : english ? "OFF  🔇" : "ВЫКЛЮЧЕН  🔇",
    );
    this.note.setText(
      english
        ? "Settings are saved on this device"
        : "Настройки сохраняются на этом устройстве",
    );
    this.backButton.setText(english ? "←  BACK" : "←  НАЗАД");
  }

  goBack() {
    this.scene.start(this.returnScene);
  }

  layout() {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const compact = width < 560;
    const header = layoutSceneHeader(
      { title: this.title, backButton: this.backButton },
      width,
      height,
    );
    const cardWidth = Math.min(width - 28, 520);
    const cardHeight = Math.min(height - header.contentTop - 14, 350);
    const x = (width - cardWidth) / 2;
    const y = header.contentTop + Math.max(0, (height - header.contentTop - cardHeight) / 2);
    const buttonWidth = Math.min(cardWidth - 40, 360);

    this.panel.clear();
    this.panel.fillStyle(0x1d2421, 1).fillRoundedRect(x, y, cardWidth, cardHeight, 18);
    this.panel.lineStyle(2, 0x53645b, 1).strokeRoundedRect(x, y, cardWidth, cardHeight, 18);
    this.languageLabel.setPosition(width / 2, y + 48);
    this.languageButton.setFixedSize(buttonWidth, 50).setPosition(width / 2, y + 88);
    this.soundLabel.setPosition(width / 2, y + 153);
    this.soundButton.setFixedSize(buttonWidth, 50).setPosition(width / 2, y + 193);
    this.note
      .setFontSize(compact ? 10 : 12)
      .setWordWrapWidth(cardWidth - 32)
      .setPosition(width / 2, y + cardHeight - 40);
  }
}
