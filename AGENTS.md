# Garden progression lab — project instructions

## Current phase

This project is a mechanics, progression, level-generation, and economy test bench. The current product goal is a short main campaign containing only levels that pass the puzzle-quality gate. The standard generator is the single public endless and future competitive ruleset. Keep the `quintessence` generator for internal experiments and contract tests, but do not expose it as a second product mode or leaderboard. Campaign length is not a target: add levels only when a new mechanic, interaction, or genuinely different decision pattern supports them. A minimal mode menu, campaign level-select screen, persistent dust wallet, hint inventory, and shop are required. Do not add unrelated product styling yet: no fake or nonfunctional settings, timers, online leaderboards, real advertisements or payments, audio, unrelated particles, decorative backgrounds, localization system, selectable difficulty modes, renamed atoms, or imported art. The interactive rules tutorial, mechanic-introduction cards, score HUDs, score-counting tweens, and purchased hint controls are part of the current progression contract.

The runtime should expose only what is needed to inspect the board and progression:

- campaign plates of 37, 61, or 91 cells, plus staged endless plates of 37, 61, and 91 cells;
- the current variable-size campaign layout or staged endless layout, reaching the full 55-piece composition on the 91-cell phase;
- flat atom labels and enough state contrast to distinguish free, locked, and selected atoms;
- a minimal start menu for `CAMPAIGN` and the unlockable standard `ENDLESS`;
- a responsive grid showing every current campaign level as `DONE`, `PLAY`, or `LOCK`;
- previous unlocked level, next unlocked level, restart, and menu/level-select controls;
- direct selection/removal behavior;
- the functional atom inventory panel: only atom types present in the initial layout, including Vitae/Mors when used and, in quintessence layouts, Q grouped with the four elements; preserve the `Pb -> Sn -> Fe -> Cu -> Ag -> Au` unlock chain, parity warnings, depleted/locked/current states, and click-to-highlight filtering.
- in standard endless, a visible score, cleared-board streak, current multiplier, next multiplier threshold, and animated score awards for removals and board clears.
- in campaign, a persistent score with animated awards but no streak or multiplier; only a level's first completion can add to that score.
- a persistent dust wallet, dedicated shop, owned counts for Move/Undo/Rescue items, and an in-board `+` purchase dialog when an item is depleted.

## Economy

- A new profile starts with 30 dust.
- The first clear of each campaign level awards 8/12/18 dust for its 37/61/91-cell plate. Claims are idempotent and old completed campaign levels are credited when the economy loads.
- Endless clears award 2/4/6 dust for 37/61/91-cell fields.
- The shop sells three Move hints for 30 dust, two Undo items for 50 dust, and one Endless Rescue for 60 dust.
- Buying only increases persistent inventory. Using an owned item during play consumes exactly one charge; a depleted item shows `+` and opens the matching dust-purchase dialog.
- Move highlights one currently legal move for four seconds. Undo restores the board and score to immediately before the latest removal. Rescue is usable only after an Endless dead end and performs the same rollback while continuing the run.
- Any hint, undo, or rescue used in Endless permanently marks that run `ASSISTED`; assisted scores must never be submitted to the future ranked leaderboard.
- `src/economy.js` is renderer-independent authority for balances, inventory, prices, rewards, persistence, and validation.

## Endless scoring

- Every removed atom awards 10 base points immediately.
- Clearing a 37/61/91-cell field awards 1000/1500/2000 base points.
- Streak multipliers are ×1.0 at 0, ×1.25 at 3, ×1.5 at 5, ×2.0 at 8, and ×2.5 at 12 cleared boards; ×2.5 is the cap.
- Removal points use the current cleared-board streak. A clear first increments the streak and then uses the resulting multiplier for its board bonus.
- A dead end ends the run. `NEW RUN` resets score and streak and returns to endless level zero.
- Standard endless has no previous-level navigation; cleared boards cannot be replayed to farm score.
- A public endless run starts with two 37-cell boards, continues with three 61-cell boards, and uses 91-cell/55-piece layouts from its sixth board onward.
- Campaign awards the same 10 points per removed atom and size-based clear bonus without any streak multiplier. Its score is persisted per level only on first completion.
- Future paid or inventory hints must not create a ranked advantage. A run using them must be unranked unless every player receives the same fixed allowance.
- `src/endless-score.js` is the renderer-independent authority for scoring math.

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

- `src/progression.js` owns a separate deterministic 24-level campaign. Do not route it through or alter the contract of `generateCampaignLevel()`.
- A separate level 0 tutorial teaches matching and geometric freedom before the numbered campaign.
- Levels 1-3 introduce the complete element set, Salt, and Vitae/Mors on 37-cell plates.
- Levels 4-9 introduce Quicksilver and one successive metal per level through Gold on 37-cell plates.
- Levels 10-16 combine the complete standard rules on selected variable masks within a 61-cell capacity.
- Levels 17-24 use selected full standard 55-piece layouts within a 91-cell capacity.
- Quintessence stays out of the main campaign and public menu.
- Generation constructs multiple certified candidates and rejects filler: a selected campaign level must expose early choices and at least one dangerous alternative according to the route analyzer.
- Every generated campaign record contains a solution certificate replayed through `GardenBoard.select()`, plate geometry, a mechanics definition, candidate-selection data, and difficulty measurements.
- Campaign level indices are zero-based internally and limited to `0..23`.

## Endless modes

- The public standard run uses the staged 37/61/91-cell sequence. Its large phase has exactly 55 pieces on distinct cells of the 91-cell plate.
- `generateCampaignLevel()` remains the legacy/full endless API: every record from it has exactly 55 pieces on the 91-cell plate.
- `standard` composition: 8 of each cardinal element, 4 Salt, 4 Vitae, 4 Mors, 5 Quicksilver, and one of each metal from Lead through Gold.
- `quintessence` composition: 8 of each cardinal element, 4 Salt, 3 Vitae, 3 Mors, 5 Quicksilver, two Quintessence, and one of each metal.
- Level masks use the same structural principle observed across the original database without loading original coordinates: centre Gold plus rotational orbits totalling 54 cells.
- Mix 60-degree, 120-degree, and 180-degree mask families. The original 50,000-board audit found 27,742 sixfold, 20,169 threefold, 2,089 twofold, and zero fully asymmetric occupancy masks. Atom types themselves need not share the mask symmetry.
- Preserve rare special silhouettes, including the centre plus complete radius-4 and radius-5 rings. Do not turn this special case into the only layout.
- Levels are deterministic from campaign seed + variant + zero-based level number.
- Generation assigns a fresh forward removal schedule to a newly selected procedural mask and returns a solution certificate that must replay through the public `GardenBoard.select()` API to an empty board.
- Certified metal moves preserve `Pb -> Sn -> Fe -> Cu -> Ag -> Au`; Ag is the final pair and Au the final move in generated levels.
- The solution certificate is an internal verifier, not a player hint.
- Do not require a `.dat` file at runtime. Browser generation runs in a module Web Worker.
- A certified initial solution guarantees solvability, but an arbitrary player route may still dead-end. Restart is sufficient during the current validation phase.
- `standard` and `quintessence` are rule variants, not difficulty settings.

## Architecture

- Phaser 3 + Vite + native ES modules.
- Keep rules and generation renderer-independent and Node-testable: `src/atom-types.js`, `src/hex.js`, `src/rules.js`, `src/board.js`, `src/generator.js`, `src/campaign.js`, and `src/progression.js`.
- Active scenes are `MenuScene`, `LevelSelectScene`, and `BoardScene`.
- Use `Phaser.Scale.RESIZE`; keep the menus, every campaign level button, and the entire plate usable in narrow portrait, phone landscape, and desktop landscape.
- Campaign completion is persisted through `CampaignProgressStore` in localStorage. Only level 1 is initially unlocked; completing an unlocked level opens exactly the next one. Invalid or unavailable storage falls back to in-memory first-level progress.
- A board itself is regenerated from its mode, seed, and number; generated coordinates are not persisted.
- `BrowserLevelGenerator.generate()` and worker requests without a kind remain the full 55-piece generator API. The public run uses `generateEndlessRun()` and `kind: "endless-run"`; progression uses `generateProgression()` and `kind: "progression"`.

## Git workflow

- The repository is initialized locally. Commit every completed logical change before handoff.
- Keep dependency caches, `node_modules`, build output, and temporary files untracked.
- Do not amend or rewrite existing commits unless the user explicitly asks.

## Verification

Before handoff:

1. Run `pnpm test` (or the equivalent `node --test` if the package-manager bootstrap is blocked by a local build-script policy).
2. Run `pnpm build` (or invoke the installed Vite CLI directly for the same reason).
3. Verify exact 55-piece counts for both endless variants.
4. Replay generated solution certificates for all campaign levels and a sequence of levels in both endless variants.
5. Verify campaign boundaries at levels 1, 2, 3, 4, 10, and 17, plus the challenge-quality gate for every campaign level.
6. Smoke-test the start menu, the endless lock message and unlock after level 9, all campaign buttons, rejecting a locked level, completing level 1, unlocking level 2, persistence after reload, the standard endless mode, both board return controls, and phone portrait layout. Keep the internal quintessence generator covered by automated tests.
7. Verify the 37/61/91 endless staging, endless removal awards, all streak thresholds, board-size bonuses, dead-end run termination, new-run reset, disabled backward farming, and narrow-layout score HUD.
8. Verify campaign score persistence, first-completion-only awards, no campaign streak, and the level-9 endless-unlock notification.
9. Verify economy migration/persistence, idempotent campaign dust, endless dust rewards, all shop purchases, inventory consumption, depleted-item `+` dialogs, score-safe Undo, dead-end Rescue, and the permanent `ASSISTED` marker.

See `RULES_AUDIT.md` for the source audit behind the contract.
