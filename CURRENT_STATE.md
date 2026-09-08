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
- Endless: staged 37 → 61 → 91-cell progression, persistent best local score, streak multipliers, actual no-moves dead-end handling, and assisted-run exclusion from ranked/local-best submission. Solver-proven unsolvability remains internal while legal moves exist.
- Quintessence generator/rules remain in code for internal experiments and contract tests but are not exposed as a public mode.
- Solver-backed Move, Undo, and Rescue flows are implemented.
- Persistent dust economy, booster inventory, shop bundles, first-clear campaign rewards, Endless dust rewards, and rewarded-ad booster grants are implemented.
- Rewarded ads have a global persistent 60-second cooldown. Localhost and `?test=all` use deterministic simulation; the Yandex adapter uses SDK rewarded callbacks when available.
- Local leaderboard UI/store is implemented with fake comparison entries plus the player's campaign + best unassisted Endless score. A live Yandex leaderboard is not implemented.
- Russian/English setting and global sound preference persist locally.
- Desktop, phone portrait, and phone landscape responsive layouts are implemented in the Phaser UI.
- Campaign/endless completion reward presentation, level select, shop, settings, and leaderboard scenes are present.
- Presentation architecture now includes renderer-owned neutral surfaces, state-preserving level hover, icon-based dust displays, a renderer-drawn cart control, larger responsive campaign tiles, visual Shop cards, a compact completion card with an explicit progress layer, and direct Shop/Settings access that preserves and correctly resumes the active Board session.
- The Board uses floating HUD/action groups rather than full-width top/bottom chrome. Pause + Restart form the system/session group, while Move/Undo/Rescue remain a separate consumable group. Atom counts sit beside their glyphs, and type filtering leaves non-matches unchanged while giving matches restrained positive same-shape emphasis.
- The tutorial now teaches matching first, geometric freedom second, and the remaining-piece count panel third through local contextual callouts; it never hard-blocks an otherwise legal click. Clearing the tutorial opens a focused `LEVEL 1` transition rather than a small HUD play button.
- Fresh fields use a skippable centre-out spiral reveal with size-dependent target duration of roughly 1.6–3.2 seconds and overlapping ~200 ms piece entrances; restarting the same field uses a compressed roughly 0.8–1.0 second profile. Returning from Shop/Settings to the same Board session does not replay the intro.
- Successful piece removals now update the Board immediately: removed piece sprites disappear on the successful move with no shrink, fade, pull, connector, ring, or removal-delay animation.

## Current runtime art state

- The current live Board candidate is **Physical Premium / Club Table**: deep green felt plus real/derived walnut, brown leather, and aged-brass 2D material surfaces.
- The Board now uses a tiled felt surface, reusable ivory ceramic socket cells, a walnut/felt inventory rack, physical leather/brass control plaques, and a dedicated physical sprite for every atom type.
- The current cell plus all 15 piece sprites come from the paused Blender Physical Asset Factory V11 iteration. The 1024x1024 Blender renders remain master art; the browser build uses centered 256x256 premultiplied-alpha Lanczos derivatives so Phaser is not shrinking 1024px art to board scale at runtime.
- Premium pieces no longer overlay the old Chequered Ink atom glyphs. Material texture plus the embedded physical mark in each factory render carries identity.
- On roomy desktop Board layouts the four system actions use short labels plus secondary glyphs instead of tiny icon-only squares; compact responsive layouts retain icon-only collapse.
- The rejected B5 Adventure/RPG/Space raster UI themes are no longer active runtime candidates but their test assets remain on disk pending cleanup after live acceptance.
- This is a live comparison candidate, **not** the approved final art direction.
- Mechanized Magic remains bundled under `public/assets/mechanized-magic/**` as rejected legacy art but is no longer the active mapping.
- Asset sources/license notes are recorded in `THIRD_PARTY_ASSETS.md` and `public/assets/chequered-ink/SOURCE.txt`.
- The final visual direction is unresolved. See `ART_DIRECTION.md` before doing further visual work.

## Documentation / context handoff state

- Active truth is split between `PROJECT.md`, this file, `ART_DIRECTION.md`, `AGENTS.md`, and generated `TREE.txt`.
- `docs/archive/**` is historical only.
- The repository provides `pnpm context` and `pnpm context:last` so a fresh session can receive a compact current-state bundle rather than the entire project history.

## TypeScript / architecture state

- Runtime source under `src/**` is migrated to strict TypeScript; tests remain JavaScript and run through `tsx`.
- `BoardScene.ts` remains the gameplay/state orchestrator, while Phaser ownership for the board HUD, inventory, tutorial, and board-intro lifecycle is split into `src/game/board/BoardHud.ts`, `BoardInventory.ts`, `BoardTutorial.ts`, and `BoardIntroAnimator.ts`.
- Atom IDs, solver/status values, worker messages, persistence boundaries, presentation models, and complete atom-to-art mappings now have explicit TypeScript contracts.
- Tooling scripts under `scripts/*.mjs` remain JavaScript and invoke TypeScript runtime modules through `tsx`.

## Current focus

Live-verify the current Physical Premium Board integration with the paused V11 factory art: smooth 256px browser sprites, exact cell/piece centering, dedicated material identity for all 15 atoms, inventory readability, and immediate no-animation removal of cleared pieces. Further Blender factory refinement is intentionally paused for this iteration.
