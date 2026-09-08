import Phaser from "phaser";
import {
  ACTIVE_ART_THEME,
  GAMEPLAY_UI_FRAMES,
  PHYSICAL_MATERIAL_FRAMES,
  UI_FRAMES,
  atomGlyphFrame,
  physicalPieceFrameForType,
} from "../../art-assets.js";
import { Atom, ATOM_NAMES, type AtomType } from "../../atom-types.js";
import { GardenBoard, type BoardPiece, type BoardPieceInput } from "../../board.js";
import { getCampaignLevel } from "../../campaign-levels.js";
import { BrowserLevelGenerator } from "../../browser.js";
import { dailyDateKey } from "../../daily-calendar.js";
import { DailyProgressStore } from "../../daily-progress.js";
import {
  scoreRemovedAtoms,
  SCORE_PER_REMOVED_ATOM,
} from "../../endless-score.js";
import { BoardVariant, type BoardVariantValue } from "../../generator.js";
import type { ProgressionLevelDefinition } from "../../progression.js";
import { CAMPAIGN_LEVEL_COUNT } from "../../plates.js";
import {
  campaignPostCompletionDestination,
  type CampaignHomeReveal,
} from "../../campaign-routing.js";
import { BOARD_CENTER, enumerateBoardCells, hexKey, type HexCoord } from "../../hex.js";
import {
  PANEL_METAL_TYPES,
  createPanelState,
  panelTypesForVariant,
} from "../../panel-state.js";
import { mechanicIntroductionForLevel } from "../../mechanic-introductions.js";
import type { CampaignProgressSnapshot } from "../../campaign-progress.js";
import { masteryRank, type MasteryRankValue } from "../../mastery.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEndlessProgress } from "../endless-progress.js";
import { getLeaderboard } from "../leaderboard.js";
import { getSettings } from "../settings.js";
import { CompletionOverlay } from "../completion-overlay.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { getTrustedClock } from "../../platform/trusted-clock.js";
import { PlayMode, type PlayModeValue } from "../modes.js";
import { isActualDeadEnd } from "../board-session-state.js";
import {
  pieceFeedbackKind,
  pieceFilterEmphasis,
  resolvePieceVisualState,
} from "../piece-visual-state.js";
import { openUtilityScene as openCoveredUtilityScene } from "../utility-navigation.js";
import { boardFloatingMetrics } from "../responsive-layout.js";
import {
  boardPrimitiveMetrics,
  inventoryAnchorMetrics,
} from "../presentation-layout.js";
import { tutorialPresentationStep, type UtilitySceneKey } from "../presentation-model.js";
import {
  SolveStatus,
  type SolveStatusValue,
  type WinningRouteResult,
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
import { BoardAssistance } from "../board/BoardAssistance.js";
import { assistancePolicy } from "../board/assistance-policy.js";
import { CampaignBoardSession } from "../board/CampaignBoardSession.js";
import { DailyBoardSession } from "../board/DailyBoardSession.js";
import { EndlessBoardSession } from "../board/EndlessBoardSession.js";
import {
  MINIMAL_UI_COLORS,
  makeMinimalButton,
  makeMinimalText,
} from "../minimal-ui.js";
import {
  createAttemptState,
  restartAttempt,
} from "../board/attempt-state.js";
import {
  BoardInventory,
  type BoardInventoryLayout,
  type BoardInventoryRevealState,
} from "../board/BoardInventory.js";
import { BoardTutorial } from "../board/BoardTutorial.js";
import {
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

const PANEL_HIGHLIGHT_DURATION_MS = 2000;
const MOVE_HINT_DURATION_MS = 4000;

function formatScore(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
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
  container: Phaser.GameObjects.Container;
  circle: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
};

type RemovalHistoryEntry = {
  pieces: readonly BoardPieceInput[];
  campaignLevelScore: number;
  displayedCampaignScore: number;
};

type RestoreOptions = {
  blockedMove?: readonly HexCoord[];
  winningRoute?: readonly (readonly HexCoord[])[];
};

type CampaignCompletionArgs = {
  snapshot: CampaignProgressSnapshot;
  progressBefore: CampaignProgressSnapshot;
  clean: boolean;
};

type PositionAnalysis = Readonly<{
  status: SolveStatusValue;
  route: readonly (readonly HexCoord[])[];
}>;

function isPlayModeValue(value: unknown): value is PlayModeValue {
  return typeof value === "string" && (Object.values(PlayMode) as readonly string[]).includes(value);
}

function boardInitData(data: unknown): { mode?: PlayModeValue; level?: number; runSeed?: string } {
  if (typeof data !== "object" || data === null) return {};
  const raw = data as { mode?: unknown; level?: unknown; runSeed?: unknown };
  return {
    ...(isPlayModeValue(raw.mode) ? { mode: raw.mode } : {}),
    ...(Number.isSafeInteger(raw.level) && (raw.level as number) >= 0 ? { level: raw.level as number } : {}),
    ...(typeof raw.runSeed === "string" && raw.runSeed.length > 0 ? { runSeed: raw.runSeed } : {}),
  };
}

function createEndlessRunSeed(): string {
  return `endless-v2:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export class BoardScene extends Phaser.Scene {
  level = 0;
  mode: PlayModeValue = PlayMode.CAMPAIGN;
  variant: BoardVariantValue = BoardVariant.STANDARD;
  generationToken = 0;
  initialPieces: BoardPiece[] = [];
  plateCells: readonly HexCoord[] = enumerateBoardCells();
  plateRadius = 5;
  levelGeometryReady = false;
  levelDefinition: Readonly<ProgressionLevelDefinition> | TutorialLevel["definition"] | undefined;
  boardShape: string | undefined;
  board: GardenBoard | undefined;
  pieceViews = new Map<string, PieceView>();
  panelTypes: AtomType[] = [];
  activePanelType: AtomType | null = null;
  panelHighlightTimer: Phaser.Time.TimerEvent | undefined;
  panelLayout: BoardInventoryLayout | undefined;
  tutorialStep = 0;
  tutorialSolution: readonly (readonly HexCoord[])[] = [];
  mechanicCardVisible = false;
  campaignLevelScore = 0;
  displayedCampaignScore = 0;
  campaignScoreTween: Phaser.Tweens.Tween | undefined;
  campaignScoringActive = false;
  campaignSession: CampaignBoardSession | undefined;
  dailySession: DailyBoardSession | undefined;
  endlessSession: EndlessBoardSession | undefined;
  endlessRunSeed = "";
  removalHistory: RemovalHistoryEntry[] = [];
  activeHintKeys = new Set<string>();
  hintTimer: Phaser.Time.TimerEvent | undefined;
  rewardedAdPending = false;
  certifiedSolution: readonly (readonly HexCoord[])[] = [];
  knownWinningRoute: readonly (readonly HexCoord[])[] = [];
  positionSolveStatus: SolveStatusValue = SolveStatus.UNKNOWN;
  actualDeadEnd = false;
  blockedMoveKey: string | undefined;
  pauseMenuVisible = false;
  campaignDeadEndVisible = false;
  campaignRescueUnavailable = false;
  hoveredPieceKey: string | undefined;
  busy = false;
  english = false;
  progress!: ReturnType<typeof getCampaignProgress>;
  endlessProgress!: ReturnType<typeof getEndlessProgress>;
  dailyProgress!: DailyProgressStore;
  leaderboard!: ReturnType<typeof getLeaderboard>;
  platform!: ReturnType<typeof getYandexGamesAdapter>;
  generator!: BrowserLevelGenerator;
  assistance!: BoardAssistance;
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
  backgroundGraphics!: Phaser.GameObjects.Graphics;
  cellGraphics!: Phaser.GameObjects.Graphics;
  atomGraphics!: Phaser.GameObjects.Graphics;
  mechanicCardGraphics!: Phaser.GameObjects.Graphics;
  mechanicCardPanel!: ReturnType<typeof makePanel>;
  mechanicCardText!: Phaser.GameObjects.Text;
  mechanicCardHint!: Phaser.GameObjects.Text;
  mechanicCardHitZone!: Phaser.GameObjects.Zone;
  mechanicCardGlyphs: Phaser.GameObjects.Image[] = [];
  pauseMenuGraphics!: Phaser.GameObjects.Graphics;
  pauseMenuPanel!: ReturnType<typeof makePanel>;
  pauseMenuHitZone!: Phaser.GameObjects.Zone;
  pauseMenuTitle!: Phaser.GameObjects.Text;
  pauseResumeButton!: ReturnType<typeof makeButton>;
  pauseRestartButton!: ReturnType<typeof makeButton>;
  pauseLevelsButton!: ReturnType<typeof makeButton>;
  pauseExitButton!: ReturnType<typeof makeButton>;
  campaignDeadEndGraphics!: Phaser.GameObjects.Graphics;
  campaignDeadEndTitle!: Phaser.GameObjects.Text;
  campaignDeadEndRestartButton!: ReturnType<typeof makeMinimalButton>;
  campaignDeadEndRescueButton!: ReturnType<typeof makeMinimalButton>;
  completionOverlay!: CompletionOverlay;
  status!: Phaser.GameObjects.Text;
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
    this.panelViews = new Map();
    this.panelTypes = [];
    this.activePanelType = null;
    this.panelHighlightTimer = undefined;
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.mechanicCardVisible = false;
    this.campaignLevelScore = 0;
    this.displayedCampaignScore = 0;
    this.campaignScoreTween = undefined;
    this.campaignScoringActive = false;
    this.campaignSession = undefined;
    this.dailySession = undefined;
    this.endlessSession = undefined;
    this.endlessRunSeed = "";
    this.removalHistory = [];
    this.activeHintKeys = new Set();
    this.hintTimer = undefined;
    this.rewardedAdPending = false;
    this.certifiedSolution = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.attemptState = createAttemptState();
    this.pauseMenuVisible = false;
    this.campaignDeadEndVisible = false;
    this.campaignRescueUnavailable = false;
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
    this.endlessProgress = getEndlessProgress(this);
    this.dailyProgress = new DailyProgressStore();
    this.english = getSettings(this).snapshot.language === "en";
    this.mode = init.mode ?? PlayMode.CAMPAIGN;
    this.variant = BoardVariant.STANDARD;
    const requestedLevel = init.level ?? 0;
    this.level =
      this.mode === PlayMode.CAMPAIGN
        ? Math.min(requestedLevel, this.progress.snapshot.highestUnlocked)
        : this.mode === PlayMode.ENDLESS
        ? 0
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
    this.campaignLevelScore = 0;
    this.displayedCampaignScore = this.progress.snapshot.campaignScore;
    this.campaignScoreTween = undefined;
    this.campaignScoringActive = false;
    this.campaignSession = undefined;
    this.dailySession = undefined;
    this.endlessSession = this.mode === PlayMode.ENDLESS ? new EndlessBoardSession() : undefined;
    this.endlessRunSeed = this.mode === PlayMode.ENDLESS ? init.runSeed ?? createEndlessRunSeed() : "";
    this.removalHistory = [];
    this.activeHintKeys = new Set();
    this.hintTimer = undefined;
    this.rewardedAdPending = false;
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
    this.leaderboard = getLeaderboard(this);
    this.leaderboard.syncCampaignScore(this.progress.snapshot.campaignScore);
    this.platform = getYandexGamesAdapter();
    this.assistance = new BoardAssistance(this.platform);
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.panelTypes = [];
    this.generator = new BrowserLevelGenerator();
    this.backgroundGraphics = this.add.graphics().setDepth(-3);
    this.cellGraphics = this.add.graphics();
    this.atomGraphics = this.add.graphics().setDepth(1);
    this.inventory = new BoardInventory(
      this,
      {
        onSelectType: (type) => this.selectPanelType(type),
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
        onHint: () => this.usePrimaryHint(),
        onOverflow: () => this.openPauseMenu(),
      },
      { english: this.english },
    );
    this.status = makeText(this, "", 12, "#9aa7b5").setOrigin(0.5).setDepth(10);
    this.mechanicCardGraphics = this.add.graphics().setDepth(20);
    this.mechanicCardPanel = makePanel(this, UI_FRAMES.panelMainMedium, 20)
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

    this.campaignDeadEndGraphics = this.add.graphics().setDepth(34).setVisible(false);
    this.campaignDeadEndTitle = makeMinimalText(
      this,
      this.uiText("ХОДОВ НЕТ", "NO MOVES"),
      22,
      MINIMAL_UI_COLORS.text,
    ).setOrigin(0.5).setFontStyle("bold").setDepth(35).setVisible(false);
    this.campaignDeadEndRestartButton = makeMinimalButton(
      this,
      this.uiText("ЗАНОВО", "RESTART"),
      () => this.restartCampaignFromDeadEnd(),
    ).setDepth(35).setVisible(false).setEnabled(false);
    this.campaignDeadEndRescueButton = makeMinimalButton(
      this,
      this.uiText("СПАСТИ ПОПЫТКУ", "RESCUE ATTEMPT"),
      () => void this.requestCampaignRescue(),
    ).setDepth(35).setVisible(false).setEnabled(false);

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
      this.openPauseMenu();
    });

    this.scale.on("resize", this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.layout, this);
      this.generator.terminate();
      this.introAnimator?.stop();
      this.pieceViews.clear();
      this.panelViews.clear();
    });
    this.rebuildPanelViews();
    this.layout();
    this.loadLevel();
  }

  async loadLevel(introProfile: BoardIntroProfile = "fresh"): Promise<void> {
    const token = ++this.generationToken;
    this.campaignSession = undefined;
    this.dailySession = undefined;
    this.removalHistory = [];
    this.hideCampaignDeadEndState();
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
          : this.mode === PlayMode.DAILY
          ? await (async () => {
              const trustedNow = await getTrustedClock().now();
              if (!trustedNow) {
                throw new Error(
                  this.uiText(
                    "НЕДОСТУПНО ДОВЕРЕННОЕ ВРЕМЯ ЯНДЕКСА",
                    "YANDEX TRUSTED TIME IS UNAVAILABLE",
                  ),
                );
              }
              const dateKey = dailyDateKey(trustedNow);
              const generated = await this.generator.generateDaily(dateKey);
              const session = new DailyBoardSession(generated, this.dailyProgress);
              this.dailySession = session;
              return {
                ...generated,
                board: session.board,
                variant: BoardVariant.STANDARD,
                shape: "canonical" as const,
              };
            })()
          : this.mode === PlayMode.ENDLESS
          ? await this.generator.generateEndlessRun(this.level, {
              runSeed: this.endlessRunSeed,
            })
          : await Promise.reject<never>(new Error("Unsupported play mode"));
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
    if (this.mode === PlayMode.ENDLESS) return;
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

  openMainMenu(reveal?: CampaignHomeReveal): void {
    this.generationToken += 1;
    this.scene.start("menu", reveal ? { reveal } : undefined);
  }

  openUtilityScene(key: UtilitySceneKey): void {
    if (
      this.rewardedAdPending ||
      this.completionOverlay?.visible
    ) return;
    if (this.pauseMenuVisible) this.closePauseMenu();
    openCoveredUtilityScene(this, key, { returnScene: "board" });
  }

  openPauseMenu(): void {
    if (
      this.pauseMenuVisible ||
      this.rewardedAdPending ||
      this.completionOverlay?.visible
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

  restartLevel(): void {
    if (
      this.busy ||
      this.completionOverlay?.visible ||
      this.pauseMenuVisible ||
      this.initialPieces.length === 0
    ) return;
    this.hideCampaignDeadEndState();
    if (this.mode === PlayMode.ENDLESS) {
      this.scene.restart({
        mode: PlayMode.ENDLESS,
        level: 0,
        runSeed: createEndlessRunSeed(),
      });
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
    } else if (this.mode === PlayMode.DAILY && this.dailySession) {
      this.dailySession.restart();
      this.board = this.dailySession.board;
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
      this.completionOverlay?.visible ||
      this.pauseMenuVisible ||
      this.campaignDeadEndVisible ||
      (this.mode === PlayMode.ENDLESS && this.endlessSession?.deadEnd === true) ||
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
      campaignLevelScore: this.campaignLevelScore,
      displayedCampaignScore: this.displayedCampaignScore,
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
      } else if (this.mode === PlayMode.DAILY && this.dailySession) {
        this.dailySession.recordBeforeRemoval(beforeRemovalPieces);
      } else if (this.mode === PlayMode.ENDLESS && this.endlessSession) {
        this.endlessSession.recordBeforeRemoval(beforeRemovalPieces);
      } else {
        this.removalHistory.push(beforeRemoval);
        if (this.removalHistory.length > 64) this.removalHistory.shift();
      }
      this.clearMoveHint(false);
      let message = "";
      if (
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
          completionAfterRebuild = () =>
            this.scene.restart({ mode: PlayMode.CAMPAIGN, level: 0 });
          message = "";
        } else if (this.mode === PlayMode.CAMPAIGN) {
          const progressBefore = this.progress.snapshot;
          const alreadyCompleted = this.progress.isCompleted(this.level);
          const clean = this.campaignSession?.cleanEligible === true;
          const snapshot = this.progress.complete(this.level, { clean });
          this.campaignScoringActive = false;
          if (snapshot.campaignCompleted) {
            message = this.uiText("КАМПАНИЯ ЗАВЕРШЕНА", "CAMPAIGN COMPLETE");
          } else if (!alreadyCompleted && !this.progress.testMode) {
            message = `${this.uiText("ОТКРЫТ УРОВЕНЬ", "LEVEL UNLOCKED")} ${this.level + 2}`;
          }
          completionAfterRebuild = () =>
            this.showCampaignCompletion({ snapshot, progressBefore, clean });
        } else if (this.mode === PlayMode.DAILY) {
          message = "";
          completionAfterRebuild = () => void this.completeDailyBoard();
        } else if (this.mode === PlayMode.ENDLESS && this.endlessSession) {
          this.endlessSession.clearBoard();
          const cleared = this.endlessSession.boardsCleared;
          message = this.english
            ? `${cleared} ${cleared === 1 ? "BOARD" : "BOARDS"} CLEARED`
            : `ОЧИЩЕНО ПОЛЕЙ: ${cleared}`;
          completionAfterRebuild = () => this.continueEndlessAfterClear();
        }
        this.setBusy(false);
      } else {
        this.analyzeCurrentPosition();
        if (this.actualDeadEnd) {
          message = this.uiText("ХОДОВ НЕТ", "NO MOVES");
          if (this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.DAILY) {
            this.enterCampaignDeadEndState();
          } else if (this.mode === PlayMode.ENDLESS && this.endlessSession) {
            const deadEnd = this.endlessSession.enterDeadEnd();
            if (deadEnd.kind === "terminal") {
              completionAfterRebuild = () => this.showEndlessCompletion();
            }
          }
        }
      }
      this.status.setText(message);
      this.rebuildPieceViews();
      this.updateTutorialGuide();
      completionAfterRebuild?.();
    }
    this.layout();
  }

  showCampaignCompletion({
    snapshot,
    progressBefore,
    clean,
  }: CampaignCompletionArgs): void {
    const firstCompletion = !progressBefore.solvedLevels.includes(this.level);
    const plannedDestination = campaignPostCompletionDestination(this.level);
    const destination =
      !firstCompletion && plannedDestination.kind === "home" && plannedDestination.reveal !== "campaign-complete"
        ? Object.freeze({ kind: "next" as const, level: this.level + 1 })
        : plannedDestination;
    const chapterComplete = this.level % 10 === 9;
    const chapterStart = Math.floor(this.level / 10) * 10;
    const chapterCleanCount = snapshot.cleanLevels.filter(
      (level) => level >= chapterStart && level < chapterStart + 10,
    ).length;
    const previousRank = masteryRank(progressBefore.cleanLevels.length);
    const currentRank = masteryRank(snapshot.cleanLevels.length);
    const newRank: MasteryRankValue | undefined = currentRank !== previousRank ? currentRank : undefined;

    const actions = destination.kind === "home"
      ? {
          onHome: () => this.openMainMenu(destination.reveal),
          ...(!clean ? { onTryClean: () => this.loadLevel() } : {}),
        }
      : {
          onNext: () => {
            this.level = destination.level;
            this.loadLevel();
          },
          ...(!clean ? { onTryClean: () => this.loadLevel() } : {}),
        };

    this.completionOverlay.show(
      {
        kind: "campaign",
        level: this.level,
        clean,
        cleanCount: snapshot.cleanLevels.length,
        chapterComplete,
        chapterCleanCount,
        ...(newRank ? { newRank } : {}),
      },
      actions,
    );
  }

  async completeDailyBoard(): Promise<void> {
    const session = this.dailySession;
    if (this.mode !== PlayMode.DAILY || !session || !session.board.won) return;

    this.setBusy(true);
    this.status.setText(this.uiText("ПРОВЕРЯЕМ ДАТУ…", "VERIFYING DAILY…"));
    try {
      const trustedNow = await getTrustedClock().now();
      if (!trustedNow) {
        this.status.setText(
          this.uiText(
            "НЕ УДАЛОСЬ ПРОВЕРИТЬ ВРЕМЯ ЯНДЕКСА",
            "YANDEX TRUSTED TIME IS UNAVAILABLE",
          ),
        );
        this.time.delayedCall(1200, () => this.openMainMenu());
        return;
      }

      const completion = session.complete(dailyDateKey(trustedNow));
      if (completion.kind === "expired") {
        this.status.setText(
          this.uiText(
            "ДОСТУПНА НОВАЯ ЕЖЕДНЕВНАЯ ЗАДАЧА",
            "NEW DAILY AVAILABLE",
          ),
        );
        this.time.delayedCall(1200, () => this.openMainMenu());
        return;
      }
      if (completion.kind !== "recorded") return;

      const week = this.dailyProgress.weekSummary(completion.dateKey);
      const achievedClean = completion.snapshot.entries[completion.dateKey]?.clean === true;

      this.status.setText("");
      this.completionOverlay.show(
        {
          kind: "simple",
          title: this.uiText("ЕЖЕДНЕВНАЯ ЗАДАЧА ПРОЙДЕНА", "DAILY COMPLETE"),
          status: completion.clean
            ? this.uiText("◆ ЧИСТОЕ РЕШЕНИЕ", "◆ CLEAN SOLUTION")
            : this.uiText("ПРОЙДЕНО С ПОМОЩЬЮ", "SOLVED WITH HELP"),
          detail: this.english
            ? `WEEK ${week.solvedCount}/7 · ◆ ${week.cleanCount}/7 CLEAN`
            : `НЕДЕЛЯ ${week.solvedCount}/7 · ◆ ЧИСТО ${week.cleanCount}/7`,
          primaryLabel: this.uiText("НА ГЛАВНУЮ", "HOME"),
          ...(!achievedClean
            ? { secondaryLabel: this.uiText("ПОПРОБОВАТЬ ЧИСТО", "TRY CLEAN") }
            : {}),
        },
        {
          onHome: () => this.openMainMenu(),
          ...(!achievedClean ? { onSecondary: () => this.loadLevel() } : {}),
        },
      );
    } finally {
      this.setBusy(false);
    }
  }

  continueEndlessAfterClear(): void {
    const session = this.endlessSession;
    if (this.mode !== PlayMode.ENDLESS || !session) return;
    const nextLevel = session.boardsCleared;
    this.time.delayedCall(650, () => {
      if (this.mode !== PlayMode.ENDLESS || this.endlessSession !== session) return;
      this.level = nextLevel;
      void this.loadLevel();
    });
  }

  showEndlessCompletion(): void {
    const session = this.endlessSession;
    if (this.mode !== PlayMode.ENDLESS || !session) return;
    const result = this.endlessProgress.submit({
      boardsCleared: session.boardsCleared,
      assisted: session.assisted,
    });
    this.completionOverlay.show(
      {
        kind: "endless",
        boardsCleared: session.boardsCleared,
        assisted: session.assisted,
        bestUnassistedBoards: result.bestUnassistedBoards,
      },
      {
        onNext: () => this.scene.restart({
          mode: PlayMode.ENDLESS,
          level: 0,
          runSeed: createEndlessRunSeed(),
        }),
        onHome: () => this.openMainMenu(),
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
    if (this.mode === PlayMode.DAILY) {
      const dailySession = this.dailySession;
      if (!dailySession?.canUndo || !dailySession.undo()) {
        this.status.setText(this.uiText("ПОКА НЕЧЕГО ОТМЕНЯТЬ", "NOTHING TO UNDO YET"));
        this.hud.setUndoEnabled(false);
        return;
      }
      this.restoreCampaignSessionBoard(
        this.uiText("ПОСЛЕДНЕЕ УДАЛЕНИЕ ОТМЕНЕНО", "LAST REMOVAL UNDONE"),
      );
      return;
    }
    if (this.mode === PlayMode.ENDLESS) {
      const session = this.endlessSession;
      if (!session) return;
      if (session.deadEnd) {
        this.showEndlessCompletion();
        return;
      }
      const snapshot = session.undoSnapshot();
      if (!snapshot) {
        this.status.setText(this.uiText("ПОКА НЕЧЕГО ОТМЕНЯТЬ", "NOTHING TO UNDO YET"));
        this.hud.setUndoEnabled(false);
        return;
      }
      this.restoreEndlessSessionBoard(
        snapshot.pieces,
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

  async useCampaignHint(): Promise<void> {
    const session = this.campaignSession;
    if (!session || !this.board || this.board.won || this.rewardedAdPending) return;

    const policy = assistancePolicy(PlayMode.CAMPAIGN, this.level);
    this.hud.setHintBusy(true);
    this.rewardedAdPending = policy.rewardRequired;
    try {
      const result = await session.requestHint(
        this.assistance,
        policy.rewardRequired,
        this.certifiedSolution,
      );
      if (result.kind === "unavailable") {
        this.status.setText(
          this.uiText(
            "ПОДСКАЗКА СЕЙЧАС НЕДОСТУПНА",
            "NO VERIFIED HINT AVAILABLE",
          ),
        );
        return;
      }
      if (result.kind === "reward-denied") {
        this.status.setText(
          this.uiText(
            "ПОДСКАЗКА НЕ ПОЛУЧЕНА",
            "HINT WAS NOT GRANTED",
          ),
        );
        return;
      }

      const move = result.move;
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
    } finally {
      this.rewardedAdPending = false;
      this.hud.setHintBusy(this.busy);
    }
  }

  async useDailyHint(): Promise<void> {
    const dailySession = this.dailySession;
    if (!dailySession || !this.board || this.board.won || this.rewardedAdPending) return;

    this.hud.setHintBusy(true);
    this.rewardedAdPending = true;
    try {
      const result = await dailySession.requestHint(
        this.assistance,
        this.certifiedSolution,
      );
      if (result.kind === "unavailable") {
        this.status.setText(
          this.uiText(
            "ПОДСКАЗКА СЕЙЧАС НЕДОСТУПНА",
            "NO VERIFIED HINT AVAILABLE",
          ),
        );
        return;
      }
      if (result.kind === "reward-denied") {
        this.status.setText(
          this.uiText(
            "ПОДСКАЗКА НЕ ПОЛУЧЕНА",
            "HINT WAS NOT GRANTED",
          ),
        );
        return;
      }

      const move = result.move;
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
    } finally {
      this.rewardedAdPending = false;
      this.hud.setHintBusy(this.busy);
    }
  }

  async requestEndlessHint(): Promise<void> {
    const session = this.endlessSession;
    if (
      this.mode !== PlayMode.ENDLESS ||
      !session ||
      !this.board ||
      this.board.won ||
      session.deadEnd ||
      this.rewardedAdPending
    ) return;

    this.hud.setHintBusy(true);
    this.rewardedAdPending = true;
    try {
      const analysis = this.assistance.findHint(
        this.board.pieces(),
        this.certifiedSolution,
      );
      const move = analysis.route[0];
      if (analysis.status !== SolveStatus.SOLVED || !move || move.length === 0) {
        this.status.setText(
          this.uiText(
            "ПОДСКАЗКА СЕЙЧАС НЕДОСТУПНА",
            "NO VERIFIED HINT AVAILABLE",
          ),
        );
        return;
      }

      const rewarded = await this.assistance.confirmReward(true);
      if (!rewarded) {
        this.status.setText(
          this.uiText("ПОДСКАЗКА НЕ ПОЛУЧЕНА", "HINT WAS NOT GRANTED"),
        );
        return;
      }

      session.markHintUsed();
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
    } finally {
      this.rewardedAdPending = false;
      this.hud.setHintBusy(this.busy);
      this.render();
    }
  }

  async requestEndlessRescue(): Promise<void> {
    const session = this.endlessSession;
    if (
      this.mode !== PlayMode.ENDLESS ||
      !session ||
      !this.board ||
      !session.canRescue() ||
      this.rewardedAdPending
    ) return;

    this.hud.setHintBusy(true);
    this.rewardedAdPending = true;
    try {
      const rescue = this.assistance.findRescue(
        session.history,
        this.board.pieces(),
        this.certifiedSolution,
      );
      if (rescue.status !== SolveStatus.SOLVED) {
        this.status.setText(
          this.uiText(
            "НЕ УДАЛОСЬ НАДЁЖНО НАЙТИ ТОЧКУ СПАСЕНИЯ",
            "NO SAFE RESCUE POINT COULD BE VERIFIED",
          ),
        );
        return;
      }

      const rewarded = await this.assistance.confirmReward(true);
      if (!rewarded) {
        this.status.setText(
          this.uiText("СПАСЕНИЕ НЕ ПОЛУЧЕНО", "RESCUE WAS NOT GRANTED"),
        );
        return;
      }
      if (!session.markRescueUsed()) return;

      session.history.splice(rescue.index);
      this.board = new GardenBoard(rescue.snapshot.pieces);
      this.actualDeadEnd = false;
      this.positionSolveStatus = SolveStatus.SOLVED;
      this.knownWinningRoute = rescue.route;
      this.blockedMoveKey =
        rescue.blockedMove.length > 0 ? moveKey(rescue.blockedMove) : undefined;
      this.clearPanelHighlight(false);
      this.clearMoveHint(false);
      this.status.setText(
        this.uiText(
          "ВОЗВРАТ К ПОСЛЕДНЕЙ РАЗРЕШИМОЙ ПОЗИЦИИ",
          "RESTORED LAST SOLVABLE POSITION",
        ),
      );
      this.setBusy(false);
      this.rebuildPieceViews();
      this.layout();
      this.render();
    } finally {
      this.rewardedAdPending = false;
      this.hud.setHintBusy(this.busy);
      this.render();
    }
  }

  usePrimaryHint(): void {
    if (
      this.busy ||
      this.mechanicCardVisible ||
      this.pauseMenuVisible ||
      this.campaignDeadEndVisible ||
      !this.board
    ) {
      return;
    }
    if (this.mode === PlayMode.DAILY) {
      void this.useDailyHint();
      return;
    }
    if (this.mode === PlayMode.CAMPAIGN) {
      void this.useCampaignHint();
      return;
    }
    if (this.mode === PlayMode.ENDLESS) {
      if (this.endlessSession?.deadEnd) void this.requestEndlessRescue();
      else void this.requestEndlessHint();
      return;
    }
    if (this.mode === PlayMode.TUTORIAL) {
      void this.useTutorialHint();
    }
  }

  async useTutorialHint(): Promise<void> {
    if (!this.board || this.board.won || this.rewardedAdPending) return;
    this.hud.setHintBusy(true);
    try {
      const result = this.assistance.findHint(this.board.pieces(), this.certifiedSolution);
      const move = result.route[0];
      if (result.status !== SolveStatus.SOLVED || !move || move.length === 0) {
        this.status.setText(this.uiText("ПОДСКАЗКА СЕЙЧАС НЕДОСТУПНА", "NO VERIFIED HINT AVAILABLE"));
        return;
      }
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
    } finally {
      this.hud.setHintBusy(this.busy);
    }
  }

  enterCampaignDeadEndState(): void {
    const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
    if (
      (this.mode !== PlayMode.CAMPAIGN && this.mode !== PlayMode.DAILY) ||
      !session?.actualDeadEnd
    ) return;
    this.campaignDeadEndVisible = true;
    this.campaignRescueUnavailable = false;
    this.hud.setUndoEnabled(false);
    this.hud.hintButton.setEnabled(false);
    this.refreshCampaignDeadEndActions();
  }

  hideCampaignDeadEndState(): void {
    this.campaignDeadEndVisible = false;
    this.campaignRescueUnavailable = false;
    this.campaignDeadEndGraphics?.clear().setVisible(false);
    this.campaignDeadEndTitle?.setVisible(false);
    this.campaignDeadEndRestartButton?.setVisible(false).setEnabled(false);
    this.campaignDeadEndRescueButton?.setVisible(false).setEnabled(false);
  }

  refreshCampaignDeadEndActions(): void {
    if (!this.campaignDeadEndVisible) return;
    const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
    const rescueVisible = session?.canRescue === true && !this.campaignRescueUnavailable;
    this.campaignDeadEndRestartButton
      .setLabel(this.uiText("ЗАНОВО", "RESTART"))
      .setVisible(true)
      .setEnabled(!this.rewardedAdPending);
    this.campaignDeadEndRescueButton
      .setLabel(this.uiText("СПАСТИ ПОПЫТКУ", "RESCUE ATTEMPT"))
      .setVisible(rescueVisible)
      .setEnabled(rescueVisible && !this.rewardedAdPending);
    this.campaignDeadEndTitle
      .setText(
        this.campaignRescueUnavailable
          ? this.uiText("ХОДОВ НЕТ · СПАСЕНИЕ НЕ НАЙДЕНО", "NO MOVES · NO VERIFIED RESCUE")
          : this.uiText("ХОДОВ НЕТ", "NO MOVES"),
      )
      .setVisible(true);
  }

  restartCampaignFromDeadEnd(): void {
    if (!this.campaignDeadEndVisible || this.rewardedAdPending) return;
    this.hideCampaignDeadEndState();
    this.restartLevel();
  }

  async requestCampaignRescue(): Promise<void> {
    const campaignSession = this.campaignSession;
    const dailySession = this.dailySession;
    const session = this.mode === PlayMode.DAILY ? dailySession : campaignSession;
    if (
      !session ||
      !this.campaignDeadEndVisible ||
      !session.canRescue ||
      this.rewardedAdPending
    ) return;

    const rewardRequired =
      this.mode === PlayMode.DAILY
        ? true
        : assistancePolicy(PlayMode.CAMPAIGN, this.level).rewardRequired;
    this.campaignDeadEndRescueButton
      .setLabel(this.uiText("ИЩЕМ…", "CHECKING…"))
      .setEnabled(false);
    this.campaignDeadEndRestartButton.setEnabled(false);
    this.rewardedAdPending = rewardRequired;
    try {
      const result =
        this.mode === PlayMode.DAILY && dailySession
          ? await dailySession.requestRescue(
              this.assistance,
              this.certifiedSolution,
            )
          : campaignSession
          ? await campaignSession.requestRescue(
              this.assistance,
              rewardRequired,
              this.certifiedSolution,
            )
          : { kind: "not-eligible" as const };
      if (result.kind === "not-eligible") {
        this.campaignRescueUnavailable = true;
        this.refreshCampaignDeadEndActions();
        return;
      }
      if (result.kind === "unavailable") {
        this.campaignRescueUnavailable = true;
        this.status.setText(
          this.uiText(
            "НЕ УДАЛОСЬ НАДЁЖНО НАЙТИ ТОЧКУ СПАСЕНИЯ",
            "NO SAFE RESCUE POINT COULD BE VERIFIED",
          ),
        );
        this.refreshCampaignDeadEndActions();
        return;
      }
      if (result.kind === "reward-denied") {
        this.status.setText(
          this.uiText("СПАСЕНИЕ НЕ ПОЛУЧЕНО", "RESCUE WAS NOT GRANTED"),
        );
        return;
      }

      this.hideCampaignDeadEndState();
      this.restoreCampaignSessionBoard(
        this.uiText(
          "ВОЗВРАТ К ПОСЛЕДНЕЙ РАЗРЕШИМОЙ ПОЗИЦИИ",
          "RESTORED LAST SOLVABLE POSITION",
        ),
        {
          blockedMove: result.blockedMove,
          winningRoute: result.route,
        },
      );
    } finally {
      this.rewardedAdPending = false;
      if (this.campaignDeadEndVisible) this.refreshCampaignDeadEndActions();
    }
  }

  restoreEndlessSessionBoard(
    pieces: readonly BoardPieceInput[],
    message: string,
    { blockedMove = [], winningRoute }: RestoreOptions = {},
  ): void {
    if (this.mode !== PlayMode.ENDLESS || !this.endlessSession) return;
    this.board = new GardenBoard(pieces);
    this.actualDeadEnd = false;
    this.positionSolveStatus = SolveStatus.SOLVED;
    this.knownWinningRoute = winningRoute ?? this.analyzeCurrentPosition().route;
    this.blockedMoveKey = blockedMove.length > 0 ? moveKey(blockedMove) : undefined;
    this.clearPanelHighlight(false);
    this.clearMoveHint(false);
    this.status.setText(message);
    this.setBusy(false);
    this.rebuildPieceViews();
    this.layout();
    this.render();
  }

  restoreCampaignSessionBoard(
    message: string,
    { blockedMove = [], winningRoute }: RestoreOptions = {},
  ): void {
    const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
    if (!session) return;
    this.board = session.board;
    if (this.mode === PlayMode.CAMPAIGN) {
      this.campaignLevelScore = Math.max(0, this.initialPieces.length - this.board.size) * SCORE_PER_REMOVED_ATOM;
      this.displayedCampaignScore =
        this.progress.snapshot.campaignScore + this.campaignLevelScore;
      this.campaignScoreTween?.stop();
    }
    this.actualDeadEnd = false;
    this.positionSolveStatus = SolveStatus.SOLVED;
    this.knownWinningRoute = winningRoute ?? this.analyzeCurrentPosition().route;
    this.blockedMoveKey = blockedMove.length > 0 ? moveKey(blockedMove) : undefined;
    this.clearPanelHighlight(false);
    this.clearMoveHint(false);
    this.status.setText(message);
    this.setBusy(false);
    this.rebuildPieceViews();
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
    this.campaignLevelScore = snapshot.campaignLevelScore;
    this.displayedCampaignScore =
      this.progress.snapshot.campaignScore + this.campaignLevelScore;
    this.campaignScoreTween?.stop();
    this.actualDeadEnd = false;
    this.positionSolveStatus = SolveStatus.SOLVED;
    this.knownWinningRoute = winningRoute ?? this.analyzeCurrentPosition().route;
    this.blockedMoveKey = blockedMove.length > 0 ? moveKey(blockedMove) : undefined;
    this.clearPanelHighlight(false);
    this.clearMoveHint(false);
    this.status.setText(message);
    this.setBusy(false);
    this.rebuildPieceViews();
    this.layout();
  }

  clearMoveHint(render = true): void {
    this.hintTimer?.remove(false);
    this.hintTimer = undefined;
    this.activeHintKeys?.clear();
    if (render) this.render();
  }


  rebuildPieceViews(): void {
    this.clearPieceViews();
    if (!this.board) return;

    for (const piece of this.board.pieces()) {
      const circle = this.add.graphics();
      const label = makeMinimalText(
        this,
        ATOM_LABELS[piece.type],
        16,
        MINIMAL_UI_COLORS.text,
      )
        .setOrigin(0.5)
        .setFontStyle("bold")
        .setStroke("#171a1f", 2);
      const container = this.add
        .container(0, 0, [circle, label])
        .setDepth(2)
        .setVisible(false);
      const hitZone = this.add.zone(0, 0, 56, 56).setDepth(6).setVisible(false);
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
      this.pieceViews.set(hexKey(piece), {
        piece,
        container,
        circle,
        label,
        hitZone,
      });
    }
  }

  clearPieceViews(): void {
    for (const view of this.pieceViews.values()) {
      view.container.destroy(true);
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
      : this.mode === PlayMode.DAILY
      ? this.dailySession?.canUndo === true
      : this.mode === PlayMode.ENDLESS
      ? this.endlessSession?.canUndo() === true
      : this.removalHistory.length > 0 && !this.board?.won;
    this.hud.setUndoEnabled(!value && canUndo);
    this.hud.setEndlessDeadEndState(
      this.mode === PlayMode.ENDLESS && this.endlessSession?.deadEnd === true,
      this.endlessSession?.canRescue() === true,
    );
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

    this.backgroundGraphics
      .clear()
      .fillStyle(MINIMAL_UI_COLORS.background, 1)
      .fillRect(0, 0, width, height);
    this.hud.layout(width, height);
    this.status
      .setFontSize(compact ? 10 : 12)
      .setWordWrapWidth(Math.max(240, contentWidth - 32))
      .setPosition(contentCenter, height - (compact ? 116 : 112));

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

    const primitiveMetrics = boardPrimitiveMetrics(this.hexSize);
    for (const view of this.pieceViews.values()) {
      const position = this.hexToScreen(view.piece);
      view.container.setPosition(position.x, position.y);
      view.label
        .setPosition(0, 0)
        .setFontSize(Math.max(11, Math.floor(this.hexSize * 0.57)));
      view.hitZone
        .setPosition(position.x, position.y)
        .setSize(primitiveMetrics.hitDiameter, primitiveMetrics.hitDiameter);
      const hitArea = view.hitZone.input?.hitArea;
      if (hitArea instanceof Phaser.Geom.Circle) {
        hitArea.setTo(
          primitiveMetrics.hitDiameter / 2,
          primitiveMetrics.hitDiameter / 2,
          primitiveMetrics.hitDiameter / 2,
        );
      }
    }
    this.render();
    this.layoutMechanicCard(width, height, compact);
    this.layoutPauseMenu(width, height);
    this.layoutCampaignDeadEnd(width, height);
    this.completionOverlay.layout(width, height);
  }

  layoutCampaignDeadEnd(width: number, height: number): void {
    this.campaignDeadEndGraphics.clear();
    if (!this.campaignDeadEndVisible) {
      this.campaignDeadEndGraphics.setVisible(false);
      this.campaignDeadEndTitle.setVisible(false);
      this.campaignDeadEndRestartButton.setVisible(false);
      this.campaignDeadEndRescueButton.setVisible(false);
      return;
    }

    const compact = width < 560;
    const buttonWidth = Math.min(width - 48, 320);
    const centerY = height / 2;
    this.campaignDeadEndGraphics
      .setVisible(true)
      .fillStyle(MINIMAL_UI_COLORS.background, 0.9)
      .fillRect(0, 0, width, height);
    this.campaignDeadEndTitle
      .setFontSize(compact ? 18 : 22)
      .setPosition(width / 2, centerY - 78)
      .setVisible(true);
    this.campaignDeadEndRestartButton
      .setPosition(width / 2, centerY - 8)
      .setSize(buttonWidth, 52);
    this.campaignDeadEndRescueButton
      .setPosition(width / 2, centerY + 58)
      .setSize(buttonWidth, 52);
    this.refreshCampaignDeadEndActions();
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
      : this.mode === PlayMode.DAILY
      ? `${this.uiText("ЕЖЕДНЕВНАЯ", "DAILY")} · ${this.dailySession?.daily.dateKey ?? ""}`
      : `ENDLESS · ${this.uiText("ПОЛЕ", "BOARD")} ${levelLabel}`;
    this.hud.setIdentity(identity);
    this.hud.setRemaining(count);
    this.hud.setCleanVisible(this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.DAILY);
    this.hud.setCleanEligible(
      this.mode === PlayMode.CAMPAIGN
        ? this.campaignSession?.cleanEligible ?? true
        : this.mode === PlayMode.DAILY
        ? this.dailySession?.cleanEligible ?? true
        : this.attemptState.cleanEligible,
    );
    const canUndo = this.mode === PlayMode.CAMPAIGN
      ? this.campaignSession?.canUndo === true
      : this.mode === PlayMode.DAILY
      ? this.dailySession?.canUndo === true
      : this.mode === PlayMode.ENDLESS
      ? this.endlessSession?.canUndo() === true
      : this.removalHistory.length > 0 && !this.board?.won;
    this.hud.setUndoEnabled(!this.busy && canUndo);
    this.hud.setEndlessDeadEndState(
      this.mode === PlayMode.ENDLESS && this.endlessSession?.deadEnd === true,
      this.endlessSession?.canRescue() === true,
    );
    this.updateEndlessHud();
    this.updateCampaignHud();

    const introActive = this.introAnimator?.active === true;
    const inventoryVisible =
      this.board !== undefined && !this.mechanicCardVisible;
    const boardActionsEnabled = inventoryVisible && !introActive;
    this.renderPanel(introActive);
    this.inventory.setPresentationVisible(inventoryVisible, boardActionsEnabled);

    const primitiveMetrics = boardPrimitiveMetrics(this.hexSize);
    this.cellGraphics.clear();
    if (this.levelGeometryReady) {
      for (const cell of this.plateCells) {
        const position = this.hexToScreen(cell);
        this.cellGraphics
          .fillStyle(MINIMAL_UI_COLORS.surface, primitiveMetrics.slotAlpha)
          .fillCircle(position.x, position.y, primitiveMetrics.slotRadius)
          .lineStyle(
            primitiveMetrics.slotLineWidth,
            MINIMAL_UI_COLORS.border,
            0.28,
          )
          .strokeCircle(position.x, position.y, primitiveMetrics.slotRadius);
      }
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
        view.container.setVisible(false);
        continue;
      }

      const revealed = !introActive || this.introRevealedKeys.has(key);
      view.hitZone.setVisible(revealed);
      view.container.setVisible(revealed);
      if (!revealed) {
        view.hitZone.disableInteractive();
        continue;
      }

      if (introActive) {
        view.hitZone.disableInteractive();
      } else if (!view.hitZone.input?.enabled) {
        view.hitZone.setInteractive(
          new Phaser.Geom.Circle(
            primitiveMetrics.hitDiameter / 2,
            primitiveMetrics.hitDiameter / 2,
            primitiveMetrics.hitDiameter / 2,
          ),
          Phaser.Geom.Circle.Contains,
        );
        if (view.hitZone.input) view.hitZone.input.cursor = "pointer";
      }

      const position = this.hexToScreen(view.piece);
      const free = introBoard
        ? introBoard.isFree(view.piece)
        : this.board.isFree(view.piece);
      const isPanelMatch = this.activePanelType === view.piece.type;
      const isHinted = this.activeHintKeys.has(key);
      const isBlocked =
        this.blockedMoveKey !== undefined &&
        this.blockedMoveKey.split("|").includes(key);
      const introProgress = introActive
        ? this.introAnimator?.entranceProgress(key, this.time.now) ?? 1
        : 1;
      const introScale = 0.9 + introProgress * 0.1;
      const visualState = resolvePieceVisualState({
        free,
        selected: selected.has(key),
        hovered: this.hoveredPieceKey === key,
      });
      const feedback = pieceFeedbackKind({
        hinted: isHinted,
        blocked: isBlocked,
      });
      const filter = pieceFilterEmphasis({
        filterActive: this.activePanelType !== null,
        matchesFilter: isPanelMatch,
      });
      const alpha = visualState.alpha * filter.alphaMultiplier * introProgress;
      const tokenRadius = primitiveMetrics.tokenRadius;

      view.circle.clear();
      view.circle
        .fillStyle(ATOM_COLORS[view.piece.type], 1)
        .fillCircle(0, 0, tokenRadius);
      const outlineWidth = visualState.kind === "selected"
        ? Math.max(2, this.hexSize * 0.075)
        : Math.max(1, this.hexSize * 0.04);
      view.circle
        .lineStyle(
          outlineWidth,
          visualState.kind === "selected"
            ? MINIMAL_UI_COLORS.borderActive
            : MINIMAL_UI_COLORS.border,
          visualState.kind === "locked" ? 0.55 : 0.9,
        )
        .strokeCircle(0, 0, tokenRadius);

      view.container
        .setPosition(position.x, position.y)
        .setScale(visualState.scale * introScale)
        .setAlpha(alpha)
        .setDepth(visualState.depth);
      view.label
        .setPosition(0, 0)
        .setFontSize(Math.max(10, Math.floor(tokenRadius * 0.62)))
        .setColor(MINIMAL_UI_COLORS.text);

      if (filter.positiveMatch) {
        this.atomGraphics
          .lineStyle(
            Math.max(1, this.hexSize * 0.04),
            ATOM_COLORS[view.piece.type],
            0.48 * introProgress,
          )
          .strokeCircle(
            position.x,
            position.y,
            tokenRadius * 1.12 * introScale,
          );
      }

      if (feedback !== null) {
        this.atomGraphics
          .lineStyle(
            Math.max(2, this.hexSize * 0.065),
            feedback === "blocked" ? 0xef5a50 : 0x68cf75,
            0.92 * introProgress,
          )
          .strokeCircle(
            position.x,
            position.y,
            tokenRadius * 1.16 * visualState.scale * introScale,
          );
      }
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
