import Phaser from "phaser";
import {
  ACTIVE_ART_THEME,
  GAMEPLAY_FRAMES,
  GAMEPLAY_UI_FRAMES,
  PHYSICAL_MATERIAL_FRAMES,
  THEME_COLORS,
  UI_FRAMES,
  atomGlyphFrame,
  hexFrameForState,
  physicalPieceFrameForType,
} from "../../art-assets.js";
import {
  createPaperBackground,
  layoutPaperBackground,
} from "../../scene-background.js";
import { Atom, ATOM_NAMES, type AtomType } from "../../atom-types.js";
import { GardenBoard, type BoardPiece, type BoardPieceInput } from "../../board.js";
import { getCampaignLevel } from "../../campaign-levels.js";
import { BrowserLevelGenerator } from "../../browser.js";
import {
  HintType,
  type HintTypeValue,
  type HintProduct,
  productForHint,
  rewardedAmountForHint,
} from "../../economy.js";
import {
  boardClearBaseScore,
  createEndlessScoreState,
  nextStreakMultiplier,
  scoreClearedBoard,
  scoreRemovedAtoms,
  SCORE_PER_REMOVED_ATOM,
  streakMultiplier,
  type EndlessScoreState,
  type ScoreAwardResult,
} from "../../endless-score.js";
import { BoardVariant, type BoardVariantValue } from "../../generator.js";
import type { ProgressionLevelDefinition } from "../../progression.js";
import { CAMPAIGN_LEVEL_COUNT } from "../../plates.js";
import { ENDLESS_REQUIRED_COMPLETIONS } from "../../mode-access.js";
import { BOARD_CENTER, enumerateBoardCells, hexKey, type HexCoord } from "../../hex.js";
import {
  PANEL_METAL_TYPES,
  createPanelState,
  panelTypesForVariant,
} from "../../panel-state.js";
import { mechanicIntroductionForLevel } from "../../mechanic-introductions.js";
import type { CampaignProgressSnapshot } from "../../campaign-progress.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEconomy } from "../economy.js";
import { getLeaderboard } from "../leaderboard.js";
import { getSettings } from "../settings.js";
import { CompletionOverlay } from "../completion-overlay.js";
import {
  RewardedAdStatus,
  getYandexGamesAdapter,
} from "../../platform/yandex-games.js";
import { PlayMode, type PlayModeValue } from "../modes.js";
import { isActualDeadEnd, isRescueEligible } from "../board-session-state.js";
import { pieceFilterEmphasis, resolvePieceVisualState } from "../piece-visual-state.js";
import { openUtilityScene as openCoveredUtilityScene } from "../utility-navigation.js";
import { boardFloatingMetrics } from "../responsive-layout.js";
import { inventoryAnchorMetrics } from "../presentation-layout.js";
import { tutorialPresentationStep, type UtilitySceneKey } from "../presentation-model.js";
import {
  SolveStatus,
  type SolveStatusValue,
  type WinningRouteResult,
  findLastSolvableSnapshot,
  findWinningRoute,
  moveKey,
} from "../../solver.js";
import {
  TUTORIAL_GUIDED_MOVE_COUNT,
  createTutorialLevel,
  findLongestEmptyNeighbourRun,
  type TutorialLevel,
} from "../../tutorial.js";
import { BoardHud } from "../board/BoardHud.js";
import { CampaignBoardSession } from "../board/CampaignBoardSession.js";
import {
  createAttemptState,
  markRescueUsed,
  markSolverAssisted,
  restartAttempt,
} from "../board/attempt-state.js";
import {
  BoardInventory,
  type BoardInventoryLayout,
  type BoardInventoryRevealState,
} from "../board/BoardInventory.js";
import { BoardTutorial } from "../board/BoardTutorial.js";
import {
  PHYSICAL_BOARD_CANVAS_SCALE,
  PHYSICAL_PIECE_CANVAS_SCALE,
  PHYSICAL_PIECE_UI_CANVAS_SCALE,
} from "../physical-asset-layout.js";
import {
  BoardIntroAnimator,
  type BoardIntroProfile,
} from "../board/BoardIntroAnimator.js";
import {
  makeButton,
  makePanel,
  makeText,
  preloadUiAssets,
  resizeNineSlice,
} from "../ui.js";

const CAMPAIGN_SEED = "rules-lab-v1";
const PANEL_HIGHLIGHT_DURATION_MS = 2000;
const MOVE_HINT_DURATION_MS = 4000;

function formatScore(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

function formatMultiplier(value: number): string {
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

const LOCKED_ATOM_NAMES: Readonly<Partial<Record<AtomType, string>>> = Object.freeze({
  [Atom.GOLD]: "ЗОЛОТО (Au)",
  [Atom.SILVER]: "СЕРЕБРО (Ag)",
  [Atom.COPPER]: "МЕДЬ (Cu)",
  [Atom.IRON]: "ЖЕЛЕЗО (Fe)",
  [Atom.TIN]: "ОЛОВО (Sn)",
  [Atom.LEAD]: "СВИНЕЦ (Pb)",
});

type PieceView = {
  piece: BoardPiece;
  tokenBase: Phaser.GameObjects.Image | undefined;
  glyph: Phaser.GameObjects.Image | undefined;
  label: Phaser.GameObjects.Text | undefined;
  filterGlow: Phaser.GameObjects.Image | undefined;
  hitZone: Phaser.GameObjects.Zone;
};

type RemovalHistoryEntry = {
  pieces: readonly BoardPieceInput[];
  endlessScoreState: Readonly<EndlessScoreState>;
  campaignLevelScore: number;
  displayedCampaignScore: number;
  displayedEndlessScore: number;
};

type RestoreOptions = {
  blockedMove?: readonly BoardPieceInput[];
  winningRoute?: readonly (readonly HexCoord[])[];
};

type CampaignCompletionArgs = {
  snapshot: CampaignProgressSnapshot;
  progressBefore: CampaignProgressSnapshot;
  scoreAward: number;
  dustAward: number;
  dustTotal: number;
  unlockedEndless: boolean;
};

type EndlessCompletionArgs = {
  clearScore: Readonly<ScoreAwardResult>;
  dustAward: number;
  dustTotal: number;
};

type PositionAnalysis = Readonly<{
  status: SolveStatusValue;
  route: readonly (readonly HexCoord[])[];
}>;

function isPlayModeValue(value: unknown): value is PlayModeValue {
  return typeof value === "string" && (Object.values(PlayMode) as readonly string[]).includes(value);
}

function boardInitData(data: unknown): { mode?: PlayModeValue; level?: number } {
  if (typeof data !== "object" || data === null) return {};
  const raw = data as { mode?: unknown; level?: unknown };
  return {
    ...(isPlayModeValue(raw.mode) ? { mode: raw.mode } : {}),
    ...(Number.isSafeInteger(raw.level) && (raw.level as number) >= 0 ? { level: raw.level as number } : {}),
  };
}

export class BoardScene extends Phaser.Scene {
  level = 0;
  mode: PlayModeValue = PlayMode.CAMPAIGN;
  variant: BoardVariantValue = BoardVariant.STANDARD;
  generationToken = 0;
  initialPieces: BoardPiece[] = [];
  plateCells: HexCoord[] = enumerateBoardCells();
  plateRadius = 5;
  levelGeometryReady = false;
  levelDefinition: Readonly<ProgressionLevelDefinition> | TutorialLevel["definition"] | undefined;
  boardShape: string | undefined;
  board: GardenBoard | undefined;
  pieceViews = new Map<string, PieceView>();
  cellViews = new Map<string, Phaser.GameObjects.Image>();
  panelTypes: AtomType[] = [];
  activePanelType: AtomType | null = null;
  panelHighlightTimer: Phaser.Time.TimerEvent | undefined;
  panelLayout: BoardInventoryLayout | undefined;
  tutorialStep = 0;
  tutorialSolution: readonly (readonly HexCoord[])[] = [];
  mechanicCardVisible = false;
  endlessScoreState: Readonly<EndlessScoreState> = createEndlessScoreState();
  displayedEndlessScore = 0;
  endlessScoreTween: Phaser.Tweens.Tween | undefined;
  endlessRunOver = false;
  campaignLevelScore = 0;
  displayedCampaignScore = 0;
  campaignScoreTween: Phaser.Tweens.Tween | undefined;
  campaignScoringActive = false;
  campaignSession: CampaignBoardSession | undefined;
  removalHistory: RemovalHistoryEntry[] = [];
  activeHintKeys = new Set<string>();
  hintTimer: Phaser.Time.TimerEvent | undefined;
  endlessAssisted = false;
  economyModalVisible = false;
  economyModalProduct: HintProduct | undefined;
  rewardedAdPending = false;
  endlessBoardStartScore = 0;
  certifiedSolution: readonly (readonly HexCoord[])[] = [];
  knownWinningRoute: readonly (readonly HexCoord[])[] = [];
  positionSolveStatus: SolveStatusValue = SolveStatus.UNKNOWN;
  actualDeadEnd = false;
  blockedMoveKey: string | undefined;
  pauseMenuVisible = false;
  hoveredPieceKey: string | undefined;
  busy = false;
  english = false;
  progress!: ReturnType<typeof getCampaignProgress>;
  economy!: ReturnType<typeof getEconomy>;
  leaderboard!: ReturnType<typeof getLeaderboard>;
  platform!: ReturnType<typeof getYandexGamesAdapter>;
  generator!: BrowserLevelGenerator;
  hud!: BoardHud;
  introAnimator: BoardIntroAnimator | undefined;
  introRevealedKeys = new Set<string>();
  pendingBoardIntroProfile: BoardIntroProfile | undefined;
  inventory!: BoardInventory;
  tutorialUi!: BoardTutorial;
  inventoryPanel!: BoardInventory["panel"];
  panelGraphics!: BoardInventory["graphics"];
  panelViews!: BoardInventory["views"];
  tutorialGraphics!: BoardTutorial["graphics"];
  tutorialText!: BoardTutorial["text"];
  tutorialNeighbourLabels!: BoardTutorial["neighbourLabels"];
  backgroundImage!: ReturnType<typeof createPaperBackground>;
  cellGraphics!: Phaser.GameObjects.Graphics;
  atomGraphics!: Phaser.GameObjects.Graphics;
  mechanicCardGraphics!: Phaser.GameObjects.Graphics;
  mechanicCardPanel!: ReturnType<typeof makePanel>;
  mechanicCardText!: Phaser.GameObjects.Text;
  mechanicCardHint!: Phaser.GameObjects.Text;
  mechanicCardHitZone!: Phaser.GameObjects.Zone;
  mechanicCardGlyphs: Phaser.GameObjects.Image[] = [];
  economyModalGraphics!: Phaser.GameObjects.Graphics;
  economyModalPanel!: ReturnType<typeof makePanel>;
  economyModalHitZone!: Phaser.GameObjects.Zone;
  economyModalTitle!: Phaser.GameObjects.Text;
  economyModalBody!: Phaser.GameObjects.Text;
  economyModalMessage!: Phaser.GameObjects.Text;
  economyModalBuy!: ReturnType<typeof makeButton>;
  economyModalAd!: ReturnType<typeof makeButton>;
  economyModalClose!: ReturnType<typeof makeButton>;
  pauseMenuGraphics!: Phaser.GameObjects.Graphics;
  pauseMenuPanel!: ReturnType<typeof makePanel>;
  pauseMenuHitZone!: Phaser.GameObjects.Zone;
  pauseMenuTitle!: Phaser.GameObjects.Text;
  pauseResumeButton!: ReturnType<typeof makeButton>;
  pauseRestartButton!: ReturnType<typeof makeButton>;
  pauseLevelsButton!: ReturnType<typeof makeButton>;
  pauseExitButton!: ReturnType<typeof makeButton>;
  completionOverlay!: CompletionOverlay;
  status!: Phaser.GameObjects.Text;
  hintButtons!: Map<HintTypeValue, ReturnType<typeof makeButton>>;
  attemptState = createAttemptState();
  boardCenterX = 0;
  boardCenterY = 0;
  hexSize = 24;
  constructor() {
    super("board");
    this.level = 0;
    this.mode = PlayMode.CAMPAIGN;
    this.variant = BoardVariant.STANDARD;
    this.generationToken = 0;
    this.initialPieces = [];
    this.plateCells = enumerateBoardCells();
    this.plateRadius = 5;
    this.levelGeometryReady = false;
    this.levelDefinition = undefined;
    this.pieceViews = new Map();
    this.cellViews = new Map();
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
    this.campaignSession = undefined;
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
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.attemptState = createAttemptState();
    this.pauseMenuVisible = false;
    this.hoveredPieceKey = undefined;
    this.introAnimator = undefined;
    this.introRevealedKeys = new Set();
    this.pendingBoardIntroProfile = undefined;
  }

  preload(): void {
    preloadUiAssets(this);
  }

  uiText(russian: string, english: string): string {
    return this.english ? english : russian;
  }

  init(data: unknown = {}): void {
    const init = boardInitData(data);
    this.progress = getCampaignProgress(this);
    this.english = getSettings(this).snapshot.language === "en";
    this.mode = init.mode ?? PlayMode.CAMPAIGN;
    this.variant = BoardVariant.STANDARD;
    const requestedLevel = init.level ?? 0;
    this.level =
      this.mode === PlayMode.CAMPAIGN
        ? Math.min(requestedLevel, this.progress.snapshot.highestUnlocked)
        : requestedLevel;
    this.initialPieces = [];
    this.plateCells = enumerateBoardCells();
    this.plateRadius = 5;
    this.levelGeometryReady = false;
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
    this.campaignSession = undefined;
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
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.attemptState = createAttemptState();
    this.pauseMenuVisible = false;
    this.hoveredPieceKey = undefined;
    this.introAnimator?.stop();
    this.introAnimator = undefined;
    this.introRevealedKeys = new Set();
    this.pendingBoardIntroProfile = undefined;
  }

  create(): void {
    this.economy = getEconomy(this);
    this.leaderboard = getLeaderboard(this);
    this.leaderboard.syncCampaignScore(this.progress.snapshot.campaignScore);
    this.platform = getYandexGamesAdapter();
    this.pieceViews = new Map();
    this.cellViews = new Map();
    this.panelViews = new Map();
    this.panelTypes = [];
    this.generator = new BrowserLevelGenerator();
    this.backgroundImage = createPaperBackground(this).setDepth(-3);
    this.cellGraphics = this.add.graphics();
    this.atomGraphics = this.add.graphics().setDepth(1);
    this.inventory = new BoardInventory(
      this,
      {
        onSelectType: (type) => this.selectPanelType(type),
        onHint: (type) => this.useHint(type),
      },
      {
        labelForType: (type) => ATOM_LABELS[type],
        colorForType: (type) => ATOM_COLORS[type],
        glyphFrameForType: (type) => atomGlyphFrame(type),
      },
    );
    this.inventoryPanel = this.inventory.panel;
    this.panelGraphics = this.inventory.graphics;
    this.panelViews = this.inventory.views;
    this.hintButtons = this.inventory.hintButtons;
    this.tutorialUi = new BoardTutorial(this);
    this.tutorialGraphics = this.tutorialUi.graphics;
    this.tutorialText = this.tutorialUi.text;
    this.tutorialNeighbourLabels = this.tutorialUi.neighbourLabels;
    this.hud = new BoardHud(
      this,
      {
        onBack: () => {
          if (this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL) this.openLevelSelect();
          else this.openMainMenu();
        },
        onUndo: () => this.undoLastRemoval(),
        onHint: () => this.useHint(HintType.MOVE),
        onOverflow: () => this.openPauseMenu(),
      },
      { english: this.english },
    );
    this.status = makeText(this, "", 12, "#9aa7b5").setOrigin(0.5).setDepth(10);
    this.mechanicCardGraphics = this.add.graphics().setDepth(20);
    this.mechanicCardPanel = makePanel(this, UI_FRAMES.panelMainMedium, 20)
      .setVisible(false);
    this.economyModalGraphics = this.add.graphics().setDepth(30);
    this.economyModalPanel = makePanel(this, UI_FRAMES.panelMainMedium, 30)
      .setVisible(false);
    this.economyModalHitZone = this.add.zone(0, 0, 1, 1)
      .setDepth(30)
      .setVisible(false);
    this.pauseMenuGraphics = this.add.graphics().setDepth(40);
    this.pauseMenuPanel = makePanel(this, UI_FRAMES.panelMainMedium, 40)
      .setVisible(false);
    this.pauseMenuHitZone = this.add.zone(0, 0, 1, 1)
      .setDepth(40)
      .setVisible(false)
      .setInteractive();
    this.mechanicCardText = makeText(this, "", 18, "#eef3f8")
      .setOrigin(0.5)
      .setAlign("center")
      .setDepth(21)
      .setVisible(false);
    this.mechanicCardHint = makeText(this, this.uiText("НАЖМИТЕ, ЧТОБЫ НАЧАТЬ", "TAP TO START"), 12, "#f3c94f")
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.mechanicCardHitZone = this.add.zone(0, 0, 1, 1).setDepth(22);
    this.mechanicCardHitZone.on("pointerdown", () => this.dismissMechanicCard());

    this.economyModalTitle = makeText(this, "", 19, "#eef3f8")
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.economyModalBody = makeText(this, "", 13, "#9aa7b5")
      .setOrigin(0.5)
      .setAlign("center")
      .setDepth(31)
      .setVisible(false);
    this.economyModalMessage = makeText(this, "", 12, "#77dc91")
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
    this.economyModalBuy = makeButton(this, this.uiText("КУПИТЬ", "BUY"), () =>
      this.purchaseEconomyModalProduct(),
    ).setIcon(GAMEPLAY_UI_FRAMES.dust, 20).setDepth(31).setVisible(false).disableInteractive();
    this.economyModalAd = makeButton(this, this.uiText("РЕКЛАМА", "AD"), () =>
      this.showRewardedForEconomyModal(),
    ).setIcon(GAMEPLAY_UI_FRAMES.badgeReward, 20).setDepth(31).setVisible(false).disableInteractive();
    this.economyModalClose = makeButton(this, this.uiText("ЗАКРЫТЬ", "CLOSE"), () =>
      this.closeEconomyModal(),
    ).setIcon(GAMEPLAY_UI_FRAMES.back, 18).setDepth(31).setVisible(false).disableInteractive();

    this.pauseMenuTitle = makeText(this, this.uiText("ПАУЗА", "PAUSED"), 24, "#eef3f8")
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(41)
      .setVisible(false);
    this.pauseResumeButton = makeButton(this, this.uiText("ПРОДОЛЖИТЬ", "RESUME"), () => this.closePauseMenu())
      .setDepth(41)
      .setVisible(false)
      .disableInteractive();
    this.pauseRestartButton = makeButton(this, this.uiText("ЗАНОВО", "RESTART"), () => this.restartFromPause())
      .setIcon(GAMEPLAY_UI_FRAMES.retry, 20)
      .setDepth(41)
      .setVisible(false)
      .disableInteractive();
    this.pauseLevelsButton = makeButton(this, this.uiText("ВЫБОР УРОВНЕЙ", "LEVEL SELECT"), () => this.exitPauseToLevels())
      .setIcon(GAMEPLAY_UI_FRAMES.next, 20)
      .setDepth(41)
      .setVisible(false)
      .disableInteractive();
    this.pauseExitButton = makeButton(this, this.uiText("ГЛАВНОЕ МЕНЮ", "MAIN MENU"), () => this.exitPauseToMenu())
      .setIcon(GAMEPLAY_UI_FRAMES.back, 20)
      .setDepth(41)
      .setVisible(false)
      .disableInteractive();
    this.completionOverlay = new CompletionOverlay(this);

    this.input.keyboard?.on("keydown-R", () => this.restartLevel());
    this.input.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) this.consumeBoardIntroInput();
      },
    );
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.rewardedAdPending) return;
      if (this.pauseMenuVisible) {
        this.closePauseMenu();
        return;
      }
      if (this.completionOverlay.visible) {
        this.completionOverlay.exit();
        return;
      }
      if (this.economyModalVisible) this.closeEconomyModal();
      else this.openPauseMenu();
    });

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
      this.generator.terminate();
      this.introAnimator?.stop();
      this.clearCellViews();
      this.pieceViews.clear();
      this.panelViews.clear();
    });
    this.rebuildPanelViews();
    this.layout();
    this.loadLevel();
  }

  async loadLevel(introProfile: BoardIntroProfile = "fresh"): Promise<void> {
    const token = ++this.generationToken;
    if (this.mode === PlayMode.ENDLESS) this.endlessRunOver = false;
    if (this.mode === PlayMode.ENDLESS) {
      this.endlessBoardStartScore = this.endlessScoreState.score;
    }
    this.campaignSession = undefined;
    this.removalHistory = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.attemptState = createAttemptState();
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
    this.levelGeometryReady = false;
    this.board = undefined;
    this.initialPieces = [];
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.pendingBoardIntroProfile = undefined;
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
          ? (() => {
              const session = new CampaignBoardSession(getCampaignLevel(this.level));
              this.campaignSession = session;
              return {
                board: session.board,
                variant: BoardVariant.STANDARD,
                shape: "canonical" as const,
                plateCells: session.level.plateCells.map((cell) => ({ ...cell })),
                plateRadius: session.level.plateRadius,
                pieces: session.level.pieces.map((piece) => ({ ...piece })),
                solution: session.level.solution.map((move) =>
                  move.map((position) => ({ ...position })),
                ),
              };
            })()
          : this.mode === PlayMode.ENDLESS
          ? await this.generator.generateEndlessRun(this.level, {
              campaignSeed: CAMPAIGN_SEED,
            })
          : await Promise.reject<never>(
              new Error("Daily mode is not implemented yet"),
            );
      if (token !== this.generationToken) return;
      this.board = record.board;
      this.variant = record.variant;
      this.boardShape = record.shape;
      this.plateCells = "plateCells" in record ? record.plateCells : enumerateBoardCells();
      this.plateRadius = "plateRadius" in record ? record.plateRadius : 5;
      this.levelGeometryReady = true;
      this.levelDefinition = "definition" in record ? record.definition : undefined;
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
      if (this.mechanicCardVisible) {
        this.pendingBoardIntroProfile = introProfile;
      } else {
        this.startBoardIntro(introProfile);
      }
      this.layout();
    } catch (error) {
      if (token !== this.generationToken) return;
      this.status.setText(`ERROR: ${error instanceof Error ? error.message : error}`);
      this.setBusy(false);
      this.render();
    }
  }

  changeLevel(delta: number): void {
    if (this.busy || this.completionOverlay?.visible) return;
    if (this.mode === PlayMode.TUTORIAL) {
      if (delta > 0 && this.board?.won) {
        this.scene.start("board", { mode: PlayMode.CAMPAIGN, level: 0 });
      }
      return;
    }
    if (this.mode === PlayMode.ENDLESS) {
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

  openLevelSelect(): void {
    if (this.mode !== PlayMode.CAMPAIGN && this.mode !== PlayMode.TUTORIAL) {
      return;
    }
    this.generationToken += 1;
    this.scene.start("level-select");
  }

  openMainMenu(): void {
    this.submitEndlessResult();
    this.generationToken += 1;
    this.scene.start("menu");
  }

  openUtilityScene(key: UtilitySceneKey): void {
    if (
      this.rewardedAdPending ||
      this.completionOverlay?.visible ||
      this.economyModalVisible
    ) return;
    if (this.pauseMenuVisible) this.closePauseMenu();
    openCoveredUtilityScene(this, key, { returnScene: "board" });
  }

  openPauseMenu(): void {
    if (
      this.pauseMenuVisible ||
      this.rewardedAdPending ||
      this.completionOverlay?.visible ||
      this.economyModalVisible
    ) return;
    this.pauseMenuVisible = true;
    this.pauseMenuHitZone.setVisible(true).setInteractive();
    for (const item of [
      this.pauseMenuTitle,
      this.pauseResumeButton,
      this.pauseRestartButton,
      this.pauseExitButton,
    ]) item.setVisible(true);
    this.pauseResumeButton.setInteractive({ useHandCursor: true });
    const canRestart = !this.busy && this.initialPieces.length > 0;
    this.pauseRestartButton.setAlpha(canRestart ? 1 : 0.45);
    if (canRestart) this.pauseRestartButton.setInteractive({ useHandCursor: true });
    else this.pauseRestartButton.disableInteractive();
    this.pauseExitButton.setInteractive({ useHandCursor: true });
    const campaignNavigation =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL;
    this.pauseLevelsButton.setVisible(campaignNavigation);
    if (campaignNavigation) this.pauseLevelsButton.setInteractive({ useHandCursor: true });
    else this.pauseLevelsButton.disableInteractive();
    this.layoutPauseMenu(this.scale.width, this.scale.height);
  }

  closePauseMenu(): void {
    if (!this.pauseMenuVisible) return;
    this.pauseMenuVisible = false;
    this.pauseMenuGraphics.clear();
    this.pauseMenuPanel.setVisible(false);
    this.pauseMenuHitZone.setVisible(false).disableInteractive();
    for (const item of [
      this.pauseMenuTitle,
      this.pauseResumeButton,
      this.pauseRestartButton,
      this.pauseLevelsButton,
      this.pauseExitButton,
    ]) item.setVisible(false).disableInteractive?.();
  }

  restartFromPause(): void {
    this.closePauseMenu();
    this.restartLevel();
  }

  exitPauseToLevels(): void {
    this.closePauseMenu();
    this.openLevelSelect();
  }

  exitPauseToMenu(): void {
    this.closePauseMenu();
    this.openMainMenu();
  }

  submitEndlessResult(): void {
    if (this.mode !== PlayMode.ENDLESS || !this.leaderboard) return;
    this.leaderboard.submitEndlessScore(this.endlessScoreState.score, {
      assisted: this.endlessAssisted,
    });
  }

  restartLevel(): void {
    if (
      this.busy ||
      this.completionOverlay?.visible ||
      this.pauseMenuVisible ||
      this.initialPieces.length === 0
    ) return;
    if (this.mode === PlayMode.ENDLESS) {
      this.submitEndlessResult();
      this.endlessScoreTween?.stop();
      this.endlessScoreState = createEndlessScoreState();
      this.displayedEndlessScore = 0;
      this.endlessRunOver = false;
      this.endlessAssisted = false;
      this.level = 0;
      this.loadLevel("restart");
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
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.clearMoveHint(false);
    if (this.mode === PlayMode.CAMPAIGN && this.campaignSession) {
      this.campaignSession.restart();
      this.board = this.campaignSession.board;
    } else {
      this.attemptState = restartAttempt(this.attemptState);
      this.board = new GardenBoard(this.initialPieces);
    }
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.status.setText("");
    this.rebuildPieceViews();
    this.pendingBoardIntroProfile = undefined;
    this.startBoardIntro("restart");
    this.updateTutorialGuide();
    this.layout();
  }

  startBoardIntro(profile: BoardIntroProfile = "fresh"): void {
    this.introAnimator?.stop();
    if (!this.board || this.initialPieces.length === 0) return;

    this.introRevealedKeys = new Set();
    this.introAnimator = new BoardIntroAnimator({
      scene: this,
      positions: this.initialPieces,
      onChange: ({ revealedKeys }) => {
        this.introRevealedKeys = new Set(revealedKeys);
        this.render();
      },
      onComplete: () => {
        this.introRevealedKeys = new Set(this.initialPieces.map(hexKey));
        this.render();
      },
    });
    this.introAnimator.start(profile);
  }

  consumeBoardIntroInput(): boolean {
    return this.introAnimator?.finish() ?? false;
  }

  selectPiece(piece: BoardPiece): void {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      this.completionOverlay?.visible ||
      this.pauseMenuVisible ||
      this.endlessRunOver ||
      !this.board
    ) {
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
    const beforeRemovalPieces = this.board.pieces();
    const beforeRemoval = {
      pieces: beforeRemovalPieces,
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
      if (this.mode === PlayMode.CAMPAIGN && this.campaignSession) {
        this.campaignSession.recordBeforeRemoval(beforeRemovalPieces);
      } else {
        this.removalHistory.push(beforeRemoval);
        if (this.removalHistory.length > 64) this.removalHistory.shift();
      }
      this.clearMoveHint(false);
      let message = "";
      if (this.mode === PlayMode.ENDLESS) {
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
          "#77dc91",
        );
        this.animateCampaignScore(
          this.progress.snapshot.campaignScore + this.campaignLevelScore,
        );
      }
      if (
        this.tutorialStep < TUTORIAL_GUIDED_MOVE_COUNT &&
        this.tutorialRemovalCompletesStep(result.removed)
      ) {
        this.tutorialStep += 1;
      }
      let completionAfterRebuild: (() => void) | undefined;
      if (this.board.won) {
        message = "BOARD CLEARED";
        if (this.mode === PlayMode.TUTORIAL) {
          this.progress.completeTutorial();
          completionAfterRebuild = () => this.showTutorialCompletion();
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
              "#77dc91",
            );
          }
          const snapshot = this.progress.complete(this.level, {
            score: shouldRecordScore ? this.campaignLevelScore : 0,
          });
          this.leaderboard.syncCampaignScore(snapshot.campaignScore);
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
            snapshot.solvedLevels.length === ENDLESS_REQUIRED_COMPLETIONS;
          completionAfterRebuild = () =>
            this.showCampaignCompletion({
              snapshot,
              progressBefore,
              scoreAward: shouldRecordScore ? this.campaignLevelScore : 0,
              dustAward: dust.award,
              dustTotal: dust.snapshot.dust,
              unlockedEndless,
            });
        } else if (this.mode === PlayMode.ENDLESS) {
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
            "#77dc91",
          );
          this.animateEndlessScore(this.endlessScoreState.score);
          message =
            `BOARD CLEARED   STREAK ${this.endlessScoreState.streak}   ` +
            `×${formatMultiplier(clearScore.multiplier)}   +${dust.award} ПЫЛИ`;
          completionAfterRebuild = () =>
            this.showEndlessCompletion({
              clearScore,
              dustAward: dust.award,
              dustTotal: dust.snapshot.dust,
            });
        }
        this.setBusy(false);
      } else {
        this.analyzeCurrentPosition();
        if (this.actualDeadEnd) {
          message = this.uiText("ХОДОВ НЕТ", "NO MOVES");
        }
      }
      this.status.setText(message);
      this.rebuildPieceViews();
      this.updateTutorialGuide();
      completionAfterRebuild?.();
    }
    this.layout();
  }

  showTutorialCompletion(): void {
    this.completionOverlay.show(
      {
        title: this.uiText("ОБУЧЕНИЕ ПРОЙДЕНО", "TUTORIAL COMPLETE"),
        subtitle: "",
        scoreAward: 0,
        totalScore: 0,
        dustAward: 0,
        dustTotal: 0,
        progressStart: 0,
        progressEnd: 1,
        progressMax: 1,
        progressText: () => "",
        continueLabel: this.uiText("УРОВЕНЬ 1 →", "LEVEL 1 →"),
        exitLabel: "",
        compactTransition: true,
      },
      {
        onContinue: () =>
          this.scene.start("board", { mode: PlayMode.CAMPAIGN, level: 0 }),
        onExit: () =>
          this.scene.start("board", { mode: PlayMode.CAMPAIGN, level: 0 }),
      },
    );
  }

  showCampaignCompletion({
    snapshot,
    progressBefore,
    scoreAward,
    dustAward,
    dustTotal,
    unlockedEndless,
  }: CampaignCompletionArgs): void {
    const completed = snapshot.completedLevels.length;
    const campaignComplete = snapshot.campaignCompleted;
    this.completionOverlay.show(
      {
        title: campaignComplete ? this.uiText("КАМПАНИЯ ЗАВЕРШЕНА", "CAMPAIGN COMPLETE") : this.uiText("УРОВЕНЬ ПРОЙДЕН", "LEVEL COMPLETE"),
        subtitle: `${this.uiText("УРОВЕНЬ", "LEVEL")} ${String(this.level + 1).padStart(2, "0")} / ${CAMPAIGN_LEVEL_COUNT}`,
        scoreAward,
        totalScore: snapshot.campaignScore,
        dustAward,
        dustTotal,
        progressStart: progressBefore.completedLevels.length,
        progressEnd: completed,
        progressMax: CAMPAIGN_LEVEL_COUNT,
        progressText: (value) =>
          `${this.uiText("ПРОГРЕСС КАМПАНИИ", "CAMPAIGN PROGRESS")}  ${Math.round(value)} / ${CAMPAIGN_LEVEL_COUNT}`,
        unlockText: unlockedEndless
          ? this.uiText("ОТКРЫТ НОВЫЙ РЕЖИМ: ENDLESS", "NEW MODE UNLOCKED: ENDLESS")
          : campaignComplete
          ? this.uiText("ВСЕ УРОВНИ ПРОЙДЕНЫ", "ALL LEVELS COMPLETE")
          : `${this.uiText("ОТКРЫТ УРОВЕНЬ", "LEVEL UNLOCKED")} ${Math.min(CAMPAIGN_LEVEL_COUNT, this.level + 2)}`,
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

  showEndlessCompletion({ clearScore, dustAward, dustTotal }: EndlessCompletionArgs): void {
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

  showScorePopup(removedPieces: readonly BoardPiece[], text: string, color = "#f3c94f"): void {
    if (
      this.mode !== PlayMode.ENDLESS &&
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

  animateEndlessScore(targetScore: number): void {
    if (this.mode !== PlayMode.ENDLESS) return;
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

  animateCampaignScore(targetScore: number): void {
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

  updateEndlessHud(): void {
    // Score chrome is intentionally absent from the functional HUD.
  }

  updateCampaignHud(): void {
    // Campaign progress lives on Home/Chapters, not on the board chrome.
  }

  updateEconomyUi(): void {
    if (!this.economy || !this.hintButtons) return;
    const snapshot = this.economy.snapshot;
    const visible =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.ENDLESS;
    const labels = {
      [HintType.MOVE]: this.uiText("ХОД", "HINT"),
      [HintType.UNDO]: this.uiText("ОТМЕНА", "UNDO"),
      [HintType.RESCUE]: this.uiText("СПАСТИ", "RESCUE"),
    };
    for (const [type, button] of this.hintButtons) {
      const typeVisible = visible &&
        (type !== HintType.RESCUE || this.mode === PlayMode.ENDLESS);
      const count = snapshot.hints[type];
      const rescueEligible = isRescueEligible({
        mode: this.mode,
        actualDeadEnd: this.actualDeadEnd,
      });
      const actionAvailable =
        type === HintType.MOVE
          ? !this.board?.won
          : type === HintType.UNDO
          ? this.removalHistory.length > 0 && !this.board?.won
          : rescueEligible;
      button
        .setText(`${labels[type]} ${count > 0 ? `×${count}` : "+"}`)
        .setVisible(typeVisible)
        .setAlpha(actionAvailable ? 1 : 0.42);
      if (typeVisible) button.setInteractive({ useHandCursor: true });
      else button.disableInteractive();
    }
  }

  wouldCompleteBlockedMove(piece: BoardPiece): boolean {
    if (!this.blockedMoveKey || !this.board?.isFree(piece)) return false;
    const selected = this.board.selected;
    if (selected.length === 0 && piece.type !== Atom.GOLD) return false;
    return moveKey([...selected, piece]) === this.blockedMoveKey;
  }


  analyzeCurrentPosition({ maxMilliseconds = 90 }: { maxMilliseconds?: number } = {}): PositionAnalysis {
    if (!this.board || this.board.won) {
      this.positionSolveStatus = SolveStatus.SOLVED;
      this.actualDeadEnd = false;
      this.knownWinningRoute = [];
      return { status: SolveStatus.SOLVED, route: [] };
    }

    const legalMoveCount = this.board.legalMoves().length;
    this.actualDeadEnd = isActualDeadEnd({
      won: this.board.won,
      legalMoveCount,
    });

    if (this.actualDeadEnd) {
      this.positionSolveStatus = SolveStatus.DEAD_END;
      this.knownWinningRoute = [];
      if (this.mode === PlayMode.ENDLESS) this.endlessRunOver = true;
      return { status: SolveStatus.DEAD_END, route: [] };
    }

    const analysis = findWinningRoute(this.board, {
      preferredSolution: this.certifiedSolution,
      maxMilliseconds,
      maxVisited: 80_000,
    });
    this.positionSolveStatus = analysis.status;
    this.knownWinningRoute =
      analysis.status === SolveStatus.SOLVED ? analysis.route : [];
    this.actualDeadEnd = false;
    return analysis;
  }

  undoLastRemoval(): void {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      this.pauseMenuVisible ||
      !this.board ||
      this.board.won
    ) {
      return;
    }
    if (this.mode === PlayMode.CAMPAIGN) {
      const session = this.campaignSession;
      if (!session?.canUndo || !session.undo()) {
        this.status.setText(this.uiText("ПОКА НЕЧЕГО ОТМЕНЯТЬ", "NOTHING TO UNDO YET"));
        this.hud.setUndoEnabled(false);
        return;
      }
      this.restoreCampaignSessionBoard(
        this.uiText("ПОСЛЕДНЕЕ УДАЛЕНИЕ ОТМЕНЕНО", "LAST REMOVAL UNDONE"),
      );
      return;
    }
    if (this.removalHistory.length === 0) {
      this.status.setText(this.uiText("ПОКА НЕЧЕГО ОТМЕНЯТЬ", "NOTHING TO UNDO YET"));
      this.hud.setUndoEnabled(false);
      return;
    }
    this.restoreLastRemoval(this.uiText("ПОСЛЕДНЕЕ УДАЛЕНИЕ ОТМЕНЕНО", "LAST REMOVAL UNDONE"));
  }

  useHint(type: HintTypeValue): void {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      this.pauseMenuVisible ||
      !this.board
    ) {
      return;
    }
    if (
      type === HintType.RESCUE &&
      !isRescueEligible({ mode: this.mode, actualDeadEnd: this.actualDeadEnd })
    ) {
      this.status.setText(
        this.uiText(
          "СПАСЕНИЕ ДОСТУПНО ТОЛЬКО КОГДА В ENDLESS НЕ ОСТАЛОСЬ ХОДОВ",
          "RESCUE IS AVAILABLE ONLY WHEN ENDLESS HAS NO MOVES LEFT",
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
      if (
        analysis.status !== SolveStatus.SOLVED ||
        analysis.route.length === 0
      ) {
        this.status.setText(
          this.uiText(
            "ПОДСКАЗКА НЕ НАЙДЕНА — БУСТ НЕ СПИСАН",
            "NO HINT FOUND — BOOSTER NOT SPENT",
          ),
        );
        this.updateEconomyUi();
        return;
      }
      const move = analysis.route[0];
      if (!move) return;
      if (!this.economy.consumeHint(type)) return;
      if (this.mode === PlayMode.CAMPAIGN && this.campaignSession) {
        this.campaignSession.markHintUsed();
      } else {
        this.attemptState = markSolverAssisted(this.attemptState);
      }
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
      if (!isRescueEligible({ mode: this.mode, actualDeadEnd: this.actualDeadEnd })) {
        this.status.setText(
          this.uiText(
            "СПАСЕНИЕ ДОСТУПНО ТОЛЬКО КОГДА В ENDLESS НЕ ОСТАЛОСЬ ХОДОВ",
            "RESCUE IS AVAILABLE ONLY WHEN ENDLESS HAS NO MOVES LEFT",
          ),
        );
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
      if (this.mode === PlayMode.CAMPAIGN && this.campaignSession) {
        this.campaignSession.markRescueUsed();
      } else {
        this.attemptState = markRescueUsed(this.attemptState);
      }
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

  markEndlessAssisted(): void {
    if (this.mode === PlayMode.ENDLESS) this.endlessAssisted = true;
  }


  restoreCampaignSessionBoard(message: string): void {
    const session = this.campaignSession;
    if (!session) return;
    this.board = session.board;
    this.campaignLevelScore = Math.max(0, this.initialPieces.length - this.board.size) * SCORE_PER_REMOVED_ATOM;
    this.displayedCampaignScore =
      this.progress.snapshot.campaignScore + this.campaignLevelScore;
    this.campaignScoreTween?.stop();
    this.actualDeadEnd = false;
    this.positionSolveStatus = SolveStatus.SOLVED;
    this.knownWinningRoute = this.analyzeCurrentPosition().route;
    this.blockedMoveKey = undefined;
    this.clearPanelHighlight(false);
    this.clearMoveHint(false);
    this.status.setText(message);
    this.setBusy(false);
    this.rebuildPieceViews();
    this.updateEconomyUi();
    this.layout();
  }

  restoreLastRemoval(message: string): void {
    this.restoreHistorySnapshot(this.removalHistory.length - 1, message);
  }

  restoreHistorySnapshot(index: number, message: string, { blockedMove = [], winningRoute }: RestoreOptions = {}): void {
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
    this.actualDeadEnd = false;
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

  clearMoveHint(render = true): void {
    this.hintTimer?.remove(false);
    this.hintTimer = undefined;
    this.activeHintKeys?.clear();
    if (render) this.render();
  }

  openEconomyModal(type: HintTypeValue): void {
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

  refreshEconomyModal(): void {
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

  purchaseEconomyModalProduct(): void {
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
      .setColor(result.ok ? "#77dc91" : "#ff6b67");
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
        .setColor("#ff6b67");
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
      .setColor("#f3c94f");
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
        .setColor("#ff6b67");
    } else if (result.status === RewardedAdStatus.CLOSED) {
      this.economyModalMessage
        .setText(this.uiText("НАГРАДА НЕ ПОЛУЧЕНА", "NO REWARD RECEIVED"))
        .setColor("#ff6b67");
    } else if (result.status === RewardedAdStatus.BUSY) {
      this.economyModalMessage
        .setText(this.uiText("РЕКЛАМА УЖЕ ОТКРЫТА", "AD IS ALREADY OPEN"))
        .setColor("#ff6b67");
    } else {
      this.economyModalMessage
        .setText(this.uiText("РЕКЛАМА СЕЙЧАС НЕДОСТУПНА", "AD IS CURRENTLY UNAVAILABLE"))
        .setColor("#ff6b67");
    }
    if (!this.economyModalVisible) return;
    this.economyModalBuy.setInteractive({ useHandCursor: true });
    this.economyModalAd.setInteractive({ useHandCursor: true }).setAlpha(1);
    this.economyModalClose.setInteractive({ useHandCursor: true }).setAlpha(1);
    this.updateEconomyUi();
    this.refreshEconomyModal();
  }

  closeEconomyModal(): void {
    if (this.rewardedAdPending) return;
    this.economyModalVisible = false;
    this.economyModalProduct = undefined;
    this.economyModalGraphics.clear();
    this.economyModalPanel.setVisible(false);
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

  rebuildPieceViews(): void {
    this.clearPieceViews();
    if (!this.board) return;
    for (const piece of this.board.pieces()) {
      const glyphFrame = atomGlyphFrame(piece.type);
      const premiumPieceFrame = physicalPieceFrameForType(piece.type);
      const premiumFallbackBall =
        ACTIVE_ART_THEME === "premium" && this.textures.exists(PHYSICAL_MATERIAL_FRAMES.pieceBall);
      const tokenFrame = premiumPieceFrame && this.textures.exists(premiumPieceFrame)
        ? premiumPieceFrame
        : premiumFallbackBall
        ? PHYSICAL_MATERIAL_FRAMES.pieceBall
        : undefined;
      const tokenBase = tokenFrame
        ? this.add
            .image(0, 0, tokenFrame)
            .setDepth(1.25)
            .setVisible(false)
        : undefined;
      const activeGlyphFrame = ACTIVE_ART_THEME === "premium" ? undefined : glyphFrame;
      const glyph = activeGlyphFrame && this.textures.exists(activeGlyphFrame)
        ? this.add.image(0, 0, activeGlyphFrame).setDepth(2).setVisible(false)
        : undefined;
      const filterGlow = activeGlyphFrame && this.textures.exists(activeGlyphFrame)
        ? this.add.image(0, 0, activeGlyphFrame).setDepth(1.5).setAlpha(0).setVisible(false)
        : undefined;
      const label = premiumPieceFrame || glyph
        ? undefined
        : makeText(
            this,
            ATOM_LABELS[piece.type],
            16,
            ACTIVE_ART_THEME === "premium" ? THEME_COLORS.ink : "#eef3f8",
          )
            .setOrigin(0.5)
            .setFontStyle("bold")
            .setDepth(2)
            .setVisible(false);
      const hitZone = this.add.zone(0, 0, 56, 56).setDepth(3).setVisible(false);
      hitZone.setInteractive(
        new Phaser.Geom.Circle(28, 28, 28),
        Phaser.Geom.Circle.Contains,
      );
      if (hitZone.input) hitZone.input.cursor = "pointer";
      hitZone.on("pointerdown", () => {
        if (this.consumeBoardIntroInput()) return;
        this.selectPiece(piece);
      });
      hitZone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
        if (pointer.wasTouch) return;
        this.hoveredPieceKey = hexKey(piece);
        this.render();
      });
      hitZone.on("pointerout", () => {
        if (this.hoveredPieceKey !== hexKey(piece)) return;
        this.hoveredPieceKey = undefined;
        this.render();
      });
      this.pieceViews.set(hexKey(piece), { piece, tokenBase, glyph, label, filterGlow, hitZone });
    }
  }

  clearPieceViews(): void {
    for (const view of this.pieceViews.values()) {
      view.tokenBase?.destroy();
      view.glyph?.destroy();
      view.filterGlow?.destroy();
      view.label?.destroy();
      view.hitZone.destroy();
    }
    this.pieceViews.clear();
    this.hoveredPieceKey = undefined;
  }

  rebuildPanelViews(): void {
    this.panelTypes = panelTypesForVariant(this.variant, this.initialPieces);
    this.inventory.rebuild(this.panelTypes);
    this.panelViews = this.inventory.views;
    this.panelLayout = undefined;
  }

  selectPanelType(type: AtomType): void {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.economyModalVisible ||
      this.pauseMenuVisible ||
      !this.board
    ) return;
    if (!this.board) {
      this.inventory.graphics.clear();
      return;
    }
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

  clearPanelHighlight(render = true): void {
    this.panelHighlightTimer?.remove(false);
    this.panelHighlightTimer = undefined;
    this.activePanelType = null;
    if (render) this.render();
  }

  tutorialRemovalCompletesStep(removed: readonly BoardPiece[]): boolean {
    return (
      this.mode === PlayMode.TUTORIAL &&
      this.tutorialStep < TUTORIAL_GUIDED_MOVE_COUNT &&
      removed.length > 0
    );
  }

  updateTutorialGuide(): void {
    if (this.mode === PlayMode.TUTORIAL) this.status.setText("");
  }

  renderTutorialGuide(): void {
    const enabled =
      this.mode === PlayMode.TUTORIAL &&
      this.tutorialStep < TUTORIAL_GUIDED_MOVE_COUNT &&
      Boolean(this.board) &&
      this.board?.won !== true;

    const pairTargets =
      enabled && this.tutorialStep === 0
        ? this.tutorialSolution[0] ?? []
        : [];
    const freedomFocus =
      enabled && this.tutorialStep === 1
        ? this.tutorialSolution[1]?.[0]
        : undefined;
    const emptyRun = freedomFocus && this.board
      ? findLongestEmptyNeighbourRun(this.board.pieces(), freedomFocus).slice(0, 3)
      : [];
    const targets = freedomFocus ? [freedomFocus] : pairTargets;
    const inventoryTargetBounds =
      enabled && this.tutorialStep === 2 && this.panelLayout
        ? {
            left: this.panelLayout.left,
            top: this.panelLayout.top,
            right: this.panelLayout.left + this.panelLayout.width,
            bottom: this.panelLayout.top + this.panelLayout.height,
          }
        : undefined;
    const preferredSides =
      this.tutorialStep === 1
        ? (["right", "top", "bottom", "left"] as const)
        : this.tutorialStep === 2
        ? (["top", "right", "left", "bottom"] as const)
        : (["bottom", "top", "right", "left"] as const);
    const copy = enabled
      ? tutorialPresentationStep(Math.min(this.tutorialStep, 2), this.english).copy
      : "";

    this.tutorialUi.renderGuide({
      enabled,
      step: this.tutorialStep,
      copy,
      emptyRun,
      targets,
      visiblePieceKeys: new Set(this.pieceViews.keys()),
      keyFor: hexKey,
      toScreen: (position) => this.hexToScreen(position),
      hexSize: this.hexSize,
      viewport: { width: this.scale.width, height: this.scale.height },
      ...(inventoryTargetBounds ? { targetBounds: inventoryTargetBounds } : {}),
      preferredSides,
    });
  }

  hideTutorialNeighbourLabels(): void {
    this.tutorialUi.hideNeighbourLabels();
  }

  override update(): void {
    if (this.introAnimator?.active) this.render();
  }

  showMechanicCardForLevel(): void {
    const introduction =
      this.mode === PlayMode.CAMPAIGN && !this.progress.isCompleted(this.level)
        ? mechanicIntroductionForLevel(this.level)
        : undefined;
    const text = introduction
      ? this.english ? introduction.textEn : introduction.text
      : undefined;
    if (!text || !introduction) {
      this.hideMechanicCard();
      return;
    }
    this.setMechanicCardGlyphTypes(introduction.requiredTypes);
    this.mechanicCardVisible = true;
    this.mechanicCardText.setText(text).setVisible(true);
    this.mechanicCardHint
      .setText(this.uiText("НАЖМИТЕ, ЧТОБЫ НАЧАТЬ", "TAP TO START"))
      .setVisible(true);
    this.mechanicCardHitZone
      .setVisible(true)
      .setInteractive({ useHandCursor: true });
  }

  setMechanicCardGlyphTypes(types: readonly AtomType[]): void {
    this.clearMechanicCardGlyphs();
    for (const type of types) {
      const premiumPieceFrame = physicalPieceFrameForType(type);
      const premiumBallFrame = PHYSICAL_MATERIAL_FRAMES.pieceBall;
      const frame =
        premiumPieceFrame && this.textures.exists(premiumPieceFrame)
          ? premiumPieceFrame
          : ACTIVE_ART_THEME === "premium" && this.textures.exists(premiumBallFrame)
          ? premiumBallFrame
          : atomGlyphFrame(type);
      if (!this.textures.exists(frame)) continue;
      const image = this.add.image(0, 0, frame).setDepth(21).setVisible(true);
      this.mechanicCardGlyphs.push(image);
    }
  }

  clearMechanicCardGlyphs(): void {
    for (const glyph of this.mechanicCardGlyphs) glyph.destroy();
    this.mechanicCardGlyphs.length = 0;
  }

  showEndlessUnlockedCard(): void {
    this.clearMechanicCardGlyphs();
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

  dismissMechanicCard(): void {
    if (!this.mechanicCardVisible) return;
    const pendingProfile = this.pendingBoardIntroProfile;
    this.pendingBoardIntroProfile = undefined;
    this.hideMechanicCard();
    if (pendingProfile) this.startBoardIntro(pendingProfile);
    this.render();
  }

  hideMechanicCard(): void {
    this.mechanicCardVisible = false;
    this.clearMechanicCardGlyphs();
    this.mechanicCardGraphics?.clear();
    this.mechanicCardPanel?.setVisible(false);
    this.mechanicCardText?.setVisible(false);
    this.mechanicCardHint?.setVisible(false);
    this.mechanicCardHitZone?.setVisible(false).disableInteractive();
  }

  setBusy(value: boolean): void {
    this.busy = value;
    this.pauseRestartButton?.setAlpha(value ? 0.45 : 1);
    this.hud.setHintBusy(value);
    const canUndo = this.mode === PlayMode.CAMPAIGN
      ? this.campaignSession?.canUndo === true
      : this.removalHistory.length > 0 && !this.board?.won;
    this.hud.setUndoEnabled(!value && canUndo);
  }

  layout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const {
      compact,
      portrait,
      actionRail: sideDock,
      contentLeft,
      contentWidth,
      topInset,
      boardTopGap,
      boardBottomGap,
    } = boardFloatingMetrics(width, height);
    const margin = compact ? 10 : 18;
    const contentCenter = contentLeft + contentWidth / 2;

    layoutPaperBackground(this.backgroundImage, width, height, { bands: false });
    this.hud.layout(width, height);
    this.status
      .setFontSize(compact ? 10 : 12)
      .setWordWrapWidth(Math.max(240, contentWidth - 32))
      .setPosition(contentCenter, height - (compact ? 116 : 112));
    this.updateEconomyUi();

    this.layoutPanel(contentLeft, contentWidth, width, height, compact || portrait);
    const panelTop = this.panelLayout?.top ?? height - 110;
    const statusY = Math.min(panelTop - 18, height - (compact ? 118 : 114));
    this.status
      .setFontSize(compact ? 10 : 12)
      .setWordWrapWidth(Math.max(240, contentWidth - 32))
      .setPosition(contentCenter, statusY);
    let boardBottom = Math.min(statusY - 20, height - 126) - boardBottomGap;

    const boardTop = topInset + boardTopGap;
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

    if (this.panelLayout) {
      const visualBoardBottom = Math.max(
        ...this.plateCells.map((cell) => this.hexToScreen(cell).y),
      ) + this.hexSize * 0.88;
      const anchor = inventoryAnchorMetrics({
        boardBottom: visualBoardBottom,
        panelHeight: this.panelLayout.height,
        viewportHeight: height,
        gap: compact ? 8 : 12,
        bottomPadding: compact ? 92 : 88,
      });
      this.repositionPanel(anchor.top);
      this.status.setPosition(
        contentCenter,
        Math.min(anchor.top - 16, height - (compact ? 118 : 114)),
      );
    }

    for (const view of this.pieceViews.values()) {
      const position = this.hexToScreen(view.piece);
      const hitDiameter = Math.max(42, this.hexSize * 1.56);
      view.label
        ?.setPosition(position.x, position.y)
        .setFontSize(Math.max(11, Math.floor(this.hexSize * 0.57)));
      view.hitZone.setPosition(position.x, position.y).setSize(hitDiameter, hitDiameter);
      const hitArea = view.hitZone.input?.hitArea;
      if (hitArea instanceof Phaser.Geom.Circle) {
        hitArea.setTo(
          hitDiameter / 2,
          hitDiameter / 2,
          hitDiameter / 2,
        );
      }
    }
    this.render();
    this.layoutMechanicCard(width, height, compact);
    this.layoutEconomyModal(width, height, compact);
    this.layoutPauseMenu(width, height);
    this.completionOverlay.layout(width, height);
  }

  layoutPauseMenu(width: number, height: number): void {
    this.pauseMenuGraphics.clear();
    if (!this.pauseMenuVisible) {
      this.pauseMenuPanel.setVisible(false);
      return;
    }
    const campaignNavigation =
      this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.TUTORIAL;
    const buttons = [
      this.pauseResumeButton,
      this.pauseRestartButton,
      ...(campaignNavigation ? [this.pauseLevelsButton] : []),
      this.pauseExitButton,
    ];
    const compact = width < 560;
    const cardWidth = Math.min(width - 28, 430);
    const cardHeight = Math.min(height - 24, 104 + buttons.length * 54);
    const x = (width - cardWidth) / 2;
    const y = (height - cardHeight) / 2;
    const buttonWidth = Math.min(cardWidth - 36, 330);
    const startY = y + 88;
    const step = Math.min(54, (cardHeight - 102) / buttons.length);

    this.pauseMenuHitZone.setPosition(width / 2, height / 2).setSize(width, height);
    this.pauseMenuHitZone.input?.hitArea?.setTo(0, 0, width, height);
    this.pauseMenuGraphics.fillStyle(0x000000, 0.78).fillRect(0, 0, width, height);
    resizeNineSlice(this.pauseMenuPanel, cardWidth, cardHeight);
    this.pauseMenuPanel
      .setPosition(width / 2, y + cardHeight / 2)
      .setVisible(true);
    this.pauseMenuTitle
      .setText(this.uiText("ПАУЗА", "PAUSED"))
      .setFontSize(compact ? 20 : 24)
      .setPosition(width / 2, y + 38);
    this.pauseResumeButton.setText(this.uiText("ПРОДОЛЖИТЬ", "RESUME")).setBackgroundColor("#526d5a");
    this.pauseRestartButton.setText(
      this.mode === PlayMode.ENDLESS
        ? this.uiText("НОВЫЙ ЗАБЕГ", "NEW RUN")
        : this.uiText("ЗАНОВО", "RESTART"),
    );
    this.pauseLevelsButton.setText(this.uiText("ВЫБОР УРОВНЕЙ", "LEVEL SELECT"));
    this.pauseExitButton.setText(this.uiText("ГЛАВНОЕ МЕНЮ", "MAIN MENU"));
    buttons.forEach((button, index) => {
      button
        .setFontSize(compact ? 11 : 13)
        .setFixedSize(buttonWidth, Math.min(44, step - 6))
        .setPosition(width / 2, startY + index * step);
    });
  }

  layoutEconomyModal(width: number, height: number, compact: boolean): void {
    this.economyModalGraphics.clear();
    if (!this.economyModalVisible) {
      this.economyModalPanel.setVisible(false);
      return;
    }
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
    resizeNineSlice(this.economyModalPanel, cardWidth, cardHeight);
    this.economyModalPanel
      .setPosition(width / 2, y + cardHeight / 2)
      .setVisible(true);
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

  layoutMechanicCard(width: number, height: number, compact: boolean): void {
    this.mechanicCardHitZone.setPosition(width / 2, height / 2).setSize(width, height);
    if (this.mechanicCardHitZone.input?.hitArea) {
      this.mechanicCardHitZone.input.hitArea.setTo(0, 0, width, height);
    }
    if (!this.mechanicCardVisible) return;

    const cardWidth = Math.min(width - 28, 520);
    const cardHeight = compact ? 270 : 300;
    const x = (width - cardWidth) / 2;
    const y = (height - cardHeight) / 2;
    this.mechanicCardGraphics.clear();
    this.mechanicCardGraphics.fillStyle(0x000000, 0.72);
    this.mechanicCardGraphics.fillRect(0, 0, width, height);
    resizeNineSlice(this.mechanicCardPanel, cardWidth, cardHeight);
    this.mechanicCardPanel
      .setPosition(width / 2, y + cardHeight / 2)
      .setVisible(true);
    this.layoutMechanicCardGlyphs(width / 2, y, cardWidth, compact);
    this.mechanicCardText
      .setFontSize(compact ? 14 : 18)
      .setPosition(width / 2, y + (compact ? 164 : 184))
      .setWordWrapWidth(cardWidth - 34);
    this.mechanicCardHint.setPosition(width / 2, y + cardHeight - 28);
  }

  layoutMechanicCardGlyphs(
    centerX: number,
    cardTop: number,
    cardWidth: number,
    compact: boolean,
  ): void {
    const count = this.mechanicCardGlyphs.length;
    if (count === 0) return;
    const size = compact ? 56 : 72;
    const gap = compact ? 18 : 24;
    const step = size + gap;
    const totalWidth = size * count + gap * Math.max(0, count - 1);
    const startX = centerX - totalWidth / 2 + size / 2;
    const y = cardTop + (compact ? 70 : 78);
    this.mechanicCardGlyphs.forEach((glyph, index) => {
      glyph
        .setPosition(startX + index * step, y)
        .setDisplaySize(
          size * (ACTIVE_ART_THEME === "premium" ? PHYSICAL_PIECE_UI_CANVAS_SCALE : 1),
          size * (ACTIVE_ART_THEME === "premium" ? PHYSICAL_PIECE_UI_CANVAS_SCALE : 1),
        )
        .setVisible(true);
    });
  }

  layoutPanel(contentLeft: number, contentWidth: number, _width: number, height: number, compact: boolean): void {
    this.panelLayout = this.inventory.layout(
      contentLeft,
      contentWidth,
      height,
      compact,
      this.panelTypes,
    );
  }

  repositionPanel(top: number): void {
    this.inventory.reposition(top);
    this.panelLayout = this.inventory.layoutState;
  }

  hexToScreen(index: HexCoord): { x: number; y: number } {
    const q = index.q - BOARD_CENTER.q;
    const r = index.r - BOARD_CENTER.r;
    return {
      x: this.boardCenterX + this.hexSize * Math.sqrt(3) * (q + r / 2),
      y: this.boardCenterY + this.hexSize * 1.5 * r,
    };
  }

  clearCellViews(): void {
    for (const image of this.cellViews.values()) image.destroy();
    this.cellViews.clear();
  }

  renderPhysicalCells(): boolean {
    const frame = PHYSICAL_MATERIAL_FRAMES.boardCell;
    if (!this.textures.exists(frame)) {
      this.clearCellViews();
      return false;
    }

    const wanted = new Set(this.plateCells.map(hexKey));
    for (const [key, image] of this.cellViews) {
      if (wanted.has(key)) continue;
      image.destroy();
      this.cellViews.delete(key);
    }

    for (const cell of this.plateCells) {
      const key = hexKey(cell);
      let image = this.cellViews.get(key);
      if (!image) {
        image = this.add.image(0, 0, frame).setDepth(0);
        this.cellViews.set(key, image);
      }
      const position = this.hexToScreen(cell);
      image
        .setPosition(position.x, position.y)
        .setTexture(frame)
        .setDisplaySize(
          this.hexSize * PHYSICAL_BOARD_CANVAS_SCALE,
          this.hexSize * PHYSICAL_BOARD_CANVAS_SCALE,
        )
        .setVisible(true);
    }
    return true;
  }

  renderAtlasCells(): boolean {
    const requiredFrames = Object.values(GAMEPLAY_FRAMES);
    if (!requiredFrames.every((frame) => this.textures.exists(frame))) {
      this.clearCellViews();
      return false;
    }

    const wanted = new Set(this.plateCells.map(hexKey));
    for (const [key, image] of this.cellViews) {
      if (wanted.has(key)) continue;
      image.destroy();
      this.cellViews.delete(key);
    }

    const selected = new Set(this.board?.selected.map(hexKey));
    for (const cell of this.plateCells) {
      const key = hexKey(cell);
      let image = this.cellViews.get(key);
      if (!image) {
        const created: Phaser.GameObjects.Image = this.add
          .image(0, 0, GAMEPLAY_FRAMES.hexIdle)
          .setDepth(0);
        this.cellViews.set(key, created);
        image = created;
      }
      const position = this.hexToScreen(cell);
      const frame = hexFrameForState({
        selected: selected.has(key),
        hovered: this.hoveredPieceKey === key,
      });
      image
        .setPosition(position.x, position.y)
        .setTexture(frame)
        .setDisplaySize(this.hexSize * 2, this.hexSize * 2);
    }
    return true;
  }

  drawHex(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, fillColor: number, lineColor: number, lineWidth = 1): void {
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
    if (ACTIVE_ART_THEME === "premium") {
      graphics.fillStyle(fillColor, 0.72).fillPoints(points, true);
      graphics.lineStyle(Math.max(1, lineWidth * 1.65), 0x0b1d17, 0.72).strokePoints(points, true);
      graphics.lineStyle(Math.max(0.8, lineWidth * 0.72), lineColor, 0.82).strokePoints(points, true);
      return;
    }
    graphics.fillStyle(fillColor, 1).fillPoints(points, true);
    graphics.lineStyle(lineWidth, lineColor, 1).strokePoints(points, true);
  }

  render(): void {
    const count = this.board?.size ?? 0;
    const levelLabel =
      this.mode === PlayMode.CAMPAIGN
        ? `${String(this.level + 1).padStart(2, "0")}/${CAMPAIGN_LEVEL_COUNT}`
        : String(this.level + 1).padStart(4, "0");
    const tutorialMode = this.mode === PlayMode.TUTORIAL;
    const identity = tutorialMode
      ? this.uiText("ОБУЧЕНИЕ", "TUTORIAL")
      : this.mode === PlayMode.CAMPAIGN
      ? `${this.uiText("УРОВЕНЬ", "LEVEL")} ${levelLabel}`
      : `ENDLESS · ${this.uiText("ПОЛЕ", "BOARD")} ${levelLabel}`;
    this.hud.setIdentity(identity);
    this.hud.setRemaining(count);
    this.hud.setCleanVisible(this.mode === PlayMode.CAMPAIGN);
    this.hud.setCleanEligible(
      this.mode === PlayMode.CAMPAIGN
        ? this.campaignSession?.cleanEligible ?? true
        : this.attemptState.cleanEligible,
    );
    const canUndo = this.mode === PlayMode.CAMPAIGN
      ? this.campaignSession?.canUndo === true
      : this.removalHistory.length > 0 && !this.board?.won;
    this.hud.setUndoEnabled(!this.busy && canUndo);
    this.updateEndlessHud();
    this.updateCampaignHud();
    this.updateEconomyUi();

    const introActive = this.introAnimator?.active === true;
    const inventoryVisible =
      this.board !== undefined && !this.mechanicCardVisible;
    const boardActionsEnabled = inventoryVisible && !introActive;
    this.renderPanel(introActive);
    this.inventory.setPresentationVisible(inventoryVisible, boardActionsEnabled);
    for (const button of this.hintButtons.values()) {
      button.setVisible(false).disableInteractive();
    }
    this.cellGraphics.clear();
    if (this.levelGeometryReady) {
      const physicalCellsRendered =
        ACTIVE_ART_THEME === "premium" && this.renderPhysicalCells();
      if (!physicalCellsRendered) {
        if (this.cellViews.size > 0) this.clearCellViews();
        for (const cell of this.plateCells) {
          const position = this.hexToScreen(cell);
          this.drawHex(
            this.cellGraphics,
            position.x,
            position.y,
            this.hexSize * 0.95,
            THEME_COLORS.cellFillNumber,
            THEME_COLORS.cellLineNumber,
            Math.max(1, this.hexSize * 0.025),
          );
        }
      }
    } else if (this.cellViews.size > 0) {
      this.clearCellViews();
    }

    this.atomGraphics.clear();
    if (!this.board) return;
    const selected = new Set(this.board.selected.map(hexKey));
    const introBoard = introActive
      ? new GardenBoard(
          this.board
            .pieces()
            .filter((piece) => this.introRevealedKeys.has(hexKey(piece))),
        )
      : undefined;
    for (const view of this.pieceViews.values()) {
      const key = hexKey(view.piece);
      if (this.mechanicCardVisible) {
        view.hitZone.setVisible(false).disableInteractive();
        view.tokenBase?.setVisible(false);
        view.glyph?.setVisible(false);
        view.label?.setVisible(false);
        view.filterGlow?.setVisible(false);
        continue;
      }
      const revealed = !introActive || this.introRevealedKeys.has(key);
      view.hitZone.setVisible(revealed);
      view.tokenBase?.setVisible(revealed);
      view.glyph?.setVisible(revealed);
      view.label?.setVisible(revealed);
      view.filterGlow?.setVisible(revealed);
      if (!revealed) {
        view.hitZone.disableInteractive();
        continue;
      }
      if (introActive) {
        view.hitZone.disableInteractive();
      } else if (!view.hitZone.input?.enabled) {
        const hitDiameter = Math.max(42, this.hexSize * 1.56);
        view.hitZone.setInteractive(
          new Phaser.Geom.Circle(hitDiameter / 2, hitDiameter / 2, hitDiameter / 2),
          Phaser.Geom.Circle.Contains,
        );
        if (view.hitZone.input) view.hitZone.input.cursor = "pointer";
      }
      const position = this.hexToScreen(view.piece);
      const free = introBoard
        ? introBoard.isFree(view.piece)
        : this.board.isFree(view.piece);
      const isPanelMatch = this.activePanelType === view.piece.type;
      const isHinted = this.activeHintKeys.has(hexKey(view.piece));
      const isBlocked =
        this.blockedMoveKey !== undefined &&
        this.blockedMoveKey.split("|").includes(hexKey(view.piece));
      const radius = this.hexSize * 0.7;
      const introProgress = introActive
        ? this.introAnimator?.entranceProgress(key, this.time.now) ?? 1
        : 1;
      const introScale = 0.9 + introProgress * 0.1;
      const visualState = resolvePieceVisualState({
        free,
        selected: selected.has(key),
        hovered: this.hoveredPieceKey === key,
        hinted: isHinted,
        blocked: isBlocked,
        now: this.time.now,
      });
      const filter = pieceFilterEmphasis({
        filterActive: this.activePanelType !== null,
        matchesFilter: isPanelMatch,
      });
      const alpha = visualState.alpha * filter.alphaMultiplier * introProgress;

      if (filter.positiveMatch) {
        this.atomGraphics.fillStyle(ATOM_COLORS[view.piece.type], 0.14 * introProgress);
        this.atomGraphics.fillCircle(position.x, position.y, radius * 1.12 * introScale);
      }

      if (!view.glyph && !view.tokenBase) {
        this.atomGraphics.fillStyle(0x050806, free ? 0.48 : 0.25);
        this.atomGraphics.fillCircle(
          position.x,
          position.y + Math.max(1, this.hexSize * 0.08),
          radius * 1.08 * introScale,
        );
        this.atomGraphics.fillStyle(0x182231, alpha);
        this.atomGraphics.fillCircle(position.x, position.y, radius * 1.04 * introScale);
        this.atomGraphics.fillStyle(ATOM_COLORS[view.piece.type], alpha);
        this.atomGraphics.fillCircle(position.x, position.y, radius * 0.9 * introScale);
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
          Math.max(1, this.hexSize * 0.045),
          0x657080,
          1,
        );
        this.atomGraphics.strokeCircle(position.x, position.y, radius * 1.02);
      }

      if (visualState.haloAlpha > 0) {
        const feedbackColor =
          visualState.kind === "blocked"
            ? 0xef5a50
            : visualState.kind === "hinted"
            ? 0x68cf75
            : visualState.kind === "selected"
            ? 0xf3c94f
            : 0xe4edf6;
        this.atomGraphics.lineStyle(
          Math.max(1, this.hexSize * (visualState.haloWidth === 1 ? 0.035 : 0.055)),
          feedbackColor,
          visualState.haloAlpha,
        );
        this.atomGraphics.strokeCircle(
          position.x,
          position.y,
          radius * 1.1 * visualState.scale,
        );
      }

      view.tokenBase
        ?.setPosition(position.x, position.y)
        .setDisplaySize(
          this.hexSize * PHYSICAL_PIECE_CANVAS_SCALE * visualState.scale * introScale,
          this.hexSize * PHYSICAL_PIECE_CANVAS_SCALE * visualState.scale * introScale,
        )
        .setAlpha(alpha * 0.98);
      view.filterGlow
        ?.setPosition(position.x, position.y)
        .setDisplaySize(radius * 1.92 * introScale, radius * 1.92 * introScale)
        .setAlpha(filter.positiveMatch ? 0.16 * introProgress : 0);
      const glyphScale = view.tokenBase ? 1.28 : 1.78;
      view.glyph
        ?.setPosition(position.x, position.y - (view.tokenBase ? radius * 0.035 : 0))
        .setDisplaySize(
          radius * glyphScale * visualState.scale * introScale,
          radius * glyphScale * visualState.scale * introScale,
        )
        .setAlpha(alpha);
      view.label
        ?.setPosition(position.x, position.y)
        .setFontSize(Math.max(10, Math.floor(radius * 0.5)))
        .setColor(
          ACTIVE_ART_THEME === "premium"
            ? free
              ? THEME_COLORS.ink
              : "#686868"
            : free
            ? "#eef3f8"
            : "#9aa7b5",
        )
        .setScale(visualState.scale * introScale)
        .setAlpha((free ? 0.92 : 0.5) * introProgress);
    }
    this.renderTutorialGuide();
  }

  introInventoryRevealState(): Readonly<BoardInventoryRevealState> | undefined {
    const animator = this.introAnimator;
    if (!animator?.active) return undefined;

    const revealedCounts = new Map<AtomType, number>();
    const activationProgress = new Map<AtomType, number>();
    for (const piece of this.initialPieces) {
      const key = hexKey(piece);
      if (!this.introRevealedKeys.has(key)) continue;
      revealedCounts.set(piece.type, (revealedCounts.get(piece.type) ?? 0) + 1);
      activationProgress.set(
        piece.type,
        Math.max(
          activationProgress.get(piece.type) ?? 0,
          animator.entranceProgress(key, this.time.now),
        ),
      );
    }
    return { revealedCounts, activationProgress };
  }

  renderPanel(introActive = false): void {
    if (!this.panelLayout) {
      this.inventory.graphics.clear();
      return;
    }
    if (!this.board) {
      this.inventory.graphics.clear();
      return;
    }
    const state = createPanelState(this.board, {
      variant: this.variant,
      activeType: this.activePanelType,
      types: this.panelTypes,
    });
    if (
      this.activePanelType !== null &&
      state.entries.find((entry) => entry.type === this.activePanelType)?.depleted
    ) {
      this.panelHighlightTimer?.remove(false);
      this.panelHighlightTimer = undefined;
      this.activePanelType = null;
    }
    const introReveal = introActive ? this.introInventoryRevealState() : undefined;
    this.inventory.render(state, introReveal);
  }
}
