# Hex Garden — Current State

This file is a concise factual snapshot of the current implementation. For stable product intent see `PROJECT.md`; for visual decisions see `ART_DIRECTION.md`.

## Stack and commands

- Node.js: `>=20`
- Phaser: `^3.90.0`
- Vite: `^7.1.3`
- Package manager used by the project: pnpm
- Development: `pnpm dev`
- Tests: `pnpm test`
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

## Current runtime art state

- The runtime currently loads Mechanized Magic-derived UI/icon/atom assets from `public/assets/mechanized-magic/**` via `src/art-assets.js`.
- The bundled Mechanized Magic license record is in `THIRD_PARTY_ASSETS.md` and its license text remains under the runtime asset directory.
- This integration is temporary implementation state, **not** the approved final art direction.
- The Mechanized Magic free direction has already been tested in the live game and rejected as the target style.
- The final visual direction is unresolved. See `ART_DIRECTION.md` before doing any visual work.

## Documentation / context handoff state

- Active truth is split between `PROJECT.md`, this file, `ART_DIRECTION.md`, `AGENTS.md`, and generated `TREE.txt`.
- `docs/archive/**` is historical only.
- The repository provides `pnpm context` and `pnpm context:last` so a fresh session can receive a compact current-state bundle rather than the entire project history.

## Current focus

Do not choose a new visual style as part of context-workflow maintenance. The next visual-development step is asset/style evaluation under the constraints in `ART_DIRECTION.md`, while preserving the existing game mechanics and product systems.
