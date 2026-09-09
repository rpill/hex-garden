# Hex Garden — Current State

This is the concise factual implementation snapshot. Stable product intent lives in `PROJECT.md`; visual status in `ART_DIRECTION.md`; validation commands in `VALIDATION.md`.

## Stack and commands

- Node.js `>=20`
- Phaser `^3.90.0`
- Vite `^7.1.3`
- strict TypeScript runtime under `src/**/*.ts` (`allowJs: false`)
- pnpm package manager
- local Yandex SDK development: `pnpm yandex:dev`
- low-level Vite development: `pnpm dev`
- tests: `pnpm test`
- type check: `pnpm typecheck`
- production build: `pnpm build`
- preview: `pnpm preview`
- frozen campaign validation: `pnpm check:campaign`
- campaign candidate authoring only: `pnpm author:campaign`

Normal test/build validation does **not** regenerate `src/data/campaign-levels.json`.

## Implemented product state

- Public play modes are Tutorial, Campaign, Daily, and Endless.
- Campaign is a separate tutorial plus **50 fixed levels**, split into **5 chapters × 10 levels**.
- Campaign runtime reads frozen level data. The old 24-level procedural mechanic progression is removed. Fixed onboarding cards now explain first appearances of Salt, Vitae/Mors, and the gradual metal chain in the opening campaign levels.
- Opening Campaign learning curve is frozen as: L1 elements only; L2 + Salt; L3 + Vitae/Mors; L4 + Quicksilver/Lead; L5 + Tin; L6 + Iron; L7 + Copper; L8 + Silver; L9 + Gold; L10 full-set exam.
- Public board geometry is canonical full hex plates only: **37 / 61 / 91 cells**.
- Campaign progression persists `Solved` and `Clean` separately. Sequential unlock follows the contiguous solved prefix.
- Clean mastery ranks are implemented at 0 / 5 / 15 / 30 / 40 / 50 Clean levels.
- Daily becomes visible after 5 contiguous campaign solves. Endless becomes visible after 10.
- Daily uses the Moscow calendar (`Europe/Moscow`), trusted platform time, Monday–Sunday weekly history, latest-90-day persistence, and Solved/Clean upgrades.
- Endless is a session-scoped sequence of boards: two 37-cell boards, three 61-cell boards, then 91-cell boards. The result is boards cleared, not points.
- Endless persists separate best unassisted and best assisted board counts; Home displays the canonical unassisted best.
- Endless Clean Yandex leaderboard is implemented with technical name `endless_clean_boards`: guests can read Top 10; explicit Yandex sign-in enables personal placement and clean-best publication; higher remote scores are never downgraded by lower local scores.
- `LeaderboardScene` is available from Home contextual menu after Endless unlock. Assisted results are never submitted.
- Campaign, Daily, and Endless use the shared solver-backed Hint/Rescue infrastructure.
- Undo and Restart are free. They do not invalidate Clean/assisted eligibility by themselves.
- Hint and Rescue invalidate Clean for Campaign/Daily attempts; Hint/Rescue permanently mark an Endless run assisted.
- Tutorial and Campaign levels 1–5 have free assistance. Later Campaign assistance and all Daily/Endless Hint/Rescue require a confirmed rewarded callback.
- Rescue is only available at a real zero-legal-moves dead end. It is limited to one per Campaign/Daily attempt or one per Endless run.
- Campaign, Daily, Endless records, and settings use the hydrated player-data storage boundary backed by Yandex Player Data when available.
- Russian/English language and global sound preference persist.
- Responsive desktop, phone portrait, and phone landscape layouts remain implemented.

## Removed legacy product state

The current runtime no longer contains the old product surfaces:

- no Dust economy;
- no Shop scene or Shop navigation;
- no booster inventory or paid consumable counts;
- no campaign score or per-level score persistence;
- no Endless point score, streak multiplier, or score farming;
- no legacy point-score/local leaderboard architecture; the only approved ranking is the new Endless Clean Yandex leaderboard;
- no 24-level mechanic progression;
- no legacy runtime mechanic-progression gate;
- no public shape-family progression API.

`src/legacy-database-generation.ts` remains only as isolated offline database-authoring support; it is not a public runtime progression API.

## Runtime presentation state

- The live target is an **asset-free functional presentation using Phaser primitives** until product playtest acceptance.
- Board/Menu acceptance is based on layout, readable state, controls, and product flow rather than premium texture/frame contracts.
- **Physical Premium / Club Table** and the **Physical UI Factory** are frozen experiments, not live runtime requirements.
- Optional frozen factory assets/tests may retain skip semantics when their external outputs or Blender are absent.
- Final visual direction is unresolved.

## Architecture snapshot

- Active Phaser scenes: `MenuScene`, `LevelSelectScene`, `SettingsScene`, `RulesScene`, `LeaderboardScene`, `BoardScene`.
- `BoardScene.ts` orchestrates gameplay/session state.
- Board-specific presentation/session helpers live under `src/game/board/`, including `BoardHud`, `BoardInventory` (atom-count/filter panel), `BoardTutorial`, `BoardIntroAnimator`, `BoardAssistance`, and Campaign/Daily/Endless session classes.
- Frozen Campaign data is read synchronously from `src/data/campaign-levels.json`; Campaign is not generated in the worker at runtime.
- The generator worker handles generic puzzle candidates, Daily, and Endless run boards only.
- `src/solver.ts` remains the renderer-independent authority for verified winning routes and recoverable history positions.
- Runtime source remains strict TypeScript; tooling under `scripts/*.mjs` remains JavaScript where appropriate.

## Documentation / context handoff

- Active truth: `PROJECT.md`, this file, `AGENTS.md`, `ART_DIRECTION.md`, `VALIDATION.md`, and `RULES_AUDIT.md`.
- `docs/archive/**` is historical only.
- `pnpm context` creates a compact working-tree handoff bundle; `pnpm context:last` creates one for the latest commit.

## Current focus

Finish Yandex release-readiness validation (lifecycle, rewarded/interstitial/banner, Endless Clean leaderboard, statistics/retention follow-ups) alongside functional playtesting. Do not resume Physical Premium / Physical UI Factory runtime integration until functional product playtest acceptance explicitly reopens visual production.
