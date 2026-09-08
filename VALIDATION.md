# Hex Garden — Validation

This file defines the current functional-product validation gate. It intentionally excludes the removed Dust/Shop/score/leaderboard product and does not require frozen Physical Premium factory outputs.

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

## Functional automated acceptance

The normal `pnpm test` suite should cover the current product contracts, including:

- audited Garden rules and solver behavior;
- canonical 37 / 61 / 91-cell plates;
- 50 fixed Campaign levels and solution certificates;
- Campaign Solved/Clean progression, 5×10 chapters, mastery ranks, and sequential unlocks;
- Daily unlock after 5 solves, Moscow calendar boundaries, trusted-clock handling, 90-day history, and weekly summary;
- Endless unlock after 10 solves, 37 → 61 → 91 staging, boards-cleared records, assisted separation, and run-session behavior;
- free Undo/Restart behavior;
- solver-first Hint/Rescue and rewarded confirmation policy;
- one Rescue per Campaign/Daily attempt or Endless run;
- player-data persistence boundaries and settings;
- responsive/product navigation contracts;
- absence of removed Dust/Shop/score/leaderboard/mechanic-progression surfaces.

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

- Same Moscow date produces the same puzzle after refresh.
- Current week is Monday–Sunday and shows open/solved/clean states.
- Daily can be replayed to upgrade Solved → Clean.
- Crossing Moscow midnight invalidates completion of the old Daily.
- There is no currency/reward chest/Shop flow.

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

### Platform / responsive UI

- Rewarded early-close/error/unavailable states grant no assisted action.
- Campaign/Daily/Endless/settings survive storage reload through the player-data boundary where applicable.
- Russian/English and sound on/off persist.
- Menu, Chapters, Settings, Board, completion overlays, Daily, and Endless are navigable without keyboard-only controls.
- Desktop, phone portrait, and phone landscape remain usable after live resize/orientation changes.

## Frozen factory status

Physical Premium / Club Table and Physical UI Factory are not normal runtime acceptance dependencies. Optional factory tests may keep their existing skip/availability behavior if Blender or generated outputs are absent.
