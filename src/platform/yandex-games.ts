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
