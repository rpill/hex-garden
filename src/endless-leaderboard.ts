import {
  getYandexGamesAdapter,
  type LeaderboardEntry,
  type YandexGamesAdapter,
} from "./platform/yandex-games.js";

export const ENDLESS_CLEAN_LEADERBOARD_NAME = "endless_clean_boards";

export type EndlessLeaderboardView = Readonly<{
  status: "ready" | "unavailable";
  authorized: boolean;
  top: readonly LeaderboardEntry[];
  player: LeaderboardEntry | null;
}>;

type EndlessLeaderboardPlatform = Pick<
  YandexGamesAdapter,
  | "isPlayerAuthorized"
  | "requestPlayerAuthorization"
  | "getLeaderboardEntries"
  | "getLeaderboardPlayerEntry"
  | "setLeaderboardScore"
>;

export interface EndlessLeaderboardServiceOptions {
  platform?: EndlessLeaderboardPlatform;
}

function assertLocalBest(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("localBest must be a non-negative safe integer");
  }
}

export class EndlessLeaderboardService {
  readonly #platform: EndlessLeaderboardPlatform;
  #lastPublishedScore: number | null = null;

  constructor({ platform = getYandexGamesAdapter() }: EndlessLeaderboardServiceOptions = {}) {
    this.#platform = platform;
  }

  async load(): Promise<EndlessLeaderboardView> {
    const topResult = await this.#platform.getLeaderboardEntries(
      ENDLESS_CLEAN_LEADERBOARD_NAME,
      10,
    );
    const authorized = await this.#platform.isPlayerAuthorized();

    if (topResult.status !== "ready") {
      return Object.freeze({ status: "unavailable", authorized, top: [], player: null });
    }

    let player: LeaderboardEntry | null = null;
    if (authorized) {
      const playerResult = await this.#platform.getLeaderboardPlayerEntry(
        ENDLESS_CLEAN_LEADERBOARD_NAME,
      );
      if (playerResult.status === "ready") player = playerResult.entry;
    }

    return Object.freeze({
      status: "ready",
      authorized,
      top: topResult.entries,
      player,
    });
  }

  async authorizeAndSync(localBest: number): Promise<EndlessLeaderboardView> {
    assertLocalBest(localBest);
    const authorization = await this.#platform.requestPlayerAuthorization();
    if (authorization !== "authorized") return this.load();

    const remote = await this.#platform.getLeaderboardPlayerEntry(
      ENDLESS_CLEAN_LEADERBOARD_NAME,
    );
    if (remote.status === "ready") {
      if (localBest > remote.entry.score && localBest > 0) {
        if (await this.#platform.setLeaderboardScore(ENDLESS_CLEAN_LEADERBOARD_NAME, localBest)) {
          this.#lastPublishedScore = localBest;
        }
      }
    } else if (remote.status === "not-present" && localBest > 0) {
      if (await this.#platform.setLeaderboardScore(ENDLESS_CLEAN_LEADERBOARD_NAME, localBest)) {
        this.#lastPublishedScore = localBest;
      }
    }

    return this.load();
  }

  async publishImprovedCleanBest(localBest: number): Promise<boolean> {
    assertLocalBest(localBest);
    if (localBest <= 0 || this.#lastPublishedScore === localBest) return false;
    if (!(await this.#platform.isPlayerAuthorized())) return false;

    const remote = await this.#platform.getLeaderboardPlayerEntry(
      ENDLESS_CLEAN_LEADERBOARD_NAME,
    );
    if (remote.status === "unavailable") return false;
    if (remote.status === "ready" && remote.entry.score >= localBest) {
      this.#lastPublishedScore = remote.entry.score;
      return false;
    }

    const published = await this.#platform.setLeaderboardScore(
      ENDLESS_CLEAN_LEADERBOARD_NAME,
      localBest,
    );
    if (published) this.#lastPublishedScore = localBest;
    return published;
  }
}
