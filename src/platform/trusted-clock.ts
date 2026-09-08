import {
  getYandexGamesAdapter,
  type YandexGamesAdapter,
} from "./yandex-games.js";

export interface TrustedClock {
  nowMs(): Promise<number | null>;
  now(): Promise<Date | null>;
}

type ServerTimeProvider = Pick<YandexGamesAdapter, "serverTime">;

export class YandexTrustedClock implements TrustedClock {
  readonly #platform: ServerTimeProvider;

  constructor(platform: ServerTimeProvider = getYandexGamesAdapter()) {
    this.#platform = platform;
  }

  async nowMs(): Promise<number | null> {
    return this.#platform.serverTime();
  }

  async now(): Promise<Date | null> {
    const timestamp = await this.nowMs();
    return timestamp === null ? null : new Date(timestamp);
  }
}

let sharedClock: YandexTrustedClock | undefined;

export function getTrustedClock(): YandexTrustedClock {
  sharedClock ??= new YandexTrustedClock();
  return sharedClock;
}
