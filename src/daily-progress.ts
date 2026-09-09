import {
  dailyArchiveWindow,
  isDailyDateKey,
  offsetDailyDateKey,
} from "./daily-calendar.js";
import { isRecord, type StorageLike } from "./persistence.js";
import { getPlayerDataStorage } from "./platform/player-data-storage.js";

export const DAILY_PROGRESS_STORAGE_KEY = "garden-js.daily-progress.v1";

export interface DailyEntry {
  solved: true;
  clean: boolean;
  completedOnTime: boolean;
}

export interface DailyProgressSnapshot {
  version: 1;
  entries: Record<string, DailyEntry>;
  bestSolvedWeek: number;
  bestCleanWeek: number;
  bestStreak: number;
}

export type DailyDayState = "missing" | "solved" | "clean";

export interface DailyWeekDay {
  dateKey: string;
  state: DailyDayState;
}

export interface DailyWeekSummary {
  weekKey: string;
  days: readonly DailyWeekDay[];
  solvedCount: number;
  cleanCount: number;
}

export interface DailyProgressStoreOptions {
  storage?: StorageLike;
  storageKey?: string;
}

function initialSnapshot(): DailyProgressSnapshot {
  return {
    version: 1,
    entries: {},
    bestSolvedWeek: 0,
    bestCleanWeek: 0,
    bestStreak: 0,
  };
}

function cloneEntry(entry: DailyEntry): DailyEntry {
  return {
    solved: true,
    clean: entry.clean,
    completedOnTime: entry.completedOnTime,
  };
}

function cloneSnapshot(snapshot: DailyProgressSnapshot): DailyProgressSnapshot {
  return {
    version: 1,
    entries: Object.fromEntries(
      Object.entries(snapshot.entries).map(([key, entry]) => [key, cloneEntry(entry)]),
    ),
    bestSolvedWeek: snapshot.bestSolvedWeek,
    bestCleanWeek: snapshot.bestCleanWeek,
    bestStreak: snapshot.bestStreak,
  };
}

function boundedWeeklyCount(value: unknown): number {
  return Number.isSafeInteger(value) ? Math.max(0, Math.min(7, value as number)) : 0;
}

function nonNegativeSafeInteger(value: unknown): number {
  return Number.isSafeInteger(value) ? Math.max(0, value as number) : 0;
}

function assertDateKey(dateKey: string): void {
  if (!isDailyDateKey(dateKey)) {
    throw new RangeError(`Invalid daily date key: ${dateKey}`);
  }
}

function weekStartKey(dateKey: string): string {
  assertDateKey(dateKey);
  const [yearText, monthText, dayText] = dateKey.split("-");
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  const sundayZero = date.getUTCDay();
  const mondayZero = (sundayZero + 6) % 7;
  return offsetDailyDateKey(dateKey, -mondayZero);
}

function weekDateKeys(dateKey: string): readonly string[] {
  const monday = weekStartKey(dateKey);
  return Object.freeze(
    Array.from({ length: 7 }, (_value, index) => offsetDailyDateKey(monday, index)),
  );
}

export function normalizeDailyProgress(value: unknown): DailyProgressSnapshot {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.entries)) {
    return initialSnapshot();
  }

  const entries: Record<string, DailyEntry> = {};
  for (const [dateKey, rawEntry] of Object.entries(value.entries)) {
    if (!isDailyDateKey(dateKey) || !isRecord(rawEntry) || rawEntry.solved !== true) continue;
    entries[dateKey] = {
      solved: true,
      clean: rawEntry.clean === true,
      completedOnTime: rawEntry.completedOnTime === true,
    };
  }

  const bestSolvedWeek = boundedWeeklyCount(value.bestSolvedWeek);
  const bestCleanWeek = Math.min(bestSolvedWeek, boundedWeeklyCount(value.bestCleanWeek));

  return {
    version: 1,
    entries,
    bestSolvedWeek,
    bestCleanWeek,
    bestStreak: nonNegativeSafeInteger(value.bestStreak),
  };
}

export class DailyProgressStore {
  #snapshot: DailyProgressSnapshot;
  readonly #storage: StorageLike;
  readonly #storageKey: string;

  constructor({
    storage = getPlayerDataStorage(),
    storageKey = DAILY_PROGRESS_STORAGE_KEY,
  }: DailyProgressStoreOptions = {}) {
    this.#storage = storage;
    this.#storageKey = storageKey;
    this.#snapshot = this.#load();
  }

  get snapshot(): DailyProgressSnapshot {
    return cloneSnapshot(this.#snapshot);
  }

  markSolved(
    dateKey: string,
    { clean = false, currentDateKey }: { clean?: boolean; currentDateKey: string },
  ): DailyProgressSnapshot {
    assertDateKey(dateKey);
    assertDateKey(currentDateKey);

    const before = JSON.stringify(this.#snapshot);
    const previous = this.#snapshot.entries[dateKey];
    const next: DailyEntry = {
      solved: true,
      clean: previous?.clean === true || clean === true,
      completedOnTime: previous?.completedOnTime === true || dateKey === currentDateKey,
    };

    const changed = !previous
      || previous.clean !== next.clean
      || previous.completedOnTime !== next.completedOnTime;

    if (changed) {
      this.#snapshot.entries[dateKey] = next;
      this.#updateBestForWeek(dateKey);
      this.#updateBestStreak();
    }

    this.#pruneInMemory(currentDateKey);
    if (JSON.stringify(this.#snapshot) !== before) this.#persist();
    return this.snapshot;
  }

  weekSummary(dateKey: string): DailyWeekSummary {
    assertDateKey(dateKey);
    const days = weekDateKeys(dateKey).map((key): DailyWeekDay => {
      const entry = this.#snapshot.entries[key];
      return {
        dateKey: key,
        state: entry?.clean === true ? "clean" : entry ? "solved" : "missing",
      };
    });
    const solvedCount = days.filter((day) => day.state !== "missing").length;
    const cleanCount = days.filter((day) => day.state === "clean").length;

    return {
      weekKey: days[0]?.dateKey ?? weekStartKey(dateKey),
      days,
      solvedCount,
      cleanCount,
    };
  }

  streakSummary(currentDateKey: string): Readonly<{
    currentStreak: number;
    bestStreak: number;
  }> {
    assertDateKey(currentDateKey);
    const completed = new Set(
      Object.entries(this.#snapshot.entries)
        .filter(([dateKey, entry]) => dateKey <= currentDateKey && entry.completedOnTime)
        .map(([dateKey]) => dateKey),
    );

    let cursor = completed.has(currentDateKey)
      ? currentDateKey
      : offsetDailyDateKey(currentDateKey, -1);
    let currentStreak = 0;
    while (completed.has(cursor)) {
      currentStreak += 1;
      cursor = offsetDailyDateKey(cursor, -1);
    }

    return Object.freeze({
      currentStreak,
      bestStreak: this.#snapshot.bestStreak,
    });
  }

  prune(nowDateKey: string): DailyProgressSnapshot {
    assertDateKey(nowDateKey);
    const before = JSON.stringify(this.#snapshot);
    this.#updateBestAcrossEntries(nowDateKey);
    this.#updateBestStreak();
    this.#pruneInMemory(nowDateKey);
    if (JSON.stringify(this.#snapshot) !== before) this.#persist();
    return this.snapshot;
  }

  #load(): DailyProgressSnapshot {
    try {
      const serialized = this.#storage.getItem(this.#storageKey);
      return serialized ? normalizeDailyProgress(JSON.parse(serialized) as unknown) : initialSnapshot();
    } catch {
      return initialSnapshot();
    }
  }

  #persist(): void {
    try {
      this.#storage.setItem(this.#storageKey, JSON.stringify(this.#snapshot));
    } catch {
      // Daily remains usable in memory if persistence is temporarily unavailable.
    }
  }

  #updateBestForWeek(dateKey: string): void {
    const summary = this.weekSummary(dateKey);
    this.#snapshot.bestSolvedWeek = Math.max(this.#snapshot.bestSolvedWeek, summary.solvedCount);
    this.#snapshot.bestCleanWeek = Math.max(this.#snapshot.bestCleanWeek, summary.cleanCount);
  }

  #updateBestAcrossEntries(nowDateKey: string): void {
    const weeks = new Set<string>();
    for (const dateKey of Object.keys(this.#snapshot.entries)) {
      if (dateKey <= nowDateKey) weeks.add(weekStartKey(dateKey));
    }
    for (const weekKey of weeks) this.#updateBestForWeek(weekKey);
  }

  #updateBestStreak(): void {
    const completed = Object.entries(this.#snapshot.entries)
      .filter(([, entry]) => entry.completedOnTime)
      .map(([dateKey]) => dateKey)
      .sort();

    let longest = 0;
    let current = 0;
    let previous: string | undefined;
    for (const dateKey of completed) {
      current = previous && offsetDailyDateKey(previous, 1) === dateKey ? current + 1 : 1;
      longest = Math.max(longest, current);
      previous = dateKey;
    }
    this.#snapshot.bestStreak = Math.max(this.#snapshot.bestStreak, longest);
  }

  #pruneInMemory(nowDateKey: string): void {
    const { startDateKey } = dailyArchiveWindow(nowDateKey);
    for (const dateKey of Object.keys(this.#snapshot.entries)) {
      if (dateKey < startDateKey || dateKey > nowDateKey) {
        delete this.#snapshot.entries[dateKey];
      }
    }
  }
}
