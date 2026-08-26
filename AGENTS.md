# Sigmar's Garden rules lab — project instructions

## Current phase

This project is deliberately a mechanics and level-generation test bench. Until the user explicitly changes the phase, do not add product UI or styling: no title/menu screens, settings, tutorial, hints, undo, scores, timers, leaderboards, audio, advertisements, particles, tweens, decorative backgrounds, localization system, difficulty modes, renamed atoms, or imported art.

The runtime should expose only what is needed to inspect the board:

- the 91-cell radius-5 hexagonal plate;
- the current 55-piece level;
- flat atom labels and enough state contrast to distinguish free, locked, and selected atoms;
- previous level, next level, restart, and board-variant controls;
- direct selection/removal behavior;
- the functional atom inventory panel: remaining Salt/elements/Hg and, in the quintessence variant, Q, the `Pb -> Sn -> Fe -> Cu -> Ag -> Au` unlock chain, parity warnings, depleted/locked/current states, and click-to-highlight filtering.

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

## Levels

- Every level has exactly 55 pieces on distinct cells of the 91-cell plate.
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
- Keep rules and generation renderer-independent and Node-testable: `src/atom-types.js`, `src/hex.js`, `src/rules.js`, `src/board.js`, `src/generator.js`, and `src/campaign.js`.
- The only active scene is `src/game/scenes/BoardScene.js`.
- Use `Phaser.Scale.RESIZE`; keep the entire plate usable in narrow portrait, phone landscape, and desktop landscape.
- No persistence is required in this phase. A level is regenerated from its number.

## Git workflow

- The repository is initialized locally. Commit every completed logical change before handoff.
- Keep dependency caches, `node_modules`, build output, and temporary files untracked.
- Do not amend or rewrite existing commits unless the user explicitly asks.

## Verification

Before handoff:

1. Run `pnpm test`.
2. Run `pnpm build`.
3. Verify exact piece counts for both variants.
4. Replay generated solution certificates for a sequence of levels in both variants.
5. Smoke-test selecting a legal pair, rejecting a blocked atom, restarting, switching level, and switching variant.

See `RULES_AUDIT.md` for the source audit behind the contract.
