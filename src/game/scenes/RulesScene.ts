import Phaser from "phaser";
import { Atom, type AtomType } from "../../atom-types.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { ContextMenuOverlay } from "../ContextMenuOverlay.js";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalCard,
  makeMinimalText,
  type MinimalButton,
} from "../minimal-ui.js";
import { getSettings } from "../settings.js";
import { boardPrimitiveMetrics } from "../presentation-layout.js";
import { closeUtilityScene, exitUtilityToScene, switchUtilityScene } from "../utility-navigation.js";
import type { UtilityRootSceneKey } from "../presentation-model.js";

const RETURN_SCENES = new Set<UtilityRootSceneKey>(["board", "menu", "level-select"]);

const GOAL_FRAGMENT_CELLS = Object.freeze([
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
] as const);
const GOAL_EMPTY_RUN = new Set(["1,0", "0,1", "-1,1"]);
const GOAL_OCCUPIED_NEIGHBOURS = Object.freeze([
  { q: -1, r: 0, type: Atom.FIRE },
  { q: 0, r: -1, type: Atom.EARTH },
  { q: 1, r: -1, type: Atom.AIR },
] as const);

const TOKEN_COLORS = Object.freeze({
  [Atom.SALT]: 0xd8d6cf,
  [Atom.AIR]: 0xc7d9e8,
  [Atom.FIRE]: 0xd98370,
  [Atom.WATER]: 0x76a8c8,
  [Atom.EARTH]: 0x93ad78,
  [Atom.QUICKSILVER]: 0x8b91a0,
  [Atom.GOLD]: 0xd6b85f,
  [Atom.SILVER]: 0xb7bdc6,
  [Atom.COPPER]: 0xb47a63,
  [Atom.IRON]: 0x7f8790,
  [Atom.TIN]: 0x9aa0a7,
  [Atom.LEAD]: 0x6f6a77,
  [Atom.VITAE]: 0xb6a264,
  [Atom.MORS]: 0x7b6e80,
  [Atom.QUINTESSENCE]: 0xd0c7b8,
} satisfies Record<AtomType, number>);

const TOKEN_LABELS = Object.freeze({
  [Atom.SALT]: "Sa",
  [Atom.AIR]: "Ai",
  [Atom.FIRE]: "Fi",
  [Atom.WATER]: "Wa",
  [Atom.EARTH]: "Ea",
  [Atom.QUICKSILVER]: "Hg",
  [Atom.GOLD]: "Au",
  [Atom.SILVER]: "Ag",
  [Atom.COPPER]: "Cu",
  [Atom.IRON]: "Fe",
  [Atom.TIN]: "Sn",
  [Atom.LEAD]: "Pb",
  [Atom.VITAE]: "V",
  [Atom.MORS]: "M",
  [Atom.QUINTESSENCE]: "Q",
} satisfies Record<AtomType, string>);

type RulePage = Readonly<{
  titleRu: string;
  titleEn: string;
  bodyRu: string;
  bodyEn: string;
  kind: "goal" | "elements" | "salt" | "life" | "metals";
}>;

const RULE_PAGES: readonly RulePage[] = Object.freeze([
  {
    titleRu: "ЦЕЛЬ И ДОСТУПНОСТЬ",
    titleEn: "GOAL & ACCESS",
    bodyRu: "Три соседние пустые ячейки подряд делают фишку доступной. Очисти всё поле.",
    bodyEn: "Three consecutive empty neighbours make a piece available. Clear the whole board.",
    kind: "goal",
  },
  {
    titleRu: "СТИХИИ",
    titleEn: "ELEMENTS",
    bodyRu: "Стихии убираются одинаковыми парами.",
    bodyEn: "Elements are removed in matching pairs.",
    kind: "elements",
  },
  {
    titleRu: "СОЛЬ",
    titleEn: "SALT",
    bodyRu: "Соль соединяется с солью или с любой стихией.",
    bodyEn: "Salt pairs with salt or with any element.",
    kind: "salt",
  },
  {
    titleRu: "VITAE И MORS",
    titleEn: "VITAE & MORS",
    bodyRu: "V и M убираются только вместе.",
    bodyEn: "V and M can only be removed together.",
    kind: "life",
  },
  {
    titleRu: "РТУТЬ И МЕТАЛЛЫ",
    titleEn: "QUICKSILVER & METALS",
    bodyRu: "Hg снимает доступный металл. Металлы открываются по цепочке; Au снимается одним нажатием.",
    bodyEn: "Hg removes an available metal. Metals unlock in order; Au is removed with one tap.",
    kind: "metals",
  },
]);

interface RuleCardLayout {
  cardWidth: number;
  cardHeight: number;
  cardTop: number;
  cardCenterY: number;
  titleY: number;
  exampleWidth: number;
  exampleHeight: number;
  exampleCenterY: number;
  diagramCenterY: number;
  bodyY: number;
  navY: number;
  navSize: number;
  compact: boolean;
  shortLandscape: boolean;
}

function ruleCardLayout(width: number, height: number): Readonly<RuleCardLayout> {
  const compact = width < 560;
  const portrait = height > width * 1.12;
  const shortLandscape = height < 520 && width > height;
  const cardTop = shortLandscape ? 54 : 68;
  const bottomInset = shortLandscape ? 12 : 18;
  const maxCardHeight = shortLandscape ? 320 : portrait ? 640 : 500;
  const cardHeight = Math.max(
    shortLandscape ? 260 : 330,
    Math.min(height - cardTop - bottomInset, maxCardHeight),
  );
  const cardWidth = Math.min(width - (compact ? 20 : 32), shortLandscape ? 720 : 680);
  const cardCenterY = cardTop + cardHeight / 2;
  const titleY = cardTop + (shortLandscape ? 28 : 36);
  const navSize = shortLandscape ? 34 : compact ? 38 : 40;
  const navY = cardTop + cardHeight - (shortLandscape ? 24 : 30);
  const bodyY = navY - (shortLandscape ? 39 : 50);
  const exampleTop = titleY + (shortLandscape ? 28 : 38);
  const exampleBottom = bodyY - (shortLandscape ? 26 : 34);
  const availableExampleHeight = Math.max(96, exampleBottom - exampleTop);
  const exampleHeight = Math.min(shortLandscape ? 150 : portrait ? 300 : 245, availableExampleHeight);
  const exampleCenterY = exampleTop + availableExampleHeight / 2;
  const exampleWidth = Math.max(220, cardWidth - (compact ? 28 : 54));

  return Object.freeze({
    cardWidth,
    cardHeight,
    cardTop,
    cardCenterY,
    titleY,
    exampleWidth,
    exampleHeight,
    exampleCenterY,
    diagramCenterY: exampleCenterY,
    bodyY,
    navY,
    navSize,
    compact,
    shortLandscape,
  });
}

function returnSceneFromData(data: unknown): UtilityRootSceneKey {
  if (typeof data !== "object" || data === null) return "menu";
  const value = (data as { returnScene?: unknown }).returnScene;
  return typeof value === "string" && RETURN_SCENES.has(value as UtilityRootSceneKey)
    ? value as UtilityRootSceneKey
    : "menu";
}

export class RulesScene extends Phaser.Scene {
  returnScene: UtilityRootSceneKey = "menu";
  english = false;
  pageIndex = 0;
  title!: Phaser.GameObjects.Text;
  backButton!: MinimalButton;
  menuButton!: MinimalButton;
  card!: Phaser.GameObjects.Graphics;
  examplePanel!: Phaser.GameObjects.Graphics;
  cardTitle!: Phaser.GameObjects.Text;
  body!: Phaser.GameObjects.Text;
  diagram!: Phaser.GameObjects.Graphics;
  diagramLabels: Phaser.GameObjects.Text[] = [];
  previousButton!: MinimalButton;
  nextButton!: MinimalButton;
  pageText!: Phaser.GameObjects.Text;
  contextMenu!: ContextMenuOverlay;
  currentLayout: Readonly<RuleCardLayout> | undefined;

  constructor() {
    super("rules");
  }

  create(data: unknown = {}): void {
    this.returnScene = returnSceneFromData(data);
    this.english = getSettings(this).snapshot.language === "en";
    this.cameras.main.setBackgroundColor(MINIMAL_UI_COLORS.background);
    void getYandexGamesAdapter().showStickyBanner();

    this.title = makeMinimalText(this, this.english ? "RULES" : "ПРАВИЛА", 26)
      .setOrigin(0.5)
      .setFontStyle("bold");
    this.backButton = makeMinimalButton(this, "←", () => this.goBack());
    this.menuButton = makeMinimalButton(this, "☰", () => this.openMenu());
    this.card = makeMinimalCard(this, 640, 430);
    this.examplePanel = this.add.graphics();
    this.cardTitle = makeMinimalText(this, "", 20).setOrigin(0.5).setFontStyle("bold");
    this.body = makeMinimalText(this, "", 14, MINIMAL_UI_COLORS.textMuted)
      .setOrigin(0.5)
      .setAlign("center");
    this.diagram = this.add.graphics();
    this.previousButton = makeMinimalButton(this, "‹", () => this.changePage(-1));
    this.nextButton = makeMinimalButton(this, "›", () => this.changePage(1));
    this.pageText = makeMinimalText(this, "", 12, MINIMAL_UI_COLORS.textMuted).setOrigin(0.5);
    this.contextMenu = new ContextMenuOverlay(this);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.contextMenu.visible) this.contextMenu.close();
      else this.goBack();
    });
    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
    });
    this.refreshPage();
    this.layout();
  }

  private uiText(russian: string, english: string): string {
    return this.english ? english : russian;
  }

  private goBack(): void {
    closeUtilityScene(this, this.returnScene);
  }

  private openMenu(): void {
    this.contextMenu.open({
      title: this.uiText("МЕНЮ", "MENU"),
      items: [
        {
          id: "settings",
          label: this.uiText("НАСТРОЙКИ", "SETTINGS"),
          onSelect: () => switchUtilityScene(this, "settings", { returnScene: this.returnScene }),
        },
        {
          id: "home",
          label: this.uiText("ГЛАВНОЕ МЕНЮ", "MAIN MENU"),
          onSelect: () => exitUtilityToScene(this, "menu", { returnScene: this.returnScene }),
        },
      ],
    });
  }

  private changePage(delta: number): void {
    this.pageIndex = Math.max(0, Math.min(RULE_PAGES.length - 1, this.pageIndex + delta));
    this.refreshPage();
    this.layout();
  }

  private refreshPage(): void {
    const page = RULE_PAGES[this.pageIndex] ?? RULE_PAGES[0]!;
    this.cardTitle.setText(this.english ? page.titleEn : page.titleRu);
    this.body.setText(this.english ? page.bodyEn : page.bodyRu);
    this.pageText.setText(`${this.pageIndex + 1} / ${RULE_PAGES.length}`);
    this.previousButton.setEnabled(this.pageIndex > 0);
    this.nextButton.setEnabled(this.pageIndex < RULE_PAGES.length - 1);
  }

  private clearDiagramLabels(): void {
    for (const label of this.diagramLabels) label.destroy();
    this.diagramLabels = [];
  }

  private addDiagramText(text: string, x: number, y: number, size = 18, color: string = MINIMAL_UI_COLORS.text): void {
    this.diagramLabels.push(
      makeMinimalText(this, text, size, color).setOrigin(0.5).setDepth(3).setPosition(x, y),
    );
  }

  private drawToken(x: number, y: number, type: AtomType, radius = 28): void {
    this.diagram
      .fillStyle(TOKEN_COLORS[type], 1)
      .fillCircle(x, y, radius)
      .lineStyle(2, MINIMAL_UI_COLORS.borderActive, 0.9)
      .strokeCircle(x, y, radius);
    this.addDiagramText(TOKEN_LABELS[type], x, y, Math.max(12, Math.floor(radius * 0.55)));
  }

  private drawHex(x: number, y: number, radius = 32, alpha = 0.8): void {
    const points: Phaser.Geom.Point[] = [];
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = Phaser.Math.DegToRad(60 * corner - 30);
      points.push(new Phaser.Geom.Point(x + radius * Math.cos(angle), y + radius * Math.sin(angle)));
    }
    this.diagram
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.45)
      .fillPoints(points, true)
      .lineStyle(2, MINIMAL_UI_COLORS.border, alpha)
      .strokePoints(points, true);
  }

  private drawPair(x: number, y: number, first: AtomType, second: AtomType, result = "✓", scale = 1): void {
    const radius = 26 * scale;
    const offset = 64 * scale;
    this.drawToken(x - offset, y, first, radius);
    this.addDiagramText("+", x, y, Math.max(16, 22 * scale));
    this.drawToken(x + offset, y, second, radius);
    this.addDiagramText(
      result,
      x + 126 * scale,
      y,
      Math.max(16, 22 * scale),
      result === "✓" ? "#91c79b" : "#d98370",
    );
  }

  private drawGoalBoardFragment(centerX: number, centerY: number, scale: number): void {
    const hexSize = 31 * scale;
    const metrics = boardPrimitiveMetrics(hexSize);
    const screenFor = ({ q, r }: Readonly<{ q: number; r: number }>) => ({
      x: centerX + hexSize * Math.sqrt(3) * (q + r / 2),
      y: centerY + hexSize * 1.5 * r,
    });

    for (const cell of GOAL_FRAGMENT_CELLS) {
      const screen = screenFor(cell);
      const key = `${cell.q},${cell.r}`;
      const points: Phaser.Geom.Point[] = [];
      for (let corner = 0; corner < 6; corner += 1) {
        const angle = Phaser.Math.DegToRad(60 * corner - 30);
        points.push(
          new Phaser.Geom.Point(
            screen.x + metrics.slotRadius * Math.cos(angle),
            screen.y + metrics.slotRadius * Math.sin(angle),
          ),
        );
      }
      const emptyRun = GOAL_EMPTY_RUN.has(key);
      this.diagram
        .fillStyle(MINIMAL_UI_COLORS.surface, emptyRun ? 0.16 : metrics.slotAlpha)
        .fillPoints(points, true)
        .lineStyle(
          Math.max(1, metrics.slotLineWidth),
          emptyRun ? 0x91c79b : MINIMAL_UI_COLORS.border,
          emptyRun ? 0.58 : 0.28,
        )
        .strokePoints(points, true);
    }

    const center = screenFor({ q: 0, r: 0 });
    this.drawToken(center.x, center.y, Atom.WATER, metrics.tokenRadius);
    this.diagram
      .lineStyle(2, 0x91c79b, 0.9)
      .strokeCircle(center.x, center.y, metrics.tokenRadius + 4 * scale);

    for (const neighbour of GOAL_OCCUPIED_NEIGHBOURS) {
      const screen = screenFor(neighbour);
      this.drawToken(screen.x, screen.y, neighbour.type, metrics.tokenRadius);
    }

    this.addDiagramText(
      this.uiText("3 ПУСТЫЕ ПОДРЯД", "3 EMPTY IN A ROW"),
      centerX,
      centerY + hexSize * 2.65,
      Math.max(10, 12 * scale),
      "#91c79b",
    );
  }

  private drawRulePage(page: RulePage): void {
    this.diagram.clear();
    this.clearDiagramLabels();
    const layout = this.currentLayout;
    if (!layout) return;

    const centerX = this.scale.width / 2;
    const centerY = layout.diagramCenterY;
    const scale = layout.shortLandscape ? 0.72 : layout.compact ? 0.82 : 1;

    if (page.kind === "goal") {
      this.drawGoalBoardFragment(centerX, centerY - 4 * scale, scale);
      return;
    }
    if (page.kind === "elements") {
      this.drawPair(centerX, centerY - 34 * scale, Atom.WATER, Atom.WATER, "✓", scale);
      this.drawPair(centerX, centerY + 34 * scale, Atom.FIRE, Atom.FIRE, "✓", scale);
      return;
    }
    if (page.kind === "salt") {
      this.drawPair(centerX, centerY - 34 * scale, Atom.SALT, Atom.FIRE, "✓", scale);
      this.drawPair(centerX, centerY + 34 * scale, Atom.SALT, Atom.SALT, "✓", scale);
      return;
    }
    if (page.kind === "life") {
      this.drawPair(centerX, centerY - 34 * scale, Atom.VITAE, Atom.MORS, "✓", scale);
      this.drawPair(centerX, centerY + 34 * scale, Atom.VITAE, Atom.VITAE, "×", scale);
      return;
    }

    this.drawPair(centerX, centerY - 48 * scale, Atom.QUICKSILVER, Atom.LEAD, "✓", scale);
    this.addDiagramText(
      "Pb  →  Sn  →  Fe  →  Cu  →  Ag  →  Au",
      centerX,
      centerY + 18 * scale,
      Math.max(10, 13 * scale),
    );
    this.drawToken(centerX - 32 * scale, centerY + 66 * scale, Atom.GOLD, 22 * scale);
    this.addDiagramText(
      this.uiText("1 НАЖАТИЕ", "1 TAP"),
      centerX + 50 * scale,
      centerY + 66 * scale,
      Math.max(10, 12 * scale),
      MINIMAL_UI_COLORS.textMuted,
    );
  }

  layout(): void {
    const { width, height } = this.scale;
    const layout = ruleCardLayout(width, height);
    this.currentLayout = layout;
    const topY = layout.shortLandscape ? 27 : 32;
    const controlSize = layout.shortLandscape ? 36 : 42;

    this.title
      .setFontSize(layout.compact ? 20 : 24)
      .setPosition(width / 2, topY);
    this.backButton
      .setPosition(14 + controlSize / 2, topY)
      .setSize(controlSize, controlSize);
    this.menuButton
      .setPosition(width - 14 - controlSize / 2, topY)
      .setSize(controlSize, controlSize);
    this.backButton.label.setFontSize(layout.shortLandscape ? 16 : 18);
    this.menuButton.label.setFontSize(layout.shortLandscape ? 16 : 18);

    this.card
      .setPosition(width / 2, layout.cardCenterY)
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.surface, 0.98)
      .fillRoundedRect(-layout.cardWidth / 2, -layout.cardHeight / 2, layout.cardWidth, layout.cardHeight, 14)
      .lineStyle(1, MINIMAL_UI_COLORS.borderActive, 0.72)
      .strokeRoundedRect(
        -layout.cardWidth / 2 + 0.5,
        -layout.cardHeight / 2 + 0.5,
        layout.cardWidth - 1,
        layout.cardHeight - 1,
        14,
      );

    this.examplePanel
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.background, 0.38)
      .fillRoundedRect(
        width / 2 - layout.exampleWidth / 2,
        layout.exampleCenterY - layout.exampleHeight / 2,
        layout.exampleWidth,
        layout.exampleHeight,
        12,
      )
      .lineStyle(1, MINIMAL_UI_COLORS.border, 0.7)
      .strokeRoundedRect(
        width / 2 - layout.exampleWidth / 2 + 0.5,
        layout.exampleCenterY - layout.exampleHeight / 2 + 0.5,
        layout.exampleWidth - 1,
        layout.exampleHeight - 1,
        12,
      );

    this.cardTitle
      .setFontSize(layout.shortLandscape || layout.compact ? 16 : 19)
      .setPosition(width / 2, layout.titleY);
    this.body
      .setFontSize(layout.shortLandscape || layout.compact ? 11 : 13)
      .setWordWrapWidth(layout.cardWidth - 54)
      .setFixedSize(layout.cardWidth - 54, 0)
      .setPosition(width / 2, layout.bodyY);

    this.previousButton
      .setPosition(width / 2 - 72, layout.navY)
      .setSize(layout.navSize, layout.navSize);
    this.nextButton
      .setPosition(width / 2 + 72, layout.navY)
      .setSize(layout.navSize, layout.navSize);
    this.pageText.setPosition(width / 2, layout.navY);

    this.drawRulePage(RULE_PAGES[this.pageIndex] ?? RULE_PAGES[0]!);
    this.contextMenu.layout(width, height);
  }
}
