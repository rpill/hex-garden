import Phaser from "phaser";
import { Atom, ATOM_NAMES, type AtomType } from "../../atom-types.js";
import { GardenBoard, type BoardPiece, type BoardPieceInput } from "../../board.js";
import { getCampaignLevel } from "../../campaign-levels.js";
import { campaignRuleIntroForLevel, type CampaignRuleIntro } from "../../campaign-onboarding.js";
import { BrowserLevelGenerator } from "../../browser.js";
import { dailyDateKey } from "../../daily-calendar.js";
import { DailyProgressStore } from "../../daily-progress.js";
import { BoardVariant, type BoardVariantValue } from "../../generator.js";
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
import type { CampaignProgressSnapshot } from "../../campaign-progress.js";
import { masteryRank, type MasteryRankValue } from "../../mastery.js";
import { getCampaignProgress } from "../campaign-progress.js";
import { getEndlessProgress } from "../endless-progress.js";
import { getSettings } from "../settings.js";
import { CompletionOverlay } from "../completion-overlay.js";
import { getYandexGamesAdapter } from "../../platform/yandex-games.js";
import { getGameLifecycleController } from "../../platform/game-lifecycle.js";
import { getTrustedClock } from "../../platform/trusted-clock.js";
import { PlayMode, type PlayModeValue } from "../modes.js";
import { isActualDeadEnd } from "../board-session-state.js";
import {
  pieceFeedbackKind,
  pieceFilterEmphasis,
  resolvePieceVisualState,
} from "../piece-visual-state.js";
import { openUtilityScene as openCoveredUtilityScene } from "../utility-navigation.js";
import { boardFloatingMetrics, boardHudMetrics } from "../responsive-layout.js";
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
import { ContextMenuOverlay } from "../ContextMenuOverlay.js";
import { RewardedOfferOverlay } from "../RewardedOfferOverlay.js";
import { BoardAssistance } from "../board/BoardAssistance.js";
import { assistancePolicy } from "../board/assistance-policy.js";
import { CampaignBoardSession } from "../board/CampaignBoardSession.js";
import { DailyBoardSession } from "../board/DailyBoardSession.js";
import { EndlessBoardSession } from "../board/EndlessBoardSession.js";
import {
  MINIMAL_UI_COLORS,
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
  BoardIntroAnimator,
  type BoardIntroProfile,
} from "../board/BoardIntroAnimator.js";
import {
  makeText,
  preloadUiAssets,
} from "../ui.js";

const PANEL_HIGHLIGHT_DURATION_MS = 2000;
const MOVE_HINT_DURATION_MS = 4000;
const CAMPAIGN_DEAD_END_DELAY_MS = 800;


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
  board: GardenBoard | undefined;
  pieceViews = new Map<string, PieceView>();
  panelTypes: AtomType[] = [];
  activePanelType: AtomType | null = null;
  panelHighlightTimer: Phaser.Time.TimerEvent | undefined;
  panelLayout: BoardInventoryLayout | undefined;
  tutorialStep = 0;
  tutorialSolution: readonly (readonly HexCoord[])[] = [];
  campaignSession: CampaignBoardSession | undefined;
  dailySession: DailyBoardSession | undefined;
  endlessSession: EndlessBoardSession | undefined;
  endlessRunSeed = "";
  removalHistory: RemovalHistoryEntry[] = [];
  activeHintKeys = new Set<string>();
  hintTimer: Phaser.Time.TimerEvent | undefined;
  rewardedAdPending = false;
  interstitialAdPending = false;
  certifiedSolution: readonly (readonly HexCoord[])[] = [];
  knownWinningRoute: readonly (readonly HexCoord[])[] = [];
  positionSolveStatus: SolveStatusValue = SolveStatus.UNKNOWN;
  actualDeadEnd = false;
  blockedMoveKey: string | undefined;
  pauseMenuVisible = false;
  campaignDeadEndVisible = false;
  campaignRescueUnavailable = false;
  campaignDeadEndTimer: Phaser.Time.TimerEvent | undefined;
  hoveredPieceKey: string | undefined;
  busy = false;
  english = false;
  progress!: ReturnType<typeof getCampaignProgress>;
  endlessProgress!: ReturnType<typeof getEndlessProgress>;
  dailyProgress!: DailyProgressStore;
  platform!: ReturnType<typeof getYandexGamesAdapter>;
  generator!: BrowserLevelGenerator;
  assistance!: BoardAssistance;
  hud!: BoardHud;
  introAnimator: BoardIntroAnimator | undefined;
  introRevealedKeys = new Set<string>();
  campaignRuleCardVisible = false;
  campaignRuleCardIntro: Readonly<CampaignRuleIntro> | undefined;
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
  campaignRuleCardGraphics!: Phaser.GameObjects.Graphics;
  campaignRuleCardBlocker!: Phaser.GameObjects.Zone;
  campaignRuleCardHitZone!: Phaser.GameObjects.Zone;
  campaignRuleCardTitle!: Phaser.GameObjects.Text;
  campaignRuleCardBody!: Phaser.GameObjects.Text;
  campaignRuleCardDismiss!: Phaser.GameObjects.Text;
  contextMenu!: ContextMenuOverlay;
  rewardedOffer!: RewardedOfferOverlay;
  campaignDeadEndTitle!: Phaser.GameObjects.Text;
  campaignDeadEndPulse: Phaser.Tweens.Tween | undefined;
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
    this.pieceViews = new Map();
    this.panelViews = new Map();
    this.panelTypes = [];
    this.activePanelType = null;
    this.panelHighlightTimer = undefined;
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.campaignSession = undefined;
    this.dailySession = undefined;
    this.endlessSession = undefined;
    this.endlessRunSeed = "";
    this.removalHistory = [];
    this.activeHintKeys = new Set();
    this.hintTimer = undefined;
    this.rewardedAdPending = false;
    this.interstitialAdPending = false;
    this.certifiedSolution = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.attemptState = createAttemptState();
    this.pauseMenuVisible = false;
    this.campaignDeadEndVisible = false;
    this.campaignRescueUnavailable = false;
    this.campaignDeadEndTimer = undefined;
    this.hoveredPieceKey = undefined;
    this.introAnimator = undefined;
    this.introRevealedKeys = new Set();
    this.campaignRuleCardVisible = false;
    this.campaignRuleCardIntro = undefined;
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
    this.activePanelType = null;
    this.panelHighlightTimer = undefined;
    this.tutorialStep = 0;
    this.tutorialSolution = [];
    this.campaignSession = undefined;
    this.dailySession = undefined;
    this.endlessSession = this.mode === PlayMode.ENDLESS ? new EndlessBoardSession() : undefined;
    this.endlessRunSeed = this.mode === PlayMode.ENDLESS ? init.runSeed ?? createEndlessRunSeed() : "";
    this.removalHistory = [];
    this.activeHintKeys = new Set();
    this.hintTimer = undefined;
    this.rewardedAdPending = false;
    this.interstitialAdPending = false;
    this.certifiedSolution = [];
    this.knownWinningRoute = [];
    this.positionSolveStatus = SolveStatus.UNKNOWN;
    this.actualDeadEnd = false;
    this.blockedMoveKey = undefined;
    this.attemptState = createAttemptState();
    this.pauseMenuVisible = false;
    this.campaignDeadEndVisible = false;
    this.campaignRescueUnavailable = false;
    this.campaignDeadEndTimer?.remove(false);
    this.campaignDeadEndTimer = undefined;
    this.hoveredPieceKey = undefined;
    this.introAnimator?.stop();
    this.introAnimator = undefined;
    this.introRevealedKeys = new Set();
    this.campaignRuleCardVisible = false;
    this.campaignRuleCardIntro = undefined;
  }

  create(): void {
    getGameLifecycleController().setGameplayActive(false);
    this.platform = getYandexGamesAdapter();
    void this.platform.hideStickyBanner();
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
        glyphFrameForType: () => undefined,
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
          if (this.mode === PlayMode.TUTORIAL) this.openMainMenu();
          else if (this.mode === PlayMode.CAMPAIGN) this.openLevelSelect();
          else this.openMainMenu();
        },
        onUndo: () => this.usePrimaryUndoAction(),
        onRestart: () => this.restartLevel(),
        onHint: () => this.usePrimaryHint(),
        onMenu: () => this.openPauseMenu(),
      },
      { english: this.english },
    );
    this.status = makeText(this, "", 12, "#9aa7b5").setOrigin(0.5).setDepth(10);
    this.campaignRuleCardGraphics = this.add.graphics().setDepth(32).setVisible(false);
    this.campaignRuleCardBlocker = this.add.zone(0, 0, 1, 1)
      .setDepth(31)
      .setVisible(false)
      .setInteractive();
    this.campaignRuleCardHitZone = this.add.zone(0, 0, 1, 1)
      .setDepth(34)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.campaignRuleCardHitZone.on("pointerdown", () => this.dismissCampaignRuleCard());
    this.campaignRuleCardTitle = makeMinimalText(this, "", 20)
      .setOrigin(0.5)
      .setFontStyle("bold")
      .setDepth(33)
      .setVisible(false);
    this.campaignRuleCardBody = makeMinimalText(this, "", 14, MINIMAL_UI_COLORS.text)
      .setOrigin(0.5)
      .setDepth(33)
      .setVisible(false);
    this.campaignRuleCardDismiss = makeMinimalText(
      this,
      this.uiText("НАЖМИ НА КАРТОЧКУ, ЧТОБЫ ПРОДОЛЖИТЬ", "TAP THE CARD TO CONTINUE"),
      11,
      MINIMAL_UI_COLORS.textMuted,
    ).setOrigin(0.5).setDepth(33).setVisible(false);
    this.contextMenu = new ContextMenuOverlay(this);
    this.rewardedOffer = new RewardedOfferOverlay(this);
    this.assistance = new BoardAssistance(
      this.platform,
      (kind) => this.rewardedOffer.request(kind, { english: this.english }),
    );

    this.campaignDeadEndTitle = makeMinimalText(
      this,
      this.uiText("ХОДОВ НЕТ", "NO MOVES"),
      11,
      MINIMAL_UI_COLORS.textMuted,
    ).setOrigin(0.5).setFontStyle("bold").setDepth(35).setVisible(false);

    this.completionOverlay = new CompletionOverlay(this);

    this.input.keyboard?.on("keydown-R", () => this.restartLevel());
    this.input.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (currentlyOver.length === 0) this.consumeBoardIntroInput();
      },
    );
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.rewardedAdPending || this.interstitialAdPending) return;
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
    this.events.on(Phaser.Scenes.Events.PAUSE, () => {
      getGameLifecycleController().setGameplayActive(false);
    });
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      void this.platform.hideStickyBanner();
      this.syncGameplayLifecycle();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getGameLifecycleController().setGameplayActive(false);
      this.scale.off("resize", this.layout, this);
      this.generator.terminate();
      this.introAnimator?.stop();
      this.rewardedOffer?.cancel();
      this.pieceViews.clear();
      this.panelViews.clear();
    });
    this.rebuildPanelViews();
    this.layout();
    this.loadLevel();
  }

  async loadLevel(introProfile: BoardIntroProfile = "fresh"): Promise<void> {
    getGameLifecycleController().setGameplayActive(false);
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
    this.hideCampaignRuleCard();
    this.clearMoveHint(false);
    this.setBusy(true);
    this.levelGeometryReady = false;
    this.board = undefined;
    this.initialPieces = [];
    this.clearPanelHighlight(false);
    this.tutorialStep = 0;
    this.tutorialSolution = [];
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
      this.plateCells = "plateCells" in record ? record.plateCells : enumerateBoardCells();
      this.plateRadius = "plateRadius" in record ? record.plateRadius : 5;
      this.levelGeometryReady = true;
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
      this.startBoardIntro(introProfile);
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
    if (this.mode !== PlayMode.CAMPAIGN) {
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
    if (this.rewardedAdPending || this.interstitialAdPending) return;
    if (this.pauseMenuVisible) this.closePauseMenu({ syncGameplay: false });
    openCoveredUtilityScene(this, key, { returnScene: "board" });
  }

  openPauseMenu(): void {
    if (this.pauseMenuVisible || this.rewardedAdPending || this.interstitialAdPending) return;
    this.pauseMenuVisible = true;
    const completionVisible = this.completionOverlay?.visible === true;
    const items = [
      ...(!completionVisible
        ? [{
            id: "resume",
            label: this.uiText("ПРОДОЛЖИТЬ", "RESUME"),
            onSelect: () => this.closePauseMenu(),
          }]
        : []),
      {
        id: "rules",
        label: this.uiText("ПРАВИЛА", "RULES"),
        onSelect: () => this.openUtilityScene("rules"),
      },
      ...(this.mode === PlayMode.CAMPAIGN && !completionVisible
        ? [{
            id: "levels",
            label: this.uiText("ВЫБОР УРОВНЕЙ", "LEVEL SELECT"),
            onSelect: () => this.exitPauseToLevels(),
          }]
        : []),
      {
        id: "settings",
        label: this.uiText("НАСТРОЙКИ", "SETTINGS"),
        onSelect: () => this.openUtilityScene("settings"),
      },
      {
        id: "home",
        label: this.mode === PlayMode.TUTORIAL
          ? this.uiText("ВЫЙТИ ИЗ ОБУЧЕНИЯ", "EXIT TUTORIAL")
          : this.uiText("ГЛАВНОЕ МЕНЮ", "MAIN MENU"),
        onSelect: () => this.exitPauseToMenu(),
      },
    ];
    this.contextMenu.open({
      title: this.uiText("ПАУЗА", "PAUSED"),
      items,
    });
    this.syncGameplayLifecycle();
  }

  closePauseMenu({ syncGameplay = true }: { syncGameplay?: boolean } = {}): void {
    if (!this.pauseMenuVisible) return;
    this.pauseMenuVisible = false;
    this.contextMenu.close();
    if (syncGameplay) this.syncGameplayLifecycle();
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
      this.rewardedAdPending ||
      this.interstitialAdPending ||
      this.campaignRuleCardVisible ||
      this.completionOverlay?.visible ||
      this.pauseMenuVisible ||
      this.initialPieces.length === 0
    ) return;

    const deadEndInterstitial =
      this.actualDeadEnd &&
      (this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.DAILY);
    if (deadEndInterstitial) {
      void this.runInterstitialBefore(() => this.restartLevelNow());
      return;
    }
    this.restartLevelNow();
  }

  restartLevelNow(): void {
    this.hideCampaignDeadEndState();
    if (this.mode === PlayMode.ENDLESS) {
      this.scene.restart({
        mode: PlayMode.ENDLESS,
        level: 0,
        runSeed: createEndlessRunSeed(),
      });
      return;
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
        if (profile === "fresh") this.maybeShowCampaignRuleCard();
        this.syncGameplayLifecycle();
      },
    });
    this.introAnimator.start(profile);
    this.syncGameplayLifecycle();
  }

  consumeBoardIntroInput(): boolean {
    return this.introAnimator?.finish() ?? false;
  }

  maybeShowCampaignRuleCard(): void {
    if (this.mode !== PlayMode.CAMPAIGN) return;
    if (this.progress.snapshot.solvedLevels.includes(this.level)) return;
    const intro = campaignRuleIntroForLevel(this.level);
    if (!intro) return;
    this.campaignRuleCardIntro = intro;
    this.campaignRuleCardVisible = true;
    this.campaignRuleCardTitle.setText(this.english ? intro.titleEn : intro.titleRu).setVisible(true);
    this.campaignRuleCardBody.setText(this.english ? intro.textEn : intro.textRu).setVisible(true);
    this.campaignRuleCardDismiss
      .setText(this.uiText("НАЖМИ НА КАРТОЧКУ, ЧТОБЫ ПРОДОЛЖИТЬ", "TAP THE CARD TO CONTINUE"))
      .setVisible(true);
    this.campaignRuleCardGraphics.setVisible(true);
    this.campaignRuleCardBlocker.setVisible(true).setInteractive();
    this.campaignRuleCardHitZone.setVisible(true).setInteractive({ useHandCursor: true });
    this.layoutCampaignRuleCard(this.scale.width, this.scale.height);
    this.render();
  }

  dismissCampaignRuleCard(): void {
    if (!this.campaignRuleCardVisible) return;
    this.hideCampaignRuleCard();
    this.render();
    this.syncGameplayLifecycle();
  }

  hideCampaignRuleCard(): void {
    this.campaignRuleCardVisible = false;
    this.campaignRuleCardIntro = undefined;
    this.campaignRuleCardGraphics?.clear().setVisible(false);
    this.campaignRuleCardBlocker?.setVisible(false).disableInteractive();
    this.campaignRuleCardHitZone?.setVisible(false).disableInteractive();
    this.campaignRuleCardTitle?.setVisible(false);
    this.campaignRuleCardBody?.setVisible(false);
    this.campaignRuleCardDismiss?.setVisible(false);
  }

  selectPiece(piece: BoardPiece): void {
    if (
      this.busy ||
      this.rewardedAdPending ||
      this.interstitialAdPending ||
      this.campaignRuleCardVisible ||
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
          if (this.mode === PlayMode.CAMPAIGN || this.mode === PlayMode.DAILY) {
            message = "";
            this.scheduleCampaignDeadEndState();
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
    this.syncGameplayLifecycle();
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
          onHome: () => void this.runInterstitialBefore(
            () => this.openMainMenu(destination.reveal),
          ),
          ...(!clean ? { onTryClean: () => this.loadLevel() } : {}),
        }
      : {
          onNext: () => void this.runInterstitialBefore(() => {
            this.level = destination.level;
            void this.loadLevel();
          }),
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
    this.syncGameplayLifecycle();
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
          onHome: () => void this.runInterstitialBefore(() => this.openMainMenu()),
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
        onNext: () => void this.runInterstitialBefore(() => this.scene.restart({
          mode: PlayMode.ENDLESS,
          level: 0,
          runSeed: createEndlessRunSeed(),
        })),
        onHome: () => this.openMainMenu(),
      },
    );
    this.syncGameplayLifecycle();
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

  usePrimaryUndoAction(): void {
    if (this.campaignDeadEndVisible) return;
    this.undoLastRemoval();
  }

  undoLastRemoval(): void {
    if (
      this.busy ||
      this.campaignRuleCardVisible ||
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

  setRewardedAdPending(value: boolean): void {
    this.rewardedAdPending = value;
    this.syncGameplayLifecycle();
  }

  async runInterstitialBefore(action: () => void): Promise<void> {
    if (this.interstitialAdPending) return;
    this.interstitialAdPending = true;
    this.syncGameplayLifecycle();
    try {
      await this.platform.showFullscreen();
    } finally {
      this.interstitialAdPending = false;
      action();
    }
  }

  async useCampaignHint(): Promise<void> {
    const session = this.campaignSession;
    if (!session || !this.board || this.board.won || this.rewardedAdPending) return;

    const policy = assistancePolicy(PlayMode.CAMPAIGN, this.level);
    this.hud.setHintBusy(true);
    this.setRewardedAdPending(policy.rewardRequired);
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
      this.setRewardedAdPending(false);
      this.hud.setHintBusy(this.busy);
    }
  }

  async useDailyHint(): Promise<void> {
    const dailySession = this.dailySession;
    if (!dailySession || !this.board || this.board.won || this.rewardedAdPending) return;

    this.hud.setHintBusy(true);
    this.setRewardedAdPending(true);
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
      this.setRewardedAdPending(false);
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
    this.setRewardedAdPending(true);
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

      const rewarded = await this.assistance.confirmReward(true, "hint");
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
      this.setRewardedAdPending(false);
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
    this.setRewardedAdPending(true);
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

      const rewarded = await this.assistance.confirmReward(true, "rescue");
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
      this.setRewardedAdPending(false);
      this.hud.setHintBusy(this.busy);
      this.render();
    }
  }

  usePrimaryHint(): void {
    if (this.campaignDeadEndVisible) {
      void this.requestCampaignRescue();
      return;
    }
    if (
      this.busy ||
      this.campaignRuleCardVisible ||
      this.pauseMenuVisible ||
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

  scheduleCampaignDeadEndState(): void {
    this.syncGameplayLifecycle();
    this.campaignDeadEndTimer?.remove(false);
    this.campaignDeadEndTimer = this.time.delayedCall(CAMPAIGN_DEAD_END_DELAY_MS, () => {
      this.campaignDeadEndTimer = undefined;
      const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
      if (!session?.actualDeadEnd || this.board?.won) return;
      this.enterCampaignDeadEndState();
    });
  }

  enterCampaignDeadEndState(): void {
    const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
    if (
      (this.mode !== PlayMode.CAMPAIGN && this.mode !== PlayMode.DAILY) ||
      !session?.actualDeadEnd
    ) return;
    this.campaignDeadEndVisible = true;
    this.campaignRescueUnavailable = false;
    this.refreshCampaignDeadEndActions();
    this.layoutCampaignDeadEnd(this.scale.width, this.scale.height);
  }

  hideCampaignDeadEndState(): void {
    this.campaignDeadEndTimer?.remove(false);
    this.campaignDeadEndTimer = undefined;
    this.campaignDeadEndVisible = false;
    this.campaignRescueUnavailable = false;
    this.campaignDeadEndPulse?.stop();
    this.campaignDeadEndPulse = undefined;
    this.campaignDeadEndTitle?.setAlpha(1).setVisible(false);
    this.hud?.setCampaignDeadEndState(false, false);
  }

  refreshCampaignDeadEndActions(): void {
    if (!this.campaignDeadEndVisible) return;
    const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
    const rescueVisible = session?.canRescue === true && !this.campaignRescueUnavailable;
    this.hud.setCampaignDeadEndState(true, rescueVisible);
    this.campaignDeadEndTitle
      .setText(
        this.campaignRescueUnavailable
          ? this.uiText("ХОДОВ НЕТ · СПАСЕНИЕ НЕ НАЙДЕНО", "NO MOVES · NO VERIFIED RESCUE")
          : this.uiText("ХОДОВ НЕТ", "NO MOVES"),
      )
      .setVisible(true);
    this.startCampaignDeadEndPulse();
  }

  startCampaignDeadEndPulse(): void {
    if (this.campaignDeadEndPulse || !this.campaignDeadEndVisible) return;
    this.campaignDeadEndTitle.setAlpha(1);
    this.campaignDeadEndPulse = this.tweens.add({
      targets: this.campaignDeadEndTitle,
      alpha: 0.38,
      duration: 620,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
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
    this.hud.setHintBusy(true);
    this.setRewardedAdPending(rewardRequired);
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
      this.setRewardedAdPending(false);
      this.hud.setHintBusy(this.busy);
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
    this.syncGameplayLifecycle();
  }

  restoreCampaignSessionBoard(
    message: string,
    { blockedMove = [], winningRoute }: RestoreOptions = {},
  ): void {
    const session = this.mode === PlayMode.DAILY ? this.dailySession : this.campaignSession;
    if (!session) return;
    this.board = session.board;
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
    this.syncGameplayLifecycle();
  }

  restoreLastRemoval(message: string): void {
    this.restoreHistorySnapshot(this.removalHistory.length - 1, message);
  }

  restoreHistorySnapshot(index: number, message: string, { blockedMove = [], winningRoute }: RestoreOptions = {}): void {
    const snapshot = this.removalHistory[index];
    if (!snapshot) return;
    this.removalHistory.splice(index);
    this.board = new GardenBoard(snapshot.pieces);
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
    this.syncGameplayLifecycle();
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
      this.campaignRuleCardVisible ||
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
      this.introAnimator?.active !== true &&
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

  syncGameplayLifecycle(): void {
    const gameplayActive =
      this.board !== undefined &&
      !this.board.won &&
      !this.busy &&
      this.introAnimator?.active !== true &&
      !this.campaignRuleCardVisible &&
      !this.pauseMenuVisible &&
      this.completionOverlay?.visible !== true &&
      !this.actualDeadEnd &&
      !(this.mode === PlayMode.ENDLESS && this.endlessSession?.deadEnd === true) &&
      !this.rewardedAdPending &&
      !this.interstitialAdPending;
    getGameLifecycleController().setGameplayActive(gameplayActive);
  }

  setBusy(value: boolean): void {
    this.busy = value;
    this.hud.setHintBusy(value);
    const canUndo = this.mode === PlayMode.CAMPAIGN
      ? this.campaignSession?.canUndo === true
      : this.mode === PlayMode.DAILY
      ? this.dailySession?.canUndo === true
      : this.mode === PlayMode.ENDLESS
      ? this.endlessSession?.canUndo() === true
      : this.removalHistory.length > 0 && !this.board?.won;
    this.hud.setUndoEnabled(!value && !this.campaignRuleCardVisible && canUndo);
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
    this.layoutCampaignRuleCard(width, height);
    this.layoutPauseMenu(width, height);
    this.layoutCampaignDeadEnd(width, height);
    this.completionOverlay.layout(width, height);
  }

  layoutCampaignRuleCard(width: number, height: number): void {
    this.campaignRuleCardGraphics.clear();
    if (!this.campaignRuleCardVisible || !this.campaignRuleCardIntro) {
      this.campaignRuleCardGraphics.setVisible(false);
      return;
    }

    const compact = width < 560;
    const shortLandscape = height < 520 && width > height;
    const cardWidth = Math.min(width - 28, shortLandscape ? 500 : 460);
    const cardHeight = Math.min(height - 92, shortLandscape ? 230 : 270);
    const centerX = width / 2;
    const centerY = height / 2;
    const cardX = centerX - cardWidth / 2;
    const cardY = centerY - cardHeight / 2;

    this.campaignRuleCardBlocker
      .setPosition(width / 2, height / 2)
      .setSize(width, height);
    const blockerArea = this.campaignRuleCardBlocker.input?.hitArea;
    if (blockerArea instanceof Phaser.Geom.Rectangle) blockerArea.setTo(0, 0, width, height);

    this.campaignRuleCardGraphics
      .setVisible(true)
      .fillStyle(0x000000, 0.58)
      .fillRect(0, 0, width, height)
      .fillStyle(MINIMAL_UI_COLORS.surface, 1)
      .fillRoundedRect(cardX, cardY, cardWidth, cardHeight, 12)
      .lineStyle(1, MINIMAL_UI_COLORS.borderActive, 1)
      .strokeRoundedRect(cardX + 0.5, cardY + 0.5, cardWidth - 1, cardHeight - 1, 12);

    this.campaignRuleCardHitZone
      .setPosition(centerX, centerY)
      .setSize(cardWidth, cardHeight);
    const cardArea = this.campaignRuleCardHitZone.input?.hitArea;
    if (cardArea instanceof Phaser.Geom.Rectangle) cardArea.setTo(0, 0, cardWidth, cardHeight);

    this.campaignRuleCardTitle
      .setFontSize(compact ? 16 : 20)
      .setPosition(centerX, cardY + (shortLandscape ? 36 : 46));
    this.campaignRuleCardBody
      .setFontSize(compact ? 12 : 14)
      .setLineSpacing(compact ? 5 : 7)
      .setWordWrapWidth(cardWidth - 44)
      .setPosition(centerX, centerY - (shortLandscape ? 4 : 2));
    this.campaignRuleCardDismiss
      .setFontSize(compact ? 9 : 11)
      .setPosition(centerX, cardY + cardHeight - (shortLandscape ? 27 : 32));
  }

  layoutCampaignDeadEnd(width: number, height: number): void {
    if (!this.campaignDeadEndVisible) {
      this.campaignDeadEndTitle.setVisible(false);
      return;
    }

    const metrics = boardHudMetrics(width, height);
    const actionTop = metrics.actionY - metrics.actionHeight / 2;
    const panelBottom = this.panelLayout
      ? this.panelLayout.top + this.panelLayout.height
      : actionTop - 22;
    const gap = Math.max(0, actionTop - panelBottom);
    const noticeY = gap >= 12
      ? panelBottom + gap / 2
      : actionTop - 8;

    this.campaignDeadEndTitle
      .setFontSize(metrics.compact ? 10 : 11)
      .setPosition(width / 2, noticeY)
      .setVisible(true);
    this.refreshCampaignDeadEndActions();
  }

  layoutPauseMenu(width: number, height: number): void {
    this.contextMenu.layout(width, height);
    this.rewardedOffer.layout(width, height);
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
    this.hud.setUndoEnabled(!this.busy && !this.campaignRuleCardVisible && canUndo);
    this.hud.setEndlessDeadEndState(
      this.mode === PlayMode.ENDLESS && this.endlessSession?.deadEnd === true,
      this.endlessSession?.canRescue() === true,
    );
    this.updateEndlessHud();
    this.updateCampaignHud();

    const introActive = this.introAnimator?.active === true;
    const inventoryVisible =
      this.board !== undefined;
    const boardActionsEnabled = inventoryVisible && !introActive && !this.campaignRuleCardVisible;
    this.renderPanel(introActive);
    this.inventory.setPresentationVisible(inventoryVisible, boardActionsEnabled);

    const primitiveMetrics = boardPrimitiveMetrics(this.hexSize);
    this.cellGraphics.clear();
    if (this.levelGeometryReady) {
      for (const cell of this.plateCells) {
        const position = this.hexToScreen(cell);
        const points: Phaser.Geom.Point[] = [];
        for (let corner = 0; corner < 6; corner += 1) {
          const angle = Phaser.Math.DegToRad(60 * corner - 30);
          points.push(
            new Phaser.Geom.Point(
              position.x + primitiveMetrics.slotRadius * Math.cos(angle),
              position.y + primitiveMetrics.slotRadius * Math.sin(angle),
            ),
          );
        }
        this.cellGraphics
          .fillStyle(MINIMAL_UI_COLORS.surface, primitiveMetrics.slotAlpha)
          .fillPoints(points, true)
          .lineStyle(
            primitiveMetrics.slotLineWidth,
            MINIMAL_UI_COLORS.border,
            0.28,
          )
          .strokePoints(points, true);
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
      const introProgress = introActive
        ? this.introAnimator?.entranceProgress(key, this.time.now) ?? 1
        : 1;
      const introScale = 0.9 + introProgress * 0.1;
      const visualState = resolvePieceVisualState({
        free,
        selected: selected.has(key),
        hovered: this.hoveredPieceKey === key,
      });
      const feedback = pieceFeedbackKind({ hinted: isHinted });
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
            0x68cf75,
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
