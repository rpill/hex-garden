# Mechanized Magic visual replacement

## Goal

Replace every runtime-owned Hex Garden visual asset with a coherent subset of
`assets/Mechanized Magic` while preserving game rules, progression, navigation,
localization, economy behavior, and responsive interaction.

## Visual direction

- Use `HUD_default_dark` for ordinary panels, controls, and inactive states.
- Use `HUD_default_gold` for selection, rewards, current progress, and emphasis.
- Use distinct `Status`, `Icons`, and `Emojis` images for atoms, navigation,
  boosters, feedback, shop products, settings, and progression states.
- Keep Phaser text for every runtime label, count, price, score, and localized
  string. Internal atom IDs and labels remain unchanged.
- Remove the paper texture and use a neutral dark procedural background for this
  pass. A generated background image may be introduced as a later change.
- Remove the bundled Neucha font and use a system sans-serif display stack.

## Asset integration

Copy only the selected CC0 source images into a compact runtime directory under
`public/assets/mechanized-magic`. The application asset catalog remains the
single source of frame and URL mappings. Shared UI helpers own panel sizing,
button states, text colors, and icon placement so scenes do not duplicate the
theme.

The old `public/assets/hex-garden` atlases, paper background, and bundled font
are removed after no runtime or test reference remains. The Mechanized Magic
license and attribution are recorded in `THIRD_PARTY_ASSETS.md`.

## Scene coverage

Apply the new theme to Menu, Level Select, Shop, Settings, Leaderboard, Board,
pause dialogs, purchase dialogs, tutorial/mechanic cards, inventory controls,
dead-end feedback, score HUDs, and completion overlays. Board states must remain
visibly distinct for idle, hover, selected, locked, filtered, hinted, and
blocked atoms.

## Verification policy

Do not use TDD for this visual experiment. Delete tests whose purpose is to
assert artwork, palette, dimensions, or responsive visual layout. Preserve
behavioral tests for mechanics, progression, persistence, economy, navigation,
and renderer-independent layout calculations when they enforce functional
usability rather than appearance.

After implementation, run the remaining test suite and production build. Smoke
check the principal scenes at desktop, portrait, and landscape sizes, including
live resize, interactive state contrast, navigation, level locking, inventory,
and completion dialogs.

## Out of scope

- No generated bitmap background in this change.
- No game-rule, economy, scoring, progression, or localization changes.
- No new sound assets or animation system.
- Do not commit unrelated pre-existing deletions or untracked source assets.
