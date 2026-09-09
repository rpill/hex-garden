# Daily Archive Design

**Date:** 2026-09-09  
**Status:** Approved in chat; ready for implementation planning after user review  
**Project:** Hex Garden / Yandex Games

## Goal

Turn Daily from a one-day-only challenge into a compact 90-day retention loop without adding a statistics subsystem or XP progression.

The archive is a playable library of Daily puzzles. A player can revisit any of the last 90 dates, replay solved days, and improve a day from `Solved` to `Clean`. The Daily streak remains meaningful because only completion on the puzzle's real calendar day counts toward streaks.

## Product principles

- The archive is **playable content**, not a statistics screen.
- No XP level, lifetime-statistics store, or unrelated meta-progression is introduced.
- Daily streak is a return incentive and is earned only by solving the current Daily on time.
- Historical replay can improve a date's result but can never repair a missed streak retroactively.
- Existing Daily rules, assistance policy, monetization policy, and Clean eligibility remain authoritative.

## Scope

### In scope

- A `Daily Archive` entry on the Home Daily card.
- A calendar-style archive covering exactly the trusted current date plus the previous 89 dates.
- Playing any available date in that window.
- Replaying solved/clean historical dates.
- Upgrading `Solved -> Clean` on replay.
- Tracking whether a date was completed on time.
- Daily streak derived only from on-time solved/clean dates.
- Returning from an archive-origin Daily result back to the archive.
- The same rewarded Hint/Rescue and interstitial policies as normal Daily gameplay.
- Mobile-landscape-friendly month navigation.

### Out of scope

- XP levels.
- A global Statistics screen.
- Lifetime counters such as total attempts, total restarts, total hints, or total rescues.
- Daily leaderboard.
- Repairing streaks by completing old puzzles.
- Playing dates older than the 90-day rolling window.
- Playing future dates.
- New puzzle-generation rules specifically for the archive.

## Unlock and entry point

Daily Archive unlocks at the same time as Daily itself. It does not get a separate unlock condition.

The Home Daily card keeps the existing primary action for today's Daily and adds a secondary action:

```text
DAILY
Сегодня · НОВАЯ
[ ИГРАТЬ ]

АРХИВ · 90 ДНЕЙ
```

The archive is intentionally not placed in the global `☰` menu. It is part of the Daily feature and should be discovered from the Daily card.

## Trusted date and window

All archive availability is based on the same trusted Yandex clock used by the current Daily flow, interpreted in `Europe/Moscow`.

For trusted current `dateKey = T`, the playable archive window is:

```text
T - 89 calendar days ... T
```

This is exactly 90 dates, inclusive of today.

Rules:

- `dateKey > T`: unavailable.
- `dateKey < T - 89 days`: unavailable.
- If trusted time cannot be obtained, the archive is temporarily unavailable.
- The implementation must not fall back to the device's local clock for archive bounds or streak decisions.

## Daily result persistence

A completed date needs two independent pieces of information:

1. the best result ever achieved for that date;
2. whether the date was ever completed on time.

Canonical logical shape:

```ts
type DailyResult = "solved" | "clean";

interface DailyDayRecord {
  dateKey: string;
  result: DailyResult;
  completedOnTime: boolean;
}
```

Only completed dates need records. Missing dates inside the current 90-day window render as missed/uncompleted dates.

### Merge rules

Recording a new completion merges monotonically:

- no record + assisted completion -> `Solved`;
- no record + clean completion -> `Clean`;
- `Solved` + assisted replay -> remains `Solved`;
- `Solved` + clean replay -> becomes `Clean`;
- `Clean` + any replay -> remains `Clean`;
- `completedOnTime=true` can never become false;
- an off-time replay can never turn `completedOnTime=false` into true.

In other words:

```text
result          = max(previousResult, newResult) where Clean > Solved
completedOnTime = previous.completedOnTime OR newCompletionIsOnTime
```

## On-time definition

A completion is on time only when the target Daily date equals the trusted Moscow date at the moment the result is recorded:

```text
targetDateKey === trustedCurrentDateKey
```

The origin screen does not decide this. Opening today's date from the archive can still count on time because it targets today. Opening yesterday's date from any screen cannot count on time.

If trusted time is unavailable when a completion needs to be recorded, the game must not invent an on-time completion. The existing safe Daily time handling should be reused rather than falling back to local time.

## Streak semantics

Daily streak uses **any on-time completion**, whether the best result for that date is `Solved` or `Clean`.

Historical completion never fills a gap in the streak.

Example:

```text
Sep 4  on-time Solved  -> streak date
Sep 5  missed          -> gap
Sep 6  on-time Clean   -> new streak starts
Sep 8  replay Sep 5    -> Sep 5 may become Solved/Clean,
                          but Sep 5 remains absent from streak history
```

Streak values are derived from `completedOnTime` dates only:

- `bestStreak` is the longest consecutive sequence of dates with an on-time Solved or Clean completion.
- `currentStreak` counts backward from today if today is completed on time.
- If today is still unfinished, `currentStreak` may count backward from yesterday; the still-open current day does not break the streak before it ends.
- Once trusted time advances past an unfinished day, that missed day is a real gap.

The archive may show compact retention information such as current and best Daily streak in its header, but it must not grow into a general statistics page.

## Puzzle identity and generation

The archive must generate the same Daily puzzle for a given `dateKey` that the normal Daily flow would generate for that date.

The archive does not copy or store full boards merely to support replay. It routes the selected historical `dateKey` into the existing deterministic Daily generation path.

### Stability constraint

Once a Daily generation algorithm has shipped, historical date identity must remain stable for the 90-day replay promise. Future changes to Daily generation must preserve the old generator for dates that were originally assigned to it, rather than silently changing a previously published Daily puzzle.

This is a compatibility constraint for future generator changes; it does not require a second generator in the first implementation.

## Archive calendar UX

### Default view

The archive opens on the trusted current month.

Because 90 rolling days can span multiple calendar months, the archive uses month paging rather than rendering 90 date cells at once.

```text
<  СЕНТЯБРЬ 2026  >

ПН  ВТ  СР  ЧТ  ПТ  СБ  ВС
    ◆   ✓   ·   ◆   ✓   ·   ●
...

СЕРИЯ 4 · ЛУЧШАЯ 9
```

Month navigation only allows months containing at least one date in the current 90-day window.

### Date states

The visual vocabulary is intentionally small:

- `◆` — best result is Clean.
- `✓` — best result is Solved but not Clean.
- `·` — available historical date with no completion.
- `●` — today; result state may also be represented through the cell styling/secondary mark.
- dates outside the 90-day rolling window — disabled/hidden as appropriate for the month grid.
- future dates — disabled.

The implementation should preserve date readability at mobile landscape sizes. State must not depend on color alone.

### Interaction

Selecting any enabled date launches that Daily immediately; no extra confirmation modal is required.

Already solved or clean dates remain selectable so the player can replay them.

## Board flow

Board launch data must distinguish:

- the Daily `dateKey` being played;
- whether the launch originated from the archive.

Conceptually:

```ts
interface DailyLaunchContext {
  dateKey: string;
  returnTarget: "home" | "daily-archive";
}
```

The exact implementation may use existing scene data structures, but these two semantics must remain explicit.

### Home today's Daily

```text
Home -> Today's Daily -> Result -> existing Daily result destination
```

Existing behavior remains unchanged.

### Archive-origin Daily

```text
Daily Archive -> selected Daily -> Result -> Daily Archive
```

The primary result action is `В АРХИВ` / `BACK TO ARCHIVE`.

The archive must refresh after return so a new `Solved` or `Clean` mark appears immediately.

If today's date was launched from the archive, it still returns to the archive because navigation origin and on-time status are separate concepts.

## Clean and assistance

Archive Daily uses the same Clean rules as normal Daily:

- Undo and Restart do not dirty Clean by themselves.
- A solver Hint dirties Clean.
- Rescue dirties Clean.
- Rewarded assistance is available under the same Daily policy already used in production code.
- Replaying a previously Clean day with assistance cannot downgrade the stored day from Clean.

No archive-specific assistance rules are introduced.

## Advertising and platform lifecycle

Archive is a non-gameplay utility scene:

- Sticky banner may be shown in `DailyArchiveScene`, consistent with other non-gameplay scenes.
- Gameplay Board hides the sticky banner.
- Rewarded Hint/Rescue behavior is unchanged.
- The safe interstitial break used by normal Daily result transitions should also be used before returning from an archive Daily result to the archive, unless the existing centralized ad policy already handles this transition generically.
- Archive navigation itself must not trigger fullscreen ads.

GameplayAPI lifecycle remains driven by Board gameplay state; browsing the archive is not gameplay.

## Error and unavailable states

### Trusted time unavailable

Show a compact unavailable state, for example:

```text
АРХИВ ВРЕМЕННО НЕДОСТУПЕН
Не удалось получить время Яндекса.
[ ПОВТОРИТЬ ]
```

Do not render a guessed archive based on local time.

### Persistence read/write failure

Follow existing progress-store fail-safe behavior. A persistence failure must not crash navigation or trap the player on the Board result screen.

### Invalid launch date

Board launch must validate the selected date against the trusted 90-day window before starting an archive Daily. An invalid/future/out-of-window request returns safely to the archive or Home rather than generating arbitrary content.

## Pre-release schema note

There are no production players yet, so this is the correct point to establish the final Daily record shape before launch.

No product promise is required for migration of development-only pre-release Daily records. For development compatibility, if the current parser encounters an old completed record without `completedOnTime`, it preserves the stored `Solved`/`Clean` result and sets `completedOnTime=false`. This may reset development-only streak history, but it cannot fabricate a streak that was never recorded.

## Components and responsibilities

### `DailyProgressStore`

Owns:

- reading/writing completed date records;
- monotonic `Solved -> Clean` merging;
- preserving `completedOnTime` once earned;
- exposing records needed for a 90-day archive;
- deriving streak from on-time records only;
- pruning persisted history according to the existing Daily retention policy.

It must not know Phaser navigation.

### Daily calendar/date utilities

Own:

- Moscow `dateKey` arithmetic;
- inclusive 90-day window calculation;
- month/page date generation;
- future/out-of-window validation.

They must be pure and renderer-independent wherever possible.

### `DailyArchiveScene`

Owns:

- trusted-time loading/unavailable/retry UI;
- month navigation;
- rendering date states;
- launching selected dates;
- refreshing after returning from Board;
- contextual menu / Rules / Settings integration following existing utility-scene conventions.

It does not calculate game rules or mutate Clean eligibility directly.

### `MenuScene`

Owns only the `АРХИВ · 90 ДНЕЙ` entry point and its visibility with the existing Daily unlock.

### `BoardScene`

Consumes an explicit Daily date and return target, then:

- plays the existing Daily ruleset for that date;
- records the result through Daily progress;
- determines on-time status using trusted current date, not navigation origin;
- returns archive-origin runs to the archive.

Board must not duplicate calendar rendering or archive-window logic.

## Test contracts

Implementation is not complete unless automated tests cover at least the following behaviors.

### Date/window

1. Window contains exactly today + previous 89 Moscow dates.
2. Future dates are rejected.
3. The 90th previous date is rejected.
4. Month paging cannot escape the rolling window.
5. Trusted-time failure does not fall back to device time.

### Persistence/result merge

6. First assisted completion records `Solved`.
7. First clean completion records `Clean`.
8. `Solved -> Clean` upgrade works.
9. `Clean -> Solved` downgrade is impossible.
10. `completedOnTime=true` is preserved across later replays.
11. Off-time completion cannot create on-time status.

### Streak

12. On-time Solved counts toward streak.
13. On-time Clean counts toward streak.
14. Missing on-time date breaks streak.
15. Completing the missed date later does not repair current or best streak retroactively.

### Puzzle identity

16. The same `dateKey` produces the same Daily board through Home and archive launch paths.

### Navigation

17. Home archive entry is hidden while Daily is locked.
18. Home archive entry appears with Daily unlock.
19. Archive selected date launches Board with the selected `dateKey`.
20. Archive-origin result returns to `DailyArchiveScene`.
21. Today's Daily launched from Home retains existing result navigation.
22. Today's Daily launched from archive returns to archive while still counting on time.
23. Archive refresh reflects a new Solved/Clean state after return.

### Assistance / monetization / lifecycle

24. Archive Daily Hint/Rescue use the existing Daily rewarded policy.
25. Assisted replay cannot downgrade an existing Clean date.
26. Archive scene shows the non-gameplay sticky-banner policy; Board hides it.
27. No fullscreen ad fires merely from browsing dates/months.
28. Existing Daily completion interstitial policy remains valid for archive-origin completion transition.

## Acceptance criteria

The feature is ready for release when all of the following are true:

- A player who has unlocked Daily can open a 90-day archive from the Home Daily card.
- The calendar uses trusted Moscow dates and never exposes future or older-than-90-day puzzles.
- Any enabled date launches the same deterministic Daily for that date.
- Historical replay can improve Solved to Clean without downgrades.
- Historical replay never repairs a missed streak.
- On-time Solved and Clean both count toward streak.
- Archive-origin gameplay returns to the archive and refreshes its marks.
- Existing Daily gameplay, rewarded assistance, Clean semantics, Yandex lifecycle, and ad policies remain intact.
- No XP, Statistics subsystem, Daily leaderboard, or unrelated progression is added.

