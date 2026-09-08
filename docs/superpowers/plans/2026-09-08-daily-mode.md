# Daily Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one deterministic Moscow-calendar puzzle per day with Solved/Clean replayability, rolling 90-day history, weekly summary, and shared Hint/Rescue rules.

**Architecture:** Date/week calculations and persistence are pure modules. Daily generation runs in the existing worker using the generic candidate/scorer pipeline from Plan 1 and a deterministic day seed. `BoardScene` reuses the assistance/session semantics from Plan 3 via a Daily session wrapper, while Home only displays the current day/week summary. Calendar decisions use `getTrustedClock()` backed by `ysdk.serverTime()`; device `Date.now()` is not an authority for Daily rollover.

**Tech Stack:** TypeScript, Phaser, `Intl.DateTimeFormat`, `node:test`, existing worker and rewarded-ad adapter.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- Day boundary: 00:00 `Europe/Moscow`; week Monday–Sunday in same timezone.
- Seed namespace: `daily-v1:YYYY-MM-DD`.
- Daily unlocks after five solved campaign levels.
- One puzzle per date, replayable any number of times that same day; missed days are not backfilled.
- Per date persist Solved/Clean; Undo/Restart preserve Clean, Hint/Rescue invalidate current attempt.
- Keep latest 90 daily entries plus aggregate best solved/clean week counts.
- Daily has no currency/chest/reward; Hint/Rescue use rewarded ads.

---

### Task 1: Moscow day/week key utilities

**Files:**
- Create: `src/daily-calendar.ts`
- Modify: `src/index.ts`
- Test: `test/daily-calendar.test.js`

**Interfaces:**
- Produces `dailyDateKey(now)`, `dailyWeekKey(now)`, `dailyWeekdayIndex(now)`, `datesForMoscowWeek(now)`.

- [ ] **Step 1: Write boundary tests using UTC instants**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { dailyDateKey, dailyWeekdayIndex } from "../src/index.js";

test("daily boundary is midnight Moscow", () => {
  assert.equal(dailyDateKey(new Date("2026-09-07T20:59:59Z")), "2026-09-07");
  assert.equal(dailyDateKey(new Date("2026-09-07T21:00:00Z")), "2026-09-08");
});

test("Moscow week indexes Monday as zero", () => {
  assert.equal(dailyWeekdayIndex(new Date("2026-09-07T12:00:00Z")), 0);
  assert.equal(dailyWeekdayIndex(new Date("2026-09-13T12:00:00Z")), 6);
});
```

- [ ] **Step 2: Implement with `Intl.DateTimeFormat`**

Use one formatter with `timeZone: "Europe/Moscow"`, `calendar: "gregory"`, numeric year/month/day and short weekday. Build date keys from `formatToParts`; do not rely on browser-local timezone.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/daily-calendar.test.js
git add src/daily-calendar.ts src/index.ts test/daily-calendar.test.js
git commit -m "feat: define Moscow daily calendar boundaries"
```

---

### Task 2: Daily progress store with rolling 90 days and weekly aggregates

**Files:**
- Create: `src/daily-progress.ts`
- Modify: `src/index.ts`
- Test: `test/daily-progress.test.js`

**Interfaces:**
- Produces `DailyProgressStore`, `DailyProgressSnapshot`, `markSolved(date,{clean})`, `weekSummary(date)`, `prune(nowDateKey)`.
- Storage key: `garden-js.daily-progress.v1`.

- [ ] **Step 1: Write persistence/upgrade tests**

Test that Solved can later upgrade to Clean, never downgrade; entries older than latest 90 sorted date keys are pruned after their week summary updates aggregate bests; reload reproduces current entries.

- [ ] **Step 2: Implement snapshot**

```ts
export interface DailyEntry { solved: true; clean: boolean }
export interface DailyProgressSnapshot {
  version: 1;
  entries: Record<string, DailyEntry>;
  bestSolvedWeek: number;
  bestCleanWeek: number;
}
```

`markSolved` sets `{ solved:true, clean: previous.clean || clean }`. `weekSummary` returns seven date keys with state `missing|solved|clean`, plus solved/clean counts. Pruning retains the lexicographically latest 90 ISO date keys.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/daily-progress.test.js
git add src/daily-progress.ts src/index.ts test/daily-progress.test.js
git commit -m "feat: persist daily clean history"
```

---

### Task 3: Deterministic Daily puzzle generation and weekly difficulty rhythm

**Files:**
- Create: `src/daily.ts`
- Modify: `src/generator-worker.ts`
- Modify: `src/browser.ts`
- Modify: `src/index.ts`
- Test: `test/daily.test.js`

**Interfaces:**
- Produces `DailyPuzzle`, `dailyDifficultyProfile(dateKey)`, `generateDailyPuzzle(dateKey)` and browser worker method.

- [ ] **Step 1: Write determinism/quality tests**

```js
const first = generateDailyPuzzle("2026-09-08");
const second = generateDailyPuzzle("2026-09-08");
assert.deepEqual(first.pieces, second.pieces);
assert.deepEqual(first.solution, second.solution);
assert.equal(replaySolution(first.pieces, first.solution), true);
assert.equal(first.seed, "daily-v1:2026-09-08");
```

Also assert Monday–Thursday profile `medium`, Friday `mediumHard`, Saturday `hard`, Sunday `challenge` for known date keys.

- [ ] **Step 2: Implement internal weekly profile mapping**

```ts
export type DailyDifficultyBand = "medium" | "mediumHard" | "hard" | "challenge";
```

Map weekday indices 0..3 -> medium, 4 -> mediumHard, 5 -> hard, 6 -> challenge. Define each band as a fixed `DifficultyProfile` target using the same axes as Plan 1.

- [ ] **Step 3: Generate a bounded deterministic candidate pool**

For Daily V1 choose medium plate (61) Mon–Fri and large plate (91) Sat/Sun. Generate 16 candidates from seeds `${dailySeed}:candidate:<index>`, analyze/rank, and choose the first accepted candidate. The candidate's `plateCells` must be full canonical plate. Throw a descriptive generation error if none passes; do not silently return an unsolved board.

- [ ] **Step 4: Add worker kind `daily`**

`BrowserLevelGenerator.generateDaily(dateKey)` posts `{ kind:"daily", dateKey }`; worker returns serialized result; browser reconstructs `GardenBoard`.

- [ ] **Step 5: Run and commit**

```bash
node --import tsx --test test/daily.test.js test/difficulty-profiles.test.js test/puzzle-generation.test.js
pnpm typecheck
git add src/daily.ts src/generator-worker.ts src/browser.ts src/index.ts test/daily.test.js
git commit -m "feat: generate shared deterministic daily puzzle"
```

---

### Task 4: Daily board session reuses Clean/assistance semantics

**Files:**
- Create: `src/game/board/DailyBoardSession.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Test: `test/daily-board-session.test.js`

**Interfaces:**
- Daily session API mirrors Campaign session: history, Undo, Restart, `cleanEligible`, one Rescue.
- On successful clear writes to `DailyProgressStore` for the current date key.

- [ ] **Step 1: Unit-test replay and Clean upgrade**

Start Daily, use Hint -> solve -> store `{clean:false}`. Start a fresh replay same day, solve without assistance -> store upgrades to `{clean:true}`. Undo alone does not invalidate Clean.

- [ ] **Step 2: Implement Daily session**

Share common history/attempt logic by extracting a tiny `BaseBoardAttempt` from Campaign session if duplication would otherwise exceed ~40 lines. Do not merge Campaign progression responsibilities into Daily.

- [ ] **Step 3: Add `PlayMode.DAILY` loading in BoardScene**

Resolve trusted time with `await getTrustedClock().now()` at mode entry; if it is unavailable, do not start Daily. Build `dateKey = dailyDateKey(trustedNow)` and request that worker puzzle. Before accepting any completion, fetch trusted time again and verify `dailyDateKey(trustedNow) === dateKey`. If the Moscow day rolled over mid-attempt, mark the attempt expired, do **not** record the old Daily result, show a short localized `NEW DAILY AVAILABLE` message, and return Home so the new date can be started. This enforces the spec's rule that a Daily is playable only during its calendar day.

- [ ] **Step 4: Use rewarded Hint/Rescue and one Rescue per attempt**

Reuse `BoardAssistance`; Daily `rewardRequired` is always true. True-dead-end semantics are identical to Campaign.

- [ ] **Step 5: Run and commit**

```bash
node --import tsx --test test/daily-board-session.test.js test/daily-progress.test.js test/assistance-policy.test.js
pnpm typecheck
git add src/game/board/DailyBoardSession.ts src/game/scenes/BoardScene.ts test/daily-board-session.test.js
git commit -m "feat: play daily with clean assistance rules"
```

---

### Task 5: Home Daily card and seven-slot current-week history

**Files:**
- Modify: `src/game/home-model.ts`
- Modify: `src/game/scenes/MenuScene.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Test: `test/ui-state-model.test.js`

**Interfaces:**
- Home Daily model includes `todayState` and seven current-week states.

- [ ] **Step 1: Extend Home model tests**

At five campaign solves, Daily is visible. Before today's solve state is `open`; after Solved it shows `✓`; after Clean `◆`. Weekly states map seven Moscow date keys.

- [ ] **Step 2: Render primitive Daily card**

Display localized `ЕЖЕДНЕВНАЯ ЗАДАЧА`, today's `Новая/✓/◆`, and compact seven marks. Clicking starts `BoardScene` in `PlayMode.DAILY`. No coin/reward copy.

- [ ] **Step 3: Completion returns Home**

Daily completion overlay shows Solved/Clean and current week count, with primary Home/Done action and optional `Try Clean` if assisted. Do not create a “Next Daily”.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/ui-state-model.test.js test/daily-progress.test.js
pnpm build
git add src/game/home-model.ts src/game/scenes/MenuScene.ts src/game/scenes/BoardScene.ts test/ui-state-model.test.js
git commit -m "feat: surface daily weekly history on home"
```

## Plan 4 completion check

```bash
pnpm test
pnpm typecheck
pnpm build
```

Manual time-boundary smoke with injected/fake dates around 20:59:59Z/21:00:00Z; verify same date yields same board after refresh, old days are not selectable, Daily can be replayed for Clean, and no rewards/currency appear.
