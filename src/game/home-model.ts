import type { CampaignProgressSnapshot } from "../campaign-progress.js";
import type { DailyWeekSummary } from "../daily-progress.js";
import type { EndlessProgressSnapshot } from "../endless-progress.js";
import {
  campaignContinueTarget,
  masteryRank,
  type CampaignContinueTarget,
  type MasteryRankValue,
} from "../mastery.js";
import { dailyAccess, endlessAccess } from "../mode-access.js";

export type HomeProgressSnapshot = Pick<
  CampaignProgressSnapshot,
  "tutorialCompleted" | "solvedLevels" | "cleanLevels"
>;

export type HomeDailyState = "open" | "solved" | "clean";

export interface HomeDailyDayModel {
  dateKey: string;
  state: HomeDailyState;
}

export interface HomeDailyModel {
  dateKey: string;
  todayState: HomeDailyState;
  weekStates: readonly HomeDailyDayModel[];
  solvedCount: number;
  cleanCount: number;
}

export interface HomeEndlessModel {
  bestBoards: number;
}

export interface HomeModel {
  firstLaunch: boolean;
  continueTarget: CampaignContinueTarget;
  solvedCount: number;
  cleanCount: number;
  rank: MasteryRankValue;
  showDaily: boolean;
  showEndless: boolean;
  daily: Readonly<HomeDailyModel> | null;
  endless: Readonly<HomeEndlessModel> | null;
}

export interface CreateHomeModelOptions {
  unlockAll?: boolean;
  daily?: Readonly<{
    dateKey: string;
    weekSummary: DailyWeekSummary;
  }>;
  endless?: Readonly<Pick<EndlessProgressSnapshot, "bestUnassistedBoards">>;
}

function homeDailyState(state: "missing" | "solved" | "clean"): HomeDailyState {
  return state === "missing" ? "open" : state;
}

function createHomeDailyModel(
  input: NonNullable<CreateHomeModelOptions["daily"]>,
): Readonly<HomeDailyModel> {
  const weekStates = Object.freeze(
    input.weekSummary.days.map((day) =>
      Object.freeze({
        dateKey: day.dateKey,
        state: homeDailyState(day.state),
      }),
    ),
  );
  const today = weekStates.find((day) => day.dateKey === input.dateKey);

  return Object.freeze({
    dateKey: input.dateKey,
    todayState: today?.state ?? "open",
    weekStates,
    solvedCount: input.weekSummary.solvedCount,
    cleanCount: input.weekSummary.cleanCount,
  });
}

export function createHomeModel(
  snapshot: HomeProgressSnapshot,
  { unlockAll = false, daily, endless }: CreateHomeModelOptions = {},
): Readonly<HomeModel> {
  const solvedCount = snapshot.solvedLevels.length;
  const cleanCount = snapshot.cleanLevels.length;

  return Object.freeze({
    firstLaunch: !snapshot.tutorialCompleted,
    continueTarget: campaignContinueTarget(snapshot),
    solvedCount,
    cleanCount,
    rank: masteryRank(cleanCount),
    showDaily: dailyAccess(snapshot, { unlockAll }).unlocked,
    showEndless: endlessAccess(snapshot, { unlockAll }).unlocked,
    daily: daily ? createHomeDailyModel(daily) : null,
    endless: endless
      ? Object.freeze({ bestBoards: endless.bestUnassistedBoards })
      : null,
  });
}
