import { isRecord } from "../persistence.js";

export const RewardedAdStatus = Object.freeze({
  REWARDED: "rewarded", CLOSED: "closed", UNAVAILABLE: "unavailable", ERROR: "error", BUSY: "busy",
} as const);
export type RewardedAdStatusValue = (typeof RewardedAdStatus)[keyof typeof RewardedAdStatus];

interface LocationLike { hostname?: string; search?: string; }
interface ScriptLike {
  src: string; async: boolean; dataset: Record<string, string>;
  addEventListener(type: "load" | "error", listener: () => void, options?: { once?: boolean }): void;
}
interface ExistingScriptLike { addEventListener(type: "load" | "error", listener: () => void, options?: { once?: boolean }): void; }
interface AppendTarget { append(node: ScriptLike): void; }
interface DocumentLike {
  createElement?(tag: "script"): ScriptLike;
  querySelector?(selector: string): ExistingScriptLike | null;
  head?: AppendTarget | null;
  body?: AppendTarget | null;
}
interface YandexSdk {
  features?: {
    LoadingAPI?: { ready?: () => void };
    GameplayAPI?: { start?: () => void; stop?: () => void };
  };
  adv?: {
    showRewardedVideo?: (options: { callbacks: { onOpen: () => void; onRewarded: () => void; onClose: () => void; onError: (error: unknown) => void } }) => void;
  };
}
interface YaGamesApi { init?: () => Promise<YandexSdk>; }
interface GlobalLike { YaGames?: YaGamesApi; }

function asGlobalLike(value: unknown): GlobalLike {
  if (!isRecord(value)) return {};
  const yaGames = isRecord(value.YaGames) ? value.YaGames : undefined;
  if (!yaGames) return {};
  const init = typeof yaGames.init === "function" ? yaGames.init as () => Promise<YandexSdk> : undefined;
  return init ? { YaGames: { init } } : { YaGames: {} };
}
function asDocumentLike(value: unknown): DocumentLike | undefined {
  return isRecord(value) ? value as unknown as DocumentLike : undefined;
}
function asLocationLike(value: unknown): LocationLike {
  if (!isRecord(value)) return {};
  return { ...(typeof value.hostname === "string" ? { hostname: value.hostname } : {}), ...(typeof value.search === "string" ? { search: value.search } : {}) };
}
function isLocalTest(locationObject: LocationLike): boolean {
  const hostname = locationObject.hostname ?? ""; const search = locationObject.search ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || new URLSearchParams(search).get("test") === "all";
}
function isYandexGamesHost(locationObject: LocationLike): boolean {
  const hostname = locationObject.hostname ?? "";
  return hostname.endsWith(".games.s3.yandex.net") || hostname === "games.s3.yandex.net";
}
async function loadSdkScript(documentObject: DocumentLike | undefined, globalObject: GlobalLike, url: string): Promise<boolean> {
  if (!documentObject?.createElement) return false;
  const existing = documentObject.querySelector?.("script[data-yandex-games-sdk]");
  if (existing) return new Promise((resolve) => {
    if (globalObject.YaGames) resolve(true);
    else { existing.addEventListener("load", () => resolve(true), { once: true }); existing.addEventListener("error", () => resolve(false), { once: true }); }
  });
  return new Promise((resolve) => {
    const script = documentObject.createElement!("script"); script.src = url; script.async = true; script.dataset.yandexGamesSdk = "true";
    script.addEventListener("load", () => resolve(true), { once: true }); script.addEventListener("error", () => resolve(false), { once: true });
    (documentObject.head ?? documentObject.body)?.append(script);
  });
}

export interface YandexGamesAdapterOptions {
  globalObject?: unknown; documentObject?: unknown; locationObject?: unknown; sdkUrl?: string | null; simulateRewarded?: boolean; simulationDelay?: number;
}
export interface RewardedCallbacks { onOpen?: () => void; onClose?: () => void; }
export type RewardedResult = Readonly<{ status: RewardedAdStatusValue; simulated?: boolean; error?: unknown }>;

export class YandexGamesAdapter {
  #document: DocumentLike | undefined; #global: GlobalLike; #initPromise: Promise<YandexSdk | null> | undefined; #location: LocationLike;
  #pendingRewarded = false; #sdk: YandexSdk | undefined; #sdkUrl: string | null; #simulateRewarded: boolean; #simulationDelay: number;
  constructor({ globalObject = globalThis, documentObject = globalThis.document, locationObject = globalThis.location, sdkUrl, simulateRewarded, simulationDelay = 700 }: YandexGamesAdapterOptions = {}) {
    this.#global = asGlobalLike(globalObject); this.#document = asDocumentLike(documentObject); this.#location = asLocationLike(locationObject);
    this.#sdkUrl = sdkUrl ?? (isYandexGamesHost(this.#location) ? "/sdk.js" : null); this.#simulateRewarded = simulateRewarded ?? isLocalTest(this.#location); this.#simulationDelay = simulationDelay;
  }
  get isSimulated(): boolean { return this.#simulateRewarded; }
  async initialize(): Promise<YandexSdk | null> {
    if (this.#simulateRewarded) return null; if (this.#sdk) return this.#sdk; if (this.#initPromise) return this.#initPromise;
    this.#initPromise = this.#initializeSdk(); return this.#initPromise;
  }
  async #initializeSdk(): Promise<YandexSdk | null> {
    try {
      if (!this.#global.YaGames && this.#sdkUrl) await loadSdkScript(this.#document, this.#global, this.#sdkUrl);
      if (typeof this.#global.YaGames?.init !== "function") return null;
      this.#sdk = await this.#global.YaGames.init(); return this.#sdk;
    } catch { return null; }
  }
  async notifyGameReady(): Promise<void> { const sdk = await this.initialize(); try { sdk?.features?.LoadingAPI?.ready?.(); } catch {} }
  async showRewarded({ onOpen, onClose }: RewardedCallbacks = {}): Promise<RewardedResult> {
    if (this.#pendingRewarded) return Object.freeze({ status: RewardedAdStatus.BUSY });
    this.#pendingRewarded = true;
    if (this.#simulateRewarded) {
      try { onOpen?.(); await new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, this.#simulationDelay))); onClose?.(); return Object.freeze({ status: RewardedAdStatus.REWARDED, simulated: true }); }
      finally { this.#pendingRewarded = false; }
    }
    const sdk = await this.initialize();
    if (typeof sdk?.adv?.showRewardedVideo !== "function") { this.#pendingRewarded = false; return Object.freeze({ status: RewardedAdStatus.UNAVAILABLE }); }
    const rewardedVideo = sdk.adv.showRewardedVideo;
    return new Promise<RewardedResult>((resolve) => {
      let rewarded = false; let settled = false;
      const finish = (result: RewardedResult): void => { if (settled) return; settled = true; this.#pendingRewarded = false; try { sdk.features?.GameplayAPI?.start?.(); onClose?.(); } finally { resolve(Object.freeze(result)); } };
      try {
        rewardedVideo({ callbacks: {
          onOpen: () => { sdk.features?.GameplayAPI?.stop?.(); onOpen?.(); }, onRewarded: () => { rewarded = true; },
          onClose: () => finish({ status: rewarded ? RewardedAdStatus.REWARDED : RewardedAdStatus.CLOSED }),
          onError: (error) => finish({ status: RewardedAdStatus.ERROR, error }),
        }});
      } catch (error) { finish({ status: RewardedAdStatus.ERROR, error }); }
    });
  }
}
let sharedAdapter: YandexGamesAdapter | undefined;
export function getYandexGamesAdapter(): YandexGamesAdapter { sharedAdapter ??= new YandexGamesAdapter(); return sharedAdapter; }
