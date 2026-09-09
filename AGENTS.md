# Hex Garden — project instructions

## Current product

Hex Garden is a Yandex Games hex-board clearing puzzle. The current goal is to finish and validate the **functional product redesign** before final art production resumes.

The public product consists of:

- separate interactive Tutorial;
- Campaign with exactly 50 fixed levels in five chapters of ten;
- Daily unlocked after the first 5 campaign levels are Solved;
- Endless unlocked after the first 10 campaign levels are Solved.

Do not restore the removed Dust/Shop/legacy-score/mechanic-progression product. One explicit replacement is now approved: the **Endless Clean Yandex leaderboard** described below. Do not revive the old local/public score leaderboard architecture.

## Documentation authority

- Code and tests = factual current implementation.
- `PROJECT.md` = stable product contract.
- `CURRENT_STATE.md` = implementation snapshot.
- `RULES_AUDIT.md` = audited low-level rules.
- `ART_DIRECTION.md` = current visual status.
- `VALIDATION.md` = required validation commands/checks.
- `docs/archive/**` = historical only.

If prose conflicts with code/tests, report the mismatch instead of changing runtime behavior to satisfy stale prose.

## Rules contract

Keep internal atom IDs/names from `src/atom-types.ts` and preserve the audited Garden behavior:

- an occupied atom is free when at least 3 consecutive positions in its circular six-neighbour ring are empty;
- positions outside the plate count as empty for freedom geometry;
- Air/Fire/Water/Earth pair with themselves;
- Salt pairs with Salt or one cardinal element;
- Vitae pairs only with Mors and vice versa;
- Quicksilver pairs with Lead/Tin/Iron/Copper/Silver, never Gold;
- metals unlock in order `Pb -> Sn -> Fe -> Cu -> Ag -> Au`;
- free unlocked Gold is removed alone;
- selection/deselection behavior must continue to come from `GardenBoard` rather than duplicated renderer logic.

Quintessence may remain in low-level/internal tooling but is not a public mode.

## Board geometry and generation

- Public plates are complete canonical regular hexes only: 37 / 61 / 91 cells (radius 3 / 4 / 5).
- Campaign uses frozen `src/data/campaign-levels.json`; normal runtime must not regenerate Campaign levels.
- Campaign has exactly 50 levels. Do not recreate a 24-level mechanic-progression API or shape-family campaign contract.
- `pnpm author:campaign` is an authoring command only. It may create candidate/shortlist data but is not part of normal test/build/runtime validation.
- Worker generation is for generic puzzle candidates, Daily, and Endless. Do not re-add worker kind `progression`.
- Offline legacy database generation may stay isolated in `src/legacy-database-generation.ts`; do not export it as product runtime API.

## Campaign progression

- Tutorial is separate from the 50 campaign levels.
- Chapters are fixed 0–9 / 10–19 / 20–29 / 30–39 / 40–49.
- Solving an unlocked level unlocks only the next level through the contiguous solved prefix.
- `Solved` = cleared.
- `Clean` = cleared without Hint or Rescue on that attempt.
- Undo and Restart preserve Clean. Hint/Rescue invalidate only the current attempt; a later replay can upgrade Solved to Clean.
- Mastery thresholds are 0 Novice, 5 Apprentice, 15 Adept, 30 Strategist, 40 Expert, 50 Master.
- Once all levels are Solved, Continue should target remaining non-Clean levels until full mastery.

## Daily

- Unlock after 5 contiguous Campaign solves.
- One deterministic puzzle for the current Moscow date.
- Day boundary: 00:00 `Europe/Moscow`; week: Monday–Sunday.
- Use trusted platform time for Daily rollover. Do not make browser/device local timezone the product authority.
- Store Solved/Clean per date, current-week summary, latest 90 entries, and aggregate best solved/clean week counts.
- Old days are history only; do not create a selectable Daily archive without a new product decision.
- Undo/Restart are free and preserve Clean.
- Hint/Rescue use rewarded assistance and invalidate Clean; Rescue is one per attempt and only at a true dead end.

## Endless

- Unlock after 10 contiguous Campaign solves.
- One run owns one unique run seed and one `EndlessBoardSession`; the live run is not resumed after reload.
- Board 0–1: 37 cells. Board 2–4: 61 cells. Board 5+: 91 cells.
- Difficulty continues through profile/band selection after plate size caps at 91.
- Result = boards cleared. There is no point score, streak multiplier, combo, or score-farming system.
- The only approved public ranking is **Endless Clean**, technical Yandex leaderboard name `endless_clean_boards`, ranked by `bestUnassistedBoards` descending.
- Guests may view public Top 10 without login. Authorization is voluntary and may start only from an explicit CTA explaining leaderboard participation.
- Assisted Endless records never submit to the public leaderboard. A higher remote clean score must never be overwritten by a lower local score.
- Clearing a board automatically advances to the next board.
- Undo is free and non-assisted before a dead end. At a true dead end ordinary Undo is unavailable.
- Hint requires a solver-verified winning route, then rewarded confirmation, then marks the run assisted permanently.
- Rescue requires a solver-verified recoverable history position, then rewarded confirmation. It can be used once per run and marks assisted.
- A second true dead end after Rescue terminates the run.
- Persist `bestUnassistedBoards` and `bestAssistedBoards` separately. Assisted results must never replace the canonical clean best shown on Home.

## Assistance

- No booster inventory exists.
- Undo and Restart are free controls.
- Tutorial assistance is free.
- Campaign levels 1–5 are free onboarding assistance; Campaign level 6 onward requires rewarded confirmation for Hint/Rescue.
- Daily and Endless Hint/Rescue always require rewarded confirmation.
- Always run the solver first. If Hint has no verified full-clear route or Rescue has no verified safe restore point, do not show a rewarded ad.
- Only `RewardedAdStatus.REWARDED` authorizes the assisted action.
- Solver timeout/budget exhaustion is `unknown`; never turn it into a false dead-end claim.
- A visible dead end means non-cleared board + zero legal moves. Do not expose solver-only unsolvability while legal moves remain.

## Removed product surfaces

Do not reintroduce without explicit approval:

- Dust/currency;
- Shop or Shop navigation;
- purchasable/consumable Hint/Undo/Rescue inventory;
- campaign points or per-level scores;
- Endless points, score bonuses, streak multipliers, or score farming;
- legacy public/local leaderboard scene/store based on points or old score concepts;
- any ranked submission other than the approved `endless_clean_boards` Clean boards-cleared leaderboard;
- legacy mechanic-progression cards/gates;
- legacy 24-level progression;
- public shape-family Campaign API.

## UI and presentation

- The current runtime target is asset-free functional Phaser presentation until playtest acceptance.
- Physical Premium / Club Table and the Physical UI Factory are frozen experiments, not runtime dependencies.
- Do not make tests require premium texture names, Blender output hashes, generated factory rasters, or other frozen-art artifacts for the game to run.
- Frozen factory tooling may remain isolated and optional.
- Keep the board readable and dominant; clearly distinguish free/locked/selected state.
- Keep on-screen navigation sufficient in desktop, phone portrait, and phone landscape. Keyboard shortcuts are optional accelerators only.
- `BoardInventory` is the atom-count/filter panel, not a booster inventory. It may show only atom types present in the current layout and must preserve metal-chain state readability.
- Russian/English and sound on/off settings persist. Sound preference controls Phaser global mute.
- Final art direction is unresolved; consult `ART_DIRECTION.md` before any new visual-production task.

## Architecture

- Phaser 3 + Vite + strict TypeScript + native ES modules.
- Runtime under `src/**` stays TypeScript; do not reintroduce JS runtime modules.
- Do not use production `any` or `// @ts-ignore` to suppress type problems.
- `src/board.ts`, `src/rules.ts`, `src/solver.ts`, generation modules, and progress stores remain renderer-independent and Node-testable.
- `BoardScene.ts` owns orchestration; board UI/session responsibilities stay split under `src/game/board/`.
- Active scenes include `MenuScene`, `LevelSelectScene`, `SettingsScene`, `RulesScene`, `LeaderboardScene`, and `BoardScene`.
- Campaign/Daily/Endless progress plus settings use the shared player-data storage boundary. Yandex Player Data is preferred when available; local/browser fallback keeps dev usable.
- Use `Phaser.Scale.RESIZE` and preserve usable responsive layouts.

## Git workflow

- Commit each completed logical change before handoff.
- Keep `node_modules`, caches, build outputs, generated temporary files, and context bundles untracked unless explicitly required.
- Do not amend/rewrite existing commits unless the user asks.
- User works in Windows PowerShell. Give shell commands in PowerShell-compatible syntax; do not use Unix `\` line continuations.

## Validation before handoff

Run the normal gate from `VALIDATION.md`:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

`pnpm author:campaign` is **authoring only** and is not part of the normal gate. Do not regenerate campaign JSON during ordinary validation.

For product changes, also verify the affected manual acceptance slice: Campaign Solved/Clean/navigation, Daily Moscow rollover/history, Endless dead-end/assistance/records, Endless Clean guest/auth leaderboard behavior, rewarded confirmation, responsive controls, and persistence as applicable.
