export const RewardedAdStatus = Object.freeze({
  REWARDED: "rewarded",
  CLOSED: "closed",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
  BUSY: "busy",
});

function isLocalTest(locationObject) {
  const hostname = locationObject?.hostname ?? "";
  const search = locationObject?.search ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    new URLSearchParams(search).get("test") === "all"
  );
}

function isYandexGamesHost(locationObject) {
  const hostname = locationObject?.hostname ?? "";
  return (
    hostname.endsWith(".games.s3.yandex.net") ||
    hostname === "games.s3.yandex.net"
  );
}

function loadSdkScript(documentObject, globalObject, url) {
  if (!documentObject?.createElement) return Promise.resolve(false);
  const existing = documentObject.querySelector?.(`script[data-yandex-games-sdk]`);
  if (existing) {
    return new Promise((resolve) => {
      if (globalObject.YaGames) resolve(true);
      else {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => resolve(false), { once: true });
      }
    });
  }
  return new Promise((resolve) => {
    const script = documentObject.createElement("script");
    script.src = url;
    script.async = true;
    script.dataset.yandexGamesSdk = "true";
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => resolve(false), { once: true });
    (documentObject.head ?? documentObject.body)?.append(script);
  });
}

export class YandexGamesAdapter {
  #document;
  #global;
  #initPromise;
  #location;
  #pendingRewarded = false;
  #sdk;
  #sdkUrl;
  #simulateRewarded;
  #simulationDelay;

  constructor({
    globalObject = globalThis,
    documentObject = globalThis.document,
    locationObject = globalThis.location,
    sdkUrl,
    simulateRewarded,
    simulationDelay = 700,
  } = {}) {
    this.#global = globalObject;
    this.#document = documentObject;
    this.#location = locationObject;
    this.#sdkUrl = sdkUrl ?? (isYandexGamesHost(locationObject) ? "/sdk.js" : null);
    this.#simulateRewarded =
      simulateRewarded ?? isLocalTest(locationObject);
    this.#simulationDelay = simulationDelay;
  }

  get isSimulated() {
    return this.#simulateRewarded;
  }

  async initialize() {
    if (this.#simulateRewarded) return null;
    if (this.#sdk) return this.#sdk;
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = this.#initializeSdk();
    return this.#initPromise;
  }

  async #initializeSdk() {
    try {
      if (!this.#global.YaGames && this.#sdkUrl) {
        await loadSdkScript(this.#document, this.#global, this.#sdkUrl);
      }
      if (typeof this.#global.YaGames?.init !== "function") return null;
      this.#sdk = await this.#global.YaGames.init();
      return this.#sdk;
    } catch {
      return null;
    }
  }

  async notifyGameReady() {
    const sdk = await this.initialize();
    try {
      sdk?.features?.LoadingAPI?.ready?.();
    } catch {
      // Game remains playable if the platform event is unavailable.
    }
  }

  async showRewarded({ onOpen, onClose } = {}) {
    if (this.#pendingRewarded) {
      return Object.freeze({ status: RewardedAdStatus.BUSY });
    }
    this.#pendingRewarded = true;

    if (this.#simulateRewarded) {
      try {
        onOpen?.();
        await new Promise((resolve) =>
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

    return new Promise((resolve) => {
      let rewarded = false;
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        this.#pendingRewarded = false;
        try {
          sdk.features?.GameplayAPI?.start?.();
          onClose?.();
        } finally {
          resolve(Object.freeze(result));
        }
      };
      try {
        sdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              sdk.features?.GameplayAPI?.stop?.();
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

let sharedAdapter;

export function getYandexGamesAdapter() {
  sharedAdapter ??= new YandexGamesAdapter();
  return sharedAdapter;
}
