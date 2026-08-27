import Phaser from "phaser";
import { Atom, ATOM_NAMES } from "../../atom-types.js";
import { GardenBoard } from "../../board.js";
import { BrowserLevelGenerator } from "../../browser.js";
import { BoardVariant } from "../../generator.js";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { BOARD_CENTER, enumerateBoardCells, hexKey } from "../../hex.js";
import { createPanelState, panelTypesForVariant } from "../../panel-state.js";
import { mechanicIntroductionForLevel } from "../../mechanic-introductions.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { PlayMode } from "../modes.js";
import {
  TUTORIAL_GUIDED_MOVE_COUNT,
  createTutorialLevel,
  findLongestEmptyNeighbourRun,
} from "../../tutorial.js";

const CAMPAIGN_SEED = "rules-lab-v1";
const TOP_BAR_HEIGHT = 52;
const BOTTOM_BAR_HEIGHT = 134;
const PANEL_HIGHLIGHT_DURATION_MS = 2000;

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
    this.mode = PlayMode.CAMPAIGN;
    this.variant = BoardVariant.STANDARD;
    this.generationToken = 0;
    this.initialPieces = [];
    this.plateCells = enumerateBoardCells();
    this.plateRadius = 5;
    this.levelDefinition = undefined;
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.activePanelType = null;
    this.panelHighlightTimer = undefined;
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.mechanicCardVisible = false;
  }

  init(data = {}) {
    this.progress = getCampaignProgress(this);
    this.mode = Object.values(PlayMode).includes(data.mode)
      ? data.mode
      : PlayMode.CAMPAIGN;
    this.variant =
      this.mode === PlayMode.QUINTESSENCE
        ? BoardVariant.QUINTESSENCE
        : BoardVariant.STANDARD;
    const requestedLevel =
      Number.isSafeInteger(data.level) && data.level >= 0 ? data.level : 0;
    this.level =
      this.mode === PlayMode.CAMPAIGN
        ? Math.min(requestedLevel, this.progress.snapshot.highestUnlocked)
        : requestedLevel;
    this.initialPieces = [];
    this.plateCells = enumerateBoardCells();
    this.plateRadius = 5;
    this.levelDefinition = undefined;
    this.activePanelType = null;
    this.panelHighlightTimer = undefined;
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.mechanicCardVisible = false;
  }

  create() {
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.generator = new BrowserLevelGenerator();
    this.cellGraphics = this.add.graphics();
    this.atomGraphics = this.add.graphics();
    this.panelGraphics = this.add.graphics().setDepth(4);
    this.tutorialGraphics = this.add.graphics().setDepth(8);
    this.mechanicCardGraphics = this.add.graphics().setDepth(20);
    this.header = makeText(this, "", 16).setOrigin(0.5);
    this.status = makeText(this, "", 14, "#adadad").setOrigin(0, 0.5);
    this.tutorialText = makeText(this, "", 14, "#f0d58a")
      .setOrigin(0.5)
      .setDepth(9);
    this.tutorialNeighbourLabels = ["1", "2", "3"].map((number) =>
      makeText(this, number, 13, "#c8edc5")
        .setOrigin(0.5)
        .setDepth(9)
        .setVisible(false),
    );
    this.mechanicCardText = makeText(this, "", 18, "#ededed")
      .setOrigin(0.5)
      .setAlign("center")
      .setDepth(21)
      .setVisible(false);
    this.mechanicCardHint = makeText(this, "TAP TO CONTINUE", 12, "#f0d58a")
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.mechanicCardHitZone = this.add.zone(0, 0, 1, 1).setDepth(22);
    this.mechanicCardHitZone.on("pointerdown", () => this.dismissMechanicCard());

    this.previousButton = makeButton(this, "<", () => this.changeLevel(-1));
    this.restartButton = makeButton(this, "RESTART", () => this.restartLevel());
    this.nextButton = makeButton(this, ">", () => this.changeLevel(1));
    this.menuButton = makeButton(this, "MENU", () => this.leaveBoard());

    this.input.keyboard?.on("keydown-LEFT", () => this.changeLevel(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.changeLevel(1));
    this.input.keyboard?.on("keydown-R", () => this.restartLevel());
    this.input.keyboard?.on("keydown-ESC", () => this.leaveBoard());

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
      this.clearPanelHighlight(false);
      this.generator.terminate();
      this.pieceViews.clear();
      this.panelViews.clear();
    });
    this.rebuildPanelViews();
    this.layout();
    this.loadLevel();
  }

  async loadLevel() {
    const token = ++this.generationToken;
    this.setBusy(true);
    this.board = undefined;
    this.initialPieces = [];
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.hideMechanicCard();
    this.status.setText("GENERATING");
    this.clearPieceViews();
    this.render();

    try {
      const record =
        this.mode === PlayMode.TUTORIAL
          ? createTutorialLevel()
          : this.mode === PlayMode.CAMPAIGN
          ? await this.generator.generateProgression(this.level, {
              campaignSeed: CAMPAIGN_SEED,
            })
          : await this.generator.generate(this.level, {
              campaignSeed: CAMPAIGN_SEED,
              variant: this.mode,
            });
      if (token !== this.generationToken) return;
      this.board = record.board;
      this.variant = record.variant;
      this.boardShape = record.shape;
      this.plateCells = record.plateCells ?? enumerateBoardCells();
      this.plateRadius = record.plateRadius ?? 5;
      this.levelDefinition = record.definition;
      this.initialPieces = record.pieces.map((piece) => ({ ...piece }));
      this.tutorialSolution =
        this.mode === PlayMode.TUTORIAL
          ? record.solution.map((move) => move.map((position) => ({ ...position })))
          : [];
      this.status.setText("");
      this.setBusy(false);
      this.rebuildPanelViews();
      this.rebuildPieceViews();
      this.updateTutorialGuide();
      this.showMechanicCardForLevel();
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
    if (this.mode === PlayMode.TUTORIAL) {
      if (delta > 0 && this.board?.won) {
        this.scene.start("board", { mode: PlayMode.CAMPAIGN, level: 0 });
      }
      return;
    }
    const maximum =
      this.mode === PlayMode.CAMPAIGN
        ? this.progress.snapshot.highestUnlocked
        : Number.MAX_SAFE_INTEGER;
    const next = Math.min(maximum, Math.max(0, this.level + delta));
    if (next === this.level) return;
    this.level = next;
    this.loadLevel();
  }

  leaveBoard() {
    this.generationToken += 1;
    this.scene.start(
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL
        ? "level-select"
        : "menu",
    );
  }

  restartLevel() {
    if (this.busy || this.initialPieces.length === 0) return;
    this.board = new GardenBoard(this.initialPieces);
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.status.setText("");
    this.rebuildPieceViews();
    this.updateTutorialGuide();
    this.layout();
  }

  selectPiece(piece) {
    if (this.busy || this.mechanicCardVisible || !this.board) return;
    if (!this.tutorialAllowsPiece(piece)) {
      this.status.setText("FOLLOW THE PULSING ATOMS");
      return;
    }
    const result = this.board.select(piece);
    if (result.kind === "locked") {
      this.status.setText(`LOCKED: ${ATOM_NAMES[piece.type].toUpperCase()}`);
    } else if (result.kind === "selected") {
      const selected = result.selected.map((item) => ATOM_LABELS[item.type]).join(" + ");
      this.status.setText(`SELECTED: ${selected}`);
    } else if (result.kind === "deselected") {
      this.status.setText("");
    } else if (result.kind === "removed") {
      let message = "";
      if (
        this.mode === PlayMode.TUTORIAL &&
        this.tutorialStep < TUTORIAL_GUIDED_MOVE_COUNT
      ) {
        this.tutorialStep += 1;
      }
      if (this.board.won) {
        message = "BOARD CLEARED";
        if (this.mode === PlayMode.TUTORIAL) {
          this.progress.completeTutorial();
          message = "";
        } else if (this.mode === PlayMode.CAMPAIGN) {
          const alreadyCompleted = this.progress.isCompleted(this.level);
          const snapshot = this.progress.complete(this.level);
          if (snapshot.campaignCompleted) {
            message = "CAMPAIGN COMPLETE";
          } else if (!alreadyCompleted && !this.progress.testMode) {
            message =
              `BOARD CLEARED - LEVEL ${this.level + 2} UNLOCKED`;
          }
        }
        this.setBusy(false);
      }
      this.status.setText(message);
      this.rebuildPieceViews();
      this.updateTutorialGuide();
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
    if (this.busy || this.mechanicCardVisible || !this.board) return;
    const state = createPanelState(this.board, { variant: this.variant });
    const entry = state.entries.find((candidate) => candidate.type === type);
    if (!entry || entry.depleted) return;
    if (this.activePanelType === type) {
      this.clearPanelHighlight();
      return;
    }
    this.clearPanelHighlight(false);
    this.activePanelType = type;
    this.panelHighlightTimer = this.time.delayedCall(
      PANEL_HIGHLIGHT_DURATION_MS,
      () => {
        this.panelHighlightTimer = undefined;
        this.activePanelType = null;
        this.render();
      },
    );
    this.render();
  }

  clearPanelHighlight(render = true) {
    this.panelHighlightTimer?.remove(false);
    this.panelHighlightTimer = undefined;
    this.activePanelType = null;
    if (render) this.render();
  }

  tutorialAllowsPiece(piece) {
    if (
      this.mode !== PlayMode.TUTORIAL ||
      this.tutorialStep >= TUTORIAL_GUIDED_MOVE_COUNT
    ) {
      return true;
    }
    return this.tutorialSolution[this.tutorialStep]?.some(
      (position) => hexKey(position) === hexKey(piece),
    );
  }

  updateTutorialGuide() {
    if (this.mode !== PlayMode.TUTORIAL) {
      this.tutorialText.setText("").setVisible(false);
      this.tutorialGraphics.clear();
      this.hideTutorialNeighbourLabels();
      return;
    }

    const messages = [
      "A FREE ATOM HAS 3+ EMPTY HEXES IN A ROW\nGREEN 1-2-3 = FREE. REMOVE THE PULSING AIR PAIR",
      "REMOVING A PAIR CREATES A NEW 3-HEX OPEN SIDE\nREMOVE THE PULSING FIRE PAIR",
      "FEWER THAN 3 EMPTY HEXES IN A ROW = BLOCKED\nCLEAR THE REST WITHOUT HELP",
    ];
    this.tutorialText
      .setText(
        this.board?.won
          ? "TUTORIAL COMPLETE\nPRESS START FOR LEVEL 1"
          : messages[Math.min(this.tutorialStep, messages.length - 1)],
      )
      .setVisible(true);
    this.status.setText("");
  }

  renderTutorialPulse(time = 0) {
    this.tutorialGraphics.clear();
    this.hideTutorialNeighbourLabels();
    if (
      this.mode !== PlayMode.TUTORIAL ||
      this.tutorialStep >= TUTORIAL_GUIDED_MOVE_COUNT ||
      !this.board
    ) {
      return;
    }

    const phase = (Math.sin(time * 0.006) + 1) / 2;
    if (this.tutorialStep === 0) {
      const focus = this.tutorialSolution[0]?.[0];
      const emptyRun = focus
        ? findLongestEmptyNeighbourRun(this.board.pieces(), focus).slice(0, 3)
        : [];
      emptyRun.forEach((position, index) => {
        const screen = this.hexToScreen(position);
        const points = [];
        for (let corner = 0; corner < 6; corner += 1) {
          const angle = Phaser.Math.DegToRad(60 * corner - 30);
          points.push(
            new Phaser.Geom.Point(
              screen.x + this.hexSize * 0.82 * Math.cos(angle),
              screen.y + this.hexSize * 0.82 * Math.sin(angle),
            ),
          );
        }
        this.tutorialGraphics
          .fillStyle(0x6fa878, 0.16 + phase * 0.12)
          .fillPoints(points, true);
        this.tutorialGraphics
          .lineStyle(2, 0x8ed18c, 0.75 + phase * 0.25)
          .strokePoints(points, true);
        this.tutorialNeighbourLabels[index]
          .setPosition(screen.x, screen.y)
          .setFontSize(Math.max(10, Math.floor(this.hexSize * 0.34)))
          .setVisible(true);
      });
    }
    const radius = this.hexSize * (0.75 + phase * 0.12);
    const alpha = 0.45 + phase * 0.5;
    this.tutorialGraphics.lineStyle(
      Math.max(2, this.hexSize * 0.08),
      0xf0d58a,
      alpha,
    );
    for (const position of this.tutorialSolution[this.tutorialStep] ?? []) {
      if (!this.pieceViews.has(hexKey(position))) continue;
      const screen = this.hexToScreen(position);
      this.tutorialGraphics.strokeCircle(screen.x, screen.y, radius);
    }
  }

  hideTutorialNeighbourLabels() {
    for (const label of this.tutorialNeighbourLabels ?? []) {
      label.setVisible(false);
    }
  }

  update(time) {
    this.renderTutorialPulse(time);
  }

  showMechanicCardForLevel() {
    const text =
      this.mode === PlayMode.CAMPAIGN && !this.progress.isCompleted(this.level)
        ? mechanicIntroductionForLevel(this.level)?.text
        : undefined;
    if (!text) {
      this.hideMechanicCard();
      return;
    }
    this.mechanicCardVisible = true;
    this.mechanicCardText.setText(text).setVisible(true);
    this.mechanicCardHint.setVisible(true);
    this.mechanicCardHitZone
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
  }

  dismissMechanicCard() {
    if (!this.mechanicCardVisible) return;
    this.hideMechanicCard();
    this.render();
  }

  hideMechanicCard() {
    this.mechanicCardVisible = false;
    this.mechanicCardGraphics?.clear();
    this.mechanicCardText?.setVisible(false);
    this.mechanicCardHint?.setVisible(false);
    this.mechanicCardHitZone?.setVisible(false).disableInteractive();
  }

  setBusy(value) {
    this.busy = value;
    const alpha = value ? 0.45 : 1;
    const previousUnavailable =
      this.mode === PlayMode.TUTORIAL || this.level === 0;
    const nextUnavailable =
      this.mode === PlayMode.TUTORIAL
        ? !this.board?.won
        : this.mode === PlayMode.CAMPAIGN &&
          this.level >= this.progress.snapshot.highestUnlocked;
    this.previousButton.setAlpha(value || previousUnavailable ? 0.45 : 1);
    this.restartButton.setAlpha(alpha);
    this.nextButton.setAlpha(value || nextUnavailable ? 0.45 : 1);
    this.menuButton.setAlpha(1);
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const compact = width < 560;

    this.header.setFontSize(compact ? 13 : 16).setPosition(width / 2, 25);
    this.status.setFontSize(compact ? 11 : 14).setPosition(10, height - 126);
    this.tutorialText
      .setFontSize(compact ? 10 : 13)
      .setPosition(width / 2, compact ? 57 : 60)
      .setWordWrapWidth(Math.max(220, width - 24));

    const controlsY = height - 22;
    const gap = 68;
    this.restartButton.setPosition(width / 2, controlsY);
    this.previousButton.setPosition(width / 2 - gap, controlsY);
    this.nextButton.setPosition(width / 2 + gap, controlsY);
    this.menuButton.setPosition(compact ? width - 48 : width - 70, controlsY);
    this.nextButton.setText(this.mode === PlayMode.TUTORIAL ? "START" : ">");

    this.layoutPanel(width, height, compact);

    const topBarHeight =
      this.mode === PlayMode.TUTORIAL ? TOP_BAR_HEIGHT + 54 : TOP_BAR_HEIGHT;
    const boardHeight = Math.max(100, height - topBarHeight - BOTTOM_BAR_HEIGHT);
    const boardWidth = Math.max(100, width - 16);
    const plateWidth = Math.sqrt(3) * (this.plateRadius * 2 + 1) + 0.2;
    const plateHeight = this.plateRadius * 3 + 2.2;
    this.hexSize = Math.max(
      9,
      Math.min(boardWidth / plateWidth, boardHeight / plateHeight),
    );
    this.boardCenterX = width / 2;
    this.boardCenterY = topBarHeight + boardHeight / 2;

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
    this.layoutMechanicCard(width, height, compact);
  }

  layoutMechanicCard(width, height, compact) {
    this.mechanicCardHitZone.setPosition(width / 2, height / 2).setSize(width, height);
    if (this.mechanicCardHitZone.input?.hitArea) {
      this.mechanicCardHitZone.input.hitArea.setTo(0, 0, width, height);
    }
    if (!this.mechanicCardVisible) return;

    const cardWidth = Math.min(width - 28, 520);
    const cardHeight = compact ? 210 : 230;
    const x = (width - cardWidth) / 2;
    const y = (height - cardHeight) / 2;
    this.mechanicCardGraphics.clear();
    this.mechanicCardGraphics.fillStyle(0x000000, 0.72);
    this.mechanicCardGraphics.fillRect(0, 0, width, height);
    this.mechanicCardGraphics.fillStyle(0x202020, 1);
    this.mechanicCardGraphics.fillRect(x, y, cardWidth, cardHeight);
    this.mechanicCardGraphics.lineStyle(2, 0xf0d58a, 1);
    this.mechanicCardGraphics.strokeRect(x, y, cardWidth, cardHeight);
    this.mechanicCardText
      .setFontSize(compact ? 14 : 18)
      .setPosition(width / 2, height / 2 - 18)
      .setWordWrapWidth(cardWidth - 34);
    this.mechanicCardHint.setPosition(width / 2, y + cardHeight - 28);
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
    const total = this.initialPieces.length || 0;
    const chapter =
      this.mode === PlayMode.CAMPAIGN
        ? (this.levelDefinition?.chapter ?? "campaign").toUpperCase()
        : (this.boardShape ?? "-").toUpperCase();
    const levelLabel =
      this.mode === PlayMode.CAMPAIGN
        ? `${String(this.level + 1).padStart(2, "0")}/${PROGRESSION_LEVEL_COUNT}`
        : String(this.level + 1).padStart(4, "0");
    this.header.setText(
      this.mode === PlayMode.TUTORIAL
        ? `TUTORIAL / BASICS   ${count}/${total}`
        : `${this.mode.toUpperCase()} / ${chapter}   LEVEL ${levelLabel}   ${count}/${total}`,
    );
    this.menuButton.setText(
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL
        ? "LEVELS"
        : "MENU",
    );

    this.renderPanel();
    this.cellGraphics.clear();
    for (const cell of this.plateCells) {
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
    this.renderTutorialPulse(this.time.now);
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
      this.panelHighlightTimer?.remove(false);
      this.panelHighlightTimer = undefined;
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
