import Phaser from "phaser";
import { Language } from "../../settings.js";
import { applySettings, getSettings } from "../settings.js";
import { makeButton, makeText } from "../ui.js";

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("settings");
  }

  create(data = {}) {
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
    const compact = width < 560;
    const cardWidth = Math.min(width - 28, 520);
    const cardHeight = Math.min(height - 36, 430);
    const x = (width - cardWidth) / 2;
    const y = (height - cardHeight) / 2;
    const buttonWidth = Math.min(cardWidth - 40, 360);

    this.panel.clear();
    this.panel.fillStyle(0x1d2421, 1).fillRoundedRect(x, y, cardWidth, cardHeight, 18);
    this.panel.lineStyle(2, 0x53645b, 1).strokeRoundedRect(x, y, cardWidth, cardHeight, 18);
    this.title.setFontSize(compact ? 23 : 28).setPosition(width / 2, y + 48);
    this.languageLabel.setPosition(width / 2, y + 105);
    this.languageButton.setFixedSize(buttonWidth, 50).setPosition(width / 2, y + 145);
    this.soundLabel.setPosition(width / 2, y + 210);
    this.soundButton.setFixedSize(buttonWidth, 50).setPosition(width / 2, y + 250);
    this.note
      .setFontSize(compact ? 10 : 12)
      .setWordWrapWidth(cardWidth - 32)
      .setPosition(width / 2, y + 310);
    this.backButton.setFixedSize(Math.min(220, cardWidth - 40), 46).setPosition(width / 2, y + cardHeight - 42);
  }
}
