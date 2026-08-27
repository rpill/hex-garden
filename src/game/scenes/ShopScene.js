import Phaser from "phaser";
import { HINT_PRODUCTS } from "../../economy.js";
import { getEconomy } from "../economy.js";
import { getSettings } from "../settings.js";
import { makeButton, makeText } from "../ui.js";

function formatDust(value) {
  return value.toLocaleString("ru-RU");
}

export class ShopScene extends Phaser.Scene {
  constructor() {
    super("shop");
    this.productViews = [];
  }

  create(data = {}) {
    this.returnScene = data.returnScene === "level-select" ? "level-select" : "menu";
    this.economy = getEconomy(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.title = makeText(this, this.english ? "SHOP" : "МАГАЗИН", 26, "#ededed").setOrigin(0.5);
    this.balance = makeText(this, "", 16, "#f0d58a").setOrigin(0.5);
    this.subtitle = makeText(
      this,
      this.english ? "BOOSTERS ARE PURCHASED IN ADVANCE AND STORED IN YOUR INVENTORY" : "ПОДСКАЗКИ ПОКУПАЮТСЯ ЗАРАНЕЕ И ХРАНЯТСЯ В ИНВЕНТАРЕ",
      11,
      "#8f8f8f",
    ).setOrigin(0.5);
    this.message = makeText(this, "", 12, "#c8edc5").setOrigin(0.5);
    this.backButton = makeButton(this, this.english ? "←  BACK" : "←  НАЗАД", () => {
      this.scene.start(this.returnScene);
    }, 14);

    this.productViews = HINT_PRODUCTS.map((product) => {
      const title = makeText(this, this.english ? product.titleEn : product.title, 18, "#ededed").setOrigin(0.5);
      const description = makeText(
        this,
        this.english ? product.descriptionEn : product.description,
        11,
        "#9f9f9f",
      ).setOrigin(0.5);
      const owned = makeText(this, "", 12, "#c8edc5").setOrigin(0.5);
      const buy = makeButton(
        this,
        `${this.english ? "BUY" : "КУПИТЬ"} ×${product.amount}  /  ${product.price} ${this.english ? "DUST" : "ПЫЛИ"}`,
        () => this.purchase(product),
        13,
      );
      return { product, title, description, owned, buy };
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
      .setColor(result.ok ? "#c8edc5" : "#e89070");
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
    const compact = width < 520;
    const shortLandscape = height < 520 && width >= 620;
    const centerX = width / 2;
    const startY = compact ? 118 : 132;
    const stepY = Math.min(142, Math.max(104, (height - 190) / 3));

    this.title
      .setFontSize(compact ? 21 : 26)
      .setPosition(centerX, 28);
    this.balance.setPosition(centerX, 62);
    this.subtitle
      .setFontSize(compact ? 9 : 11)
      .setWordWrapWidth(Math.max(240, width - 32))
      .setPosition(centerX, 89);
    this.message.setPosition(centerX, height - 62);
    this.backButton.setFixedSize(126, 44).setPosition(76, height - 28);

    if (shortLandscape) {
      this.title.setFontSize(20).setPosition(centerX, 24);
      this.balance.setFontSize(13).setPosition(centerX, 51);
      this.subtitle.setFontSize(9).setPosition(centerX, 75);
      this.productViews.forEach((view, index) => {
        const x = width * (index + 0.5) / this.productViews.length;
        view.title.setFontSize(15).setPosition(x, 122);
        view.description
          .setFontSize(9)
          .setWordWrapWidth(Math.max(150, width / 3 - 24))
          .setPosition(x, 158);
        view.owned.setFontSize(10).setPosition(x, 205);
        view.buy
          .setFontSize(9)
          .setFixedSize(Math.max(150, width / 3 - 28), 34)
          .setPosition(x, 244);
      });
      this.message.setPosition(centerX, height - 57);
      return;
    }

    this.productViews.forEach((view, index) => {
      const y = startY + stepY * index;
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
