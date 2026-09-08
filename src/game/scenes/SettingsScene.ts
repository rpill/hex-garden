import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { Language } from "../../settings.js";
import { applySettings, getSettings } from "../settings.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import { closeUtilityScene } from "../utility-navigation.js";
import type { UtilitySceneKey } from "../presentation-model.js";
import {
  makeButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
} from "../ui.js";


const RETURN_SCENES = new Set<UtilitySceneKey>(["board", "menu", "level-select", "leaderboard"]);
function returnSceneFromData(data: unknown): UtilitySceneKey {
  if (typeof data !== "object" || data === null) return "menu";
  const value = (data as { returnScene?: unknown }).returnScene;
  return typeof value === "string" && RETURN_SCENES.has(value as UtilitySceneKey) ? value as UtilitySceneKey : "menu";
}

export class SettingsScene extends Phaser.Scene {
  paperBackground!: ReturnType<typeof createPaperBackground>;
  returnScene: UtilitySceneKey = "menu";
  settings!: ReturnType<typeof getSettings>;
  panel!: ReturnType<typeof makePanel>;
  titlePanel!: ReturnType<typeof makePanel>;
  title!: Phaser.GameObjects.Text;
  languageLabel!: Phaser.GameObjects.Text;
  languageButton!: ReturnType<typeof makeButton>;
  soundLabel!: Phaser.GameObjects.Text;
  soundButton!: ReturnType<typeof makeButton>;
  note!: Phaser.GameObjects.Text;
  backButton!: ReturnType<typeof makeButton>;
  constructor() {
    super("settings");
  }

  preload(): void {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create(data: unknown = {}): void {
    this.paperBackground = createPaperBackground(this);
    this.returnScene = returnSceneFromData(data);
    this.settings = getSettings(this);
    this.panel = makePanel(this, UI_FRAMES.panelMainMedium);
    this.titlePanel = makePanel(this, UI_FRAMES.panelHeader).setVisible(false);
    this.title = makeText(this, "НАСТРОЙКИ", 28, "#eef3f8").setOrigin(0.5);
    this.languageLabel = makeText(this, "ЯЗЫК", 13, "#eef3f8").setOrigin(0.5);
    this.languageButton = makeButton(this, "", () => this.toggleLanguage(), 15);
    this.soundLabel = makeText(this, "ЗВУК", 13, "#9aa7b5").setOrigin(0.5);
    this.soundButton = makeButton(this, "", () => this.toggleSound(), 15);
    this.note = makeText(
      this,
      "Настройки сохраняются на этом устройстве",
      12,
      "#9aa7b5",
    ).setOrigin(0.5);
    this.backButton = makeButton(this, "НАЗАД", () => this.goBack(), 14)
      .setIcon(GAMEPLAY_UI_FRAMES.back, 22);
    this.input.keyboard?.on("keydown-ESC", () => this.goBack());
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.refresh();
    this.layout();
  }

  toggleLanguage(): void {
    const language =
      this.settings.snapshot.language === Language.RU ? Language.EN : Language.RU;
    applySettings(this, this.settings.setLanguage(language));
    this.refresh();
  }

  toggleSound(): void {
    applySettings(
      this,
      this.settings.setSoundEnabled(!this.settings.snapshot.soundEnabled),
    );
    this.refresh();
  }

  refresh(): void {
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
    this.backButton.setText(english ? "BACK" : "НАЗАД");
  }


  goBack(): void {
    closeUtilityScene(this, this.returnScene);
  }

  layout(): void {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const compact = width < 560;
    const header = layoutSceneHeader(
      {
        title: this.title,
        backButton: this.backButton,
        utilityButtons: [],
      },
      width,
      height,
    );
    this.titlePanel.setVisible(false);
    const cardWidth = Math.min(width - 28, 520);
    const cardHeight = Math.min(height - header.contentTop - 14, 350);
    const x = (width - cardWidth) / 2;
    const y = header.contentTop + Math.max(0, (height - header.contentTop - cardHeight) / 2);
    const buttonWidth = Math.min(cardWidth - 40, 360);

    resizeNineSlice(this.panel, cardWidth, cardHeight);
    this.panel.setPosition(width / 2, y + cardHeight / 2);
    this.languageLabel.setPosition(width / 2, y + 70);
    this.languageButton.setFixedSize(buttonWidth, 50).setPosition(width / 2, y + 105);
    this.soundLabel.setPosition(width / 2, y + 153);
    this.soundButton.setFixedSize(buttonWidth, 50).setPosition(width / 2, y + 193);
    this.note
      .setFontSize(compact ? 10 : 12)
      .setWordWrapWidth(cardWidth - 32)
      .setPosition(width / 2, y + cardHeight - 70);
  }
}
