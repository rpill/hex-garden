import Phaser from "phaser";
import { Atom, ATOM_NAMES } from "../../atom-types.js";
import { SigmarsGardenBoard } from "../../board.js";
import { BrowserLevelGenerator } from "../../browser.js";
import { BoardVariant } from "../../generator.js";
import { BOARD_CENTER, enumerateBoardCells, hexKey } from "../../hex.js";
import { createPanelState, panelTypesForVariant } from "../../panel-state.js";

const CAMPAIGN_SEED = "rules-lab-v1";
const TOP_BAR_HEIGHT = 52;
const BOTTOM_BAR_HEIGHT = 134;

const ATOM_LABELS = Object.freeze({
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
});

const ATOM_COLORS = Object.freeze({
  [Atom.SALT]: 0xb8b8b8,
  [Atom.AIR]: 0xb8c8d8,
  [Atom.FIRE]: 0xc87868,
  [Atom.WATER]: 0x688fae,
  [Atom.EARTH]: 0x82966f,
  [Atom.QUICKSILVER]: 0xc8c8c8,
  [Atom.GOLD]: 0xb89a55,
  [Atom.SILVER]: 0x9fabb5,
  [Atom.COPPER]: 0xa97255,
  [Atom.IRON]: 0x737980,
  [Atom.TIN]: 0x8f9494,
  [Atom.LEAD]: 0x5f6570,
  [Atom.VITAE]: 0xd2c19c,
  [Atom.MORS]: 0x706775,
  [Atom.QUINTESSENCE]: 0xa493b7,
});

function makeText(scene, text, size, color = "#d8d8d8") {
  return scene.add.text(0, 0, text, {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: `${size}px`,
    color,
  });
}

function makeButton(scene, label, onClick) {
  const text = makeText(scene, label, 16, "#e5e5e5")
    .setOrigin(0.5)
    .setPadding(12, 8)
    .setBackgroundColor("#292929")
    .setInteractive({ useHandCursor: true });
  text.on("pointerdown", onClick);
  return text;
}

export class BoardScene extends Phaser.Scene {
  constructor() {
    super("board");
    this.level = 0;
    this.variant = BoardVariant.STANDARD;
    this.generationToken = 0;
    this.initialPieces = [];
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.activePanelType = null;
  }

  create() {
    this.generator = new BrowserLevelGenerator();
    this.cellGraphics = this.add.graphics();
    this.atomGraphics = this.add.graphics();
    this.panelGraphics = this.add.graphics().setDepth(4);
    this.header = makeText(this, "", 16).setOrigin(0.5);
    this.status = makeText(this, "", 14, "#adadad").setOrigin(0, 0.5);

    this.previousButton = makeButton(this, "<", () => this.changeLevel(-1));
    this.restartButton = makeButton(this, "RESTART", () => this.restartLevel());
    this.nextButton = makeButton(this, ">", () => this.changeLevel(1));
    this.variantButton = makeButton(this, "VARIANT", () => this.toggleVariant());

    this.input.keyboard?.on("keydown-LEFT", () => this.changeLevel(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.changeLevel(1));
    this.input.keyboard?.on("keydown-R", () => this.restartLevel());
    this.input.keyboard?.on("keydown-V", () => this.toggleVariant());

    this.scale.on("resize", () => this.layout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.generator.terminate());
    this.rebuildPanelViews();
    this.layout();
    this.loadLevel();
  }

  async loadLevel() {
    const token = ++this.generationToken;
    this.setBusy(true);
    this.board = undefined;
    this.initialPieces = [];
    this.activePanelType = null;
    this.status.setText("GENERATING");
    this.clearPieceViews();
    this.render();

    try {
      const record = await this.generator.generate(this.level, {
        campaignSeed: CAMPAIGN_SEED,
        variant: this.variant,
      });
      if (token !== this.generationToken) return;
      this.board = record.board;
      this.boardShape = record.shape;
      this.initialPieces = record.pieces.map((piece) => ({ ...piece }));
      this.status.setText("");
      this.setBusy(false);
      this.rebuildPieceViews();
      this.layout();
    } catch (error) {
      if (token !== this.generationToken) return;
      this.status.setText(`ERROR: ${error instanceof Error ? error.message : error}`);
      this.setBusy(false);
      this.render();
    }
  }

  changeLevel(delta) {
    if (this.busy) return;
    const next = Math.max(0, this.level + delta);
    if (next === this.level) return;
    this.level = next;
    this.loadLevel();
  }

  toggleVariant() {
    if (this.busy) return;
    this.variant =
      this.variant === BoardVariant.STANDARD
        ? BoardVariant.QUINTESSENCE
        : BoardVariant.STANDARD;
    this.rebuildPanelViews();
    this.loadLevel();
  }

  restartLevel() {
    if (this.busy || this.initialPieces.length === 0) return;
    this.board = new SigmarsGardenBoard(this.initialPieces);
    this.activePanelType = null;
    this.status.setText("");
    this.rebuildPieceViews();
    this.layout();
  }

  selectPiece(piece) {
    if (this.busy || !this.board) return;
    const result = this.board.select(piece);
    if (result.kind === "locked") {
      this.status.setText(`LOCKED: ${ATOM_NAMES[piece.type].toUpperCase()}`);
    } else if (result.kind === "selected") {
      const selected = result.selected.map((item) => ATOM_LABELS[item.type]).join(" + ");
      this.status.setText(`SELECTED: ${selected}`);
    } else if (result.kind === "deselected") {
      this.status.setText("");
    } else if (result.kind === "removed") {
      this.status.setText(this.board.won ? "BOARD CLEARED" : "");
      this.rebuildPieceViews();
    }
    this.layout();
  }

  rebuildPieceViews() {
    this.clearPieceViews();
    if (!this.board) return;
    for (const piece of this.board.pieces()) {
      const label = makeText(this, ATOM_LABELS[piece.type], 16, "#111111")
        .setOrigin(0.5)
        .setDepth(2);
      const hitZone = this.add.zone(0, 0, 56, 56).setDepth(3);
      hitZone.setInteractive(
        new Phaser.Geom.Circle(28, 28, 28),
        Phaser.Geom.Circle.Contains,
      );
      hitZone.input.cursor = "pointer";
      hitZone.on("pointerdown", () => this.selectPiece(piece));
      this.pieceViews.set(hexKey(piece), { piece, label, hitZone });
    }
  }

  clearPieceViews() {
    for (const view of this.pieceViews.values()) {
      view.label.destroy();
      view.hitZone.destroy();
    }
    this.pieceViews.clear();
  }

  rebuildPanelViews() {
    for (const view of this.panelViews.values()) {
      view.label.destroy();
      view.count.destroy();
      view.hitZone.destroy();
    }
    this.panelViews.clear();

    for (const type of panelTypesForVariant(this.variant)) {
      const label = makeText(this, ATOM_LABELS[type], 14, "#111111")
        .setOrigin(0.5)
        .setDepth(6);
      const count = makeText(this, "", 10, "#d8d8d8")
        .setOrigin(0.5)
        .setDepth(6);
      const hitZone = this.add.zone(0, 0, 36, 36).setDepth(7);
      hitZone.setInteractive(
        new Phaser.Geom.Circle(18, 18, 18),
        Phaser.Geom.Circle.Contains,
      );
      hitZone.input.cursor = "pointer";
      hitZone.on("pointerdown", () => this.selectPanelType(type));
      this.panelViews.set(type, { type, label, count, hitZone });
    }
  }

  selectPanelType(type) {
    if (this.busy || !this.board) return;
    const state = createPanelState(this.board, { variant: this.variant });
    const entry = state.entries.find((candidate) => candidate.type === type);
    if (!entry || entry.depleted) return;
    this.activePanelType = this.activePanelType === type ? null : type;
    this.render();
  }

  setBusy(value) {
    this.busy = value;
    const alpha = value ? 0.45 : 1;
    this.previousButton.setAlpha(alpha);
    this.restartButton.setAlpha(alpha);
    this.nextButton.setAlpha(alpha);
    this.variantButton.setAlpha(alpha);
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 560;

    this.header.setFontSize(compact ? 13 : 16).setPosition(width / 2, 25);
    this.status.setFontSize(compact ? 11 : 14).setPosition(10, height - 126);

    const controlsY = height - 22;
    const gap = 68;
    this.restartButton.setPosition(width / 2, controlsY);
    this.previousButton.setPosition(width / 2 - gap, controlsY);
    this.nextButton.setPosition(width / 2 + gap, controlsY);
    this.variantButton.setPosition(compact ? width - 57 : width - 92, controlsY);

    this.layoutPanel(width, height, compact);

    const boardHeight = Math.max(100, height - TOP_BAR_HEIGHT - BOTTOM_BAR_HEIGHT);
    const boardWidth = Math.max(100, width - 16);
    this.hexSize = Math.max(9, Math.min(boardWidth / 19.2, boardHeight / 17.2));
    this.boardCenterX = width / 2;
    this.boardCenterY = TOP_BAR_HEIGHT + boardHeight / 2;

    for (const view of this.pieceViews.values()) {
      const position = this.hexToScreen(view.piece);
      const hitDiameter = this.hexSize * 1.44;
      view.label
        .setPosition(position.x, position.y)
        .setFontSize(Math.max(9, Math.floor(this.hexSize * 0.55)));
      view.hitZone.setPosition(position.x, position.y).setSize(hitDiameter, hitDiameter);
      view.hitZone.input.hitArea.setTo(
        hitDiameter / 2,
        hitDiameter / 2,
        hitDiameter / 2,
      );
    }
    this.render();
  }

  layoutPanel(width, height, compact) {
    const types = panelTypesForVariant(this.variant);
    const panelWidth = Math.min(width - 12, compact ? 520 : 680);
    const left = (width - panelWidth) / 2;
    const step = panelWidth / types.length;
    const radius = Math.max(10, Math.min(18, step * 0.38));
    const y = height - 76;

    this.panelLayout = { left, width: panelWidth, y, radius, step, types };
    types.forEach((type, index) => {
      const view = this.panelViews.get(type);
      if (!view) return;
      const x = left + step * (index + 0.5);
      const hitDiameter = Math.max(28, radius * 2.25);
      view.label
        .setPosition(x, y)
        .setFontSize(Math.max(9, Math.floor(radius * 0.78)));
      view.count
        .setPosition(x + radius * 0.72, y - radius * 0.92)
        .setFontSize(Math.max(8, Math.floor(radius * 0.58)));
      view.hitZone.setPosition(x, y).setSize(hitDiameter, hitDiameter);
      view.hitZone.input.hitArea.setTo(
        hitDiameter / 2,
        hitDiameter / 2,
        hitDiameter / 2,
      );
    });
  }

  hexToScreen(index) {
    const q = index.q - BOARD_CENTER.q;
    const r = index.r - BOARD_CENTER.r;
    return {
      x: this.boardCenterX + this.hexSize * Math.sqrt(3) * (q + r / 2),
      y: this.boardCenterY + this.hexSize * 1.5 * r,
    };
  }

  drawHex(graphics, x, y, radius, fillColor, lineColor, lineWidth = 1) {
    const points = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = Phaser.Math.DegToRad(60 * i - 30);
      points.push(
        new Phaser.Geom.Point(
          x + radius * Math.cos(angle),
          y + radius * Math.sin(angle),
        ),
      );
    }
    graphics.fillStyle(fillColor, 1).fillPoints(points, true);
    graphics.lineStyle(lineWidth, lineColor, 1).strokePoints(points, true);
  }

  render() {
    const count = this.board?.size ?? 0;
    this.header.setText(
      `${this.variant.toUpperCase()} / ${(this.boardShape ?? "-").toUpperCase()}   LEVEL ${String(this.level + 1).padStart(4, "0")}   ${count}/55`,
    );
    this.variantButton.setText(
      this.variant === BoardVariant.STANDARD ? "STANDARD" : "Q MODE",
    );

    this.renderPanel();
    this.cellGraphics.clear();
    for (const cell of enumerateBoardCells()) {
      const position = this.hexToScreen(cell);
      this.drawHex(
        this.cellGraphics,
        position.x,
        position.y,
        this.hexSize * 0.96,
        0x202020,
        0x4b4b4b,
      );
    }

    this.atomGraphics.clear();
    if (!this.board) return;
    const selected = new Set(this.board.selected.map(hexKey));
    for (const view of this.pieceViews.values()) {
      const position = this.hexToScreen(view.piece);
      const free = this.board.isFree(view.piece);
      const isSelected = selected.has(hexKey(view.piece));
      const isPanelMatch = this.activePanelType === view.piece.type;
      const radius = this.hexSize * 0.68;

      this.atomGraphics.fillStyle(ATOM_COLORS[view.piece.type], free ? 1 : 0.38);
      this.atomGraphics.fillCircle(position.x, position.y, radius);
      this.atomGraphics.lineStyle(
        isSelected || isPanelMatch ? Math.max(2, this.hexSize * 0.12) : 1,
        isSelected ? 0xffffff : isPanelMatch ? 0xf0d58a : 0x111111,
        1,
      );
      this.atomGraphics.strokeCircle(position.x, position.y, radius);
      view.label.setAlpha(free ? 1 : 0.45);
    }
  }

  renderPanel() {
    this.panelGraphics.clear();
    if (!this.panelLayout) return;

    const { left, width, y, radius, step, types } = this.panelLayout;
    const state = createPanelState(this.board, {
      variant: this.variant,
      activeType: this.activePanelType,
    });
    if (
      this.activePanelType !== null &&
      state.entries.find((entry) => entry.type === this.activePanelType)?.depleted
    ) {
      this.activePanelType = null;
    }

    this.panelGraphics.fillStyle(0x181818, 1);
    this.panelGraphics.fillRect(left, y - radius - 9, width, radius * 2 + 18);
    this.panelGraphics.lineStyle(1, 0x555555, 1);
    this.panelGraphics.strokeRect(left, y - radius - 9, width, radius * 2 + 18);

    const quicksilverIndex = types.indexOf(Atom.QUICKSILVER);
    const metalStartIndex = types.indexOf(Atom.LEAD);
    for (const boundary of [1, quicksilverIndex, metalStartIndex]) {
      const x = left + step * boundary;
      this.panelGraphics.lineStyle(1, 0x686868, 0.8);
      this.panelGraphics.lineBetween(x, y - radius, x, y + radius);
    }

    for (let index = metalStartIndex; index < types.length - 1; index += 1) {
      const fromX = left + step * (index + 0.5) + radius + 2;
      const toX = left + step * (index + 1.5) - radius - 2;
      if (toX <= fromX) continue;
      this.panelGraphics.lineStyle(1, 0x777777, 0.8);
      this.panelGraphics.lineBetween(fromX, y, toX, y);
      this.panelGraphics.fillStyle(0x777777, 0.8);
      this.panelGraphics.fillTriangle(toX, y, toX - 4, y - 3, toX - 4, y + 3);
    }

    state.entries.forEach((entry, index) => {
      const view = this.panelViews.get(entry.type);
      if (!view) return;
      const x = left + step * (index + 0.5);
      const alpha = entry.depleted ? 0.18 : entry.locked ? 0.36 : 1;
      this.panelGraphics.fillStyle(ATOM_COLORS[entry.type], alpha);
      this.panelGraphics.fillCircle(x, y, radius);
      this.panelGraphics.lineStyle(
        entry.selected ? 3 : entry.current ? 2 : 1,
        entry.selected ? 0xffffff : entry.current ? 0xf0d58a : 0x101010,
        alpha,
      );
      this.panelGraphics.strokeCircle(x, y, radius);

      view.label.setAlpha(alpha);
      view.count
        .setText(entry.countVisible && !entry.depleted ? String(entry.count) : "")
        .setColor(entry.warning ? "#e89070" : "#d8d8d8")
        .setAlpha(alpha);
    });
  }
}
