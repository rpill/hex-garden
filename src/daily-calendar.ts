const MOSCOW_TIME_ZONE = "Europe/Moscow";

const MOSCOW_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: MOSCOW_TIME_ZONE,
  calendar: "gregory",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const WEEKDAY_INDEX = Object.freeze({
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
} as const);

type MoscowDateParts = Readonly<{
  year: number;
  month: number;
  day: number;
  weekday: keyof typeof WEEKDAY_INDEX;
}>;

function moscowDateParts(now: Date): MoscowDateParts {
  let year = 0;
  let month = 0;
  let day = 0;
  let weekday: keyof typeof WEEKDAY_INDEX | undefined;

  for (const part of MOSCOW_DATE_FORMATTER.formatToParts(now)) {
    switch (part.type) {
      case "year":
        year = Number(part.value);
        break;
      case "month":
        month = Number(part.value);
        break;
      case "day":
        day = Number(part.value);
        break;
      case "weekday":
        if (part.value in WEEKDAY_INDEX) {
          weekday = part.value as keyof typeof WEEKDAY_INDEX;
        }
        break;
    }
  }

  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || !Number.isInteger(day) || day < 1 || weekday === undefined) {
    throw new RangeError("Could not resolve Moscow calendar date");
  }

  return { year, month, day, weekday };
}

function dateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function offsetDateKey(parts: MoscowDateParts, dayOffset: number): string {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return date.toISOString().slice(0, 10);
}

export function dailyDateKey(now: Date): string {
  const parts = moscowDateParts(now);
  return dateKey(parts.year, parts.month, parts.day);
}

export function dailyWeekdayIndex(now: Date): number {
  return WEEKDAY_INDEX[moscowDateParts(now).weekday];
}

export function dailyWeekKey(now: Date): string {
  const parts = moscowDateParts(now);
  return offsetDateKey(parts, -WEEKDAY_INDEX[parts.weekday]);
}

export function datesForMoscowWeek(now: Date): readonly string[] {
  const parts = moscowDateParts(now);
  const mondayOffset = -WEEKDAY_INDEX[parts.weekday];
  return Object.freeze(
    Array.from({ length: 7 }, (_value, index) => offsetDateKey(parts, mondayOffset + index)),
  );
}
