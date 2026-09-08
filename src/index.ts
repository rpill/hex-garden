export {
  Atom,
  ATOM_NAMES,
  ELEMENT_TYPES,
  METAL_TYPES,
  PREVIOUS_METAL,
  isElement,
  isMetal,
} from "./atom-types.js";
export { GardenBoard } from "./board.js";
export { analyzePuzzleDifficulty } from "./difficulty.js";
export type { DifficultyInput, DifficultyMetrics } from "./difficulty.js";
export {
  CAMPAIGN_DIFFICULTY_PROFILES,
  CAMPAIGN_DIFFICULTY_RHYTHM,
  CampaignChapter,
  campaignChapterForLevel,
  campaignDifficultyProfile,
  rankCandidatesForProfile,
} from "./difficulty-profiles.js";
export type {
  CampaignChapterValue,
  DifficultyCandidate,
  DifficultyPercentiles,
  DifficultyProfile,
  RankedDifficultyCandidate,
} from "./difficulty-profiles.js";
export {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_PLATE_SCHEDULE,
  PLATE_SPECS,
  PlateSize,
  campaignPlateSize,
  plateSpec,
} from "./plates.js";
export type { PlateSizeValue, PlateSpec } from "./plates.js";
export {
  CAMPAIGN_CHAPTERS,
  CampaignLevelState,
  campaignLevelState,
} from "./game/chapter-model.js";
export type {
  CampaignChapterDefinition,
  CampaignLevelStateValue,
  ChapterProgressSnapshot,
} from "./game/chapter-model.js";
export { CAMPAIGN_LEVELS, getCampaignLevel } from "./campaign-levels.js";
export type { CampaignLevelRecord } from "./campaign-levels.js";
export { generatePuzzleCandidate } from "./puzzle-generation.js";
export type {
  GeneratedPuzzleCandidate,
  PuzzleCandidateOptions,
  PuzzleComposition,
} from "./puzzle-generation.js";
export {
  ATOMS_PER_BOARD,
  BYTES_PER_ATOM,
  BYTES_PER_BOARD,
  DATABASE_HEADER_BYTES,
  GardenDatabase,
  encodeBoardDatabase,
} from "./database.js";
export {
  BoardShape,
  BoardVariant,
  createSeededRandom,
  generateSolvableBoard,
  replaySolution,
} from "./generator.js";
export {
  DEFAULT_CAMPAIGN_SEED,
  generateCampaignLevel,
} from "./campaign.js";
export {
  DEFAULT_PROGRESSION_SEED,
  PROGRESSION_LEVEL_COUNT,
  ProgressionChapter,
  analyzeProgressionDifficulty,
  generateProgressionLevel,
  getProgressionLevelDefinition,
} from "./progression.js";
export {
  CAMPAIGN_PROGRESS_STORAGE_KEY,
  CampaignProgressStore,
  normalizeCampaignProgress,
  type CampaignProgressRuntimeSnapshot,
  type CampaignProgressSnapshot,
  type CampaignProgressSnapshotV3,
  type CampaignProgressStoreOptions,
} from "./campaign-progress.js";
export {
  MasteryRank,
  campaignContinueTarget,
  masteryRank,
} from "./mastery.js";
export type {
  CampaignContinueTarget,
  CampaignMasteryProgress,
  MasteryRankValue,
} from "./mastery.js";
export {
  DAILY_REQUIRED_COMPLETIONS,
  ENDLESS_REQUIRED_COMPLETIONS,
  dailyAccess,
  endlessAccess,
  type ModeAccessSnapshot,
} from "./mode-access.js";
export {
  ENDLESS_BOARD_BASE_SCORE,
  SCORE_PER_REMOVED_ATOM,
  STREAK_MULTIPLIER_STEPS,
  boardClearBaseScore,
  createEndlessScoreState,
  nextStreakMultiplier,
  scoreClearedBoard,
  scoreRemovedAtoms,
  streakMultiplier,
} from "./endless-score.js";
export {
  ENDLESS_COMPACT_LEVEL_COUNT,
  ENDLESS_LARGE_START_LEVEL,
  ENDLESS_MEDIUM_LEVEL_COUNT,
  endlessRunPhase,
  generateEndlessRunLevel,
} from "./endless-run.js";
export {
  ECONOMY_STORAGE_KEY,
  HINT_PRODUCTS,
  REWARDED_AD_COOLDOWN_MS,
  REWARDED_HINT_AMOUNTS,
  STARTING_DUST,
  EconomyStore,
  HintType,
  dustRewardForPlate,
  endlessDustReward,
  normalizeEconomy,
  productForHint,
  rewardedAmountForHint,
} from "./economy.js";
export {
  RewardedAdStatus,
  YandexGamesAdapter,
  getYandexGamesAdapter,
} from "./platform/yandex-games.js";
export {
  DEFAULT_SETTINGS,
  Language,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  normalizeSettings,
} from "./settings.js";
export {
  FAKE_LEADERBOARD_ENTRIES,
  LEADERBOARD_STORAGE_KEY,
  LocalLeaderboardStore,
  normalizeLeaderboardProfile,
} from "./leaderboard.js";
export {
  SolveStatus,
  findLastSolvableSnapshot,
  findWinningRoute,
  moveKey,
} from "./solver.js";
export {
  ADJACENT_OFFSETS,
  BOARD_CENTER,
  BOARD_RADIUS,
  addHex,
  enumerateBoardCells,
  enumerateHexPlate,
  hex,
  hexDistance,
  hexKey,
  isBoardCell,
  isHexPlateCell,
  rotateHex,
  rotateHexAround,
  subtractHex,
} from "./hex.js";
export { atomTypesMatch, isMetalLocked, isSingleRemoval } from "./rules.js";
export {
  PANEL_COMMON_TYPES,
  PANEL_METAL_TYPES,
  createPanelState,
  panelTypesForVariant,
} from "./panel-state.js";
export {
  TUTORIAL_GUIDED_MOVE_COUNT,
  createTutorialLevel,
  findLongestEmptyNeighbourRun,
} from "./tutorial.js";
export { campaignPostCompletionDestination } from "./campaign-routing.js";
export {
  CAMPAIGN_MECHANIC_INTRODUCTIONS,
  mechanicIntroductionForLevel,
} from "./mechanic-introductions.js";
export {
  dailyDateKey,
  dailyWeekKey,
  dailyWeekdayIndex,
  datesForMoscowWeek,
} from "./daily-calendar.js";
