import { isRecord } from "../persistence.js";

export const RewardedAdStatus = Object.freeze({
  REWARDED: "rewarded",
  CLOSED: "closed",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
  BUSY: "busy",
} as const);

export type RewardedAdStatusValue =
  (typeof RewardedAdStatus)[keyof typeof RewardedAdStatus];

interface ScriptLike {
  src: string;
  async: boolean;
  dataset: Record<string, string>;
  addEventListener(
    type: "load" | "error",
    listener: () => void,
    options?: { once?: boolean },
  ): void;
}

interface ExistingScriptLike {
  addEventListener(
    type: "load" | "error",
    listener: () => void,
    options?: { once?: boolean },
  ): void;
}

interface AppendTarget {
  append(node: ScriptLike): void;
}

interface DocumentLike {
  createElement?(tag: "script"): ScriptLike;
  querySelector?(selector: string): ExistingScriptLike | null;
  head?: AppendTarget | null;
  body?: AppendTarget | null;
}

interface YandexPlayer {
  getData?: (keys?: string[]) => Promise<unknown>;
  setData?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
  isAuthorized?: () => boolean;
}

type StickyBannerStatus = Readonly<{
  stickyAdvIsShowing: boolean;
  reason?: "ADV_IS_NOT_CONNECTED" | "UNKNOWN";
}>;

interface YandexSdk {
  on?: (event: "game_api_pause" | "game_api_resume", callback: () => void) => void;
  off?: (event: "game_api_pause" | "game_api_resume", callback: () => void) => void;
  serverTime?: () => number;
  getPlayer?: (options?: { scopes?: boolean }) => Promise<YandexPlayer>;
  isAvailableMethod?: (method: string) => Promise<boolean> | boolean;
  auth?: {
    openAuthDialog?: () => Promise<void>;
  };
  leaderboards?: {
    getEntries?: (
      leaderboardName: string,
      options: { includeUser?: boolean; quantityAround?: number; quantityTop?: number },
    ) => Promise<unknown>;
    getPlayerEntry?: (leaderboardName: string) => Promise<unknown>;
    setScore?: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
  };
  features?: {
    LoadingAPI?: { ready?: () => void };
    GameplayAPI?: { start?: () => void; stop?: () => void };
  };
  adv?: {
    showBannerAdv?: () => Promise<StickyBannerStatus>;
    hideBannerAdv?: () => Promise<Readonly<{ stickyAdvIsShowing: boolean }>>;
    showFullscreenAdv?: (options: {
      callbacks: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: unknown) => void;
      };
    }) => void;
    showRewardedVideo?: (options: {
      callbacks: {
        onOpen: () => void;
        onRewarded: () => void;
        onClose: () => void;
        onError: (error: unknown) => void;
      };
    }) => void;
  };
}

type InitYandexSdk = () => Promise<YandexSdk>;

function asDocumentLike(value: unknown): DocumentLike | undefined {
  return isRecord(value) ? (value as unknown as DocumentLike) : undefined;
}

function yandexInit(globalObject: unknown): InitYandexSdk | undefined {
  if (!isRecord(globalObject) || !isRecord(globalObject.YaGames)) return undefined;
  const yaGames = globalObject.YaGames;
  if (typeof yaGames.init !== "function") return undefined;
  const init = yaGames.init as () => Promise<YandexSdk>;
  return () => init.call(yaGames);
}

async function loadSdkScript(
  documentObject: DocumentLike | undefined,
  globalObject: unknown,
  url: string,
): Promise<boolean> {
  if (!documentObject?.createElement) return false;

  const existing = documentObject.querySelector?.("script[data-yandex-games-sdk]");
  if (existing) {
    if (yandexInit(globalObject)) return true;
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  const target = documentObject.head ?? documentObject.body;
  if (!target) return false;

  return new Promise((resolve) => {
    const script = documentObject.createElement!("script");
    script.src = url;
    script.async = true;
    script.dataset.yandexGamesSdk = "true";
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    target.append(script);
  });
}

export interface YandexGamesAdapterOptions {
  globalObject?: unknown;
  documentObject?: unknown;
  /** Kept for compatibility with older tests/callers. Runtime behavior no longer depends on localhost detection. */
  locationObject?: unknown;
  sdkUrl?: string | null;
  /** Explicit test-only fallback. Real localhost development should use the official SDK dev proxy. */
  simulateRewarded?: boolean;
  simulationDelay?: number;
}

export interface RewardedCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
}

export type RewardedResult = Readonly<{
  status: RewardedAdStatusValue;
  simulated?: boolean;
  error?: unknown;
}>;

export interface LeaderboardEntry {
  rank: number;
  score: number;
  publicName: string;
  uniqueId: string;
}

export type AuthorizationResult = "authorized" | "guest" | "unavailable";

export type LeaderboardEntriesResult =
  | { status: "ready"; entries: readonly LeaderboardEntry[] }
  | { status: "unavailable"; entries: readonly LeaderboardEntry[] };

export type LeaderboardPlayerEntryResult =
  | { status: "ready"; entry: LeaderboardEntry }
  | { status: "not-present"; entry: null }
  | { status: "unavailable"; entry: null };

function normalizeLeaderboardEntry(value: unknown): LeaderboardEntry | null {
  if (!isRecord(value) || !isRecord(value.player)) return null;
  const { rank, score } = value;
  if (
    typeof rank !== "number" || !Number.isFinite(rank) || rank < 0 ||
    typeof score !== "number" || !Number.isFinite(score) || score < 0
  ) return null;
  const publicName = typeof value.player.publicName === "string" ? value.player.publicName : "";
  const uniqueId = typeof value.player.uniqueID === "string" ? value.player.uniqueID : "";
  return Object.freeze({ rank, score, publicName, uniqueId });
}

function isLeaderboardPlayerNotPresent(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.code === "LEADERBOARD_PLAYER_NOT_PRESENT" ||
    error.name === "LEADERBOARD_PLAYER_NOT_PRESENT";
}

export class YandexGamesAdapter {
  #document: DocumentLike | undefined;
  #global: unknown;
  #initPromise: Promise<YandexSdk | null> | undefined;
  #pendingRewarded = false;
  #gameReadyReported = false;
  #gameplayState: "started" | "stopped" | undefined;
  #stickyBannerState: boolean | undefined;
  #stickyBannerOperation: Promise<void> = Promise.resolve();
  #playerPromise: Promise<YandexPlayer | null> | undefined;
  #sdk: YandexSdk | undefined;
  #sdkUrl: string | null;
  #simulateRewarded: boolean;
  #simulationDelay: number;

  constructor({
    globalObject = globalThis,
    documentObject = globalThis.document,
    sdkUrl = "/sdk.js",
    simulateRewarded = false,
    simulationDelay = 700,
  }: YandexGamesAdapterOptions = {}) {
    this.#global = globalObject;
    this.#document = asDocumentLike(documentObject);
    this.#sdkUrl = sdkUrl;
    this.#simulateRewarded = simulateRewarded;
    this.#simulationDelay = simulationDelay;
  }

  get isSimulated(): boolean {
    return this.#simulateRewarded;
  }

  async initialize(): Promise<YandexSdk | null> {
    if (this.#simulateRewarded) return null;
    if (this.#sdk) return this.#sdk;
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = this.#initializeSdk();
    return this.#initPromise;
  }

  async #initializeSdk(): Promise<YandexSdk | null> {
    try {
      let init = yandexInit(this.#global);
      if (!init && this.#sdkUrl) {
        const loaded = await loadSdkScript(this.#document, this.#global, this.#sdkUrl);
        if (!loaded) return null;
        init = yandexInit(this.#global);
      }
      if (!init) return null;
      this.#sdk = await init();
      return this.#sdk;
    } catch {
      return null;
    }
  }

  async #getPlayer(): Promise<YandexPlayer | null> {
    if (this.#playerPromise) return this.#playerPromise;
    this.#playerPromise = (async () => {
      const sdk = await this.initialize();
      if (typeof sdk?.getPlayer !== "function") return null;
      try {
        return await sdk.getPlayer({ scopes: false });
      } catch {
        return null;
      }
    })();
    return this.#playerPromise;
  }

  async isPlayerAuthorized(): Promise<boolean> {
    const player = await this.#getPlayer();
    if (typeof player?.isAuthorized !== "function") return false;
    try {
      return player.isAuthorized() === true;
    } catch {
      return false;
    }
  }

  async requestPlayerAuthorization(): Promise<AuthorizationResult> {
    const current = await this.#getPlayer();
    if (typeof current?.isAuthorized === "function") {
      try {
        if (current.isAuthorized() === true) return "authorized";
      } catch {
        // Continue to the explicit auth flow.
      }
    }

    const sdk = await this.initialize();
    const authTarget = sdk?.auth;
    const openAuthDialog = authTarget?.openAuthDialog;
    if (typeof openAuthDialog !== "function") return "unavailable";

    try {
      await openAuthDialog.call(authTarget);
    } catch {
      // A user-cancelled dialog may reject. Refresh Player below to distinguish
      // a normal guest outcome from an unavailable SDK/player.
    }

    this.#playerPromise = undefined;
    const refreshed = await this.#getPlayer();
    if (!refreshed || typeof refreshed.isAuthorized !== "function") return "unavailable";
    try {
      return refreshed.isAuthorized() === true ? "authorized" : "guest";
    } catch {
      return "unavailable";
    }
  }

  async getLeaderboardEntries(
    name: string,
    quantityTop = 10,
  ): Promise<LeaderboardEntriesResult> {
    const sdk = await this.initialize();
    const leaderboardsTarget = sdk?.leaderboards;
    const getEntries = leaderboardsTarget?.getEntries;
    if (typeof getEntries !== "function") {
      return Object.freeze({ status: "unavailable", entries: [] });
    }
    const safeQuantity = Math.max(1, Math.min(20, Math.trunc(quantityTop)));
    try {
      const value = await getEntries.call(leaderboardsTarget, name, {
        quantityTop: safeQuantity,
        includeUser: false,
      });
      if (!isRecord(value) || !Array.isArray(value.entries)) {
        return Object.freeze({ status: "unavailable", entries: [] });
      }
      const entries = value.entries.map(normalizeLeaderboardEntry);
      if (entries.some((entry) => entry === null)) {
        return Object.freeze({ status: "unavailable", entries: [] });
      }
      return Object.freeze({
        status: "ready",
        entries: Object.freeze(entries as LeaderboardEntry[]),
      });
    } catch {
      return Object.freeze({ status: "unavailable", entries: [] });
    }
  }

  async getLeaderboardPlayerEntry(name: string): Promise<LeaderboardPlayerEntryResult> {
    const sdk = await this.initialize();
    const getPlayerEntry = sdk?.leaderboards?.getPlayerEntry;
    if (typeof sdk?.isAvailableMethod !== "function" || typeof getPlayerEntry !== "function") {
      return Object.freeze({ status: "unavailable", entry: null });
    }
    try {
      if (!(await sdk.isAvailableMethod("leaderboards.getPlayerEntry"))) {
        return Object.freeze({ status: "unavailable", entry: null });
      }
      const value = await getPlayerEntry.call(sdk.leaderboards, name);
      const entry = normalizeLeaderboardEntry(value);
      return entry
        ? Object.freeze({ status: "ready", entry })
        : Object.freeze({ status: "unavailable", entry: null });
    } catch (error) {
      return isLeaderboardPlayerNotPresent(error)
        ? Object.freeze({ status: "not-present", entry: null })
        : Object.freeze({ status: "unavailable", entry: null });
    }
  }

  async setLeaderboardScore(name: string, score: number): Promise<boolean> {
    if (!Number.isFinite(score) || score < 0) return false;
    const sdk = await this.initialize();
    const setScore = sdk?.leaderboards?.setScore;
    if (typeof sdk?.isAvailableMethod !== "function" || typeof setScore !== "function") return false;
    try {
      if (!(await sdk.isAvailableMethod("leaderboards.setScore"))) return false;
      await setScore.call(sdk.leaderboards, name, Math.trunc(score));
      return true;
    } catch {
      return false;
    }
  }

  async getPlayerData(keys?: readonly string[]): Promise<Record<string, unknown> | null> {
    const player = await this.#getPlayer();
    if (typeof player?.getData !== "function") return null;
    try {
      const value = keys === undefined
        ? await player.getData()
        : await player.getData([...keys]);
      return isRecord(value) ? value : null;
    } catch {
      return null;
    }
  }

  async setPlayerData(
    data: Record<string, unknown>,
    flush = true,
  ): Promise<boolean> {
    const player = await this.#getPlayer();
    if (typeof player?.setData !== "function") return false;
    try {
      await player.setData(data, flush);
      return true;
    } catch {
      return false;
    }
  }

  async serverTime(): Promise<number | null> {
    const sdk = await this.initialize();
    try {
      const timestamp = sdk?.serverTime?.();
      return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp >= 0
        ? timestamp
        : null;
    } catch {
      return null;
    }
  }

  async notifyGameReady(): Promise<void> {
    if (this.#gameReadyReported) return;
    const sdk = await this.initialize();
    const loadingApi = sdk?.features?.LoadingAPI;
    const ready = loadingApi?.ready;
    if (typeof ready !== "function") return;
    try {
      ready.call(loadingApi);
      this.#gameReadyReported = true;
    } catch {
      // The game remains usable when platform readiness reporting is unavailable.
    }
  }

  async notifyGameplayStart(): Promise<void> {
    if (this.#gameplayState === "started") return;
    const sdk = await this.initialize();
    const gameplayApi = sdk?.features?.GameplayAPI;
    const start = gameplayApi?.start;
    if (typeof start !== "function") return;
    try {
      start.call(gameplayApi);
      this.#gameplayState = "started";
    } catch {
      // Gameplay remains usable when platform markup is unavailable.
    }
  }

  async notifyGameplayStop(): Promise<void> {
    if (this.#gameplayState === "stopped") return;
    const sdk = await this.initialize();
    const gameplayApi = sdk?.features?.GameplayAPI;
    const stop = gameplayApi?.stop;
    if (typeof stop !== "function") return;
    try {
      stop.call(gameplayApi);
      this.#gameplayState = "stopped";
    } catch {
      // Gameplay remains usable when platform markup is unavailable.
    }
  }

  async subscribeGamePauseResume({
    onPause,
    onResume,
  }: {
    onPause: () => void;
    onResume: () => void;
  }): Promise<(() => void) | null> {
    const sdk = await this.initialize();
    if (typeof sdk?.on !== "function" || typeof sdk?.off !== "function") return null;
    sdk.on("game_api_pause", onPause);
    sdk.on("game_api_resume", onResume);
    return () => {
      sdk.off?.("game_api_pause", onPause);
      sdk.off?.("game_api_resume", onResume);
    };
  }

  showStickyBanner(): Promise<void> {
    return this.#queueStickyBannerState(true);
  }

  hideStickyBanner(): Promise<void> {
    return this.#queueStickyBannerState(false);
  }

  #queueStickyBannerState(visible: boolean): Promise<void> {
    const apply = async (): Promise<void> => {
      if (this.#stickyBannerState === visible) return;
      const sdk = await this.initialize();
      const adv = sdk?.adv;
      const method = visible ? adv?.showBannerAdv : adv?.hideBannerAdv;
      if (typeof method !== "function") return;
      try {
        const result = await method.call(adv);
        this.#stickyBannerState = result?.stickyAdvIsShowing === visible
          ? visible
          : undefined;
      } catch {
        this.#stickyBannerState = undefined;
      }
    };

    this.#stickyBannerOperation = this.#stickyBannerOperation.then(apply, apply);
    return this.#stickyBannerOperation;
  }

  async showFullscreen(): Promise<void> {
    const sdk = await this.initialize();
    const showFullscreenAdv = sdk?.adv?.showFullscreenAdv;
    if (typeof showFullscreenAdv !== "function") return;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      try {
        showFullscreenAdv({
          callbacks: {
            onClose: () => finish(),
            onError: () => finish(),
          },
        });
      } catch {
        finish();
      }
    });
  }

  async showRewarded({ onOpen, onClose }: RewardedCallbacks = {}): Promise<RewardedResult> {
    if (this.#pendingRewarded) {
      return Object.freeze({ status: RewardedAdStatus.BUSY });
    }

    this.#pendingRewarded = true;
    if (this.#simulateRewarded) {
      try {
        onOpen?.();
        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.max(0, this.#simulationDelay)),
        );
        onClose?.();
        return Object.freeze({
          status: RewardedAdStatus.REWARDED,
          simulated: true,
        });
      } finally {
        this.#pendingRewarded = false;
      }
    }

    const sdk = await this.initialize();
    if (typeof sdk?.adv?.showRewardedVideo !== "function") {
      this.#pendingRewarded = false;
      return Object.freeze({ status: RewardedAdStatus.UNAVAILABLE });
    }

    const rewardedVideo = sdk.adv.showRewardedVideo;
    return new Promise<RewardedResult>((resolve) => {
      let rewarded = false;
      let settled = false;
      const finish = (result: RewardedResult): void => {
        if (settled) return;
        settled = true;
        this.#pendingRewarded = false;
        try {
          onClose?.();
        } finally {
          resolve(Object.freeze(result));
        }
      };

      try {
        rewardedVideo({
          callbacks: {
            onOpen: () => {
              onOpen?.();
            },
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () =>
              finish({
                status: rewarded
                  ? RewardedAdStatus.REWARDED
                  : RewardedAdStatus.CLOSED,
              }),
            onError: (error) =>
              finish({ status: RewardedAdStatus.ERROR, error }),
          },
        });
      } catch (error) {
        finish({ status: RewardedAdStatus.ERROR, error });
      }
    });
  }
}

let sharedAdapter: YandexGamesAdapter | undefined;

export function getYandexGamesAdapter(): YandexGamesAdapter {
  sharedAdapter ??= new YandexGamesAdapter();
  return sharedAdapter;
}
