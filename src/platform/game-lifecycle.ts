import { getYandexGamesAdapter, type YandexGamesAdapter } from "./yandex-games.js";

type LifecycleAdapter = Pick<
  YandexGamesAdapter,
  "subscribeGamePauseResume" | "notifyGameplayStart" | "notifyGameplayStop"
>;

interface GameLoopLike {
  sleep(): void;
  wake(): void;
}

interface GameSoundLike {
  mute: boolean;
}

export interface LifecycleGameLike {
  loop: GameLoopLike;
  sound: GameSoundLike;
}

interface VisibilityDocumentLike {
  hidden?: boolean;
  addEventListener?(type: "visibilitychange", listener: () => void): void;
  removeEventListener?(type: "visibilitychange", listener: () => void): void;
}

export interface GameLifecycleControllerOptions {
  adapter?: LifecycleAdapter;
  documentObject?: VisibilityDocumentLike;
}

export class GameLifecycleController {
  readonly #adapter: LifecycleAdapter;
  readonly #document: VisibilityDocumentLike | undefined;
  #game: LifecycleGameLike | undefined;
  #externalPaused = false;
  #gameplayActive = false;
  #startDeferredByExternalPause = false;
  #muteBeforeExternalPause = false;
  #unsubscribeSdk: (() => void) | null | undefined;
  #visibilityListener: (() => void) | undefined;
  #markupQueue: Promise<void> = Promise.resolve();

  constructor({
    adapter = getYandexGamesAdapter(),
    documentObject = globalThis.document,
  }: GameLifecycleControllerOptions = {}) {
    this.#adapter = adapter;
    this.#document = documentObject;
  }

  async initialize(): Promise<void> {
    if (this.#unsubscribeSdk !== undefined || this.#visibilityListener) return;
    this.#unsubscribeSdk = await this.#adapter.subscribeGamePauseResume({
      onPause: () => this.#setExternalPaused(true, true),
      onResume: () => this.#setExternalPaused(false, true),
    });
    if (this.#unsubscribeSdk) return;

    const listener = () => {
      this.#setExternalPaused(this.#document?.hidden === true, false);
    };
    this.#visibilityListener = listener;
    this.#document?.addEventListener?.("visibilitychange", listener);
    if (this.#document?.hidden === true) listener();
  }

  attachGame(game: LifecycleGameLike): void {
    this.#game = game;
    if (this.#externalPaused) this.#pauseAttachedGame();
  }

  setGameplayActive(active: boolean): void {
    if (this.#gameplayActive === active) return;
    this.#gameplayActive = active;
    if (!active) {
      this.#startDeferredByExternalPause = false;
      this.#queueMarkup(false);
      return;
    }
    if (this.#externalPaused) {
      this.#startDeferredByExternalPause = true;
      return;
    }
    this.#queueMarkup(true);
  }

  flush(): Promise<void> {
    return this.#markupQueue;
  }

  dispose(): void {
    this.#unsubscribeSdk?.();
    this.#unsubscribeSdk = undefined;
    if (this.#visibilityListener) {
      this.#document?.removeEventListener?.("visibilitychange", this.#visibilityListener);
      this.#visibilityListener = undefined;
    }
  }

  #queueMarkup(active: boolean): void {
    this.#markupQueue = this.#markupQueue.then(() =>
      active
        ? this.#adapter.notifyGameplayStart()
        : this.#adapter.notifyGameplayStop(),
    );
  }

  #setExternalPaused(paused: boolean, sdkManaged: boolean): void {
    if (this.#externalPaused === paused) return;
    this.#externalPaused = paused;
    if (paused) {
      this.#pauseAttachedGame();
      if (!sdkManaged && this.#gameplayActive) this.#queueMarkup(false);
      return;
    }

    this.#resumeAttachedGame();
    if (this.#gameplayActive && (!sdkManaged || this.#startDeferredByExternalPause)) {
      this.#queueMarkup(true);
    }
    this.#startDeferredByExternalPause = false;
  }

  #pauseAttachedGame(): void {
    const game = this.#game;
    if (!game) return;
    this.#muteBeforeExternalPause = game.sound.mute;
    game.sound.mute = true;
    game.loop.sleep();
  }

  #resumeAttachedGame(): void {
    const game = this.#game;
    if (!game) return;
    game.loop.wake();
    game.sound.mute = this.#muteBeforeExternalPause;
  }
}

let sharedLifecycle: GameLifecycleController | undefined;

export function getGameLifecycleController(): GameLifecycleController {
  sharedLifecycle ??= new GameLifecycleController();
  return sharedLifecycle;
}
