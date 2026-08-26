# Sigmar's Garden progression lab — project instructions

## Current phase

This project is a mechanics, progression, and level-generation test bench. The current product goal is a 60-level main campaign that teaches mechanics gradually, while the existing `standard` and `quintessence` generators remain independent endless modes. A minimal mode menu and campaign level-select screen are now required. Do not add product styling yet: no settings, tutorial overlays, hints, undo, scores, timers, leaderboards, audio, advertisements, particles, tweens, decorative backgrounds, localization system, selectable difficulty modes, renamed atoms, or imported art.

The runtime should expose only what is needed to inspect the board and progression:

- campaign plates of 37, 61, or 91 cells, plus the endless 91-cell plate;
- the current variable-size campaign layout or 55-piece endless layout;
- flat atom labels and enough state contrast to distinguish free, locked, and selected atoms;
- a minimal start menu for `CAMPAIGN`, `STANDARD / ENDLESS`, and `Q MODE / ENDLESS`;
- a responsive grid showing all 60 campaign levels as `DONE`, `PLAY`, or `LOCK`;
- previous unlocked level, next unlocked level, restart, and menu/level-select controls;
- direct selection/removal behavior;
- the functional atom inventory panel: remaining Salt/elements/Hg and, in quintessence layouts, Q grouped with the four elements, the `Pb -> Sn -> Fe -> Cu -> Ag -> Au` unlock chain, parity warnings, depleted/locked/current states, and click-to-highlight filtering.

The folder `styloo Vector Icons and UI/` is parked source material. Do not import or modify it during this phase.

## Rules contract

Internal IDs and names must remain those in `src/atom-types.js`.

- An occupied atom is geometrically free when at least 3 consecutive positions in its circular 6-neighbour ring are empty.
- Positions outside the 91-cell plate count as empty. Geometry is based on occupancy, not plate membership.
- Air pairs with Air, Fire with Fire, Water with Water, and Earth with Earth.
- Salt pairs with Salt or with any one of the four cardinal elements.
- Vitae pairs only with Mors, and Mors only with Vitae.
- Quicksilver pairs with Lead, Tin, Iron, Copper, or Silver. It does not pair with Gold.
- Metals unlock in this removal order: Lead, Tin, Iron, Copper, Silver, Gold.
- A metal is unavailable while the immediately less-refined metal remains anywhere on the board.
- Free, unlocked Gold is removed by itself.
- Quintessence is removed as one five-piece selection containing Quintessence plus exactly one free Air, Fire, Water, and Earth.
- A mismatching second selection replaces the first selection.
- Selecting an already selected atom deselects it according to the original selection state machine.
- The metal sequence is `Pb -> Sn -> Fe -> Cu -> Ag -> Au`. Removing Fe unlocks Cu, not Au. Only removing Ag can unlock Au.

`src/board.js` is the authority for runtime move behavior. Renderer code must call it and must not duplicate or weaken these rules.

## Main progression

- `src/progression.js` owns a separate deterministic 60-level campaign. Do not route it through or alter the contract of `generateCampaignLevel()`.
- Levels 1-8 use 37 cells and introduce the four elements gradually.
- Levels 9-16 stay on 37 cells and add Salt.
- Levels 17-26 use 61 cells and add Vitae/Mors.
- Levels 27-38 stay on 61 cells and add Quicksilver plus the metal chain incrementally. Gold appears only after the complete chain.
- Levels 39-50 use 91 cells and the full standard 55-piece composition.
- Levels 51-60 use 91 cells, introduce Quintessence, and finish with the full quintessence composition.
- Every generated campaign record contains a solution certificate replayed through `SigmarsGardenBoard.select()`, plate geometry, a mechanics definition, and difficulty measurements.
- Campaign level indices are zero-based internally and limited to `0..59`.

## Endless modes

- Every endless level has exactly 55 pieces on distinct cells of the 91-cell plate.
- `standard` composition: 8 of each cardinal element, 4 Salt, 4 Vitae, 4 Mors, 5 Quicksilver, and one of each metal from Lead through Gold.
- `quintessence` composition: 8 of each cardinal element, 4 Salt, 3 Vitae, 3 Mors, 5 Quicksilver, two Quintessence, and one of each metal.
- Level masks use the same structural principle observed across the original database without loading original coordinates: centre Gold plus rotational orbits totalling 54 cells.
- Mix 60-degree, 120-degree, and 180-degree mask families. The original 50,000-board audit found 27,742 sixfold, 20,169 threefold, 2,089 twofold, and zero fully asymmetric occupancy masks. Atom types themselves need not share the mask symmetry.
- Preserve rare special silhouettes, including the centre plus complete radius-4 and radius-5 rings. Do not turn this special case into the only layout.
- Levels are deterministic from campaign seed + variant + zero-based level number.
- Generation assigns a fresh forward removal schedule to a newly selected procedural mask and returns a solution certificate that must replay through the public `SigmarsGardenBoard.select()` API to an empty board.
- Certified metal moves preserve `Pb -> Sn -> Fe -> Cu -> Ag -> Au`; Ag is the final pair and Au the final move in generated levels.
- The solution certificate is an internal verifier, not a player hint.
- Do not require a `.dat` file at runtime. Browser generation runs in a module Web Worker.
- A certified initial solution guarantees solvability, but an arbitrary player route may still dead-end. Restart is sufficient during the current validation phase.
- `standard` and `quintessence` are rule variants, not difficulty settings.

## Architecture

- Phaser 3 + Vite + native ES modules.
- Keep rules and generation renderer-independent and Node-testable: `src/atom-types.js`, `src/hex.js`, `src/rules.js`, `src/board.js`, `src/generator.js`, `src/campaign.js`, and `src/progression.js`.
- Active scenes are `MenuScene`, `LevelSelectScene`, and `BoardScene`.
- Use `Phaser.Scale.RESIZE`; keep the menus, all 60 level buttons, and the entire plate usable in narrow portrait, phone landscape, and desktop landscape.
- Campaign completion is persisted through `CampaignProgressStore` in localStorage. Only level 1 is initially unlocked; completing an unlocked level opens exactly the next one. Invalid or unavailable storage falls back to in-memory first-level progress.
- A board itself is regenerated from its mode, seed, and number; generated coordinates are not persisted.
- `BrowserLevelGenerator.generate()` and worker requests without a kind remain the endless API. Progression uses `generateProgression()` and `kind: "progression"`.

## Git workflow

- The repository is initialized locally. Commit every completed logical change before handoff.
- Keep dependency caches, `node_modules`, build output, and temporary files untracked.
- Do not amend or rewrite existing commits unless the user explicitly asks.

## Verification

Before handoff:

1. Run `pnpm test` (or the equivalent `node --test` if the package-manager bootstrap is blocked by a local build-script policy).
2. Run `pnpm build` (or invoke the installed Vite CLI directly for the same reason).
3. Verify exact 55-piece counts for both endless variants.
4. Replay generated solution certificates for all 60 campaign levels and a sequence of levels in both endless variants.
5. Verify campaign boundaries at levels 1, 9, 17, 27, 39, and 51.
6. Smoke-test the start menu, all 60 campaign buttons, rejecting a locked level, completing level 1, unlocking level 2, persistence after reload, both endless modes, board return controls, and phone portrait layout.

See `RULES_AUDIT.md` for the source audit behind the contract.
