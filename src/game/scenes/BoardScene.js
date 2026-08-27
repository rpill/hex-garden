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
import { CompletionOverlay } from "../completion-overlay.js";
import {
  RewardedAdStatus,
  getYandexGamesAdapter,
} from "../../platform/yandex-games.js";
import { PlayMode } from "../modes.js";
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
  }

  create() {
    this.economy = getEconomy(this);
    this.platform = getYandexGamesAdapter();
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.panelTypes = [];
    this.generator = new BrowserLevelGenerator();
    this.cellGraphics = this.add.graphics();
    this.atomGraphics = this.add.graphics();
    this.panelGraphics = this.add.graphics().setDepth(4);
    this.tutorialGraphics = this.add.graphics().setDepth(8);
    this.mechanicCardGraphics = this.add.graphics().setDepth(20);
    this.economyModalGraphics = this.add.graphics().setDepth(30);
    this.economyModalHitZone = this.add.zone(0, 0, 1, 1)
      .setDepth(30)
      .setVisible(false);
    this.header = makeText(this, "", 16).setOrigin(0.5);
    this.status = makeText(this, "", 14, "#adadad").setOrigin(0, 0.5);
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
    this.mechanicCardHint = makeText(this, "НАЖМИТЕ, ЧТОБЫ НАЧАТЬ", 12, "#f0d58a")
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
    this.economyModalBuy = makeButton(this, "КУПИТЬ", () =>
      this.purchaseEconomyModalProduct(),
    ).setDepth(31).setVisible(false).disableInteractive();
    this.economyModalAd = makeButton(this, "РЕКЛАМА", () =>
      this.showRewardedForEconomyModal(),
    ).setDepth(31).setVisible(false).disableInteractive();
    this.economyModalClose = makeButton(this, "ЗАКРЫТЬ", () =>
      this.closeEconomyModal(),
    ).setDepth(31).setVisible(false).disableInteractive();

    this.previousButton = makeButton(this, "<", () => this.changeLevel(-1));
    this.restartButton = makeButton(this, "RESTART", () => this.restartLevel());
    this.nextButton = makeButton(this, ">", () => this.changeLevel(1));
    this.levelsButton = makeButton(this, "LEVELS", () =>
      this.openLevelSelect(),
    );
    this.menuButton = makeButton(this, "MENU", () => this.openMainMenu());
    this.hintButtons = new Map([
      [HintType.MOVE, makeButton(this, "ХОД +", () => this.useHint(HintType.MOVE))],
      [HintType.UNDO, makeButton(this, "ОТМЕНА +", () => this.useHint(HintType.UNDO))],
      [HintType.RESCUE, makeButton(this, "СПАСТИ +", () => this.useHint(HintType.RESCUE))],
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
      this.clearPanelHighlight(false);
      this.clearMoveHint(false);
      this.endlessScoreTween?.stop();
      this.campaignScoreTween?.stop();
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
      this.endlessRunOver ||
      !this.board
    ) {
      return;
    }
    if (!this.tutorialAllowsPiece(piece)) {
      this.status.setText("НАЖМИТЕ НА ПУЛЬСИРУЮЩИЕ АТОМЫ");
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
      } else if (
        this.mode === PlayMode.STANDARD &&
        this.board.legalMoves().length === 0
      ) {
        this.endlessRunOver = true;
        message =
          `RUN OVER   SCORE ${formatScore(this.endlessScoreState.score)}   ` +
          `STREAK ${this.endlessScoreState.streak}`;
        this.setBusy(false);
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
        title: campaignComplete ? "КАМПАНИЯ ЗАВЕРШЕНА" : "УРОВЕНЬ ПРОЙДЕН",
        subtitle: `УРОВЕНЬ ${String(this.level + 1).padStart(2, "0")} / ${PROGRESSION_LEVEL_COUNT}`,
        scoreAward,
        totalScore: snapshot.campaignScore,
        dustAward,
        dustTotal,
        progressStart: progressBefore.completedLevels.length,
        progressEnd: completed,
        progressMax: PROGRESSION_LEVEL_COUNT,
        progressText: (value) =>
          `ПРОГРЕСС КАМПАНИИ  ${Math.round(value)} / ${PROGRESSION_LEVEL_COUNT}`,
        unlockText: unlockedEndless
          ? "ОТКРЫТ НОВЫЙ РЕЖИМ: ENDLESS"
          : campaignComplete
          ? "ВСЕ УРОВНИ ПРОЙДЕНЫ"
          : `ОТКРЫТ УРОВЕНЬ ${Math.min(PROGRESSION_LEVEL_COUNT, this.level + 2)}`,
        continueLabel: campaignComplete
          ? "К РЕЗУЛЬТАТАМ"
          : "СЛЕДУЮЩИЙ УРОВЕНЬ",
        exitLabel: "К ВЫБОРУ УРОВНЕЙ",
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
        title: "ПОЛЕ ОЧИЩЕНО",
        subtitle: `ПОЛЕ ${String(this.level + 1).padStart(2, "0")}   ·   СЕРИЯ ${streak}`,
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
            ? `СЕРИЯ  ${Math.round(value)} / ${next.streak}   ДО ×${formatMultiplier(next.multiplier)}`
            : `СЕРИЯ  ${Math.round(value)}   ·   МАКСИМАЛЬНЫЙ МНОЖИТЕЛЬ`,
        unlockText:
          `БОНУС ОЧИСТКИ ×${formatMultiplier(clearScore.multiplier)}` +
          (this.endlessAssisted ? "   ·   ASSISTED" : ""),
        continueLabel: "СЛЕДУЮЩЕЕ ПОЛЕ",
        exitLabel: "ЗАВЕРШИТЬ ЗАБЕГ",
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
      ? `NEXT ×${formatMultiplier(next.multiplier)} AT ${next.streak}`
      : `MAX ×${formatMultiplier(multiplier)}`;
    const separator = this.scale.width < 560 ? "\n" : "   ";
    const assisted = this.endlessAssisted ? "   ASSISTED" : "";
    this.endlessHud.setText(
      `SCORE ${formatScore(this.displayedEndlessScore)}   ` +
        `STREAK ${streak}   ×${formatMultiplier(multiplier)}` +
        `${assisted}${separator}${nextLabel}`,
    );
  }

  updateCampaignHud() {
    const visible = this.mode === PlayMode.CAMPAIGN;
    this.campaignHud?.setVisible(visible);
    if (!visible || !this.campaignHud) return;
    this.campaignHud.setText(
      `CAMPAIGN SCORE ${formatScore(this.displayedCampaignScore)}`,
    );
  }

  updateEconomyUi() {
    if (!this.economy || !this.hintButtons) return;
    const snapshot = this.economy.snapshot;
    const visible =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.STANDARD;
    this.dustHud?.setText(`ПЫЛЬ ${formatScore(snapshot.dust)}`).setVisible(visible);

    const labels = {
      [HintType.MOVE]: "ХОД",
      [HintType.UNDO]: "ОТМЕНА",
      [HintType.RESCUE]: "СПАСТИ",
    };
    for (const [type, button] of this.hintButtons) {
      const typeVisible = visible &&
        (type !== HintType.RESCUE || this.mode === PlayMode.STANDARD);
      const count = snapshot.hints[type];
      button
        .setText(`${labels[type]} ${count > 0 ? `×${count}` : "+"}`)
        .setVisible(typeVisible);
      if (typeVisible) button.setInteractive({ useHandCursor: true });
      else button.disableInteractive();
    }
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
    if (this.economy.snapshot.hints[type] <= 0) {
      this.openEconomyModal(type);
      return;
    }

    if (type === HintType.MOVE) {
      if (this.board.won) return;
      const move = this.board.legalMoves()[0];
      if (!move) {
        this.status.setText("ДОСТУПНЫХ ХОДОВ НЕТ — ИСПОЛЬЗУЙТЕ ОТМЕНУ ИЛИ RESTART");
        return;
      }
      if (!this.economy.consumeHint(type)) return;
      this.markEndlessAssisted();
      this.clearMoveHint(false);
      this.activeHintKeys = new Set(move.map(hexKey));
      this.hintTimer = this.time.delayedCall(MOVE_HINT_DURATION_MS, () => {
        this.hintTimer = undefined;
        this.activeHintKeys.clear();
        this.render();
      });
      this.status.setText("ПОДСВЕЧЕН ДОСТУПНЫЙ ХОД");
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
      if (this.mode !== PlayMode.STANDARD || !this.endlessRunOver) {
        this.status.setText("СПАСЕНИЕ ДОСТУПНО ТОЛЬКО ПОСЛЕ ТУПИКА В ENDLESS");
        return;
      }
      if (this.removalHistory.length === 0) {
        this.status.setText("НЕТ СОСТОЯНИЯ ДЛЯ ВОССТАНОВЛЕНИЯ");
        return;
      }
      if (!this.economy.consumeHint(type)) return;
      this.markEndlessAssisted();
      this.restoreLastRemoval("ЗАБЕГ ПРОДОЛЖЕН   ASSISTED");
    }
  }

  markEndlessAssisted() {
    if (this.mode === PlayMode.STANDARD) this.endlessAssisted = true;
  }

  restoreLastRemoval(message) {
    const snapshot = this.removalHistory.pop();
    if (!snapshot) return;
    this.board = new GardenBoard(snapshot.pieces);
    this.endlessScoreState = Object.freeze({ ...snapshot.endlessScoreState });
    this.campaignLevelScore = snapshot.campaignLevelScore;
    this.displayedEndlessScore = this.endlessScoreState.score;
    this.displayedCampaignScore =
      this.progress.snapshot.campaignScore + this.campaignLevelScore;
    this.endlessScoreTween?.stop();
    this.campaignScoreTween?.stop();
    this.endlessRunOver = false;
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
    this.economyModalTitle.setText(product.title).setVisible(true);
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
      `${product.description}\n\nВ ИНВЕНТАРЕ: ${snapshot.hints[product.hint]}\nБАЛАНС: ${formatScore(snapshot.dust)} ПЫЛИ`,
    );
    this.economyModalBuy
      .setText(`КУПИТЬ ×${product.amount}  /  ${product.price} ПЫЛИ`)
      .setAlpha(snapshot.dust >= product.price ? 1 : 0.62);
    const rewardedAmount = rewardedAmountForHint(product.hint);
    this.economyModalAd.setText(
      `СМОТРЕТЬ РЕКЛАМУ  /  +${rewardedAmount}`,
    );
  }

  purchaseEconomyModalProduct() {
    if (this.rewardedAdPending) return;
    const product = this.economyModalProduct;
    if (!product) return;
    const result = this.economy.purchase(product.id);
    this.economyModalMessage
      .setText(
        result.ok
          ? `КУПЛЕНО: +${product.amount}`
          : `НЕ ХВАТАЕТ ${product.price - result.snapshot.dust} ПЫЛИ`,
      )
      .setColor(result.ok ? "#c8edc5" : "#e89070");
    this.updateEconomyUi();
    this.refreshEconomyModal();
  }

  async showRewardedForEconomyModal() {
    if (this.rewardedAdPending || !this.economyModalProduct) return;
    const product = this.economyModalProduct;
    const amount = rewardedAmountForHint(product.hint);
    this.rewardedAdPending = true;
    this.economyModalMessage
      .setText(
        this.platform.isSimulated
          ? "ТЕСТОВАЯ РЕКЛАМА..."
          : "ЗАГРУЗКА РЕКЛАМЫ...",
      )
      .setColor("#f0d58a");
    this.economyModalBuy.disableInteractive().setAlpha(0.4);
    this.economyModalAd.disableInteractive().setAlpha(0.4);
    this.economyModalClose.disableInteractive().setAlpha(0.4);

    const result = await this.platform.showRewarded();
    this.rewardedAdPending = false;
    if (result.status === RewardedAdStatus.REWARDED) {
      this.economy.grantHint(product.hint, amount);
      this.economyModalMessage
        .setText(`ПОЛУЧЕНО: ${product.title} +${amount}`)
        .setColor("#c8edc5");
    } else if (result.status === RewardedAdStatus.CLOSED) {
      this.economyModalMessage
        .setText("НАГРАДА НЕ ПОЛУЧЕНА")
        .setColor("#e89070");
    } else if (result.status === RewardedAdStatus.BUSY) {
      this.economyModalMessage
        .setText("РЕКЛАМА УЖЕ ОТКРЫТА")
        .setColor("#e89070");
    } else {
      this.economyModalMessage
        .setText("РЕКЛАМА СЕЙЧАС НЕДОСТУПНА")
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
      "АТОМ СВОБОДЕН, ЕСЛИ РЯДОМ 3+ ПУСТЫЕ ЯЧЕЙКИ ПОДРЯД\nЗЕЛЁНЫЕ 1-2-3 = СВОБОДЕН. УБЕРИТЕ ПУЛЬСИРУЮЩУЮ ПАРУ ВОЗДУХА",
      "УДАЛЕНИЕ ПАРЫ ОТКРЫВАЕТ НОВУЮ СТОРОНУ ИЗ 3 ЯЧЕЕК\nУБЕРИТЕ ПУЛЬСИРУЮЩУЮ ПАРУ ОГНЯ",
      "МЕНЬШЕ 3 ПУСТЫХ ЯЧЕЕК ПОДРЯД = ЗАБЛОКИРОВАН\nОЧИСТИТЕ ОСТАТОК ПОЛЯ БЕЗ ПОДСКАЗКИ",
    ];
    this.tutorialText
      .setText(
        this.board?.won
          ? "ОБУЧЕНИЕ ЗАВЕРШЕНО\nПЕРЕХОДИТЕ К УРОВНЮ 1"
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
    this.mechanicCardHint
      .setText("НАЖМИТЕ, ЧТОБЫ НАЧАТЬ")
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
    const compact = width < 560;
    const shortLandscape = height < 520 && width >= 560;

    this.header.setFontSize(compact ? 13 : 16).setPosition(width / 2, 25);
    this.endlessHud
      .setFontSize(compact ? 10 : 12)
      .setPosition(width / 2, compact ? 58 : 52);
    this.campaignHud
      .setFontSize(compact ? 10 : 12)
      .setPosition(width / 2, 52);
    this.dustHud
      .setFontSize(compact ? 9 : 11)
      .setPosition(width - 10, 25);
    this.updateEndlessHud();
    this.updateCampaignHud();
    this.updateEconomyUi();
    this.status
      .setFontSize(compact ? 11 : 14)
      .setPosition(
        10,
        shortLandscape ? height - 94 : compact ? height - 178 : height - 160,
      );
    this.tutorialText
      .setFontSize(compact ? 10 : 13)
      .setPosition(width / 2, compact ? 57 : 60)
      .setWordWrapWidth(Math.max(220, width - 24));

    const controlsY = height - 22;
    const gap = 68;
    this.restartButton.setPosition(width / 2, controlsY);
    this.restartButton.setText(
      this.mode === PlayMode.STANDARD ? "NEW RUN" : "RESTART",
    );
    this.previousButton
      .setPosition(width / 2 - gap, controlsY)
      .setVisible(this.mode !== PlayMode.STANDARD);
    if (this.mode === PlayMode.STANDARD) {
      this.previousButton.disableInteractive();
    } else {
      this.previousButton.setInteractive({ useHandCursor: true });
    }
    this.nextButton.setPosition(width / 2 + gap, controlsY);
    const campaignNavigation =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL;
    const navigationY = compact ? height - 178 : controlsY;
    this.levelsButton
      .setPosition(compact ? width - 126 : width - 158, navigationY)
      .setVisible(campaignNavigation);
    if (campaignNavigation) {
      this.levelsButton.setInteractive({ useHandCursor: true });
    } else {
      this.levelsButton.disableInteractive();
    }
    this.menuButton.setPosition(compact ? width - 46 : width - 70, navigationY);
    this.nextButton.setText(this.mode === PlayMode.TUTORIAL ? "ИГРАТЬ" : ">");

    const visibleHints = [...this.hintButtons.entries()].filter(
      ([type]) =>
        (this.mode === PlayMode.CAMPAIGN && type !== HintType.RESCUE) ||
        this.mode === PlayMode.STANDARD,
    );
    const hintWidth = Math.min(
      compact ? 102 : 118,
      Math.max(72, (width - 20) / Math.max(1, visibleHints.length) - 6),
    );
    const hintGap = hintWidth + 6;
    const hintLeft = width / 2 - hintGap * (visibleHints.length - 1) / 2;
    visibleHints.forEach(([, button], index) => {
      button
        .setFontSize(compact ? 10 : shortLandscape ? 9 : 12)
        .setFixedSize(
          shortLandscape ? 102 : hintWidth,
          compact ? 32 : 36,
        )
        .setPosition(
          shortLandscape ? 66 : hintLeft + hintGap * index,
          shortLandscape ? 118 + index * 48 : height - 132,
        );
    });

    this.layoutPanel(width, height, compact);

    const topBarHeight =
      this.mode === PlayMode.TUTORIAL
        ? TOP_BAR_HEIGHT + 54
      : this.mode === PlayMode.STANDARD
        ? TOP_BAR_HEIGHT + (compact ? 48 : 30)
        : this.mode === PlayMode.CAMPAIGN
        ? TOP_BAR_HEIGHT + 28
        : TOP_BAR_HEIGHT;
    const bottomBarHeight = shortLandscape ? 100 : BOTTOM_BAR_HEIGHT;
    const boardHeight = Math.max(100, height - topBarHeight - bottomBarHeight);
    const boardWidth = Math.max(100, width - (shortLandscape ? 170 : 16));
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

  layoutPanel(width, height, compact) {
    const types = this.panelTypes;
    if (types.length === 0) {
      this.panelLayout = undefined;
      this.panelGraphics.clear();
      return;
    }
    const panelWidth = Math.min(
      width - 12,
      compact ? 520 : 680,
      Math.max(96, types.length * (compact ? 44 : 50)),
    );
    const left = (width - panelWidth) / 2;
    const step = panelWidth / types.length;
    const radius = Math.max(10, Math.min(18, step * 0.38));
    const shortLandscape = height < 520 && width >= 560;
    const y = height - (shortLandscape ? 58 : 76);

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
        ? `ОБУЧЕНИЕ / ОСНОВЫ   ${count}/${total}`
        : `${this.mode.toUpperCase()} / ${chapter}   LEVEL ${levelLabel}   ${count}/${total}`,
    );
    this.menuButton.setText("MENU");
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
      const isHinted = this.activeHintKeys.has(hexKey(view.piece));
      const radius = this.hexSize * 0.68;

      this.atomGraphics.fillStyle(ATOM_COLORS[view.piece.type], free ? 1 : 0.38);
      this.atomGraphics.fillCircle(position.x, position.y, radius);
      this.atomGraphics.lineStyle(
        isSelected || isPanelMatch || isHinted
          ? Math.max(2, this.hexSize * 0.12)
          : 1,
        isSelected
          ? 0xffffff
          : isHinted
          ? 0x8ed18c
          : isPanelMatch
          ? 0xf0d58a
          : 0x111111,
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

    this.panelGraphics.fillStyle(0x181818, 1);
    this.panelGraphics.fillRect(left, y - radius - 9, width, radius * 2 + 18);
    this.panelGraphics.lineStyle(1, 0x555555, 1);
    this.panelGraphics.strokeRect(left, y - radius - 9, width, radius * 2 + 18);

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
      const x = left + step * boundary;
      this.panelGraphics.lineStyle(1, 0x686868, 0.8);
      this.panelGraphics.lineBetween(x, y - radius, x, y + radius);
    }

    for (let index = 0; index < types.length - 1; index += 1) {
      if (
        !PANEL_METAL_TYPES.includes(types[index]) ||
        !PANEL_METAL_TYPES.includes(types[index + 1])
      ) {
        continue;
      }
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
