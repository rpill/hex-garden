# Hex Garden — Validation

This file defines the current functional-product validation gate. It excludes the removed Dust/Shop/legacy score product while including the approved Endless Clean Yandex leaderboard, and it does not require frozen Physical Premium factory outputs.

## Normal handoff gate

Run from the repository root:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

All three commands must complete successfully before a normal code handoff is described as green.

## Campaign authoring is separate

Campaign runtime content is frozen in `src/data/campaign-levels.json`. Do **not** regenerate it during ordinary test/typecheck/build validation.

The authoring command is:

```powershell
pnpm author:campaign
```

Use it only when deliberately generating/reviewing Campaign candidates or shortlists. Freezing a curated selection is a separate content-authoring action, not a normal runtime validation step.

`pnpm check:campaign` may be used to inspect/validate the currently frozen Campaign data without replacing it.

## Daily authoring is separate

Daily runtime content is frozen in `src/data/daily-levels.json`. Ordinary test/typecheck/build validation must not regenerate it.

Use:

```powershell
pnpm check:daily
```

to replay every shipped Daily solution certificate. Use `pnpm freeze:daily` only when deliberately replacing the release pack; by default it freezes `2026-01-01` through `2027-12-31` deterministically and may take several minutes because it evaluates 16 candidates per date. The bulk freeze ranks 16 deterministic solver-certified candidates per date with the fast Daily quality selector; it intentionally does not run the expensive deep difficulty scorer for every date. `pnpm check:daily` also verifies candidate-index diversity and the expected medium → challenge gradients for meaningful choices, constrained early steps, ambiguity, and random-route survival.

## Functional automated acceptance

The normal `pnpm test` suite should cover the current product contracts, including:

- audited Garden rules and solver behavior;
- canonical 37 / 61 / 91-cell plates;
- 50 fixed Campaign levels and solution certificates;
- Campaign Solved/Clean progression, 5×10 chapters, mastery ranks, and sequential unlocks;
- Daily unlock after 5 solves, trusted Moscow calendar boundaries, playable rolling 90-day Archive, on-time streak semantics, historical Solved → Clean upgrades, weekly summary, and the frozen 2026–2027 Daily pack;
- Endless unlock after 10 solves, 37 → 61 → 91 staging, boards-cleared records, assisted separation, and run-session behavior;
- free Undo/Restart behavior;
- solver-first Hint/Rescue and rewarded confirmation policy;
- one Rescue per Campaign/Daily attempt or Endless run;
- player-data persistence boundaries and settings;
- responsive/product navigation contracts;
- Endless Clean Yandex leaderboard guest/auth/no-downgrade/clean-only submission contracts;
- absence of removed Dust/Shop/legacy score/mechanic-progression surfaces.

## Manual smoke acceptance

For user-facing changes, smoke-test the affected slice in `pnpm yandex:dev`.

### Campaign

- Fresh profile enters Tutorial and then Level 1.
- Solving Level 1 unlocks only Level 2.
- `SOLVED` and `CLEAN` are visually distinguishable.
- Undo and Restart preserve Clean eligibility.
- Hint/Rescue make only the current attempt assisted.
- A later clean replay upgrades a Solved level to Clean.
- Chapters contain all 50 levels in five groups of ten.
- Daily becomes visible after Level 5 is solved; Endless after Level 10.

### Daily

- Same Moscow `dateKey` produces the same puzzle after refresh.
- Current week is Monday–Sunday and shows open/solved/clean states.
- Daily can be replayed to upgrade Solved → Clean; Clean never downgrades.
- Today plus the previous 89 trusted Moscow dates are playable from Archive; future/older dates are disabled.
- Completing a historical Daily records it off-time and never repairs the streak retroactively.
- Today's Daily can count on time whether launched from Home or Archive.
- Archive-origin completion returns to Archive through the normal Daily interstitial opportunity, subject to the shared 3-minute session/cooldown gate.
- There is no currency/reward chest/Shop flow.

### Daily Archive

DA-01  Home shows ARCHIVE · 90 DAYS only after Daily unlocks.
DA-02  Archive opens on trusted current Moscow month and shows only months intersecting the 90-day window.
DA-03  Future dates and dates older than today-89 are not playable.
DA-04  Historical date launches the deterministic Daily for that exact dateKey.
DA-05  Historical Solved replay can upgrade to Clean; Clean never downgrades.
DA-06  Historical completion does not repair Daily streak.
DA-07  Today's Daily launched from Archive can count on time but still returns to Archive.
DA-08  Archive -> Rules/Settings -> Back resumes Archive without resetting the selected month.
DA-09  Archive-origin completion primary action returns to Archive after the normal Daily interstitial opportunity; the centralized 3-minute session/cooldown gate may suppress the actual ad request.
DA-10  Trusted-time failure disables Archive instead of falling back to device time.
DA-11  Mobile landscape keeps month arrows, 7-column calendar, streak header, and date cells readable/clickable.
DA-12  Home Daily is one card: current streak, explicit NEW/PLAY or SOLVED/IMPROVE or CLEAN state, weekly strip, and embedded ARCHIVE · 90 DAYS action.
DA-13  Archive legend explains · / ✓ / ◆, current/best streak sits near the month header, and today is indicated by highlighted cell styling without an extra label glyph.
DA-14  Home Daily title/action/week/Archive CTA do not overlap at normal or short-landscape sizes; Archive calendar starts directly below weekday labels and its legend follows the grid instead of being pinned to the viewport bottom.
DA-15  Home Today and Archive are separate clickable rectangles with a visible gap, visually grouped by shared left/right bracket strokes; the Archive button never reuses or overlaps the Today button border.

### Generation / interstitial UX

- Campaign and Daily start without generator-worker work; Daily loads its packaged board directly after trusted-date validation.
- Endless prefetches the next board while the current one is played. The central generation overlay appears only when the requested Endless board is still being generated (normally the first board or fallback).
- The generation overlay uses animated dots and never presents fake percentage progress.
- No fullscreen interstitial request is made during the first 3 minutes of an app session.
- After that grace period, fullscreen interstitial requests are limited to at most one every 3 minutes.
- Campaign replay progression is not an interstitial opportunity.
- Endless board-to-board continuation is never an interstitial opportunity.

### Endless

- New run starts at Board 0 with a unique run seed.
- Boards 0–1 are 37-cell, 2–4 are 61-cell, 5+ are 91-cell.
- Clearing a board automatically starts the next board.
- Result is boards cleared; no point score/multiplier appears.
- Undo before dead end is free and does not assist the run.
- Hint marks the run assisted only after verified route + rewarded confirmation.
- At a true dead end normal Undo is unavailable.
- Rescue works once, restores a solver-verified safe history state, and marks assisted.
- A later true dead end after Rescue ends the run.
- Assisted result cannot replace the Home clean best.


### Endless Clean leaderboard

- [ ] Guest can open leaderboard and see public Top 10 without auth dialog.
- [ ] Guest local clean best is visible even when leaderboard is unavailable.
- [ ] Closing/cancelling auth keeps game usable and returns to guest state.
- [ ] Successful auth refreshes Player and shows personal placement when present.
- [ ] Local 17 vs remote 25 performs no `setScore` call.
- [ ] Local 17 vs remote 12 submits 17 once.
- [ ] Local 0 with no remote entry does not create a zero entry.
- [ ] Assisted Endless best never changes leaderboard score.
- [ ] New clean Endless best publishes asynchronously without delaying result overlay.
- [ ] Missing console leaderboard/404 shows unavailable state and Home remains reachable.
- [ ] Rules/Settings opened from leaderboard return to leaderboard without duplicate fetch loops.
- [ ] Desktop, portrait phone, and short-landscape leaderboard layouts remain usable.

Developer Console requirement:

```text
Technical name: endless_clean_boards
Type: numeric
Decimal offset: 0
Sort: DESC
```

### Platform / responsive UI

- Rewarded early-close/error/unavailable states grant no assisted action.
- Campaign/Daily/Endless/settings survive storage reload through the player-data boundary where applicable.
- Russian/English and sound on/off persist.
- Menu, Chapters, Settings, Board, completion overlays, Daily, and Endless are navigable without keyboard-only controls.
- Desktop, phone portrait, and phone landscape remain usable after live resize/orientation changes.

## Frozen factory status

Physical Premium / Club Table and Physical UI Factory are not normal runtime acceptance dependencies. Optional factory tests may keep their existing skip/availability behavior if Blender or generated outputs are absent.
