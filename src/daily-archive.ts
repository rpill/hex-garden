import {
  dailyArchiveMonthKeys,
  isDailyArchiveDateAvailable,
} from "./daily-calendar.js";
import type {
  DailyDayState,
  DailyProgressSnapshot,
} from "./daily-progress.js";

export interface DailyArchiveCell {
  readonly dateKey: string;
  readonly dayOfMonth: number;
  readonly weekdayIndex: number;
  readonly state: DailyDayState;
  readonly enabled: boolean;
  readonly today: boolean;
}

export interface DailyArchiveMonthModel {
  readonly monthKey: string;
  readonly year: number;
  readonly month: number;
  readonly cells: readonly (DailyArchiveCell | null)[];
  readonly previousMonthKey?: string;
  readonly nextMonthKey?: string;
}

export function createDailyArchiveMonth(
  currentDateKey: string,
  monthKey: string,
  snapshot: DailyProgressSnapshot,
): Readonly<DailyArchiveMonthModel> {
  const monthKeys = dailyArchiveMonthKeys(currentDateKey);
  const monthIndex = monthKeys.indexOf(monthKey);
  if (monthIndex < 0) {
    throw new RangeError(`Daily archive month is outside the window: ${monthKey}`);
  }

  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstSundayZero = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstMondayZero = (firstSundayZero + 6) % 7;
  const cells: (DailyArchiveCell | null)[] = Array.from({ length: 42 }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${yearText}-${monthText}-${String(day).padStart(2, "0")}`;
    const weekdayIndex = (firstMondayZero + day - 1) % 7;
    const index = firstMondayZero + day - 1;
    const entry = snapshot.entries[dateKey];
    cells[index] = Object.freeze({
      dateKey,
      dayOfMonth: day,
      weekdayIndex,
      state: entry?.clean ? "clean" : entry ? "solved" : "missing",
      enabled: isDailyArchiveDateAvailable(currentDateKey, dateKey),
      today: dateKey === currentDateKey,
    });
  }

  return Object.freeze({
    monthKey,
    year,
    month,
    cells: Object.freeze(cells),
    ...(monthIndex > 0 ? { previousMonthKey: monthKeys[monthIndex - 1] } : {}),
    ...(monthIndex < monthKeys.length - 1 ? { nextMonthKey: monthKeys[monthIndex + 1] } : {}),
  });
}
