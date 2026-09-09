import Phaser from "phaser";
import { Language } from "../../settings.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { ContextMenuOverlay } from "../ContextMenuOverlay.js";
import {
  MINIMAL_UI_COLORS,
  layoutMinimalButton,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "../minimal-ui.js";
import type { UtilityRootSceneKey } from "../presentation-model.js";
import { applySettings, getSettings } from "../settings.js";
import {
  closeUtilityScene,
  exitUtilityToScene,
  switchUtilityScene,
} from "../utility-navigation.js";

const RETURN_SCENES = new Set<UtilityRootSceneKey>(["board", "menu", "level-select"]);

function returnSceneFromData(data: unknown): UtilityRootSceneKey {
  if (typeof data !== "object" || data === null) return "menu";
  const value = (data as { returnScene?: unknown }).returnScene;
  return typeof value === "string" && RETURN_SCENES.has(value as UtilityRootSceneKey)
    ? value as UtilityRootSceneKey
    : "menu";
}

export class SettingsScene extends Phaser.Scene {
  returnScene: UtilityRootSceneKey = "menu";
  settings!: ReturnType<typeof getSettings>;
  title!: Phaser.GameObjects.Text;
  card!: Phaser.GameObjects.Graphics;
  languageLabel!: Phaser.GameObjects.Text;
  languageButton!: MinimalButton;
  soundLabel!: Phaser.GameObjects.Text;
  soundButton!: MinimalButton;
  note!: Phaser.GameObjects.Text;
  backButton!: MinimalButton;
  menuButton!: MinimalButton;
  contextMenu!: ContextMenuOverlay;

  constructor() {
    super("settings");
  }

  create(data: unknown = {}): void {
    this.returnScene = returnSceneFromData(data);
    this.settings = getSettings(this);
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    void getYandexGamesAdapter().showStickyBanner();

    this.title = makeMinimalText(this, "НАСТРОЙКИ", 26)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.card = makeMinimalCard(this, 480, 310);
    this.languageLabel = makeMinimalText(this, "ЯЗЫК", 13, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.languageButton = makeMinimalButton(this, "", () => this.toggleLanguage());
    this.soundLabel = makeMinimalText(this, "ЗВУК", 13, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.soundButton = makeMinimalButton(this, "", () => this.toggleSound());
    this.note = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted).setOrigin(0.5);
    this.backButton = makeMinimalButton(this, "←", () => this.goBack());
    this.menuButton = makeMinimalButton(this, "☰", () => this.openContextMenu()).setDepth(70);
    this.contextMenu = new ContextMenuOverlay(this);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.contextMenu.visible) this.contextMenu.close();
      else this.goBack();
    });
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
    this.languageButton.setLabel(english ? "ENGLISH  ›  РУССКИЙ" : "РУССКИЙ  ›  ENGLISH");
    this.soundLabel.setText(english ? "SOUND" : "ЗВУК");
    this.soundButton.setLabel(
      soundEnabled
        ? english ? "ON  🔊" : "ВКЛЮЧЁН  🔊"
        : english ? "OFF  🔇" : "ВЫКЛЮЧЕН  🔇",
    );
    this.note.setText(
      english
        ? "Settings are saved on this device"
        : "Настройки сохраняются на этом устройстве",
    );
  }

  openContextMenu(): void {
    const english = this.settings.snapshot.language === Language.EN;
    this.contextMenu.open({
      title: english ? "MENU" : "МЕНЮ",
      items: [
        {
          id: "rules",
          label: english ? "RULES" : "ПРАВИЛА",
          onSelect: () => switchUtilityScene(this, "rules", { returnScene: this.returnScene }),
        },
        {
          id: "home",
          label: english ? "MAIN MENU" : "ГЛАВНОЕ МЕНЮ",
          onSelect: () => exitUtilityToScene(this, "menu", { returnScene: this.returnScene }),
        },
      ],
    });
  }

  goBack(): void {
    closeUtilityScene(this, this.returnScene);
  }

  layout(): void {
    const { width, height } = this.scale;
    const compact = width < 560;
    const shortLandscape = height < 520 && width > height;
    const headerY = shortLandscape ? 27 : 34;
    const controlSize = shortLandscape ? 36 : 42;
    const cardWidth = Math.min(width - (compact ? 20 : 32), 500);
    const cardHeight = Math.min(height - (shortLandscape ? 82 : 116), shortLandscape ? 280 : 330);
    const cardCenterY = shortLandscape
      ? 56 + cardHeight / 2
      : 76 + Math.max(0, (height - 76 - cardHeight) / 2) + cardHeight / 2;
    const cardTop = cardCenterY - cardHeight / 2;
    const buttonWidth = Math.min(cardWidth - 44, 360);
    const buttonHeight = shortLandscape ? 42 : 48;

    this.title
      .setFontSize(compact ? 20 : 24)
      .setPosition(width / 2, headerY);
    layoutMinimalButton(this.backButton, 14 + controlSize / 2, headerY, controlSize, controlSize);
    layoutMinimalButton(this.menuButton, width - 14 - controlSize / 2, headerY, controlSize, controlSize);
    this.backButton.label.setFontSize(shortLandscape ? 16 : 18);
    this.menuButton.label.setFontSize(shortLandscape ? 16 : 18);

    this.card
      .setPosition(width / 2, cardCenterY)
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.98)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14)
      .lineStyle(1, MINIMAL_UI_COLORS.border, 1)
      .strokeRoundedRect(-cardWidth / 2 + 0.5, -cardHeight / 2 + 0.5, cardWidth - 1, cardHeight - 1, 14);

    const languageLabelY = cardTop + (shortLandscape ? 44 : 58);
    const languageButtonY = languageLabelY + (shortLandscape ? 34 : 40);
    const soundLabelY = languageButtonY + (shortLandscape ? 58 : 72);
    const soundButtonY = soundLabelY + (shortLandscape ? 34 : 40);

    this.languageLabel.setPosition(width / 2, languageLabelY);
    layoutMinimalButton(this.languageButton, width / 2, languageButtonY, buttonWidth, buttonHeight);
    this.soundLabel.setPosition(width / 2, soundLabelY);
    layoutMinimalButton(this.soundButton, width / 2, soundButtonY, buttonWidth, buttonHeight);
    this.languageButton.label.setFontSize(shortLandscape ? 12 : 14);
    this.soundButton.label.setFontSize(shortLandscape ? 12 : 14);
    this.note
      .setFontSize(compact || shortLandscape ? 10 : 12)
      .setWordWrapWidth(cardWidth - 40)
      .setPosition(width / 2, cardTop + cardHeight - (shortLandscape ? 26 : 42));

    this.contextMenu.layout(width, height);
  }
}
