import Phaser from "phaser";
import { GAMEPLAY_UI_FRAMES, UI_FRAMES } from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
  preloadPaperBackground,
} from "../../scene-background.js";
import { HINT_PRODUCTS, HintType, type HintProduct } from "../../economy.js";
import { getEconomy } from "../economy.js";
import { getSettings } from "../settings.js";
import { layoutSceneHeader } from "../navigation-layout.js";
import { shopGridMetrics } from "../presentation-layout.js";
import { shopProductPresentation, type UtilitySceneKey } from "../presentation-model.js";
import { closeUtilityScene, openUtilityScene } from "../utility-navigation.js";
import {
  makeButton,
  makeCurrencyDisplay,
  makeIconButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
} from "../ui.js";

const PRODUCT_ICON = Object.freeze({
  [HintType.MOVE]: GAMEPLAY_UI_FRAMES.hint,
  [HintType.UNDO]: GAMEPLAY_UI_FRAMES.undo,
  [HintType.RESCUE]: GAMEPLAY_UI_FRAMES.rescue,
});


type ProductView = {
  product: HintProduct;
  panel: ReturnType<typeof makePanel>;
  icon: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  owned: Phaser.GameObjects.Text;
  amount: Phaser.GameObjects.Text;
  price: ReturnType<typeof makeCurrencyDisplay>;
  buy: ReturnType<typeof makeButton>;
};

const RETURN_SCENES = new Set<UtilitySceneKey>(["board", "settings", "level-select", "leaderboard", "menu"]);
function returnSceneFromData(data: unknown): UtilitySceneKey {
  if (typeof data !== "object" || data === null) return "menu";
  const value = (data as { returnScene?: unknown }).returnScene;
  return typeof value === "string" && RETURN_SCENES.has(value as UtilitySceneKey) ? value as UtilitySceneKey : "menu";
}

export class ShopScene extends Phaser.Scene {
  productViews: ProductView[] = [];
  paperBackground!: ReturnType<typeof createPaperBackground>;
  returnScene: UtilitySceneKey = "menu";
  economy!: ReturnType<typeof getEconomy>;
  english = false;
  titlePanel!: ReturnType<typeof makePanel>;
  title!: Phaser.GameObjects.Text;
  balance!: ReturnType<typeof makeCurrencyDisplay>;
  subtitle!: Phaser.GameObjects.Text;
  message!: Phaser.GameObjects.Text;
  backButton!: ReturnType<typeof makeButton>;
  settingsButton!: ReturnType<typeof makeIconButton>;
  constructor() {
    super("shop");
  }

  preload(): void {
    preloadPaperBackground(this);
    preloadUiAssets(this);
  }

  create(data: unknown = {}): void {
    this.paperBackground = createPaperBackground(this);
    this.returnScene = returnSceneFromData(data);
    this.economy = getEconomy(this);
    this.english = getSettings(this).snapshot.language === "en";

    this.titlePanel = makePanel(this, UI_FRAMES.panelHeader).setVisible(false);
    this.title = makeText(
      this,
      this.english ? "SHOP" : "МАГАЗИН",
      28,
      "#eef3f8",
    )
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.balance = makeCurrencyDisplay(
      this,
      GAMEPLAY_UI_FRAMES.dust,
      0,
      { iconSize: 24, fontSize: 15 },
    );
    this.subtitle = makeText(
      this,
      this.english
        ? "BOOSTERS STAY IN YOUR INVENTORY"
        : "УСИЛИТЕЛИ СОХРАНЯЮТСЯ В ИНВЕНТАРЕ",
      11,
      "#9aa7b5",
    ).setOrigin(0.5);
    this.message = makeText(this, "", 12, "#77dc91").setOrigin(0.5);

    this.backButton = makeButton(
      this,
      this.english ? "BACK" : "НАЗАД",
      () => this.goBack(),
      14,
    ).setIcon(GAMEPLAY_UI_FRAMES.back, 22);
    this.settingsButton = makeIconButton(
      this,
      GAMEPLAY_UI_FRAMES.settings,
      () => this.openSettings(),
      { size: 46, glyphSize: 32 },
    );

    this.productViews = HINT_PRODUCTS.map((product) => {
      const panel = makePanel(this, UI_FRAMES.panelMainMedium);
      const icon = this.add.image(0, 0, PRODUCT_ICON[product.hint]);
      const title = makeText(this, "", 20, "#eef3f8")
        .setOrigin(0.5)
        .setFontStyle("bold");
      const description = makeText(this, "", 11, "#9aa7b5")
        .setOrigin(0.5)
        .setAlign("center");
      const owned = makeText(this, "", 12, "#77dc91").setOrigin(0.5);
      const amount = makeText(this, "", 12, "#eef3f8").setOrigin(0.5);
      const price = makeCurrencyDisplay(
        this,
        GAMEPLAY_UI_FRAMES.dust,
        product.price,
        { iconSize: 20, fontSize: 13 },
      );
      const buy = makeButton(
        this,
        this.english ? "BUY" : "КУПИТЬ",
        () => this.purchase(product),
        13,
      );
      return { product, panel, icon, title, description, owned, amount, price, buy };
    });

    this.input.keyboard?.on("keydown-ESC", () => this.goBack());
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.refresh();
    this.layout();
  }

  openSettings(): void {
    openUtilityScene(this, "settings", { returnScene: "shop" });
  }

  goBack(): void {
    closeUtilityScene(this, this.returnScene);
  }

  purchase(product: HintProduct): void {
    const result = this.economy.purchase(product.id);
    this.message
      .setText(
        result.ok
          ? `+${product.amount} ${this.english ? product.titleEn : product.title}`
          : this.english
          ? `NEED ${product.price - result.snapshot.dust} MORE`
          : `НЕ ХВАТАЕТ ${product.price - result.snapshot.dust}`,
      )
      .setColor(result.ok ? "#77dc91" : "#ff6b67");
    this.refresh();
  }

  refresh(): void {
    const snapshot = this.economy.snapshot;
    this.balance.setValue(snapshot.dust);
    for (const view of this.productViews) {
      const model = shopProductPresentation(view.product, snapshot, this.english);
      view.title.setText(model.title);
      view.description.setText(model.description);
      view.owned.setText(`×${model.owned}`);
      view.amount.setText(`${this.english ? "BUNDLE" : "НАБОР"} ×${model.amount}`);
      view.price.setValue(model.price);
      view.buy.setText(model.buyLabel).setEnabled(model.affordable);
    }
  }

  layout(): void {
    const { width, height } = this.scale;
    layoutPaperBackground(this.paperBackground, width, height);
    const header = layoutSceneHeader(
      {
        title: this.title,
        backButton: this.backButton,
        utilityButtons: [this.settingsButton],
      },
      width,
      height,
    );
    this.titlePanel.setVisible(false);

    const compact = width < 560;
    this.balance
      .setFontSize(compact ? 11 : 14)
      .setPosition(
        compact ? width / 2 : width - 118,
        header.contentTop + (compact ? 26 : 14),
      );
    this.subtitle.setVisible(false);

    const gridTop = header.contentTop + (compact ? 56 : 38);
    const metrics = shopGridMetrics(width, height, this.productViews.length, gridTop);
    const gridWidth =
      metrics.cardWidth * metrics.columns + metrics.gap * (metrics.columns - 1);
    const left = (width - gridWidth) / 2;
    const rows = Math.ceil(this.productViews.length / metrics.columns);
    const totalHeight = rows * metrics.cardHeight + metrics.gap * (rows - 1);
    const freeHeight = Math.max(0, height - gridTop - totalHeight - 36);
    const top = gridTop + freeHeight / 2;

    this.productViews.forEach((view, index) => {
      const column = index % metrics.columns;
      const row = Math.floor(index / metrics.columns);
      const cardX =
        left + column * (metrics.cardWidth + metrics.gap) + metrics.cardWidth / 2;
      const cardY =
        top + row * (metrics.cardHeight + metrics.gap) + metrics.cardHeight / 2;
      resizeNineSlice(view.panel, metrics.cardWidth, metrics.cardHeight);
      view.panel.setPosition(cardX, cardY);

      if (metrics.columns === 1) {
        const leftX = cardX - metrics.cardWidth * 0.31;
        view.icon.setDisplaySize(62, 62).setPosition(leftX, cardY - 20);
        view.title
          .setFontSize(17)
          .setPosition(cardX + 24, cardY - 56);
        view.description
          .setVisible(true)
          .setFontSize(9)
          .setWordWrapWidth(metrics.cardWidth * 0.56)
          .setPosition(cardX + 24, cardY - 28);
        view.owned.setFontSize(10).setPosition(cardX + 24, cardY + 6);
        view.amount.setFontSize(12).setPosition(leftX, cardY + 28);
        view.price.setPosition(cardX - 28, cardY + 48);
        view.buy
          .setFontSize(11)
          .setFixedSize(Math.min(150, metrics.cardWidth * 0.42), 38)
          .setPosition(cardX + metrics.cardWidth * 0.25, cardY + 52);
        return;
      }

      const topY = cardY - metrics.cardHeight / 2;
      const denseCard = metrics.cardWidth < 210;
      const iconSize = denseCard ? 62 : metrics.columns === 3 ? 88 : 76;
      view.icon
        .setDisplaySize(iconSize, iconSize)
        .setPosition(cardX, topY + (denseCard ? 50 : 68));
      view.title
        .setFontSize(denseCard ? 15 : metrics.columns === 3 ? 20 : 18)
        .setPosition(cardX, topY + (denseCard ? 96 : 126));
      view.description
        .setVisible(!denseCard)
        .setFontSize(10)
        .setWordWrapWidth(metrics.cardWidth - 34)
        .setPosition(cardX, topY + 158);
      view.owned
        .setFontSize(denseCard ? 9 : 11)
        .setPosition(cardX, topY + (denseCard ? 122 : 194));
      view.amount
        .setFontSize(denseCard ? 10 : 12)
        .setPosition(cardX, topY + (denseCard ? 146 : 218));
      view.price
        .setFontSize(denseCard ? 10 : 13)
        .setPosition(cardX, topY + (denseCard ? 170 : 242));
      view.buy
        .setFontSize(denseCard ? 10 : 12)
        .setFixedSize(Math.min(metrics.cardWidth - 28, 220), denseCard ? 36 : 42)
        .setPosition(cardX, topY + metrics.cardHeight - (denseCard ? 28 : 34));
    });

    this.message.setPosition(width / 2, height - 18);
  }
}
