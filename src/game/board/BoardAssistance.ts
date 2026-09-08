import type { BoardPieceInput } from "../../board.js";
import type { HexCoord } from "../../hex.js";
import {
  findLastSolvableSnapshot,
  findWinningRoute,
  type HistorySnapshotBase,
  type RescueResult,
  type WinningRouteResult,
} from "../../solver.js";
import {
  RewardedAdStatus,
  type YandexGamesAdapter,
} from "../../platform/yandex-games.js";

type RewardedProvider = Pick<YandexGamesAdapter, "showRewarded">;

export class BoardAssistance {
  constructor(private readonly rewarded: RewardedProvider) {}

  findHint(
    pieces: readonly BoardPieceInput[],
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): WinningRouteResult {
    return findWinningRoute(pieces, {
      preferredSolution,
      maxMilliseconds: 500,
    });
  }

  findRescue<T extends HistorySnapshotBase>(
    history: readonly T[],
    pieces: readonly BoardPieceInput[],
    preferredSolution: readonly (readonly HexCoord[])[] = [],
  ): RescueResult<T> {
    return findLastSolvableSnapshot(history, pieces, {
      preferredSolution,
      maxMilliseconds: 500,
    });
  }

  async confirmReward(required: boolean): Promise<boolean> {
    if (!required) return true;
    const result = await this.rewarded.showRewarded();
    return result.status === RewardedAdStatus.REWARDED;
  }
}
