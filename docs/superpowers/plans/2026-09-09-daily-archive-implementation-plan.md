# Daily Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playable 90-day Daily archive that preserves deterministic Daily identity, allows historical replay and `Solved -> Clean` upgrades, and keeps Daily streaks based only on on-time completions.

**Architecture:** Extend the existing Daily date/progress domain first, then adapt `DailyBoardSession` to record historical completions safely. Build a pure archive month model, a dedicated `DailyArchiveScene`, and explicit Daily board launch context (`dateKey` + return target). Reuse the current deterministic Daily generator, trusted Yandex clock, Hint/Rescue policy, interstitial policy, sticky-banner policy, and utility-scene navigation.

**Tech Stack:** TypeScript 5+, Phaser 3.90, Node 20 test runner with `tsx`, Vite, existing Yandex Games SDK adapter and Player Data storage.

**Spec:** `docs/superpowers/specs/2026-09-09-daily-archive-design.md`

## Global Constraints

- Archive window is exactly the trusted Moscow current date plus the previous 89 calendar dates.
- Never use device-local time to determine archive availability, on-time completion, or streaks.
- Historical Daily uses the same deterministic generation path as current Daily: same `dateKey` means same puzzle.
- Historical replay can upgrade `Solved -> Clean` but can never downgrade `Clean` or restore a missed streak.
- A completion is on time only when `targetDateKey === trustedCurrentDateKey` at record time.
- Hint and Rescue keep the current Daily rewarded-ad policy and invalidate Clean exactly as they do now.
- Undo and Restart remain Clean-safe by themselves.
- Archive-origin Daily completion returns to `daily-archive`; Home-origin Daily keeps the existing Home result destination.
- Sticky banner is visible in `daily-archive` and hidden on `board`.
- Do not add XP, Statistics, lifetime counters, Daily leaderboard, or a second archive-specific generator.
- Keep the existing storage key `garden-js.daily-progress.v1`; normalize pre-feature records without `completedOnTime` as `completedOnTime: false`.

---

### Task 1: Daily archive calendar primitives

**Files:**
- Modify: `src/daily-calendar.ts`
- Modify: `src/index.ts`
- Test: `test/daily-calendar.test.js`

**Interfaces:**
- Consumes: existing `dailyDateKey(now: Date): string` and Moscow calendar semantics.
- Produces:
  - `DAILY_ARCHIVE_DAYS = 90`
  - `isDailyDateKey(value: string): boolean`
  - `offsetDailyDateKey(dateKey: string, dayOffset: number): string`
  - `dailyArchiveWindow(currentDateKey: string): Readonly<{ startDateKey: string; endDateKey: string; dateKeys: readonly string[] }>`
  - `isDailyArchiveDateAvailable(currentDateKey: string, targetDateKey: string): boolean`
  - `dailyArchiveMonthKeys(currentDateKey: string): readonly string[]`

- [ ] **Step 1: Add failing archive-window tests**

Append to `test/daily-calendar.test.js`:

```js
import {
  DAILY_ARCHIVE_DAYS,
  dailyArchiveMonthKeys,
  dailyArchiveWindow,
  isDailyArchiveDateAvailable,
  offsetDailyDateKey,
} from "../src/index.js";

test("daily archive window is exactly today plus the previous 89 Moscow calendar dates", () => {
  const window = dailyArchiveWindow("2026-09-09");
  assert.equal(DAILY_ARCHIVE_DAYS, 90);
  assert.equal(window.startDateKey, "2026-06-12");
  assert.equal(window.endDateKey, "2026-09-09");
  assert.equal(window.dateKeys.length, 90);
  assert.equal(window.dateKeys[0], "2026-06-12");
  assert.equal(window.dateKeys.at(-1), "2026-09-09");
});

test("daily archive availability rejects future and older-than-window dates", () => {
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-06-12"), true);
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-09-09"), true);
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-06-11"), false);
  assert.equal(isDailyArchiveDateAvailable("2026-09-09", "2026-09-10"), false);
});

test("daily date offsets cross month and leap boundaries in UTC calendar space", () => {
  assert.equal(offsetDailyDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(offsetDailyDateKey("2028-03-01", -1), "2028-02-29");
  assert.equal(offsetDailyDateKey("2026-12-31", 1), "2027-01-01");
});

test("daily archive month keys include only months intersecting the rolling window", () => {
  assert.deepEqual(dailyArchiveMonthKeys("2026-09-09"), [
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
  ]);
});
```

- [ ] **Step 2: Run the calendar tests and verify RED**

Run:

```powershell
node --import tsx --test test/daily-calendar.test.js
```

Expected: FAIL because the archive exports do not exist yet.

- [ ] **Step 3: Implement the pure date helpers**

Add to `src/daily-calendar.ts` after `dateKey(...)`:

```ts
export const DAILY_ARCHIVE_DAYS = 90;

export function isDailyDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const resolved = new Date(Date.UTC(year, month - 1, day));
  return resolved.getUTCFullYear() === year
    && resolved.getUTCMonth() === month - 1
    && resolved.getUTCDate() === day;
}

export function offsetDailyDateKey(dateKeyValue: string, dayOffset: number): string {
  if (!isDailyDateKey(dateKeyValue)) throw new RangeError(`Invalid daily date key: ${dateKeyValue}`);
  if (!Number.isSafeInteger(dayOffset)) throw new RangeError(`Invalid daily day offset: ${dayOffset}`);
  const [yearText, monthText, dayText] = dateKeyValue.split("-");
  const date = new Date(Date.UTC(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText) + dayOffset,
  ));
  return date.toISOString().slice(0, 10);
}

export function dailyArchiveWindow(currentDateKey: string): Readonly<{
  startDateKey: string;
  endDateKey: string;
  dateKeys: readonly string[];
}> {
  if (!isDailyDateKey(currentDateKey)) throw new RangeError(`Invalid daily date key: ${currentDateKey}`);
  const startDateKey = offsetDailyDateKey(currentDateKey, -(DAILY_ARCHIVE_DAYS - 1));
  const dateKeys = Object.freeze(
    Array.from({ length: DAILY_ARCHIVE_DAYS }, (_value, index) =>
      offsetDailyDateKey(startDateKey, index),
    ),
  );
  return Object.freeze({ startDateKey, endDateKey: currentDateKey, dateKeys });
}

export function isDailyArchiveDateAvailable(
  currentDateKey: string,
  targetDateKey: string,
): boolean {
  if (!isDailyDateKey(currentDateKey) || !isDailyDateKey(targetDateKey)) return false;
  const { startDateKey, endDateKey } = dailyArchiveWindow(currentDateKey);
  return targetDateKey >= startDateKey && targetDateKey <= endDateKey;
}

export function dailyArchiveMonthKeys(currentDateKey: string): readonly string[] {
  const { dateKeys } = dailyArchiveWindow(currentDateKey);
  return Object.freeze([...new Set(dateKeys.map((key) => key.slice(0, 7)))]);
}
```

Export the new symbols from `src/index.ts` alongside the existing Daily calendar exports.

- [ ] **Step 4: Run calendar tests and verify GREEN**

Run:

```powershell
node --import tsx --test test/daily-calendar.test.js
```

Expected: all Daily calendar tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/daily-calendar.ts src/index.ts test/daily-calendar.test.js
git commit -m "feat: add daily archive calendar window"
```

---

### Task 2: On-time Daily persistence and streak semantics

**Files:**
- Modify: `src/daily-progress.ts`
- Modify: `src/index.ts`
- Test: `test/daily-progress.test.js`

**Interfaces:**
- Consumes: `isDailyDateKey`, `offsetDailyDateKey`, `dailyArchiveWindow` from Task 1.
- Produces:
  - `DailyEntry = { solved: true; clean: boolean; completedOnTime: boolean }`
  - `DailyProgressSnapshot.bestStreak: number`
  - `markSolved(dateKey, { clean, currentDateKey })`
  - `streakSummary(currentDateKey): Readonly<{ currentStreak: number; bestStreak: number }>`
  - pruning by the rolling 90 **calendar-day** window, not the last 90 completed entries.

- [ ] **Step 1: Write failing persistence and streak tests**

Update the first test in `test/daily-progress.test.js` so every `markSolved` call supplies `currentDateKey`, then add:

```js
test("daily progress records on-time independently from best solved/clean result", () => {
  const store = new DailyProgressStore({ storage: new MemoryStorage() });

  store.markSolved("2026-09-08", { clean: false, currentDateKey: "2026-09-09" });
  assert.deepEqual(store.snapshot.entries["2026-09-08"], {
    solved: true,
    clean: false,
    completedOnTime: false,
  });

  store.markSolved("2026-09-08", { clean: true, currentDateKey: "2026-09-09" });
  assert.deepEqual(store.snapshot.entries["2026-09-08"], {
    solved: true,
    clean: true,
    completedOnTime: false,
  });

  store.markSolved("2026-09-09", { clean: false, currentDateKey: "2026-09-09" });
  assert.equal(store.snapshot.entries["2026-09-09"].completedOnTime, true);
});

test("normalization preserves old Daily result but never invents on-time completion", () => {
  const normalized = normalizeDailyProgress({
    version: 1,
    entries: {
      "2026-09-08": { solved: true, clean: true },
    },
    bestSolvedWeek: 4,
    bestCleanWeek: 2,
  });

  assert.deepEqual(normalized.entries["2026-09-08"], {
    solved: true,
    clean: true,
    completedOnTime: false,
  });
  assert.equal(normalized.bestStreak, 0);
});

test("current streak may continue from yesterday while today is still open", () => {
  const store = new DailyProgressStore({ storage: new MemoryStorage() });
  for (const dateKey of ["2026-09-06", "2026-09-07", "2026-09-08"]) {
    store.markSolved(dateKey, { clean: false, currentDateKey: dateKey });
  }

  assert.deepEqual(store.streakSummary("2026-09-09"), {
    currentStreak: 3,
    bestStreak: 3,
  });

  assert.deepEqual(store.streakSummary("2026-09-10"), {
    currentStreak: 0,
    bestStreak: 3,
  });
});

test("historical replay never repairs a missed streak", () => {
  const store = new DailyProgressStore({ storage: new MemoryStorage() });
  store.markSolved("2026-09-04", { clean: false, currentDateKey: "2026-09-04" });
  store.markSolved("2026-09-06", { clean: true, currentDateKey: "2026-09-06" });
  store.markSolved("2026-09-05", { clean: true, currentDateKey: "2026-09-08" });

  assert.equal(store.snapshot.entries["2026-09-05"].completedOnTime, false);
  assert.deepEqual(store.streakSummary("2026-09-08"), {
    currentStreak: 0,
    bestStreak: 1,
  });
});

test("prune retains only completed dates inside the rolling 90 calendar-day window", () => {
  const store = new DailyProgressStore({ storage: new MemoryStorage() });
  store.markSolved("2026-06-11", { clean: true, currentDateKey: "2026-06-11" });
  store.markSolved("2026-06-12", { clean: true, currentDateKey: "2026-06-12" });
  store.markSolved("2026-09-09", { clean: true, currentDateKey: "2026-09-09" });
  store.prune("2026-09-09");

  assert.equal(store.snapshot.entries["2026-06-11"], undefined);
  assert.ok(store.snapshot.entries["2026-06-12"]);
  assert.ok(store.snapshot.entries["2026-09-09"]);
});
```

Also update existing expected `DailyEntry` objects to include `completedOnTime`, and supply `currentDateKey` to all existing `markSolved` calls.

- [ ] **Step 2: Run Daily progress tests and verify RED**

```powershell
node --import tsx --test test/daily-progress.test.js
```

Expected: FAIL because `completedOnTime`, `bestStreak`, new `markSolved` options, and streak logic do not exist yet.

- [ ] **Step 3: Extend the snapshot without changing the storage key/version**

Modify `src/daily-progress.ts`:

```ts
import {
  dailyArchiveWindow,
  isDailyDateKey,
  offsetDailyDateKey,
} from "./daily-calendar.js";

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
```

`initialSnapshot()` must set `bestStreak: 0`. `cloneEntry()` must copy `completedOnTime`. `normalizeDailyProgress(...)` must accept old valid entries and normalize with:

```ts
completedOnTime: rawEntry.completedOnTime === true,
```

Normalize `bestStreak` with a non-negative safe-integer helper; absent or malformed values become `0`.

- [ ] **Step 4: Implement monotonic merge, rolling prune, and streaks**

Change `markSolved` to:

```ts
markSolved(
  dateKey: string,
  { clean = false, currentDateKey }: { clean?: boolean; currentDateKey: string },
): DailyProgressSnapshot {
  assertDateKey(dateKey);
  assertDateKey(currentDateKey);
  const previous = this.#snapshot.entries[dateKey];
  const next: DailyEntry = {
    solved: true,
    clean: previous?.clean === true || clean === true,
    completedOnTime:
      previous?.completedOnTime === true || dateKey === currentDateKey,
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
  if (changed) this.#persist();
  return this.snapshot;
}
```

Use `dailyArchiveWindow(nowDateKey).startDateKey` in `#pruneInMemory` and delete every entry outside `[startDateKey, nowDateKey]`.

Add:

```ts
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
```

Implement `#updateBestStreak()` by sorting all `completedOnTime` date keys and measuring consecutive `offsetDailyDateKey(previous, 1) === current`; update `this.#snapshot.bestStreak` with the maximum found before pruning.

- [ ] **Step 5: Run Daily progress tests and verify GREEN**

```powershell
node --import tsx --test test/daily-progress.test.js
```

Expected: all Daily progress tests PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- src/daily-progress.ts src/index.ts test/daily-progress.test.js
git commit -m "feat: track on-time daily streaks"
```

---

### Task 3: Make DailyBoardSession archive-safe

**Files:**
- Modify: `src/game/board/DailyBoardSession.ts`
- Test: `test/daily-board-session.test.js`

**Interfaces:**
- Consumes: Task 1 `isDailyArchiveDateAvailable`; Task 2 `markSolved(dateKey, { clean, currentDateKey })`.
- Produces `DailyCompletionResult` that records any in-window date and rejects only future/out-of-window dates.

- [ ] **Step 1: Replace the old expired-date contract with archive behavior tests**

Replace `Daily completion refuses an expired Moscow date and does not persist` with:

```js
test("Daily completion records an in-window historical date as off-time", () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });
  const session = new DailyBoardSession(puzzle(), progress);
  solve(session);

  const completion = session.complete("2026-09-09");

  assert.equal(completion.kind, "recorded");
  assert.equal(completion.completedOnTime, false);
  assert.deepEqual(progress.snapshot.entries[DATE_KEY], {
    solved: true,
    clean: true,
    completedOnTime: false,
  });
});

test("Daily completion rejects future and older-than-archive targets", () => {
  const progress = new DailyProgressStore({ storage: new MemoryStorage() });

  const future = new DailyBoardSession({ ...puzzle(), dateKey: "2026-09-10" }, progress);
  solve(future);
  assert.equal(future.complete("2026-09-09").kind, "outside-window");

  const old = new DailyBoardSession({ ...puzzle(), dateKey: "2026-06-11" }, progress);
  solve(old);
  assert.equal(old.complete("2026-09-09").kind, "outside-window");
});
```

Update existing `progress.snapshot.entries[...]` expectations to include `completedOnTime: true` where completion uses the same current date.

- [ ] **Step 2: Run session tests and verify RED**

```powershell
node --import tsx --test test/daily-board-session.test.js
```

Expected: FAIL because current code returns `expired` whenever dates differ.

- [ ] **Step 3: Implement archive-safe completion**

In `DailyBoardSession.ts`, import `isDailyArchiveDateAvailable` and replace `expired` with:

```ts
export type DailyCompletionResult =
  | Readonly<{ kind: "not-cleared" }>
  | Readonly<{ kind: "outside-window"; dateKey: string }>
  | Readonly<{
      kind: "recorded";
      dateKey: string;
      clean: boolean;
      completedOnTime: boolean;
      snapshot: DailyProgressSnapshot;
    }>;
```

Implement `complete(currentDateKey)` as:

```ts
if (!this.board.won) return Object.freeze({ kind: "not-cleared" as const });
if (!isDailyArchiveDateAvailable(currentDateKey, this.daily.dateKey)) {
  return Object.freeze({ kind: "outside-window" as const, dateKey: this.daily.dateKey });
}
const clean = this.cleanEligible;
const completedOnTime = currentDateKey === this.daily.dateKey;
const snapshot = this.progress.markSolved(this.daily.dateKey, {
  clean,
  currentDateKey,
});
return Object.freeze({
  kind: "recorded" as const,
  dateKey: this.daily.dateKey,
  clean,
  completedOnTime,
  snapshot,
});
```

- [ ] **Step 4: Run session tests and verify GREEN**

```powershell
node --import tsx --test test/daily-board-session.test.js
```

Expected: all Daily board-session tests PASS; Hint/Rescue/Undo behavior remains green.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- src/game/board/DailyBoardSession.ts test/daily-board-session.test.js
git commit -m "feat: allow historical daily completion"
```

---

### Task 4: Pure Daily archive month model

**Files:**
- Create: `src/daily-archive.ts`
- Modify: `src/index.ts`
- Create: `test/daily-archive.test.js`

**Interfaces:**
- Consumes: `dailyArchiveMonthKeys`, `isDailyArchiveDateAvailable`, `offsetDailyDateKey`, `DailyProgressSnapshot`, `DailyDayState`.
- Produces:
  - `DailyArchiveCell`
  - `DailyArchiveMonthModel`
  - `createDailyArchiveMonth(currentDateKey, monthKey, snapshot)`

- [ ] **Step 1: Write failing month-model tests**

Create `test/daily-archive.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createDailyArchiveMonth } from "../src/index.js";

const snapshot = {
  version: 1,
  entries: {
    "2026-09-01": { solved: true, clean: false, completedOnTime: true },
    "2026-09-05": { solved: true, clean: true, completedOnTime: false },
  },
  bestSolvedWeek: 2,
  bestCleanWeek: 1,
  bestStreak: 1,
};

test("archive month model uses Monday-first cells and stored solved/clean state", () => {
  const model = createDailyArchiveMonth("2026-09-09", "2026-09", snapshot);
  assert.equal(model.monthKey, "2026-09");
  assert.equal(model.cells.length, 42);

  const sep1 = model.cells.find((cell) => cell?.dateKey === "2026-09-01");
  const sep5 = model.cells.find((cell) => cell?.dateKey === "2026-09-05");
  const sep9 = model.cells.find((cell) => cell?.dateKey === "2026-09-09");
  assert.equal(sep1?.weekdayIndex, 1);
  assert.equal(sep1?.state, "solved");
  assert.equal(sep5?.state, "clean");
  assert.equal(sep9?.today, true);
  assert.equal(sep9?.enabled, true);
});

test("archive month model disables future dates and dates outside the rolling window", () => {
  const september = createDailyArchiveMonth("2026-09-09", "2026-09", snapshot);
  assert.equal(september.cells.find((cell) => cell?.dateKey === "2026-09-10")?.enabled, false);

  const june = createDailyArchiveMonth("2026-09-09", "2026-06", snapshot);
  assert.equal(june.cells.find((cell) => cell?.dateKey === "2026-06-11")?.enabled, false);
  assert.equal(june.cells.find((cell) => cell?.dateKey === "2026-06-12")?.enabled, true);
});

test("archive month paging stops at months intersecting the 90-day window", () => {
  assert.deepEqual(
    createDailyArchiveMonth("2026-09-09", "2026-06", snapshot).previousMonthKey,
    undefined,
  );
  assert.equal(
    createDailyArchiveMonth("2026-09-09", "2026-06", snapshot).nextMonthKey,
    "2026-07",
  );
  assert.equal(
    createDailyArchiveMonth("2026-09-09", "2026-09", snapshot).nextMonthKey,
    undefined,
  );
});
```

- [ ] **Step 2: Run the model tests and verify RED**

```powershell
node --import tsx --test test/daily-archive.test.js
```

Expected: FAIL because `createDailyArchiveMonth` does not exist.

- [ ] **Step 3: Implement `src/daily-archive.ts`**

Use these public shapes:

```ts
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
```

Implementation rules:

```ts
export function createDailyArchiveMonth(
  currentDateKey: string,
  monthKey: string,
  snapshot: DailyProgressSnapshot,
): Readonly<DailyArchiveMonthModel> {
  const monthKeys = dailyArchiveMonthKeys(currentDateKey);
  const monthIndex = monthKeys.indexOf(monthKey);
  if (monthIndex < 0) throw new RangeError(`Daily archive month is outside the window: ${monthKey}`);

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
```

Export it from `src/index.ts`.

- [ ] **Step 4: Run model tests and verify GREEN**

```powershell
node --import tsx --test test/daily-archive.test.js
```

Expected: all archive model tests PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add -- src/daily-archive.ts src/index.ts test/daily-archive.test.js
git commit -m "feat: add daily archive month model"
```

---

### Task 5: DailyArchiveScene, Home entry, and utility navigation

**Files:**
- Create: `src/game/scenes/DailyArchiveScene.ts`
- Modify: `src/main.ts`
- Modify: `src/game/scenes/MenuScene.ts`
- Modify: `src/game/presentation-model.ts`
- Modify: `src/game/scenes/RulesScene.ts`
- Modify: `src/game/scenes/SettingsScene.ts`
- Test: `test/daily-archive-scene-contract.test.js`
- Test: `test/utility-navigation.test.js`
- Test: `test/sticky-banner.test.js`

**Interfaces:**
- Consumes: `DailyProgressStore.streakSummary`, `createDailyArchiveMonth`, `dailyDateKey`, `getTrustedClock`, existing minimal UI helpers.
- Produces scene key `daily-archive` and board launch data `{ mode: PlayMode.DAILY, dailyDateKey, dailyReturnTarget: "daily-archive" }`.

- [ ] **Step 1: Write failing scene/navigation contracts**

Create `test/daily-archive-scene-contract.test.js`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("DailyArchiveScene is registered and uses trusted time plus the rolling month model", async () => {
  const [main, archive] = await Promise.all([
    read("../src/main.ts"),
    read("../src/game/scenes/DailyArchiveScene.ts"),
  ]);
  assert.match(main, /DailyArchiveScene/);
  assert.match(main, /scene: \[[^\]]*DailyArchiveScene/s);
  assert.match(archive, /super\("daily-archive"\)/);
  assert.match(archive, /getTrustedClock\(\)\.now\(\)/);
  assert.match(archive, /createDailyArchiveMonth\(/);
  assert.match(archive, /streakSummary\(/);
  assert.match(archive, /showStickyBanner\(\)/);
});

test("Home exposes archive only as part of the unlocked Daily card", async () => {
  const menu = await read("../src/game/scenes/MenuScene.ts");
  assert.match(menu, /dailyArchiveButton/);
  assert.match(menu, /АРХИВ · 90 ДНЕЙ/);
  assert.match(menu, /this\.model\.showDaily/);
  assert.match(menu, /scene\.start\("daily-archive"\)/);
  assert.doesNotMatch(menu, /id:\s*"daily-archive"/);
});

test("archive date selection launches explicit Daily date and archive return target", async () => {
  const archive = await read("../src/game/scenes/DailyArchiveScene.ts");
  assert.match(archive, /mode:\s*PlayMode\.DAILY/);
  assert.match(archive, /dailyDateKey:\s*dateKey/);
  assert.match(archive, /dailyReturnTarget:\s*"daily-archive"/);
});
```

Add to `test/utility-navigation.test.js`:

```js
test("utility scenes resume Daily archive as a covered root", () => {
  const scene = fakeScene("settings");
  closeUtilityScene(scene, "daily-archive");
  assert.deepEqual(scene.calls, [
    ["stop", "settings"],
    ["resume", "daily-archive"],
    ["bringToTop", "daily-archive"],
  ]);
});
```

- [ ] **Step 2: Run scene/navigation tests and verify RED**

```powershell
node --import tsx --test test/daily-archive-scene-contract.test.js test/utility-navigation.test.js test/sticky-banner.test.js
```

Expected: FAIL because the scene, Home action, and utility root do not exist.

- [ ] **Step 3: Add `daily-archive` as a resumable utility root**

In `src/game/presentation-model.ts`:

```ts
export type UtilityRootSceneKey =
  | "board"
  | "level-select"
  | "menu"
  | "leaderboard"
  | "daily-archive";
```

Update `utilityReturnPlan` so `daily-archive` joins `board` and `leaderboard` in the `resume` branch.

Add `"daily-archive"` to `RETURN_SCENES` in both `RulesScene.ts` and `SettingsScene.ts`.

- [ ] **Step 4: Implement `DailyArchiveScene`**

Create a minimal Phaser scene using existing `makeMinimalText`, `makeMinimalButton`, `makeMinimalCard`, and `ContextMenuOverlay`.

Required state:

```ts
currentDateKey = "";
monthKey = "";
english = false;
loading = true;
progress!: DailyProgressStore;
monthModel: DailyArchiveMonthModel | null = null;
dayButtons: MinimalButton[] = [];
```

Create exactly 42 reusable day buttons. Each button callback reads its current bound `dateKey`; disabled/null cells stay non-interactive. The scene must:

```ts
const trustedNow = await getTrustedClock().now();
if (!trustedNow) {
  // status: "АРХИВ ВРЕМЕННО НЕДОСТУПЕН" / "ARCHIVE TEMPORARILY UNAVAILABLE"
  // keep month navigation and day buttons disabled
  return;
}
this.currentDateKey = dailyDateKey(trustedNow);
this.progress.prune(this.currentDateKey);
this.monthKey = this.currentDateKey.slice(0, 7);
this.refreshMonth();
```

`refreshMonth()` calls `createDailyArchiveMonth(...)`, renders `◆`, `✓`, `·`, and an additional today marker in text so state is not color-only, and renders:

```text
СЕРИЯ <current> · ЛУЧШАЯ <best>
```

Month arrows use `previousMonthKey`/`nextMonthKey` and are disabled when absent.

Selecting an enabled cell must call:

```ts
this.scene.start("board", {
  mode: PlayMode.DAILY,
  dailyDateKey: dateKey,
  dailyReturnTarget: "daily-archive",
});
```

The context menu contains Rules, Settings, Home. Rules/Settings use `openUtilityScene(..., { returnScene: "daily-archive" })`.

- [ ] **Step 5: Register the scene and add the Home archive action**

Import/register `DailyArchiveScene` in `src/main.ts` before `BoardScene`.

In `MenuScene.ts` add:

```ts
dailyArchiveButton!: MinimalButton;
```

Create it with label `ARCHIVE · 90 DAYS` / `АРХИВ · 90 ДНЕЙ`, and callback:

```ts
if (this.model.showDaily && this.dailyReady) this.scene.start("daily-archive");
```

`setDailyVisible` must also set archive-button visibility. `refreshDailyCard` must enable it only when trusted Daily time is ready. It must not be added to `☰`.

Layout rule:
- normal layout: put the archive button directly below the Daily card at height 28, then shift Endless/Chapters downward by 32 px;
- short landscape with Daily+Endless side-by-side: put the archive button below the Daily half-card at height 26, and move Chapters below the lower of the archive button/Endless card.

- [ ] **Step 6: Run scene/navigation tests and verify GREEN**

```powershell
node --import tsx --test test/daily-archive-scene-contract.test.js test/utility-navigation.test.js test/sticky-banner.test.js
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit Task 5**

```powershell
git add -- src/main.ts src/game/scenes/DailyArchiveScene.ts src/game/scenes/MenuScene.ts src/game/presentation-model.ts src/game/scenes/RulesScene.ts src/game/scenes/SettingsScene.ts test/daily-archive-scene-contract.test.js test/utility-navigation.test.js test/sticky-banner.test.js
git commit -m "feat: add playable daily archive scene"
```

---

### Task 6: Explicit Daily board launch and archive return flow

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/scenes/MenuScene.ts`
- Test: `test/daily-board-session.test.js`
- Create: `test/daily-archive-board-flow.test.js`
- Modify: `test/interstitial-ads.test.js`

**Interfaces:**
- Consumes:
  - Home launch `{ mode: PlayMode.DAILY, dailyDateKey: todayKey, dailyReturnTarget: "home" }`
  - Archive launch `{ mode: PlayMode.DAILY, dailyDateKey: selectedKey, dailyReturnTarget: "daily-archive" }`
  - `DailyBoardSession.complete(currentDateKey)` from Task 3.
- Produces explicit `BoardScene` Daily init context and destination-aware completion overlay.

- [ ] **Step 1: Write failing board-flow contracts**

Create `test/daily-archive-board-flow.test.js`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const boardSource = () => readFile(
  new URL("../src/game/scenes/BoardScene.ts", import.meta.url),
  "utf8",
);

test("BoardScene init keeps Daily target date and return target explicit", async () => {
  const source = await boardSource();
  assert.match(source, /dailyDateKey\?:/);
  assert.match(source, /dailyReturnTarget\?:/);
  assert.match(source, /"home"\s*\|\s*"daily-archive"/);
});

test("Daily generation uses requested archive date after trusted-window validation", async () => {
  const source = await boardSource();
  assert.match(source, /isDailyArchiveDateAvailable\(/);
  assert.match(source, /generateDaily\(.*dailyDateKey/s);
  assert.doesNotMatch(source, /const dateKey = dailyDateKey\(trustedNow\);\s*const generated = await this\.generator\.generateDaily\(dateKey\)/s);
});

test("archive-origin Daily result returns through an interstitial to archive", async () => {
  const source = await boardSource();
  assert.match(source, /BACK TO ARCHIVE|В АРХИВ/);
  assert.match(source, /dailyReturnTarget/);
  assert.match(source, /runInterstitialBefore\([\s\S]*daily-archive/);
});

test("Daily result no longer treats any date rollover as an automatic expiry", async () => {
  const source = await boardSource();
  assert.doesNotMatch(source, /NEW DAILY AVAILABLE|ДОСТУПНА НОВАЯ ЕЖЕДНЕВНАЯ ЗАДАЧА/);
  assert.match(source, /outside-window/);
});
```

- [ ] **Step 2: Run board-flow tests and verify RED**

```powershell
node --import tsx --test test/daily-archive-board-flow.test.js test/daily-board-session.test.js test/interstitial-ads.test.js
```

Expected: FAIL because BoardScene currently always generates Daily from the current trusted date and always returns Daily result to Home.

- [ ] **Step 3: Extend BoardScene init parsing**

Add:

```ts
type DailyReturnTarget = "home" | "daily-archive";

type BoardInitData = {
  mode?: PlayModeValue;
  level?: number;
  runSeed?: string;
  dailyDateKey?: string;
  dailyReturnTarget?: DailyReturnTarget;
};
```

`boardInitData(data)` must accept `dailyDateKey` only when `isDailyDateKey(...)` is true, and `dailyReturnTarget` only when it is exactly `"home"` or `"daily-archive"`.

Add BoardScene fields:

```ts
dailyTargetDateKey = "";
dailyReturnTarget: DailyReturnTarget = "home";
```

Reset them in constructor/init. For Daily mode, copy validated init values; for other modes keep defaults.

- [ ] **Step 4: Generate the requested Daily only inside the trusted archive window**

In the Daily branch of `loadLevel()`:

```ts
const trustedNow = await getTrustedClock().now();
if (!trustedNow) throw new Error(this.uiText(
  "НЕДОСТУПНО ДОВЕРЕННОЕ ВРЕМЯ ЯНДЕКСА",
  "YANDEX TRUSTED TIME IS UNAVAILABLE",
));
const currentDateKey = dailyDateKey(trustedNow);
const targetDateKey = this.dailyTargetDateKey || currentDateKey;
if (!isDailyArchiveDateAvailable(currentDateKey, targetDateKey)) {
  throw new RangeError(this.uiText(
    "ЭТА ЕЖЕДНЕВНАЯ ЗАДАЧА БОЛЬШЕ НЕДОСТУПНА",
    "THIS DAILY PUZZLE IS NO LONGER AVAILABLE",
  ));
}
const generated = await this.generator.generateDaily(targetDateKey);
const session = new DailyBoardSession(generated, this.dailyProgress);
this.dailySession = session;
```

Home's `activateDaily()` must now pass the already trusted `this.model.daily.dateKey` explicitly:

```ts
this.scene.start("board", {
  mode: PlayMode.DAILY,
  dailyDateKey: this.model.daily.dateKey,
  dailyReturnTarget: "home",
});
```

- [ ] **Step 5: Make Daily completion destination-aware**

In `completeDailyBoard()` keep the trusted-clock recheck. Call `session.complete(currentDateKey)`.

If result is `outside-window`, display the existing safe error state and after 1200 ms route to `daily-archive` when `dailyReturnTarget === "daily-archive"`, otherwise Home.

For `recorded`, keep the existing status/Clean detail. Choose primary label and primary action:

```ts
const returnToArchive = this.dailyReturnTarget === "daily-archive";
const primaryLabel = returnToArchive
  ? this.uiText("В АРХИВ", "BACK TO ARCHIVE")
  : this.uiText("НА ГЛАВНУЮ", "HOME");
const primaryAction = returnToArchive
  ? () => this.scene.start("daily-archive")
  : () => this.openMainMenu();
```

Run `primaryAction` through `runInterstitialBefore(...)`, preserving current Daily interstitial policy. Keep `TRY CLEAN` as a direct replay with no interstitial and the same target/return context.

Remove the old `expired` / `NEW DAILY AVAILABLE` branch.

- [ ] **Step 6: Verify Daily HUD identity shows the target date**

Keep the existing Daily HUD expression based on `this.dailySession?.daily.dateKey`; add a regression assertion to `test/daily-archive-board-flow.test.js`:

```js
assert.match(source, /dailySession\?\.daily\.dateKey/);
```

This guarantees a historical replay visibly identifies the selected date rather than today's date.

- [ ] **Step 7: Run focused Daily/ads tests and verify GREEN**

```powershell
node --import tsx --test test/daily-archive-board-flow.test.js test/daily-board-session.test.js test/interstitial-ads.test.js test/rewarded-ux-contract.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 8: Commit Task 6**

```powershell
git add -- src/game/scenes/BoardScene.ts src/game/scenes/MenuScene.ts test/daily-archive-board-flow.test.js test/daily-board-session.test.js test/interstitial-ads.test.js
git commit -m "feat: route historical daily board flow"
```

---

### Task 7: Product documentation and full release gate

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `PROJECT.md`
- Modify: `VALIDATION.md`
- Modify: `docs/functional-redesign-acceptance.md`
- Test: full test suite

**Interfaces:**
- Consumes: completed Tasks 1-6.
- Produces: documented Daily Archive release behavior and a manual acceptance matrix.

- [ ] **Step 1: Update product truth**

Add these exact product facts to `CURRENT_STATE.md` and `PROJECT.md` in the Daily section:

```text
- Daily Archive is a playable rolling 90-day library using trusted Europe/Moscow time.
- Historical Daily can be replayed and upgraded from Solved to Clean.
- Daily streak counts only completions recorded on the target Daily's own trusted date.
- Completing a missed historical date never repairs a streak retroactively.
- Archive-origin Daily returns to Daily Archive after completion.
```

Do not add Statistics, XP, or Daily leaderboard claims.

- [ ] **Step 2: Add manual Daily Archive acceptance cases**

Append to `VALIDATION.md` and `docs/functional-redesign-acceptance.md`:

```text
DA-01  Home shows ARCHIVE · 90 DAYS only after Daily unlocks.
DA-02  Archive opens on trusted current Moscow month and shows only months intersecting the 90-day window.
DA-03  Future dates and dates older than today-89 are not playable.
DA-04  Historical date launches the deterministic Daily for that exact dateKey.
DA-05  Historical Solved replay can upgrade to Clean; Clean never downgrades.
DA-06  Historical completion does not repair Daily streak.
DA-07  Today's Daily launched from Archive can count on time but still returns to Archive.
DA-08  Archive -> Rules/Settings -> Back resumes Archive without resetting the selected month.
DA-09  Archive-origin completion primary action returns to Archive after the normal Daily interstitial opportunity.
DA-10  Trusted-time failure disables Archive instead of falling back to device time.
DA-11  Mobile landscape keeps month arrows, 7-column calendar, streak header, and date cells readable/clickable.
```

- [ ] **Step 3: Run the full automated suite**

```powershell
pnpm test
```

Expected: 0 failures. Existing skips are acceptable only if they are the previously known optional integration skips; no new skips may be added for Daily Archive.

- [ ] **Step 4: Run full typecheck**

```powershell
pnpm typecheck
```

Expected: exit code 0, no TypeScript errors.

- [ ] **Step 5: Run production build**

```powershell
pnpm build
```

Expected: Vite build exits 0. The existing large-chunk warning is non-blocking unless its severity changes.

- [ ] **Step 6: Run Yandex dev smoke test manually**

```powershell
pnpm yandex:dev
```

Manual checks:

```text
1. Unlock/test-mode Daily and open ARCHIVE · 90 DAYS.
2. Page to the oldest available month and verify the first enabled day is exactly today-89.
3. Open a missed historical day, solve with Hint, and verify ✓ without streak repair.
4. Replay the same date without assistance and verify ◆.
5. Open today's date from Archive, solve it, and verify streak can advance.
6. Confirm the result returns to Archive and the calendar refreshes immediately.
7. Open Rules and Settings from Archive, then Back, and verify the same archive month remains visible.
8. Resize to short mobile landscape and verify no calendar/date control overlaps.
```

- [ ] **Step 7: Commit documentation and acceptance updates**

```powershell
git add -- CURRENT_STATE.md PROJECT.md VALIDATION.md docs/functional-redesign-acceptance.md
git commit -m "docs: add daily archive acceptance"
```

---

## Plan self-review

**Spec coverage:**
- 90-day trusted window: Task 1.
- On-time persistence, monotonic Solved/Clean, streak semantics, old dev-save normalization: Task 2.
- Historical completion and no automatic expiry on rollover: Task 3.
- Calendar month paging and state model: Task 4.
- Home entry, archive UI, sticky banner, Rules/Settings return: Task 5.
- Deterministic selected-date generation, result routing, ads, Clean/assistance behavior: Task 6.
- Documentation, mobile manual checks, typecheck/test/build/Yandex smoke: Task 7.

**Placeholder scan:** No `TODO`, `TBD`, "implement later", or unspecified error-handling steps remain in the plan.

**Type consistency:** `dailyDateKey` is the selected Daily target in board init; `dailyReturnTarget` is exactly `"home" | "daily-archive"`; `completedOnTime` is stored only in `DailyEntry`; `currentDateKey` is always sourced from trusted Yandex time before persistence or archive-bound decisions.
