import Phaser from "phaser";
import {
  GAMEPLAY_UI_FRAMES,
  UI_FRAMES,
} from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { HINT_PRODUCTS } from "../../economy.js";
import { getEconomy } from "../economy.js";
import { getSettings } from "../settings.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import {
  makeButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
} from "../ui.js";

function formatDust(value) {
  return value.toLocaleString("ru-RU");
}

export class ShopScene extends Phaser.Scene {
  constructor() {
    super("shop");
    this.productViews = [];
  }

  preload() {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create(data = {}) {
    this.paperBackground = createPaperBackground(this);
    this.returnScene = data.returnScene === "level-select" ? "level-select" : "menu";
    this.economy = getEconomy(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.titlePanel = makePanel(this, UI_FRAMES.panelHeader);
    this.title = makeText(this, this.english ? "SHOP" : "МАГАЗИН", 26, "#eef3f8").setOrigin(0.5);
    this.balancePanel = makePanel(this, UI_FRAMES.panelStripWithIcon);
    this.balanceIcon = this.add.image(0, 0, GAMEPLAY_UI_FRAMES.dust);
    this.balance = makeText(this, "", 16, "#f3c94f").setOrigin(1, 0.5);
    this.subtitle = makeText(
      this,
      this.english ? "BOOSTERS ARE PURCHASED IN ADVANCE AND STORED IN YOUR INVENTORY" : "ПОДСКАЗКИ ПОКУПАЮТСЯ ЗАРАНЕЕ И ХРАНЯТСЯ В ИНВЕНТАРЕ",
      11,
      "#9aa7b5",
    ).setOrigin(0.5);
    this.message = makeText(this, "", 12, "#77dc91").setOrigin(0.5);
    this.backButton = makeButton(this, this.english ? "←  BACK" : "←  НАЗАД", () => {
      this.scene.start(this.returnScene);
    }, 14).setIcon(GAMEPLAY_UI_FRAMES.back, 20);

    this.productViews = HINT_PRODUCTS.map((product) => {
      const panel = makePanel(this, UI_FRAMES.panelMainMedium);
      const title = makeText(this, this.english ? product.titleEn : product.title, 18, "#eef3f8").setOrigin(0.5);
      const description = makeText(
        this,
        this.english ? product.descriptionEn : product.description,
        11,
        "#9aa7b5",
      ).setOrigin(0.5);
      const owned = makeText(this, "", 12, "#77dc91").setOrigin(0.5);
      const buy = makeButton(
        this,
        `${this.english ? "BUY" : "КУПИТЬ"} ×${product.amount}  /  ${product.price} ${this.english ? "DUST" : "ПЫЛИ"}`,
        () => this.purchase(product),
        13,
      );
      return { product, panel, title, description, owned, buy };
    });

    this.input.keyboard?.on("keydown-ESC", () => this.scene.start(this.returnScene));
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.refresh();
    this.layout();
  }

  purchase(product) {
    const result = this.economy.purchase(product.id);
    this.message
      .setText(
        result.ok
          ? `${this.english ? product.titleEn : product.title}: +${product.amount}`
          : this.english
          ? `NEED ${product.price - result.snapshot.dust} MORE DUST`
          : `НЕ ХВАТАЕТ ${product.price - result.snapshot.dust} ПЫЛИ`,
      )
      .setColor(result.ok ? "#77dc91" : "#ff6b67");
    this.refresh();
  }

  refresh() {
    const snapshot = this.economy.snapshot;
    this.balance.setText(`${this.english ? "DUST" : "ПЫЛЬ"}  ${formatDust(snapshot.dust)}`);
    for (const view of this.productViews) {
      view.owned.setText(`${this.english ? "OWNED" : "В ИНВЕНТАРЕ"}: ${snapshot.hints[view.product.hint]}`);
      view.buy.setAlpha(snapshot.dust >= view.product.price ? 1 : 0.62);
    }
  }

  layout() {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const compact = width < 520;
    const shortLandscape = height < 520 && width >= 620;
    const centerX = width / 2;
    const header = layoutSceneHeader(
      { title: this.title, backButton: this.backButton },
      width,
      height,
    );
    resizeNineSlice(this.titlePanel, Math.max(120, Math.min(width - 230, 320)), header.controlHeight + 8);
    this.titlePanel.setPosition(header.titleX, header.y);
    resizeNineSlice(this.balancePanel, 150, 46);
    this.balancePanel.setPosition(width - 82, header.y);
    this.balanceIcon.setPosition(width - 137, header.y).setDisplaySize(26, 26);
    const startY = compact ? header.contentTop + 74 : header.contentTop + 82;
    const stepY = Math.min(142, Math.max(104, (height - header.contentTop - 110) / 3));

    this.balance
      .setFontSize(compact ? 10 : 12)
      .setPosition(width - 18, header.y);
    this.subtitle
      .setFontSize(compact ? 9 : 11)
      .setWordWrapWidth(Math.max(240, width - 32))
      .setPosition(centerX, header.contentTop + 20);
    this.message.setPosition(centerX, height - 24);

    if (shortLandscape) {
      this.subtitle.setFontSize(9).setPosition(centerX, header.contentTop + 13);
      this.productViews.forEach((view, index) => {
        const x = width * (index + 0.5) / this.productViews.length;
        resizeNineSlice(view.panel, Math.max(170, width / 3 - 18), 158);
        view.panel.setPosition(x, header.contentTop + 125);
        view.title.setFontSize(15).setPosition(x, header.contentTop + 62);
        view.description
          .setFontSize(9)
          .setWordWrapWidth(Math.max(150, width / 3 - 24))
          .setPosition(x, header.contentTop + 98);
        view.owned.setFontSize(10).setPosition(x, header.contentTop + 145);
        view.buy
          .setFontSize(9)
          .setFixedSize(Math.max(150, width / 3 - 28), 34)
          .setPosition(x, header.contentTop + 184);
      });
      this.message.setPosition(centerX, height - 24);
      return;
    }

    this.productViews.forEach((view, index) => {
      const y = startY + stepY * index;
      resizeNineSlice(view.panel, Math.min(width - 24, 430), Math.max(100, stepY - 8));
      view.panel.setPosition(centerX, y + 34);
      view.title.setFontSize(compact ? 15 : 18).setPosition(centerX, y);
      view.description
        .setFontSize(compact ? 9 : 11)
        .setWordWrapWidth(Math.max(220, width - 36))
        .setPosition(centerX, y + 25);
      view.owned.setPosition(centerX, y + 48);
      view.buy
        .setFontSize(compact ? 10 : 13)
        .setFixedSize(Math.min(width - 30, 330), compact ? 34 : 38)
        .setPosition(centerX, y + 80);
    });
  }
}
