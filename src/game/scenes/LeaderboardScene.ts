import Phaser from "phaser";
import type { EndlessLeaderboardView } from "../../endless-leaderboard.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { ContextMenuOverlay } from "../ContextMenuOverlay.js";
import { getEndlessLeaderboard } from "../endless-leaderboard.js";
import { getEndlessProgress } from "../endless-progress.js";
import {
  MINIMAL_UI_COLORS,
  layoutMinimalButton,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "../minimal-ui.js";
import { getSettings } from "../settings.js";
import { openUtilityScene } from "../utility-navigation.js";

export class LeaderboardScene extends Phaser.Scene {
  leaderboard!: ReturnType<typeof getEndlessLeaderboard>;
  endlessProgress!: ReturnType<typeof getEndlessProgress>;
  english = false;
  view: EndlessLeaderboardView | null = null;
  loading = true;
  requestGeneration = 0;
  pageIndex = 0;

  title!: Phaser.GameObjects.Text;
  card!: Phaser.GameObjects.Graphics;
  statusText!: Phaser.GameObjects.Text;
  rowTexts: Phaser.GameObjects.Text[] = [];
  localBestText!: Phaser.GameObjects.Text;
  playerText!: Phaser.GameObjects.Text;
  guestExplanation!: Phaser.GameObjects.Text;
  signInButton!: MinimalButton;
  retryButton!: MinimalButton;
  previousPageButton!: MinimalButton;
  nextPageButton!: MinimalButton;
  pageText!: Phaser.GameObjects.Text;
  menuButton!: MinimalButton;
  contextMenu!: ContextMenuOverlay;

  constructor() {
    super("leaderboard");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    void getYandexGamesAdapter().showStickyBanner();
    this.leaderboard = getEndlessLeaderboard(this);
    this.endlessProgress = getEndlessProgress(this);
    this.english = getSettings(this).snapshot.language === "en";

    this.title = makeMinimalText(
      this,
      this.english ? "ENDLESS · CLEAN LEADERBOARD" : "ENDLESS · ЧИСТЫЙ РЕЙТИНГ",
      25,
    ).setOrigin(0.5).setFontStyle("bold");
    this.card = makeMinimalCard(this, 640, 560);
    this.statusText = makeMinimalText(this, "", 13, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.rowTexts = Array.from({ length: 10 }, () =>
      makeMinimalText(this, "", 13).setOrigin(0, 0.5),
    );
    this.localBestText = makeMinimalText(this, "", 13, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.playerText = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5);
    this.guestExplanation = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setAlign("center");
    this.signInButton = makeMinimalButton(
      this,
      this.english ? "SIGN IN TO YANDEX" : "ВОЙТИ В ЯНДЕКС",
      () => void this.signIn(),
    );
    this.retryButton = makeMinimalButton(
      this,
      this.english ? "RETRY" : "ПОВТОРИТЬ",
      () => void this.loadLeaderboard(),
    );
    this.previousPageButton = makeMinimalButton(this, "‹", () => this.changePage(-1));
    this.nextPageButton = makeMinimalButton(this, "›", () => this.changePage(1));
    this.pageText = makeMinimalText(this, "", 11, MINIMAL_UI_COLORS.textMuted).setOrigin(0.5);
    this.menuButton = makeMinimalButton(this, "☰", () => this.openContextMenu()).setDepth(70);
    this.contextMenu = new ContextMenuOverlay(this);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.contextMenu.visible) this.contextMenu.close();
      else this.scene.start("menu");
    });
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.requestGeneration += 1;
      this.scale.off("resize", this.layout, this);
    });

    this.renderState();
    this.layout();
    void this.loadLeaderboard();
  }

  private uiText(russian: string, english: string): string {
    return this.english ? english : russian;
  }

  private async loadLeaderboard(): Promise<void> {
    const generation = ++this.requestGeneration;
    this.loading = true;
    this.setBusy(true);
    this.renderState();
    this.layout();
    const nextView = await this.leaderboard.load();
    if (generation !== this.requestGeneration) return;
    this.view = nextView;
    this.loading = false;
    this.pageIndex = 0;
    this.setBusy(false);
    this.renderState();
    this.layout();
  }

  async signIn(): Promise<void> {
    if (this.loading) return;
    const generation = ++this.requestGeneration;
    this.loading = true;
    this.setBusy(true);
    this.renderState();
    this.layout();
    const nextView = await this.leaderboard.authorizeAndSync(
      this.endlessProgress.snapshot.bestUnassistedBoards,
    );
    if (generation !== this.requestGeneration) return;
    this.view = nextView;
    this.loading = false;
    this.pageIndex = 0;
    this.setBusy(false);
    this.renderState();
    this.layout();
  }

  private setBusy(busy: boolean): void {
    this.signInButton?.setEnabled(!busy);
    this.retryButton?.setEnabled(!busy);
  }

  private changePage(delta: number): void {
    const pageSize = this.currentPageSize();
    const total = this.view?.top.length ?? 0;
    const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
    this.pageIndex = Math.max(0, Math.min(maxPage, this.pageIndex + delta));
    this.renderState();
    this.layout();
  }

  private currentPageSize(): number {
    const { width, height } = this.scale;
    return height < 520 && width > height ? 6 : 10;
  }

  private renderState(): void {
    const localBest = this.endlessProgress?.snapshot.bestUnassistedBoards ?? 0;
    this.localBestText?.setText(
      this.uiText(
        `ТВОЙ ЛУЧШИЙ ЧИСТЫЙ РЕЗУЛЬТАТ: ${localBest}`,
        `YOUR BEST CLEAN RESULT: ${localBest}`,
      ),
    );

    for (const row of this.rowTexts) row.setVisible(false);
    this.playerText?.setVisible(false);
    this.guestExplanation?.setVisible(false);
    this.signInButton?.setVisible(false);
    this.retryButton?.setVisible(false);
    this.previousPageButton?.setVisible(false);
    this.nextPageButton?.setVisible(false);
    this.pageText?.setVisible(false);

    if (this.loading || !this.view) {
      this.statusText?.setText(this.uiText("ЗАГРУЗКА…", "LOADING…")).setVisible(true);
      return;
    }

    const view = this.view;
    if (view.status === "unavailable") {
      this.statusText
        .setText(this.uiText("РЕЙТИНГ ВРЕМЕННО НЕДОСТУПЕН", "LEADERBOARD TEMPORARILY UNAVAILABLE"))
        .setVisible(true);
      this.retryButton.setVisible(true);
      return;
    }

    if (view.top.length === 0) {
      this.statusText
        .setText(this.uiText("ПОКА НЕТ РЕЗУЛЬТАТОВ", "NO RESULTS YET"))
        .setVisible(true);
    } else {
      this.statusText.setText(this.uiText("МИРОВОЙ ТОП", "WORLD TOP")).setVisible(true);
      const pageSize = this.currentPageSize();
      const start = this.pageIndex * pageSize;
      const visibleEntries = view.top.slice(start, start + pageSize);
      visibleEntries.forEach((entry, index) => {
        const publicName = entry.publicName;
        const name = publicName.trim() || (this.english ? "PLAYER" : "ИГРОК");
        this.rowTexts[index]
          ?.setText(`${entry.rank}.   ${name}   ·   ${entry.score}`)
          .setVisible(true);
      });
      const pageCount = Math.max(1, Math.ceil(view.top.length / pageSize));
      if (pageCount > 1) {
        this.pageText.setText(`${this.pageIndex + 1} / ${pageCount}`).setVisible(true);
        this.previousPageButton.setVisible(true).setEnabled(this.pageIndex > 0);
        this.nextPageButton.setVisible(true).setEnabled(this.pageIndex < pageCount - 1);
      }
    }

    if (view.authorized) {
      this.playerText
        .setText(
          view.player
            ? this.uiText(
                `ТВОЁ МЕСТО: ${view.player.rank} · ${view.player.score} ПОЛЕЙ`,
                `YOUR PLACE: ${view.player.rank} · ${view.player.score} BOARDS`,
              )
            : this.uiText("ТВОЁ МЕСТО: —", "YOUR PLACE: —"),
        )
        .setVisible(true);
    } else {
      this.guestExplanation
        .setText(
          this.uiText(
            "Войди в Яндекс, чтобы отправить чистый рекорд и участвовать в рейтинге.",
            "Sign in to Yandex to submit your clean record and participate in the leaderboard.",
          ),
        )
        .setVisible(true);
      this.signInButton.setVisible(true);
    }
  }

  private openContextMenu(): void {
    this.contextMenu.open({
      title: this.uiText("МЕНЮ", "MENU"),
      items: [
        {
          id: "rules",
          label: this.uiText("ПРАВИЛА", "RULES"),
          onSelect: () => openUtilityScene(this, "rules", { returnScene: "leaderboard" }),
        },
        {
          id: "settings",
          label: this.uiText("НАСТРОЙКИ", "SETTINGS"),
          onSelect: () => openUtilityScene(this, "settings", { returnScene: "leaderboard" }),
        },
        {
          id: "home",
          label: this.uiText("ГЛАВНОЕ МЕНЮ", "MAIN MENU"),
          onSelect: () => this.scene.start("menu"),
        },
      ],
    });
  }

  layout(): void {
    const { width, height } = this.scale;
    const compact = width < 560;
    const shortLandscape = height < 520 && width > height;
    const controlSize = shortLandscape ? 36 : 42;
    const headerY = shortLandscape ? 27 : 34;
    const cardWidth = Math.min(width - (compact ? 20 : 32), 640);
    const cardHeight = Math.min(
      height - (shortLandscape ? 68 : 94),
      shortLandscape ? 310 : 590,
    );
    const cardCenterY = headerY + (height - headerY) / 2 + (shortLandscape ? 4 : 10);
    const cardTop = cardCenterY - cardHeight / 2;
    const cardBottom = cardCenterY + cardHeight / 2;
    const innerWidth = cardWidth - (compact ? 28 : 52);
    const pageSize = this.currentPageSize();
    const rowsTop = cardTop + (shortLandscape ? 47 : 60);
    const reservedBottom = shortLandscape ? 120 : 150;
    const availableRows = Math.max(80, cardHeight - (rowsTop - cardTop) - reservedBottom);
    const rowStep = Math.min(shortLandscape ? 23 : 28, availableRows / Math.max(1, pageSize));

    this.title
      .setFontSize(compact || shortLandscape ? 19 : 25)
      .setPosition(width / 2, headerY);
    layoutMinimalButton(
      this.menuButton,
      width - 14 - controlSize / 2,
      headerY,
      controlSize,
      controlSize,
    );
    this.menuButton.label.setFontSize(shortLandscape ? 16 : 18);

    this.card
      .setPosition(width / 2, cardCenterY)
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.98)
      .fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14)
      .lineStyle(1, MINIMAL_UI_COLORS.border, 1)
      .strokeRoundedRect(-cardWidth / 2 + 0.5, -cardHeight / 2 + 0.5, cardWidth - 1, cardHeight - 1, 14);

    this.statusText
      .setFontSize(shortLandscape ? 11 : 13)
      .setPosition(width / 2, cardTop + (shortLandscape ? 24 : 31));

    this.rowTexts.forEach((row, index) => {
      row
        .setFontSize(shortLandscape ? 10 : compact ? 11 : 13)
        .setFixedSize(innerWidth, 0)
        .setPosition(width / 2 - innerWidth / 2, rowsTop + index * rowStep);
    });

    const pageY = rowsTop + pageSize * rowStep + (shortLandscape ? 2 : 6);
    const pageButtonSize = shortLandscape ? 30 : 34;
    layoutMinimalButton(this.previousPageButton, width / 2 - 54, pageY, pageButtonSize, pageButtonSize);
    layoutMinimalButton(this.nextPageButton, width / 2 + 54, pageY, pageButtonSize, pageButtonSize);
    this.pageText.setPosition(width / 2, pageY);

    const localY = cardBottom - (shortLandscape ? 91 : 116);
    this.localBestText
      .setFontSize(shortLandscape ? 10 : compact ? 11 : 13)
      .setPosition(width / 2, localY);
    this.playerText
      .setFontSize(shortLandscape ? 9 : 12)
      .setPosition(width / 2, localY + (shortLandscape ? 20 : 25));
    this.guestExplanation
      .setFontSize(shortLandscape ? 9 : compact ? 10 : 12)
      .setWordWrapWidth(Math.max(180, innerWidth - 12))
      .setPosition(width / 2, localY + (shortLandscape ? 21 : 27));

    const actionY = cardBottom - (shortLandscape ? 26 : 34);
    const actionWidth = Math.min(innerWidth, 330);
    const actionHeight = shortLandscape ? 34 : 42;
    layoutMinimalButton(this.signInButton, width / 2, actionY, actionWidth, actionHeight);
    layoutMinimalButton(this.retryButton, width / 2, actionY, actionWidth, actionHeight);
    this.signInButton.label.setFontSize(shortLandscape ? 10 : 12);
    this.retryButton.label.setFontSize(shortLandscape ? 10 : 12);
    this.contextMenu.layout(width, height);
  }
}
