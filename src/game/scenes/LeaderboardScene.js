import Phaser from "phaser";
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
import { makeButton, makeText } from "../ui.js";

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
  }

  create() {
    this.paperBackground = createPaperBackground(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.progress = getCampaignProgress(this);
    this.leaderboard = getLeaderboard(this);
    this.leaderboard.syncCampaignScore(this.progress.snapshot.campaignScore);
    this.background = this.add.graphics();
    this.title = makeText(this, this.english ? "LEADERBOARD" : "РЕЙТИНГ", 25, "#f2efe5")
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.subtitle = makeText(
      this,
      this.english ? "LOCAL PREVIEW · CAMPAIGN + BEST ENDLESS" : "ЛОКАЛЬНЫЙ ПРОТОТИП · КАМПАНИЯ + ЛУЧШИЙ ENDLESS",
      11,
      "#9fb2a7",
    ).setOrigin(0.5);
    this.breakdown = makeText(this, "", 11, "#f0d58a").setOrigin(0.5);
    this.backButton = makeButton(this, this.english ? "← BACK" : "← НАЗАД", () => {
      this.scene.start("menu");
    }, 13);

    const standings = this.leaderboard.standings({
      limit: 10,
      playerName: this.english ? "YOU" : "ВЫ",
    });
    this.rows = standings.entries.map((entry) => ({
      entry,
      background: this.add.graphics(),
      rank: makeText(this, String(entry.rank), 12, entry.isPlayer ? "#101713" : "#aebbb4").setOrigin(0.5),
      name: makeText(this, entry.name, 13, entry.isPlayer ? "#101713" : "#edf2ee").setOrigin(0, 0.5),
      score: makeText(this, formatScore(entry.score), 13, entry.isPlayer ? "#101713" : "#f0d58a").setOrigin(1, 0.5),
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

    this.background.clear();
    this.background.fillStyle(0x17201c, 1).fillRoundedRect(left, top, cardWidth, cardHeight, 18);
    this.background.lineStyle(2, 0x43564b, 1).strokeRoundedRect(left, top, cardWidth, cardHeight, 18);
    this.subtitle
      .setFontSize(shortLandscape ? 9 : 11)
      .setPosition(width / 2, top + cardHeaderHeight / 2);

    this.rows.forEach((row, index) => {
      const y = top + cardHeaderHeight + rowHeight * (index + 0.5);
      row.background.clear();
      row.background.fillStyle(row.entry.isPlayer ? 0xf0d58a : index % 2 === 0 ? 0x202c26 : 0x1b2520, 1);
      row.background.fillRoundedRect(innerLeft, y - rowHeight * 0.42, innerWidth, rowHeight * 0.84, 7);
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
