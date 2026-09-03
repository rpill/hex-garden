# Hex Garden — Current State

This file is a concise factual snapshot of the current implementation. For stable product intent see `PROJECT.md`; for visual decisions see `ART_DIRECTION.md`.

## Stack and commands

- Node.js: `>=20`
- Phaser: `^3.90.0`
- Vite: `^7.1.3`
- Runtime source: strict TypeScript (`src/**/*.ts`, `allowJs: false`)
- Package manager used by the project: pnpm
- Development: `pnpm dev`
- Tests: `pnpm test`
- Type check: `pnpm typecheck`
- Production build: `pnpm build`
- Preview: `pnpm preview`
- Database tools: `pnpm inspect`, `pnpm generate`, `pnpm verify`
- Campaign check: `pnpm check:campaign`

## Implemented product state

- Public menu modes: Campaign and standard Endless.
- Campaign: tutorial plus 24 curated progression levels with sequential unlocks and persistent completion/score state.
- Endless: staged 37 → 61 → 91-cell progression, persistent best local score, streak multipliers, dead-end handling, and assisted-run exclusion from ranked/local-best submission.
- Quintessence generator/rules remain in code for internal experiments and contract tests but are not exposed as a public mode.
- Solver-backed Move, Undo, and Rescue flows are implemented.
- Persistent dust economy, booster inventory, shop bundles, first-clear campaign rewards, Endless dust rewards, and rewarded-ad booster grants are implemented.
- Rewarded ads have a global persistent 60-second cooldown. Localhost and `?test=all` use deterministic simulation; the Yandex adapter uses SDK rewarded callbacks when available.
- Local leaderboard UI/store is implemented with fake comparison entries plus the player's campaign + best unassisted Endless score. A live Yandex leaderboard is not implemented.
- Russian/English setting and global sound preference persist locally.
- Desktop, phone portrait, and phone landscape responsive layouts are implemented in the Phaser UI.
- Campaign/endless completion reward presentation, level select, shop, settings, and leaderboard scenes are present.
- Presentation architecture now includes renderer-owned neutral surfaces, state-preserving level hover, icon-based dust displays, a renderer-drawn cart control, larger responsive campaign tiles, visual Shop cards, a compact completion card with an explicit progress layer, and direct Shop/Settings access that preserves and correctly resumes the active Board session.

## Current runtime art state

- The runtime currently loads an experimental Chequered Ink candidate set from `public/assets/chequered-ink/**` via `src/art-assets.ts`.
- Board cells use renderer-drawn low-contrast hex treatment so empty cells recede; board pieces still use the provisional shape-based gem grammar; main panels, buttons, level tiles, Shop cards, and completion surfaces are now renderer-owned neutral primitives instead of Cartoon UI chrome.
- This is a live comparison baseline, **not** the approved final art direction.
- Mechanized Magic remains bundled under `public/assets/mechanized-magic/**` as rejected legacy art but is no longer the active mapping.
- Asset sources/license notes are recorded in `THIRD_PARTY_ASSETS.md` and `public/assets/chequered-ink/SOURCE.txt`.
- The final visual direction is unresolved. See `ART_DIRECTION.md` before doing further visual work.

## Documentation / context handoff state

- Active truth is split between `PROJECT.md`, this file, `ART_DIRECTION.md`, `AGENTS.md`, and generated `TREE.txt`.
- `docs/archive/**` is historical only.
- The repository provides `pnpm context` and `pnpm context:last` so a fresh session can receive a compact current-state bundle rather than the entire project history.

## TypeScript / architecture state

- Runtime source under `src/**` is migrated to strict TypeScript; tests remain JavaScript and run through `tsx`.
- `BoardScene.ts` remains the gameplay/state orchestrator, while Phaser ownership for the board HUD, inventory, and tutorial is split into `src/game/board/BoardHud.ts`, `BoardInventory.ts`, and `BoardTutorial.ts`.
- Atom IDs, solver/status values, worker messages, persistence boundaries, presentation models, and complete atom-to-art mappings now have explicit TypeScript contracts.
- Tooling scripts under `scripts/*.mjs` remain JavaScript and invoke TypeScript runtime modules through `tsx`.

## Current focus

The next board-UX pass is intentionally separate from the TypeScript migration: remove the large top/bottom board chrome, move tutorial guidance next to its targets, add a direct restart control, replace intrusive inventory filtering with subtle positive highlighting, distinguish an unsolvable position from a position with no legal moves, and add a skippable spiral board-fill intro. Continue searching for a stronger final piece/icon identity; Chequered Ink remains provisional.
