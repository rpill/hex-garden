import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getLeaderboard } from "../leaderboard.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import { isShortLandscape } from "../responsive-layout.js";
import { getSettings } from "../settings.js";
import {
  makeButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
} from "../ui.js";

function formatScore(value) {
  return value.toLocaleString("ru-RU");
}

export class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super("leaderboard");
    this.rows = [];
  }

  preload() {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create() {
    this.paperBackground = createPaperBackground(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.progress = getCampaignProgress(this);
    this.leaderboard = getLeaderboard(this);
    this.leaderboard.syncCampaignScore(this.progress.snapshot.campaignScore);
    this.background = makePanel(this, UI_FRAMES.panelMainLarge);
    this.titlePanel = makePanel(this, UI_FRAMES.panelHeader);
    this.title = makeText(this, this.english ? "LEADERBOARD" : "РЕЙТИНГ", 25, "#303632")
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.subtitle = makeText(
      this,
      this.english ? "LOCAL PREVIEW · CAMPAIGN + BEST ENDLESS" : "ЛОКАЛЬНЫЙ ПРОТОТИП · КАМПАНИЯ + ЛУЧШИЙ ENDLESS",
      11,
      "#f5ead0",
    ).setOrigin(0.5);
    this.breakdown = makeText(this, "", 11, "#795a1e").setOrigin(0.5);
    this.backButton = makeButton(this, this.english ? "← BACK" : "← НАЗАД", () => {
      this.scene.start("menu");
    }, 13).setIcon(GAMEPLAY_UI_FRAMES.back, 20);

    const standings = this.leaderboard.standings({
      limit: 10,
      playerName: this.english ? "YOU" : "ВЫ",
    });
    this.rows = standings.entries.map((entry) => ({
      entry,
      background: makePanel(this, entry.isPlayer ? UI_FRAMES.panelSuccess : UI_FRAMES.panelStripSmall),
      rank: makeText(this, String(entry.rank), 12, "#303632").setOrigin(0.5),
      name: makeText(this, entry.name, 13, "#303632").setOrigin(0, 0.5),
      score: makeText(this, formatScore(entry.score), 13, "#795a1e").setOrigin(1, 0.5),
    }));
    this.breakdown.setText(
      this.english
        ? `YOUR SCORE  ${formatScore(standings.profile.totalScore)}   ·   CAMPAIGN ${formatScore(standings.profile.campaignScore)}   ·   ENDLESS ${formatScore(standings.profile.endlessBest)}`
        : `ВАШ СЧЁТ  ${formatScore(standings.profile.totalScore)}   ·   КАМПАНИЯ ${formatScore(standings.profile.campaignScore)}   ·   ENDLESS ${formatScore(standings.profile.endlessBest)}`,
    );

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("menu"));
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.layout();
  }

  layout() {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const shortLandscape = isShortLandscape(width, height);
    const header = layoutSceneHeader(
      { title: this.title, backButton: this.backButton },
      width,
      height,
    );
    resizeNineSlice(this.titlePanel, Math.max(120, Math.min(width - 230, 340)), header.controlHeight + 8);
    this.titlePanel.setPosition(header.titleX, header.y);
    const cardWidth = Math.min(width - 24, 650);
    const cardHeight = Math.min(height - header.contentTop - 10, shortLandscape ? 344 : 650);
    const left = (width - cardWidth) / 2;
    const top = header.contentTop + Math.max(0, (height - header.contentTop - cardHeight) / 2);
    const cardHeaderHeight = shortLandscape ? 42 : 56;
    const footerHeight = shortLandscape ? 64 : 84;
    const tableHeight = cardHeight - cardHeaderHeight - footerHeight;
    const rowHeight = tableHeight / this.rows.length;
    const innerLeft = left + 18;
    const innerWidth = cardWidth - 36;

    resizeNineSlice(this.background, cardWidth, cardHeight);
    this.background.setPosition(width / 2, top + cardHeight / 2);
    this.subtitle
      .setFontSize(shortLandscape ? 9 : 11)
      .setPosition(width / 2, top + cardHeaderHeight / 2);

    this.rows.forEach((row, index) => {
      const y = top + cardHeaderHeight + rowHeight * (index + 0.5);
      resizeNineSlice(row.background, innerWidth, rowHeight * 0.84);
      row.background.setPosition(innerLeft + innerWidth / 2, y);
      row.rank.setFontSize(shortLandscape ? 10 : 12).setPosition(innerLeft + 24, y);
      row.name.setFontSize(shortLandscape ? 11 : 13).setPosition(innerLeft + 50, y);
      row.score.setFontSize(shortLandscape ? 11 : 13).setPosition(innerLeft + innerWidth - 14, y);
    });

    this.breakdown
      .setFontSize(shortLandscape ? 9 : 11)
      .setWordWrapWidth(shortLandscape ? cardWidth - 150 : cardWidth - 36)
      .setPosition(
        shortLandscape ? left + cardWidth * 0.61 : width / 2,
        top + cardHeight - (shortLandscape ? 22 : 54),
      );
  }
}
