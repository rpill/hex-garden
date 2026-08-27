import Phaser from "phaser";
import { Atom, ATOM_NAMES } from "../../atom-types.js";
import { GardenBoard } from "../../board.js";
import { BrowserLevelGenerator } from "../../browser.js";
import {
  HintType,
  productForHint,
  rewardedAmountForHint,
} from "../../economy.js";
import {
  boardClearBaseScore,
  createEndlessScoreState,
  nextStreakMultiplier,
  scoreClearedBoard,
  scoreRemovedAtoms,
  streakMultiplier,
} from "../../endless-score.js";
import { BoardVariant } from "../../generator.js";
import { PROGRESSION_LEVEL_COUNT } from "../../progression.js";
import { STANDARD_ENDLESS_UNLOCK_LEVEL } from "../../mode-access.js";
import { BOARD_CENTER, enumerateBoardCells, hexKey } from "../../hex.js";
import {
  PANEL_METAL_TYPES,
  createPanelState,
  panelTypesForVariant,
} from "../../panel-state.js";
import { mechanicIntroductionForLevel } from "../../mechanic-introductions.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEconomy } from "../economy.js";
import { getSettings } from "../settings.js";
import { CompletionOverlay } from "../completion-overlay.js";
import {
  RewardedAdStatus,
  getYandexGamesAdapter,
} from "../../platform/yandex-games.js";
import { PlayMode } from "../modes.js";
import { classifyBoardViewport } from "../responsive-layout.js";
import {
  SolveStatus,
  findLastSolvableSnapshot,
  findWinningRoute,
  moveKey,
} from "../../solver.js";
import {
  TUTORIAL_GUIDED_MOVE_COUNT,
  createTutorialLevel,
  findLongestEmptyNeighbourRun,
} from "../../tutorial.js";

const CAMPAIGN_SEED = "rules-lab-v1";
const TOP_BAR_HEIGHT = 52;
const BOTTOM_BAR_HEIGHT = 190;
const PANEL_HIGHLIGHT_DURATION_MS = 2000;
const MOVE_HINT_DURATION_MS = 4000;

function formatScore(value) {
  return Math.round(value).toLocaleString("ru-RU");
}

function formatMultiplier(value) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

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
  [Atom.SALT]: 0xd8d6cf,
  [Atom.AIR]: 0xc7d9e8,
  [Atom.FIRE]: 0xd98370,
  [Atom.WATER]: 0x76a8c8,
  [Atom.EARTH]: 0x93ad78,
  [Atom.QUICKSILVER]: 0xd7d9db,
  [Atom.GOLD]: 0xc8a84e,
  [Atom.SILVER]: 0xaebbc6,
  [Atom.COPPER]: 0xb77958,
  [Atom.IRON]: 0x858c92,
  [Atom.TIN]: 0xa2aaa8,
  [Atom.LEAD]: 0x69717d,
  [Atom.VITAE]: 0xd8c58e,
  [Atom.MORS]: 0x86778d,
  [Atom.QUINTESSENCE]: 0xb49bc8,
});

const LOCKED_ATOM_NAMES = Object.freeze({
  [Atom.GOLD]: "ЗОЛОТО (Au)",
  [Atom.SILVER]: "СЕРЕБРО (Ag)",
  [Atom.COPPER]: "МЕДЬ (Cu)",
  [Atom.IRON]: "ЖЕЛЕЗО (Fe)",
  [Atom.TIN]: "ОЛОВО (Sn)",
  [Atom.LEAD]: "СВИНЕЦ (Pb)",
});

function makeText(scene, text, size, color = "#d8d8d8") {
  return scene.add.text(0, 0, text, {
    fontFamily: 'Inter, Arial, "Segoe UI", sans-serif',
    fontSize: `${size}px`,
    color,
  }).setResolution(Math.min(2, globalThis.devicePixelRatio || 1));
}

function makeButton(scene, label, onClick) {
  const text = makeText(scene, label, 16, "#e5e5e5")
    .setOrigin(0.5)
    .setPadding(14, 10)
    .setFontStyle("bold")
    .setBackgroundColor("#29332e")
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
    this.panelTypes = [];
    this.activePanelType = null;
    this.panelHighlightTimer = undefined;
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.mechanicCardVisible = false;
    this.endlessScoreState = createEndlessScoreState();
    this.displayedEndlessScore = 0;
    this.endlessScoreTween = undefined;
    this.endlessRunOver = false;
    this.campaignLevelScore = 0;
    this.displayedCampaignScore = 0;
    this.campaignScoreTween = undefined;
    this.campaignScoringActive = false;
    this.removalHistory = [];
    this.activeHintKeys = new Set();
    this.hintTimer = undefined;
    this.endlessAssisted = false;
    this.economyModalVisible = false;
    this.economyModalProduct = undefined;
    this.rewardedAdPending = false;
    this.endlessBoardStartScore = 0;
    this.certifiedSolution = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.positionDeadEnd = false;
    this.blockedMoveKey = undefined;
  }

  uiText(russian, english) {
    return this.english ? english : russian;
  }

  init(data = {}) {
    this.progress = getCampaignProgress(this);
    this.english = getSettings(this).snapshot.language === "en";
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
    this.endlessScoreState = createEndlessScoreState();
    this.displayedEndlessScore = 0;
    this.endlessScoreTween = undefined;
    this.endlessRunOver = false;
    this.campaignLevelScore = 0;
    this.displayedCampaignScore = this.progress.snapshot.campaignScore;
    this.campaignScoreTween = undefined;
    this.campaignScoringActive = false;
    this.removalHistory = [];
    this.activeHintKeys = new Set();
    this.hintTimer = undefined;
    this.endlessAssisted = false;
    this.economyModalVisible = false;
    this.economyModalProduct = undefined;
    this.rewardedAdPending = false;
    this.endlessBoardStartScore = 0;
    this.certifiedSolution = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.positionDeadEnd = false;
    this.blockedMoveKey = undefined;
  }

  create() {
    this.economy = getEconomy(this);
    this.platform = getYandexGamesAdapter();
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.panelTypes = [];
    this.generator = new BrowserLevelGenerator();
    this.chromeGraphics = this.add.graphics().setDepth(-2);
    this.cellGraphics = this.add.graphics();
    this.atomGraphics = this.add.graphics();
    this.panelGraphics = this.add.graphics().setDepth(4);
    this.tutorialGraphics = this.add.graphics().setDepth(8);
    this.mechanicCardGraphics = this.add.graphics().setDepth(20);
    this.economyModalGraphics = this.add.graphics().setDepth(30);
    this.economyModalHitZone = this.add.zone(0, 0, 1, 1)
      .setDepth(30)
      .setVisible(false);
    this.header = makeText(this, "", 16).setOrigin(0.5).setDepth(10);
    this.status = makeText(this, "", 14, "#b8c3bd").setOrigin(0.5).setDepth(10);
    this.endlessHud = makeText(this, "", 13, "#f0d58a")
      .setOrigin(0.5)
      .setDepth(10);
    this.campaignHud = makeText(this, "", 13, "#c8edc5")
      .setOrigin(0.5)
      .setDepth(10);
    this.dustHud = makeText(this, "", 12, "#f0d58a")
      .setOrigin(1, 0.5)
      .setDepth(10);
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
    this.mechanicCardHint = makeText(this, this.uiText("НАЖМИТЕ, ЧТОБЫ НАЧАТЬ", "TAP TO START"), 12, "#f0d58a")
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.mechanicCardHitZone = this.add.zone(0, 0, 1, 1).setDepth(22);
    this.mechanicCardHitZone.on("pointerdown", () => this.dismissMechanicCard());

    this.economyModalTitle = makeText(this, "", 19, "#ededed")
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.economyModalBody = makeText(this, "", 13, "#bdbdbd")
      .setOrigin(0.5)
      .setAlign("center")
      .setDepth(31)
      .setVisible(false);
    this.economyModalMessage = makeText(this, "", 12, "#c8edc5")
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.economyModalBuy = makeButton(this, this.uiText("КУПИТЬ", "BUY"), () =>
      this.purchaseEconomyModalProduct(),
    ).setDepth(31).setVisible(false).disableInteractive();
    this.economyModalAd = makeButton(this, this.uiText("РЕКЛАМА", "AD"), () =>
      this.showRewardedForEconomyModal(),
    ).setDepth(31).setVisible(false).disableInteractive();
    this.economyModalClose = makeButton(this, this.uiText("ЗАКРЫТЬ", "CLOSE"), () =>
      this.closeEconomyModal(),
    ).setDepth(31).setVisible(false).disableInteractive();

    this.previousButton = makeButton(this, "‹", () => this.changeLevel(-1)).setDepth(10);
    this.restartButton = makeButton(this, this.uiText("ЗАНОВО", "RESTART"), () => this.restartLevel()).setDepth(10);
    this.nextButton = makeButton(this, "›", () => this.changeLevel(1)).setDepth(10);
    this.levelsButton = makeButton(this, this.uiText("УРОВНИ", "LEVELS"), () =>
      this.openLevelSelect(),
    ).setDepth(10);
    this.menuButton = makeButton(this, this.uiText("←  МЕНЮ", "←  MENU"), () => this.openMainMenu()).setDepth(10);
    this.hintButtons = new Map([
      [HintType.MOVE, makeButton(this, "✦  ХОД +", () => this.useHint(HintType.MOVE)).setDepth(10)],
      [HintType.UNDO, makeButton(this, "↶  ОТМЕНА +", () => this.useHint(HintType.UNDO)).setDepth(10)],
      [HintType.RESCUE, makeButton(this, "◆  СПАСТИ +", () => this.useHint(HintType.RESCUE)).setDepth(10)],
    ]);
    this.completionOverlay = new CompletionOverlay(this);

    this.input.keyboard?.on("keydown-LEFT", () => this.changeLevel(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => this.changeLevel(1));
    this.input.keyboard?.on("keydown-R", () => this.restartLevel());
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.rewardedAdPending) return;
      if (this.completionOverlay.visible) {
        this.completionOverlay.exit();
        return;
      }
      if (this.economyModalVisible) this.closeEconomyModal();
      else this.leaveBoard();
    });

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
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
    if (this.mode === PlayMode.STANDARD) this.endlessRunOver = false;
    if (this.mode === PlayMode.STANDARD) {
      this.endlessBoardStartScore = this.endlessScoreState.score;
    }
    this.removalHistory = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.positionDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.clearMoveHint(false);
    if (this.mode === PlayMode.CAMPAIGN) {
      this.campaignScoreTween?.stop();
      this.campaignLevelScore = 0;
      this.displayedCampaignScore = this.progress.snapshot.campaignScore;
      this.campaignScoringActive =
        !this.progress.isCompleted(this.level) ||
        this.progress.snapshot.levelScores[this.level] === 0;
    }
    this.setBusy(true);
    this.board = undefined;
    this.initialPieces = [];
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.hideMechanicCard();
    this.status.setText("GENERATING");
    this.clearPieceViews();
    this.rebuildPanelViews();
    this.render();

    try {
      const record =
        this.mode === PlayMode.TUTORIAL
          ? createTutorialLevel()
          : this.mode === PlayMode.CAMPAIGN
          ? await this.generator.generateProgression(this.level, {
              campaignSeed: CAMPAIGN_SEED,
            })
          : this.mode === PlayMode.STANDARD
          ? await this.generator.generateEndlessRun(this.level, {
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
      this.certifiedSolution = record.solution.map((move) =>
        move.map((position) => ({ ...position })),
      );
      this.knownWinningRoute = this.certifiedSolution;
      this.positionSolveStatus = SolveStatus.SOLVED;
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
    if (this.busy || this.completionOverlay?.visible) return;
    if (this.mode === PlayMode.TUTORIAL) {
      if (delta > 0 && this.board?.won) {
        this.scene.start("board", { mode: PlayMode.CAMPAIGN, level: 0 });
      }
      return;
    }
    if (this.mode === PlayMode.STANDARD) {
      if (delta <= 0 || !this.board?.won || this.endlessRunOver) return;
      this.level += 1;
      this.loadLevel();
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
    if (this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL) {
      this.scene.start("level-select");
    } else {
      this.scene.start("menu");
    }
  }

  openLevelSelect() {
    if (this.mode !== PlayMode.CAMPAIGN && this.mode !== PlayMode.TUTORIAL) {
      return;
    }
    this.generationToken += 1;
    this.scene.start("level-select");
  }

  openMainMenu() {
    this.generationToken += 1;
    this.scene.start("menu");
  }

  restartLevel() {
    if (
      this.busy ||
      this.completionOverlay?.visible ||
      this.initialPieces.length === 0
    ) return;
    if (this.mode === PlayMode.STANDARD) {
      this.endlessScoreTween?.stop();
      this.endlessScoreState = createEndlessScoreState();
      this.displayedEndlessScore = 0;
      this.endlessRunOver = false;
      this.endlessAssisted = false;
      this.level = 0;
      this.loadLevel();
      return;
    }
    if (this.mode === PlayMode.CAMPAIGN) {
      this.campaignScoreTween?.stop();
      this.campaignLevelScore = 0;
      this.displayedCampaignScore = this.progress.snapshot.campaignScore;
      this.campaignScoringActive =
        !this.progress.isCompleted(this.level) ||
        this.progress.snapshot.levelScores[this.level] === 0;
    }
    this.removalHistory = [];
    this.knownWinningRoute = this.certifiedSolution;
    this.positionSolveStatus = SolveStatus.SOLVED;
    this.positionDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.clearMoveHint(false);
    this.board = new GardenBoard(this.initialPieces);
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.status.setText("");
    this.rebuildPieceViews();
    this.updateTutorialGuide();
    this.layout();
  }

  selectPiece(piece) {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      this.completionOverlay?.visible ||
      this.positionDeadEnd ||
      this.endlessRunOver ||
      !this.board
    ) {
      return;
    }
    if (!this.tutorialAllowsPiece(piece)) {
      this.status.setText("НАЖМИТЕ НА ПУЛЬСИРУЮЩИЕ АТОМЫ");
      return;
    }
    if (this.wouldCompleteBlockedMove(piece)) {
      this.board.clearSelection();
      this.status.setText(
        this.uiText(
          "ЭТОТ ХОД УЖЕ ПРИВОДИЛ В ТУПИК — ВЫБЕРИТЕ ДРУГОЙ",
          "THIS MOVE ALREADY LED TO A DEAD END — CHOOSE ANOTHER",
        ),
      );
      this.render();
      return;
    }
    const beforeRemoval = {
      pieces: this.board.pieces(),
      endlessScoreState: { ...this.endlessScoreState },
      campaignLevelScore: this.campaignLevelScore,
      displayedCampaignScore: this.displayedCampaignScore,
      displayedEndlessScore: this.displayedEndlessScore,
    };
    const result = this.board.select(piece);
    if (result.kind === "locked") {
      this.status.setText(
        `ЗАБЛОКИРОВАНО: ${LOCKED_ATOM_NAMES[piece.type] ?? ATOM_NAMES[piece.type].toUpperCase()}`,
      );
    } else if (result.kind === "selected") {
      const selected = result.selected.map((item) => ATOM_LABELS[item.type]).join(" + ");
      this.status.setText(`SELECTED: ${selected}`);
    } else if (result.kind === "deselected") {
      this.status.setText("");
    } else if (result.kind === "removed") {
      this.blockedMoveKey = undefined;
      this.removalHistory.push(beforeRemoval);
      if (this.removalHistory.length > 64) this.removalHistory.shift();
      this.clearMoveHint(false);
      let message = "";
      if (this.mode === PlayMode.STANDARD) {
        const scoredRemoval = scoreRemovedAtoms(
          this.endlessScoreState,
          result.removed.length,
        );
        this.endlessScoreState = scoredRemoval.state;
        this.showScorePopup(result.removed, `+${formatScore(scoredRemoval.award)}`);
        this.animateEndlessScore(this.endlessScoreState.score);
      } else if (
        this.mode === PlayMode.CAMPAIGN &&
        this.campaignScoringActive
      ) {
        const scoredRemoval = scoreRemovedAtoms(
          { score: this.campaignLevelScore, streak: 0 },
          result.removed.length,
        );
        this.campaignLevelScore = scoredRemoval.state.score;
        this.showScorePopup(
          result.removed,
          `+${formatScore(scoredRemoval.award)}`,
          "#c8edc5",
        );
        this.animateCampaignScore(
          this.progress.snapshot.campaignScore + this.campaignLevelScore,
        );
      }
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
          const progressBefore = this.progress.snapshot;
          const alreadyCompleted = this.progress.isCompleted(this.level);
          const shouldRecordScore =
            this.campaignScoringActive &&
            this.progress.snapshot.levelScores[this.level] === 0;
          let clearAward = 0;
          if (shouldRecordScore) {
            clearAward = boardClearBaseScore(
              1 + 3 * this.plateRadius * (this.plateRadius + 1),
            );
            this.campaignLevelScore += clearAward;
            this.showScorePopup(
              [],
              `CLEAR +${formatScore(clearAward)}`,
              "#c8edc5",
            );
          }
          const snapshot = this.progress.complete(this.level, {
            score: shouldRecordScore ? this.campaignLevelScore : 0,
          });
          const dust = this.economy.claimCampaignLevel(
            this.level,
            1 + 3 * this.plateRadius * (this.plateRadius + 1),
          );
          this.campaignScoringActive = false;
          this.animateCampaignScore(snapshot.campaignScore);
          if (snapshot.campaignCompleted) {
            message = `CAMPAIGN COMPLETE   SCORE ${formatScore(snapshot.campaignScore)}`;
          } else if (!alreadyCompleted && !this.progress.testMode) {
            message =
              `BOARD CLEARED - LEVEL ${this.level + 2} UNLOCKED`;
          }
          if (dust.award > 0) message += `   +${dust.award} ПЫЛИ`;
          const unlockedEndless =
            !alreadyCompleted &&
            !this.progress.testMode &&
            this.level === STANDARD_ENDLESS_UNLOCK_LEVEL;
          this.showCampaignCompletion({
            snapshot,
            progressBefore,
            scoreAward: shouldRecordScore ? this.campaignLevelScore : 0,
            dustAward: dust.award,
            dustTotal: dust.snapshot.dust,
            unlockedEndless,
          });
        } else if (this.mode === PlayMode.STANDARD) {
          const clearScore = scoreClearedBoard(
            this.endlessScoreState,
            1 + 3 * this.plateRadius * (this.plateRadius + 1),
          );
          this.endlessScoreState = clearScore.state;
          const dust = this.economy.awardEndlessClear(
            1 + 3 * this.plateRadius * (this.plateRadius + 1),
          );
          this.showScorePopup(
            [],
            `CLEAR +${formatScore(clearScore.award)}`,
            "#c8edc5",
          );
          this.animateEndlessScore(this.endlessScoreState.score);
          message =
            `BOARD CLEARED   STREAK ${this.endlessScoreState.streak}   ` +
            `×${formatMultiplier(clearScore.multiplier)}   +${dust.award} ПЫЛИ`;
          this.showEndlessCompletion({
            clearScore,
            dustAward: dust.award,
            dustTotal: dust.snapshot.dust,
          });
        }
        this.setBusy(false);
      } else {
        const analysis = this.analyzeCurrentPosition();
        if (analysis.status === SolveStatus.DEAD_END) {
          message = this.deadEndMessage();
        }
      }
      this.status.setText(message);
      this.rebuildPieceViews();
      this.updateTutorialGuide();
    }
    this.layout();
  }

  showCampaignCompletion({
    snapshot,
    progressBefore,
    scoreAward,
    dustAward,
    dustTotal,
    unlockedEndless,
  }) {
    const completed = snapshot.completedLevels.length;
    const campaignComplete = snapshot.campaignCompleted;
    this.completionOverlay.show(
      {
        title: campaignComplete ? this.uiText("КАМПАНИЯ ЗАВЕРШЕНА", "CAMPAIGN COMPLETE") : this.uiText("УРОВЕНЬ ПРОЙДЕН", "LEVEL COMPLETE"),
        subtitle: `${this.uiText("УРОВЕНЬ", "LEVEL")} ${String(this.level + 1).padStart(2, "0")} / ${PROGRESSION_LEVEL_COUNT}`,
        scoreAward,
        totalScore: snapshot.campaignScore,
        dustAward,
        dustTotal,
        progressStart: progressBefore.completedLevels.length,
        progressEnd: completed,
        progressMax: PROGRESSION_LEVEL_COUNT,
        progressText: (value) =>
          `${this.uiText("ПРОГРЕСС КАМПАНИИ", "CAMPAIGN PROGRESS")}  ${Math.round(value)} / ${PROGRESSION_LEVEL_COUNT}`,
        unlockText: unlockedEndless
          ? this.uiText("ОТКРЫТ НОВЫЙ РЕЖИМ: ENDLESS", "NEW MODE UNLOCKED: ENDLESS")
          : campaignComplete
          ? this.uiText("ВСЕ УРОВНИ ПРОЙДЕНЫ", "ALL LEVELS COMPLETE")
          : `${this.uiText("ОТКРЫТ УРОВЕНЬ", "LEVEL UNLOCKED")} ${Math.min(PROGRESSION_LEVEL_COUNT, this.level + 2)}`,
        continueLabel: campaignComplete
          ? this.uiText("К РЕЗУЛЬТАТАМ", "VIEW RESULTS")
          : this.uiText("СЛЕДУЮЩИЙ УРОВЕНЬ", "NEXT LEVEL"),
        exitLabel: this.uiText("К ВЫБОРУ УРОВНЕЙ", "LEVEL SELECT"),
      },
      {
        onContinue: () => {
          if (campaignComplete) this.openLevelSelect();
          else this.changeLevel(1);
        },
        onExit: () => this.openLevelSelect(),
      },
    );
  }

  showEndlessCompletion({ clearScore, dustAward, dustTotal }) {
    const streak = this.endlessScoreState.streak;
    const next = nextStreakMultiplier(streak);
    const progressMax = next?.streak ?? Math.max(1, streak);
    this.completionOverlay.show(
      {
        title: this.uiText("ПОЛЕ ОЧИЩЕНО", "BOARD CLEARED"),
        subtitle: `${this.uiText("ПОЛЕ", "BOARD")} ${String(this.level + 1).padStart(2, "0")}   ·   ${this.uiText("СЕРИЯ", "STREAK")} ${streak}`,
        scoreAward:
          this.endlessScoreState.score - this.endlessBoardStartScore,
        totalScore: this.endlessScoreState.score,
        dustAward,
        dustTotal,
        progressStart: Math.max(0, streak - 1),
        progressEnd: streak,
        progressMax,
        progressText: (value) =>
          next
            ? `${this.uiText("СЕРИЯ", "STREAK")}  ${Math.round(value)} / ${next.streak}   ${this.uiText("ДО", "TO")} ×${formatMultiplier(next.multiplier)}`
            : `${this.uiText("СЕРИЯ", "STREAK")}  ${Math.round(value)}   ·   ${this.uiText("МАКСИМАЛЬНЫЙ МНОЖИТЕЛЬ", "MAX MULTIPLIER")}`,
        unlockText:
          `${this.uiText("БОНУС ОЧИСТКИ", "CLEAR BONUS")} ×${formatMultiplier(clearScore.multiplier)}` +
          (this.endlessAssisted ? "   ·   ASSISTED" : ""),
        continueLabel: this.uiText("СЛЕДУЮЩЕЕ ПОЛЕ", "NEXT BOARD"),
        exitLabel: this.uiText("ЗАВЕРШИТЬ ЗАБЕГ", "END RUN"),
      },
      {
        onContinue: () => this.changeLevel(1),
        onExit: () => this.openMainMenu(),
      },
    );
  }

  showScorePopup(removedPieces, text, color = "#f0d58a") {
    if (
      this.mode !== PlayMode.STANDARD &&
      this.mode !== PlayMode.CAMPAIGN
    ) {
      return;
    }
    const positions = removedPieces.map((piece) => this.hexToScreen(piece));
    const x =
      positions.length > 0
        ? positions.reduce((sum, position) => sum + position.x, 0) /
          positions.length
        : this.boardCenterX;
    const y =
      positions.length > 0
        ? positions.reduce((sum, position) => sum + position.y, 0) /
          positions.length
        : this.boardCenterY;
    const popup = makeText(this, text, positions.length > 0 ? 17 : 21, color)
      .setOrigin(0.5)
      .setPosition(x, y)
      .setDepth(18)
      .setScale(0.82);
    this.tweens.add({
      targets: popup,
      y: y - (positions.length > 0 ? 42 : 58),
      alpha: 0,
      scale: 1.12,
      duration: positions.length > 0 ? 760 : 1050,
      ease: "Cubic.Out",
      onComplete: () => popup.destroy(),
    });
  }

  animateEndlessScore(targetScore) {
    if (this.mode !== PlayMode.STANDARD) return;
    this.endlessScoreTween?.stop();
    const counter = { value: this.displayedEndlessScore };
    const distance = Math.max(1, targetScore - this.displayedEndlessScore);
    this.endlessScoreTween = this.tweens.add({
      targets: counter,
      value: targetScore,
      duration: Math.min(900, 220 + Math.sqrt(distance) * 12),
      ease: "Cubic.Out",
      onUpdate: () => {
        this.displayedEndlessScore = Math.round(counter.value);
        this.updateEndlessHud();
      },
      onComplete: () => {
        this.displayedEndlessScore = targetScore;
        this.endlessScoreTween = undefined;
        this.updateEndlessHud();
      },
    });
  }

  animateCampaignScore(targetScore) {
    if (this.mode !== PlayMode.CAMPAIGN) return;
    this.campaignScoreTween?.stop();
    const counter = { value: this.displayedCampaignScore };
    const distance = Math.max(1, targetScore - this.displayedCampaignScore);
    this.campaignScoreTween = this.tweens.add({
      targets: counter,
      value: targetScore,
      duration: Math.min(900, 220 + Math.sqrt(distance) * 12),
      ease: "Cubic.Out",
      onUpdate: () => {
        this.displayedCampaignScore = Math.round(counter.value);
        this.updateCampaignHud();
      },
      onComplete: () => {
        this.displayedCampaignScore = targetScore;
        this.campaignScoreTween = undefined;
        this.updateCampaignHud();
      },
    });
  }

  updateEndlessHud() {
    const visible = this.mode === PlayMode.STANDARD;
    this.endlessHud?.setVisible(visible);
    if (!visible || !this.endlessHud) return;
    const streak = this.endlessScoreState.streak;
    const multiplier = streakMultiplier(streak);
    const next = nextStreakMultiplier(streak);
    const nextLabel = next
      ? `${this.uiText("ДАЛЬШЕ", "NEXT")} ×${formatMultiplier(next.multiplier)} ${this.uiText("НА", "AT")} ${next.streak}`
      : `${this.uiText("МАКС", "MAX")} ×${formatMultiplier(multiplier)}`;
    const separator = this.scale.width < 560 ? "\n" : "   ";
    const assisted = this.endlessAssisted ? "   ASSISTED" : "";
    this.endlessHud.setText(
      `${this.uiText("СЧЁТ", "SCORE")} ${formatScore(this.displayedEndlessScore)}   ` +
        `${this.uiText("СЕРИЯ", "STREAK")} ${streak}   ×${formatMultiplier(multiplier)}` +
        `${assisted}${separator}${nextLabel}`,
    );
  }

  updateCampaignHud() {
    const visible = this.mode === PlayMode.CAMPAIGN;
    this.campaignHud?.setVisible(visible);
    if (!visible || !this.campaignHud) return;
    this.campaignHud.setText(
      `${this.uiText("СЧЁТ КАМПАНИИ", "CAMPAIGN SCORE")} ${formatScore(this.displayedCampaignScore)}`,
    );
  }

  updateEconomyUi() {
    if (!this.economy || !this.hintButtons) return;
    const snapshot = this.economy.snapshot;
    const visible =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.STANDARD;
    this.dustHud?.setText(`${this.uiText("ПЫЛЬ", "DUST")} ${formatScore(snapshot.dust)}`).setVisible(visible);

    const labels = {
      [HintType.MOVE]: this.uiText("✦  ХОД", "✦  HINT"),
      [HintType.UNDO]: this.uiText("↶  ОТМЕНА", "↶  UNDO"),
      [HintType.RESCUE]: this.uiText("◆  СПАСТИ", "◆  RESCUE"),
    };
    for (const [type, button] of this.hintButtons) {
      const typeVisible = visible &&
        (type !== HintType.RESCUE || this.mode === PlayMode.STANDARD);
      const count = snapshot.hints[type];
      const actionAvailable =
        (type !== HintType.MOVE || !this.positionDeadEnd) &&
        (type !== HintType.UNDO || !this.endlessRunOver) &&
        (type !== HintType.RESCUE || this.positionDeadEnd);
      button
        .setText(`${labels[type]} ${count > 0 ? `×${count}` : "+"}`)
        .setVisible(typeVisible)
        .setAlpha(actionAvailable ? 1 : 0.42);
      if (typeVisible) button.setInteractive({ useHandCursor: true });
      else button.disableInteractive();
    }
  }

  wouldCompleteBlockedMove(piece) {
    if (!this.blockedMoveKey || !this.board?.isFree(piece)) return false;
    const selected = this.board.selected;
    if (selected.length === 0 && piece.type !== Atom.GOLD) return false;
    return moveKey([...selected, piece]) === this.blockedMoveKey;
  }

  deadEndMessage() {
    return this.mode === PlayMode.STANDARD
      ? this.uiText(
          "ТУПИК: ИЗ ЭТОЙ ПОЗИЦИИ ПОЛЕ НЕ ОЧИСТИТЬ — ИСПОЛЬЗУЙТЕ СПАСЕНИЕ ИЛИ НАЧНИТЕ ЗАНОВО",
          "DEAD END: THIS BOARD CANNOT BE CLEARED — USE RESCUE OR START OVER",
        )
      : this.uiText(
          "ТУПИК: ИЗ ЭТОЙ ПОЗИЦИИ ПОЛЕ НЕ ОЧИСТИТЬ — НАЧНИТЕ УРОВЕНЬ ЗАНОВО",
          "DEAD END: THIS BOARD CANNOT BE CLEARED — RESTART THE LEVEL",
        );
  }

  analyzeCurrentPosition({ maxMilliseconds = 90 } = {}) {
    if (!this.board || this.board.won) {
      this.positionSolveStatus = SolveStatus.SOLVED;
      this.positionDeadEnd = false;
      this.knownWinningRoute = [];
      return { status: SolveStatus.SOLVED, route: [] };
    }
    if (this.board.legalMoves().length === 0) {
      this.positionSolveStatus = SolveStatus.DEAD_END;
      this.positionDeadEnd = true;
      this.knownWinningRoute = [];
      if (this.mode === PlayMode.STANDARD) this.endlessRunOver = true;
      return { status: SolveStatus.DEAD_END, route: [] };
    }
    const analysis = findWinningRoute(this.board, {
      preferredSolution: this.certifiedSolution,
      maxMilliseconds,
      maxVisited: 80_000,
    });
    this.positionSolveStatus = analysis.status;
    this.positionDeadEnd = analysis.status === SolveStatus.DEAD_END;
    this.knownWinningRoute =
      analysis.status === SolveStatus.SOLVED ? analysis.route : [];
    if (this.mode === PlayMode.STANDARD && this.positionDeadEnd) {
      this.endlessRunOver = true;
    }
    return analysis;
  }

  useHint(type) {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      !this.board
    ) {
      return;
    }
    if (type === HintType.MOVE && this.positionDeadEnd) {
      this.status.setText(this.deadEndMessage());
      return;
    }
    if (type === HintType.UNDO && this.endlessRunOver) {
      this.status.setText(
        this.uiText(
          "В ТУПИКЕ ОБЫЧНАЯ ОТМЕНА НЕ СПИСЫВАЕТСЯ — ИСПОЛЬЗУЙТЕ СПАСЕНИЕ",
          "NORMAL UNDO IS NOT SPENT IN A DEAD END — USE RESCUE",
        ),
      );
      return;
    }
    if (
      type === HintType.RESCUE &&
      (this.mode !== PlayMode.STANDARD || !this.positionDeadEnd)
    ) {
      this.status.setText(
        this.uiText(
          "СПАСЕНИЕ ДОСТУПНО ТОЛЬКО ПОСЛЕ ДОКАЗАННОГО ТУПИКА В ENDLESS",
          "RESCUE IS AVAILABLE ONLY AFTER A VERIFIED ENDLESS DEAD END",
        ),
      );
      return;
    }
    if (type === HintType.RESCUE && this.removalHistory.length === 0) {
      this.status.setText(
        this.uiText(
          "ВОССТАНОВИТЬ НЕЧЕГО — БУСТ НЕ СПИСАН",
          "NOTHING CAN BE RESTORED — BOOSTER NOT SPENT",
        ),
      );
      return;
    }
    if (this.economy.snapshot.hints[type] <= 0) {
      this.openEconomyModal(type);
      return;
    }

    if (type === HintType.MOVE) {
      if (this.board.won) return;
      const analysis =
        this.positionSolveStatus === SolveStatus.SOLVED &&
        this.knownWinningRoute.length > 0
          ? { status: SolveStatus.SOLVED, route: this.knownWinningRoute }
          : this.analyzeCurrentPosition({ maxMilliseconds: 180 });
      if (analysis.status === SolveStatus.DEAD_END) {
        this.status.setText(this.deadEndMessage());
        this.updateEconomyUi();
        this.render();
        return;
      }
      if (analysis.status === SolveStatus.UNKNOWN || analysis.route.length === 0) {
        this.status.setText(
          this.uiText(
            "НЕ УДАЛОСЬ ПОДТВЕРДИТЬ БЕЗОПАСНЫЙ ХОД — БУСТ НЕ СПИСАН",
            "NO SAFE MOVE COULD BE VERIFIED — BOOSTER NOT SPENT",
          ),
        );
        return;
      }
      const move = analysis.route[0];
      if (!this.economy.consumeHint(type)) return;
      this.markEndlessAssisted();
      this.clearMoveHint(false);
      this.activeHintKeys = new Set(move.map(hexKey));
      this.hintTimer = this.time.delayedCall(MOVE_HINT_DURATION_MS, () => {
        this.hintTimer = undefined;
        this.activeHintKeys.clear();
        this.render();
      });
      this.status.setText(
        this.uiText(
          "ПОДСВЕЧЕН ХОД, ДЛЯ КОТОРОГО НАЙДЕН ПУТЬ ДО ПОЛНОЙ ЗАЧИСТКИ",
          "HIGHLIGHTED MOVE HAS A VERIFIED PATH TO A FULL CLEAR",
        ),
      );
      this.render();
      this.updateEconomyUi();
      return;
    }

    if (type === HintType.UNDO) {
      if (this.endlessRunOver) {
        this.status.setText("ПОСЛЕ ТУПИКА ИСПОЛЬЗУЙТЕ СПАСЕНИЕ");
        return;
      }
      if (this.removalHistory.length === 0 || this.board.won) {
        this.status.setText("ПОКА НЕЧЕГО ОТМЕНЯТЬ");
        return;
      }
      if (!this.economy.consumeHint(type)) return;
      this.markEndlessAssisted();
      this.restoreLastRemoval("ПОСЛЕДНЕЕ УДАЛЕНИЕ ОТМЕНЕНО");
      return;
    }

    if (type === HintType.RESCUE) {
      if (this.mode !== PlayMode.STANDARD || !this.positionDeadEnd) {
        this.status.setText(this.uiText("СПАСЕНИЕ ДОСТУПНО ТОЛЬКО ПОСЛЕ ДОКАЗАННОГО ТУПИКА В ENDLESS", "RESCUE IS AVAILABLE ONLY AFTER A VERIFIED ENDLESS DEAD END"));
        return;
      }
      if (this.removalHistory.length === 0) {
        this.status.setText(this.uiText("ВОССТАНОВИТЬ НЕЧЕГО — БУСТ НЕ СПИСАН", "NOTHING CAN BE RESTORED — BOOSTER NOT SPENT"));
        return;
      }
      const rescue = findLastSolvableSnapshot(
        this.removalHistory,
        this.board.pieces(),
        {
          preferredSolution: this.certifiedSolution,
          maxMilliseconds: 240,
          maxVisited: 160_000,
        },
      );
      if (rescue.status !== SolveStatus.SOLVED) {
        this.status.setText(
          rescue.status === SolveStatus.UNKNOWN
            ? this.uiText("НЕ УДАЛОСЬ НАДЁЖНО НАЙТИ ТОЧКУ СПАСЕНИЯ — БУСТ НЕ СПИСАН", "NO SAFE RESCUE POINT COULD BE VERIFIED — BOOSTER NOT SPENT")
            : this.uiText("В ЭТОМ ЗАБЕГЕ НЕТ РАЗРЕШИМОЙ ТОЧКИ ВОЗВРАТА — БУСТ НЕ СПИСАН", "THIS RUN HAS NO SOLVABLE RESTORE POINT — BOOSTER NOT SPENT"),
        );
        return;
      }
      if (!this.economy.consumeHint(type)) return;
      this.markEndlessAssisted();
      this.restoreHistorySnapshot(
        rescue.index,
        this.uiText("ВОЗВРАТ К ПОСЛЕДНЕЙ РАЗРЕШИМОЙ ПОЗИЦИИ   ·   ТУПИКОВЫЙ ХОД ЗАБЛОКИРОВАН", "RESTORED LAST SOLVABLE POSITION   ·   DEAD-END MOVE BLOCKED"),
        {
          blockedMove: rescue.blockedMove,
          winningRoute: rescue.route,
        },
      );
    }
  }

  markEndlessAssisted() {
    if (this.mode === PlayMode.STANDARD) this.endlessAssisted = true;
  }

  restoreLastRemoval(message) {
    this.restoreHistorySnapshot(this.removalHistory.length - 1, message);
  }

  restoreHistorySnapshot(index, message, { blockedMove = [], winningRoute } = {}) {
    const snapshot = this.removalHistory[index];
    if (!snapshot) return;
    this.removalHistory.splice(index);
    this.board = new GardenBoard(snapshot.pieces);
    this.endlessScoreState = Object.freeze({ ...snapshot.endlessScoreState });
    this.campaignLevelScore = snapshot.campaignLevelScore;
    this.displayedEndlessScore = this.endlessScoreState.score;
    this.displayedCampaignScore =
      this.progress.snapshot.campaignScore + this.campaignLevelScore;
    this.endlessScoreTween?.stop();
    this.campaignScoreTween?.stop();
    this.endlessRunOver = false;
    this.positionDeadEnd = false;
    this.positionSolveStatus = SolveStatus.SOLVED;
    this.knownWinningRoute = winningRoute ?? this.analyzeCurrentPosition().route;
    this.blockedMoveKey = blockedMove.length > 0 ? moveKey(blockedMove) : undefined;
    this.clearPanelHighlight(false);
    this.clearMoveHint(false);
    this.status.setText(message);
    this.setBusy(false);
    this.rebuildPieceViews();
    this.updateEconomyUi();
    this.layout();
  }

  clearMoveHint(render = true) {
    this.hintTimer?.remove(false);
    this.hintTimer = undefined;
    this.activeHintKeys?.clear();
    if (render) this.render();
  }

  openEconomyModal(type) {
    const product = productForHint(type);
    if (!product) return;
    this.economyModalVisible = true;
    this.economyModalProduct = product;
    this.economyModalMessage.setText("").setVisible(true);
    this.economyModalTitle
      .setText(this.english ? product.titleEn : product.title)
      .setVisible(true);
    this.economyModalBody.setVisible(true);
    this.economyModalBuy
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
    this.economyModalAd
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
    this.economyModalClose
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
    this.economyModalHitZone.setVisible(true).setInteractive();
    this.refreshEconomyModal();
    this.layout();
  }

  refreshEconomyModal() {
    const product = this.economyModalProduct;
    if (!product || !this.economyModalVisible) return;
    const snapshot = this.economy.snapshot;
    this.economyModalBody.setText(
      `${this.english ? product.descriptionEn : product.description}\n\n` +
      `${this.uiText("В ИНВЕНТАРЕ", "OWNED")}: ${snapshot.hints[product.hint]}\n` +
      `${this.uiText("БАЛАНС", "BALANCE")}: ${formatScore(snapshot.dust)} ${this.uiText("ПЫЛИ", "DUST")}`,
    );
    this.economyModalBuy
      .setText(`${this.uiText("КУПИТЬ", "BUY")} ×${product.amount}  /  ${product.price} ${this.uiText("ПЫЛИ", "DUST")}`)
      .setAlpha(snapshot.dust >= product.price ? 1 : 0.62);
    const rewardedAmount = rewardedAmountForHint(product.hint);
    const waitSeconds = Math.ceil(this.economy.rewardedWaitMs() / 1000);
    this.economyModalAd
      .setText(
        waitSeconds > 0
          ? `${this.uiText("РЕКЛАМА ЧЕРЕЗ", "AD IN")} ${waitSeconds}${this.uiText("с", "s")}`
          : `${this.uiText("СМОТРЕТЬ РЕКЛАМУ", "WATCH AD")}  /  +${rewardedAmount}`,
      )
      .setAlpha(waitSeconds > 0 ? 0.48 : 1);
  }

  purchaseEconomyModalProduct() {
    if (this.rewardedAdPending) return;
    const product = this.economyModalProduct;
    if (!product) return;
    const result = this.economy.purchase(product.id);
    this.economyModalMessage
      .setText(
        result.ok
          ? `${this.uiText("КУПЛЕНО", "PURCHASED")}: +${product.amount}`
          : `${this.uiText("НЕ ХВАТАЕТ", "NEED")} ${product.price - result.snapshot.dust} ${this.uiText("ПЫЛИ", "DUST")}`,
      )
      .setColor(result.ok ? "#c8edc5" : "#e89070");
    this.updateEconomyUi();
    this.refreshEconomyModal();
  }

  async showRewardedForEconomyModal() {
    if (this.rewardedAdPending || !this.economyModalProduct) return;
    const waitMs = this.economy.rewardedWaitMs();
    if (waitMs > 0) {
      this.economyModalMessage
        .setText(
          `${this.uiText("СЛЕДУЮЩАЯ РЕКЛАМА ЧЕРЕЗ", "NEXT AD IN")} ${Math.ceil(waitMs / 1000)}${this.uiText("с", "s")}`,
        )
        .setColor("#e89070");
      this.refreshEconomyModal();
      return;
    }
    const product = this.economyModalProduct;
    const amount = rewardedAmountForHint(product.hint);
    this.rewardedAdPending = true;
    this.economyModalMessage
      .setText(
        this.platform.isSimulated
          ? this.uiText("ТЕСТОВАЯ РЕКЛАМА...", "TEST AD...")
          : this.uiText("ЗАГРУЗКА РЕКЛАМЫ...", "LOADING AD..."),
      )
      .setColor("#f0d58a");
    this.economyModalBuy.disableInteractive().setAlpha(0.4);
    this.economyModalAd.disableInteractive().setAlpha(0.4);
    this.economyModalClose.disableInteractive().setAlpha(0.4);

    const result = await this.platform.showRewarded();
    this.rewardedAdPending = false;
    if (result.status === RewardedAdStatus.REWARDED) {
      const grant = this.economy.grantRewardedHint(product.hint, { amount });
      if (grant.ok) {
        this.updateEconomyUi();
        this.closeEconomyModal();
        this.status.setText(
          `${this.uiText("ПОЛУЧЕНО", "RECEIVED")}: ${this.english ? product.titleEn : product.title} +${amount}`,
        );
        return;
      }
      this.economyModalMessage
        .setText(this.uiText("РЕКЛАМНАЯ НАГРАДА УЖЕ ПОЛУЧЕНА", "AD REWARD ALREADY CLAIMED"))
        .setColor("#e89070");
    } else if (result.status === RewardedAdStatus.CLOSED) {
      this.economyModalMessage
        .setText(this.uiText("НАГРАДА НЕ ПОЛУЧЕНА", "NO REWARD RECEIVED"))
        .setColor("#e89070");
    } else if (result.status === RewardedAdStatus.BUSY) {
      this.economyModalMessage
        .setText(this.uiText("РЕКЛАМА УЖЕ ОТКРЫТА", "AD IS ALREADY OPEN"))
        .setColor("#e89070");
    } else {
      this.economyModalMessage
        .setText(this.uiText("РЕКЛАМА СЕЙЧАС НЕДОСТУПНА", "AD IS CURRENTLY UNAVAILABLE"))
        .setColor("#e89070");
    }
    if (!this.economyModalVisible) return;
    this.economyModalBuy.setInteractive({ useHandCursor: true });
    this.economyModalAd.setInteractive({ useHandCursor: true }).setAlpha(1);
    this.economyModalClose.setInteractive({ useHandCursor: true }).setAlpha(1);
    this.updateEconomyUi();
    this.refreshEconomyModal();
  }

  closeEconomyModal() {
    if (this.rewardedAdPending) return;
    this.economyModalVisible = false;
    this.economyModalProduct = undefined;
    this.economyModalGraphics.clear();
    this.economyModalHitZone.setVisible(false).disableInteractive();
    for (const item of [
      this.economyModalTitle,
      this.economyModalBody,
      this.economyModalMessage,
      this.economyModalBuy,
      this.economyModalAd,
      this.economyModalClose,
    ]) {
      item.setVisible(false);
    }
    this.economyModalBuy.disableInteractive();
    this.economyModalAd.disableInteractive();
    this.economyModalClose.disableInteractive();
    this.render();
  }

  rebuildPieceViews() {
    this.clearPieceViews();
    if (!this.board) return;
    for (const piece of this.board.pieces()) {
      const label = makeText(this, ATOM_LABELS[piece.type], 16, "#111111")
        .setOrigin(0.5)
        .setFontStyle("bold")
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
    this.panelLayout = undefined;
    this.panelTypes = panelTypesForVariant(this.variant, this.initialPieces);

    for (const type of this.panelTypes) {
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
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      !this.board
    ) return;
    const state = createPanelState(this.board, {
      variant: this.variant,
      types: this.panelTypes,
    });
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
      this.uiText("АТОМ СВОБОДЕН, ЕСЛИ РЯДОМ 3+ ПУСТЫЕ ЯЧЕЙКИ ПОДРЯД\nЗЕЛЁНЫЕ 1-2-3 = СВОБОДЕН. УБЕРИТЕ ПУЛЬСИРУЮЩУЮ ПАРУ ВОЗДУХА", "AN ATOM IS FREE WITH 3+ CONSECUTIVE EMPTY CELLS\nGREEN 1-2-3 = FREE. REMOVE THE PULSING AIR PAIR"),
      this.uiText("УДАЛЕНИЕ ПАРЫ ОТКРЫВАЕТ НОВУЮ СТОРОНУ ИЗ 3 ЯЧЕЕК\nУБЕРИТЕ ПУЛЬСИРУЮЩУЮ ПАРУ ОГНЯ", "REMOVING A PAIR OPENS A NEW SIDE OF 3 CELLS\nREMOVE THE PULSING FIRE PAIR"),
      this.uiText("МЕНЬШЕ 3 ПУСТЫХ ЯЧЕЕК ПОДРЯД = ЗАБЛОКИРОВАН\nОЧИСТИТЕ ОСТАТОК ПОЛЯ БЕЗ ПОДСКАЗКИ", "FEWER THAN 3 CONSECUTIVE EMPTY CELLS = LOCKED\nCLEAR THE REST WITHOUT GUIDANCE"),
    ];
    this.tutorialText
      .setText(
        this.board?.won
          ? this.uiText("ОБУЧЕНИЕ ЗАВЕРШЕНО\nПЕРЕХОДИТЕ К УРОВНЮ 1", "TUTORIAL COMPLETE\nCONTINUE TO LEVEL 1")
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
    const introduction =
      this.mode === PlayMode.CAMPAIGN && !this.progress.isCompleted(this.level)
        ? mechanicIntroductionForLevel(this.level)
        : undefined;
    const text = introduction
      ? this.english ? introduction.textEn : introduction.text
      : undefined;
    if (!text) {
      this.hideMechanicCard();
      return;
    }
    this.mechanicCardVisible = true;
    this.mechanicCardText.setText(text).setVisible(true);
    this.mechanicCardHint
      .setText(this.uiText("НАЖМИТЕ, ЧТОБЫ НАЧАТЬ", "TAP TO START"))
      .setVisible(true);
    this.mechanicCardHitZone
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
  }

  showEndlessUnlockedCard() {
    this.mechanicCardVisible = true;
    this.mechanicCardText
      .setText(
        "ОТКРЫТ НОВЫЙ РЕЖИМ\n\nENDLESS\n\nНАЧНИТЕ С ПОЛЯ НА 37 КЛЕТОК\nИ УДЕРЖИВАЙТЕ СТРИК",
      )
      .setVisible(true);
    this.mechanicCardHint
      .setText("НАЖМИТЕ, ЧТОБЫ ПРОДОЛЖИТЬ")
      .setVisible(true);
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
      this.mode === PlayMode.TUTORIAL ||
      this.mode === PlayMode.STANDARD ||
      this.level === 0;
    const nextUnavailable =
      this.mode === PlayMode.TUTORIAL
        ? !this.board?.won
        : this.mode === PlayMode.STANDARD
        ? !this.board?.won || this.endlessRunOver
        : this.mode === PlayMode.CAMPAIGN &&
          this.level >= this.progress.snapshot.highestUnlocked;
    this.previousButton.setAlpha(value || previousUnavailable ? 0.45 : 1);
    this.restartButton.setAlpha(alpha);
    this.nextButton.setAlpha(value || nextUnavailable ? 0.45 : 1);
    this.levelsButton.setAlpha(1);
    this.menuButton.setAlpha(1);
  }

  layout() {
    const width = this.scale.width;
    const height = this.scale.height;
    const { compact, portrait, sideDock } = classifyBoardViewport(width, height);
    const margin = compact ? 10 : 18;
    const contentLeft = sideDock ? 154 : 0;
    const contentWidth = width - contentLeft;
    const contentCenter = contentLeft + contentWidth / 2;
    const topBarHeight = portrait ? 142 : sideDock ? 78 : 86;

    this.chromeGraphics.clear();
    this.chromeGraphics.fillStyle(0x111714, 1).fillRect(0, 0, width, height);
    this.chromeGraphics.fillStyle(0x18211d, 1).fillRect(0, 0, width, topBarHeight);
    this.chromeGraphics.lineStyle(1, 0x34443b, 1).lineBetween(0, topBarHeight, width, topBarHeight);
    if (sideDock) {
      this.chromeGraphics.fillStyle(0x18211d, 1).fillRect(0, 0, contentLeft, height);
      this.chromeGraphics.lineStyle(1, 0x34443b, 1).lineBetween(contentLeft, 0, contentLeft, height);
    }

    const topButtonWidth = compact ? 96 : 118;
    this.menuButton
      .setFontSize(compact ? 11 : 12)
      .setFixedSize(topButtonWidth, 42)
      .setPosition(margin + topButtonWidth / 2, 28);
    const campaignNavigation =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL;
    this.levelsButton
      .setFontSize(compact ? 10 : 12)
      .setFixedSize(compact ? 92 : 112, 42)
      .setPosition(width - margin - (compact ? 46 : 56), 28)
      .setVisible(campaignNavigation);
    if (campaignNavigation) this.levelsButton.setInteractive({ useHandCursor: true });
    else this.levelsButton.disableInteractive();

    this.header
      .setFontSize(compact ? 12 : 15)
      .setFontStyle("bold")
      .setPosition(contentCenter, portrait ? 74 : 27);
    this.endlessHud
      .setFontSize(compact ? 11 : 12)
      .setPosition(contentCenter, portrait ? 104 : 58);
    this.campaignHud
      .setFontSize(compact ? 11 : 12)
      .setPosition(contentCenter, portrait ? 104 : 58);
    this.dustHud
      .setFontSize(compact ? 10 : 12)
      .setPosition(width - margin, portrait ? 128 : 58);
    this.updateEndlessHud();
    this.updateCampaignHud();
    this.updateEconomyUi();
    this.tutorialText
      .setFontSize(compact ? 11 : 13)
      .setPosition(contentCenter, portrait ? 111 : 56)
      .setWordWrapWidth(Math.max(220, contentWidth - 28));

    this.layoutPanel(contentLeft, contentWidth, width, height, compact || portrait);
    const panelTop = this.panelLayout?.top ?? height - 68;
    if (!sideDock) {
      const dockTop = Math.max(topBarHeight + 120, panelTop - 144);
      this.chromeGraphics.fillStyle(0x151d19, 0.98).fillRect(0, dockTop, width, height - dockTop);
      this.chromeGraphics.lineStyle(1, 0x34443b, 1).lineBetween(0, dockTop, width, dockTop);
    }
    const hintEntries = [...this.hintButtons.entries()].filter(
      ([type]) =>
        (this.mode === PlayMode.CAMPAIGN && type !== HintType.RESCUE) ||
        this.mode === PlayMode.STANDARD,
    );

    let boardBottom;
    if (sideDock) {
      const sideX = contentLeft / 2;
      this.menuButton.setPosition(sideX, 28);
      this.levelsButton
        .setFixedSize(118, 42)
        .setPosition(sideX, 78);
      hintEntries.forEach(([, button], index) => {
        button
          .setFontSize(10)
          .setFixedSize(124, 44)
          .setPosition(sideX, 142 + index * 54);
      });
      this.restartButton.setFixedSize(124, 44).setPosition(sideX, height - 80);
      this.previousButton.setFixedSize(48, 44).setPosition(sideX - 33, height - 30);
      this.nextButton.setFixedSize(48, 44).setPosition(sideX + 33, height - 30);
      this.status
        .setFontSize(11)
        .setWordWrapWidth(Math.max(240, contentWidth - 30))
        .setPosition(contentCenter, panelTop - 18);
      boardBottom = panelTop - 44;
    } else {
      const hintsY = panelTop - 58;
      const controlsY = hintsY - 58;
      const statusY = controlsY - 42;
      const navGap = compact ? 72 : 86;
      const actionWidth = Math.min(
        compact ? 168 : 190,
        Math.max(104, (contentWidth - margin * 2) / Math.max(1, hintEntries.length) - 8),
      );
      const actionStep = actionWidth + 8;
      const actionLeft = contentCenter - actionStep * (hintEntries.length - 1) / 2;
      hintEntries.forEach(([, button], index) => {
        button
          .setFontSize(compact ? 11 : 12)
          .setFixedSize(actionWidth, 46)
          .setPosition(actionLeft + actionStep * index, hintsY);
      });
      this.restartButton
        .setFontSize(compact ? 10 : 12)
        .setFixedSize(compact ? 116 : 138, 44)
        .setPosition(contentCenter, controlsY);
      this.previousButton
        .setFontSize(20)
        .setFixedSize(48, 44)
        .setPosition(contentCenter - navGap, controlsY);
      this.nextButton
        .setFontSize(this.mode === PlayMode.TUTORIAL ? 11 : 20)
        .setFixedSize(this.mode === PlayMode.TUTORIAL ? 112 : 48, 44)
        .setPosition(
          contentCenter + (this.mode === PlayMode.TUTORIAL ? navGap + 28 : navGap),
          controlsY,
        );
      this.status
        .setFontSize(compact ? 10 : 12)
        .setWordWrapWidth(Math.max(240, contentWidth - 32))
        .setPosition(contentCenter, statusY);
      boardBottom = statusY - 22;
    }

    this.restartButton.setText(
      this.mode === PlayMode.STANDARD ? this.uiText("НОВЫЙ ЗАБЕГ", "NEW RUN") : this.uiText("ЗАНОВО", "RESTART"),
    );
    this.previousButton
      .setVisible(this.mode !== PlayMode.STANDARD);
    if (this.mode === PlayMode.STANDARD) {
      this.previousButton.disableInteractive();
    } else {
      this.previousButton.setInteractive({ useHandCursor: true });
    }
    this.nextButton.setText(this.mode === PlayMode.TUTORIAL ? this.uiText("ИГРАТЬ", "PLAY") : "›");

    const boardTop = topBarHeight + 10;
    const boardHeight = Math.max(100, boardBottom - boardTop);
    const boardWidth = Math.max(100, contentWidth - margin * 2);
    const plateWidth = Math.sqrt(3) * (this.plateRadius * 2 + 1) + 0.2;
    const plateHeight = this.plateRadius * 3 + 2.2;
    this.hexSize = Math.max(
      9,
      Math.min(48, boardWidth / plateWidth, boardHeight / plateHeight),
    );
    this.boardCenterX = contentCenter;
    this.boardCenterY = boardTop + boardHeight / 2;

    for (const view of this.pieceViews.values()) {
      const position = this.hexToScreen(view.piece);
      const hitDiameter = Math.max(42, this.hexSize * 1.56);
      view.label
        .setPosition(position.x, position.y)
        .setFontSize(Math.max(11, Math.floor(this.hexSize * 0.57)));
      view.hitZone.setPosition(position.x, position.y).setSize(hitDiameter, hitDiameter);
      view.hitZone.input.hitArea.setTo(
        hitDiameter / 2,
        hitDiameter / 2,
        hitDiameter / 2,
      );
    }
    this.render();
    this.layoutMechanicCard(width, height, compact);
    this.layoutEconomyModal(width, height, compact);
    this.completionOverlay.layout(width, height);
  }

  layoutEconomyModal(width, height, compact) {
    this.economyModalGraphics.clear();
    if (!this.economyModalVisible) return;
    this.economyModalHitZone
      .setPosition(width / 2, height / 2)
      .setSize(width, height);
    if (this.economyModalHitZone.input?.hitArea) {
      this.economyModalHitZone.input.hitArea.setTo(0, 0, width, height);
    }
    const cardWidth = Math.min(width - 28, 500);
    const cardHeight = compact ? 300 : 320;
    const x = (width - cardWidth) / 2;
    const y = (height - cardHeight) / 2;
    this.economyModalGraphics.fillStyle(0x000000, 0.78);
    this.economyModalGraphics.fillRect(0, 0, width, height);
    this.economyModalGraphics.fillStyle(0x202020, 1);
    this.economyModalGraphics.fillRect(x, y, cardWidth, cardHeight);
    this.economyModalGraphics.lineStyle(2, 0xf0d58a, 1);
    this.economyModalGraphics.strokeRect(x, y, cardWidth, cardHeight);
    this.economyModalTitle
      .setFontSize(compact ? 16 : 19)
      .setPosition(width / 2, y + 38);
    this.economyModalBody
      .setFontSize(compact ? 11 : 13)
      .setWordWrapWidth(cardWidth - 36)
      .setPosition(width / 2, y + 112);
    this.economyModalMessage.setPosition(width / 2, y + 174);
    this.economyModalAd
      .setFontSize(compact ? 10 : 13)
      .setFixedSize(Math.min(cardWidth - 36, 330), 38)
      .setPosition(width / 2, y + cardHeight - 116);
    this.economyModalBuy
      .setFontSize(compact ? 10 : 13)
      .setFixedSize(Math.min(cardWidth - 36, 330), 38)
      .setPosition(width / 2, y + cardHeight - 70);
    this.economyModalClose
      .setFontSize(compact ? 10 : 12)
      .setPosition(width / 2, y + cardHeight - 27);
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

  layoutPanel(contentLeft, contentWidth, width, height, compact) {
    const types = this.panelTypes;
    if (types.length === 0) {
      this.panelLayout = undefined;
      this.panelGraphics.clear();
      return;
    }
    const useTwoRows = compact && types.length > 9;
    const columns = useTwoRows ? Math.ceil(types.length / 2) : types.length;
    const rows = Math.ceil(types.length / columns);
    const desiredWidth = columns * (compact ? 48 : 52);
    const panelWidth = Math.min(
      contentWidth - 16,
      compact ? 560 : 760,
      Math.max(116, desiredWidth),
    );
    const left = contentLeft + (contentWidth - panelWidth) / 2;
    const step = panelWidth / columns;
    const radius = Math.max(12, Math.min(compact ? 18 : 20, step * 0.34));
    const rowHeight = Math.max(38, radius * 2 + 8);
    const panelHeight = rows * rowHeight + 16;
    const top = height - panelHeight - 8;
    const entries = types.map((type, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const rowCount = Math.min(columns, types.length - row * columns);
      const rowWidth = step * rowCount;
      const rowLeft = contentLeft + (contentWidth - rowWidth) / 2;
      return {
        type,
        row,
        column,
        x: rowLeft + step * (column + 0.5),
        y: top + 8 + rowHeight * (row + 0.5),
      };
    });

    this.panelLayout = {
      left,
      width: panelWidth,
      top,
      height: panelHeight,
      radius,
      step,
      rows,
      entries,
      types,
    };
    entries.forEach(({ type, x, y }) => {
      const view = this.panelViews.get(type);
      if (!view) return;
      const hitDiameter = Math.max(40, radius * 2.25);
      view.label
        .setPosition(x, y)
        .setFontSize(Math.max(10, Math.floor(radius * 0.78)));
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
    const levelLabel =
      this.mode === PlayMode.CAMPAIGN
        ? `${String(this.level + 1).padStart(2, "0")}/${PROGRESSION_LEVEL_COUNT}`
        : String(this.level + 1).padStart(4, "0");
    this.header.setText(
      this.mode === PlayMode.TUTORIAL
        ? `${this.uiText("ОБУЧЕНИЕ", "TUTORIAL")}  ·  ${count}/${total}`
        : this.mode === PlayMode.CAMPAIGN
        ? `${this.uiText("УРОВЕНЬ", "LEVEL")} ${levelLabel}  ·  ${this.uiText("ОСТАЛОСЬ", "LEFT")} ${count}/${total}`
        : `ENDLESS  ·  ${this.uiText("ПОЛЕ", "BOARD")} ${levelLabel}  ·  ${count}/${total}`,
    );
    this.menuButton.setText(this.uiText("←  МЕНЮ", "←  MENU"));
    this.updateEndlessHud();
    this.updateCampaignHud();
    this.updateEconomyUi();

    this.renderPanel();
    this.cellGraphics.clear();
    for (const cell of this.plateCells) {
      const position = this.hexToScreen(cell);
      this.drawHex(
        this.cellGraphics,
        position.x,
        position.y,
        this.hexSize * 0.96,
        0x171e1b,
        0x34423a,
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
      const isHinted = this.activeHintKeys.has(hexKey(view.piece));
      const isBlocked = this.blockedMoveKey
        ?.split("|")
        .includes(hexKey(view.piece));
      const radius = this.hexSize * 0.7;
      const alpha = free ? 1 : 0.4;

      this.atomGraphics.fillStyle(0x050806, free ? 0.48 : 0.25);
      this.atomGraphics.fillCircle(position.x, position.y + Math.max(1, this.hexSize * 0.08), radius * 1.08);
      this.atomGraphics.fillStyle(0x26312b, alpha);
      this.atomGraphics.fillCircle(position.x, position.y, radius * 1.04);
      this.atomGraphics.fillStyle(ATOM_COLORS[view.piece.type], alpha);
      this.atomGraphics.fillCircle(position.x, position.y, radius * 0.9);
      if (free) {
        this.atomGraphics.fillStyle(0xffffff, 0.12);
        this.atomGraphics.fillEllipse(
          position.x - radius * 0.22,
          position.y - radius * 0.27,
          radius * 0.62,
          radius * 0.3,
        );
      }
      this.atomGraphics.lineStyle(
        isSelected || isPanelMatch || isHinted || isBlocked
          ? Math.max(2, this.hexSize * 0.12)
          : Math.max(1, this.hexSize * 0.045),
        isSelected
          ? 0xffffff
          : isBlocked
          ? 0xe87070
          : isHinted
          ? 0x8ed18c
          : isPanelMatch
          ? 0xf0d58a
          : 0x506159,
        1,
      );
      this.atomGraphics.strokeCircle(position.x, position.y, radius * 1.02);
      view.label
        .setColor(free ? "#121713" : "#1d231f")
        .setAlpha(free ? 1 : 0.5);
    }
    this.renderTutorialPulse(this.time.now);
  }

  renderPanel() {
    this.panelGraphics.clear();
    if (!this.panelLayout) return;

    const { left, width, top, height, radius, step, entries, types } = this.panelLayout;
    const state = createPanelState(this.board, {
      variant: this.variant,
      activeType: this.activePanelType,
      types,
    });
    if (
      this.activePanelType !== null &&
      state.entries.find((entry) => entry.type === this.activePanelType)?.depleted
    ) {
      this.panelHighlightTimer?.remove(false);
      this.panelHighlightTimer = undefined;
      this.activePanelType = null;
    }

    this.panelGraphics.fillStyle(0x1b2520, 1);
    this.panelGraphics.fillRoundedRect(left, top, width, height, 14);
    this.panelGraphics.lineStyle(1, 0x506159, 1);
    this.panelGraphics.strokeRoundedRect(left, top, width, height, 14);

    const saltIndex = types.indexOf(Atom.SALT);
    const oppositeStartIndex = types.findIndex(
      (type) => type === Atom.VITAE || type === Atom.MORS,
    );
    const quicksilverIndex = types.indexOf(Atom.QUICKSILVER);
    const metalStartIndex = types.findIndex((type) =>
      PANEL_METAL_TYPES.includes(type),
    );
    const boundaries = new Set([
      saltIndex >= 0 && saltIndex < types.length - 1 ? saltIndex + 1 : -1,
      oppositeStartIndex > 0 ? oppositeStartIndex : -1,
      quicksilverIndex > 0 ? quicksilverIndex : -1,
      metalStartIndex > 0 ? metalStartIndex : -1,
    ]);
    for (const boundary of boundaries) {
      if (boundary <= 0 || boundary >= types.length) continue;
      const before = entries[boundary - 1];
      const after = entries[boundary];
      if (!before || !after || before.row !== after.row) continue;
      const x = (before.x + after.x) / 2;
      this.panelGraphics.lineStyle(1, 0x686868, 0.8);
      this.panelGraphics.lineBetween(x, before.y - radius, x, before.y + radius);
    }

    for (let index = 0; index < types.length - 1; index += 1) {
      if (
        !PANEL_METAL_TYPES.includes(types[index]) ||
        !PANEL_METAL_TYPES.includes(types[index + 1])
      ) {
        continue;
      }
      const from = entries[index];
      const to = entries[index + 1];
      if (!from || !to || from.row !== to.row) continue;
      const fromX = from.x + radius + 2;
      const toX = to.x - radius - 2;
      if (toX <= fromX) continue;
      this.panelGraphics.lineStyle(1, 0x777777, 0.8);
      this.panelGraphics.lineBetween(fromX, from.y, toX, to.y);
      this.panelGraphics.fillStyle(0x777777, 0.8);
      this.panelGraphics.fillTriangle(toX, to.y, toX - 4, to.y - 3, toX - 4, to.y + 3);
    }

    state.entries.forEach((entry, index) => {
      const view = this.panelViews.get(entry.type);
      if (!view) return;
      const position = entries[index];
      const x = position.x;
      const y = position.y;
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
