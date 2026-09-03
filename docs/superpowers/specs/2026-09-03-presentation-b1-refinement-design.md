# Hex Garden — Presentation B1 Refinement Design

## Status

Approved design revision for the current Hex Garden presentation overhaul.

This document supersedes the visual/layout decisions from `2026-09-03-visual-presentation-overhaul-design.md` wherever they conflict. The earlier document remains historical context for how the first pass was structured; this document defines the active B1 refinement.

The goal is not to select a final art pack. The goal is to remove the generic asset-pack look, fix the navigation/layout bugs exposed by the first live test, and establish a calmer presentation system that can accept stronger assets later without another structural rewrite.

## Non-goals

- Do not change puzzle rules, generator behavior, solver behavior, scoring, campaign progression, economy values, or persistence contracts.
- Do not rename internal atom IDs or rule concepts solely for presentation.
- Do not add screenshot/pixel-diff tests that lock the project to a particular art pack, color, font, or exact coordinate.
- Do not treat the current Chequered Ink gems or icons as final art.
- Do not keep polishing the current Cartoon UI surfaces as the primary visual language.

## Core presentation direction

### Neutral renderer-owned surfaces

The main UI surfaces should be drawn primarily with Phaser primitives and renderer text rather than built from large decorative Cartoon UI images.

Use:

- dark neutral translucent/opaque panels;
- subtle one-pixel or low-contrast borders;
- restrained corner radii where practical;
- renderer text for dynamic labels, counts, prices, score, tutorial copy, and localization;
- third-party raster assets mainly for pieces, currency/item icons, and high-salience symbols.

The UI should recede behind the board. It should not read as a collection of premade grey buttons.

### Temporary asset role

Chequered Ink remains acceptable as temporary implementation material for:

- puzzle pieces/gems;
- selected system icons where they read clearly;
- dust/coin icon;
- any small symbolic asset that survives live evaluation.

It should not define the shape and chrome of every panel, button, level tile, modal, or navigation surface.

## Board presentation

### Cells

Empty board cells should be quiet. Do not use thick 3D token assets as the visual base of every cell.

Render each empty hex as a low-contrast hex outline/fill directly in Phaser. The board should read as one coherent surface rather than a pile of individual dark buttons.

### Pieces

Pieces remain the dominant visual objects on the board. Temporary gems may continue to be used while stronger candidate packs are searched.

Increase piece salience through scale and contrast rather than through heavy cell chrome.

### Hover

Hover must be deliberately subtle:

- no large white disc;
- no thick yellow ring;
- no high-contrast filled overlay;
- at most a slight brightness increase, very soft halo, and/or approximately 2–4% scale increase.

The player should be able to tell which piece is under the pointer without the entire board composition shifting attention toward it.

### Selected

Selected state is stronger than hover but still restrained. It may use a thin accent ring or soft glow. It must not resemble the old high-contrast spotlight.

### Hint

Hint feedback must be visually distinct from hover and selection. Prefer a soft slow pulse or gentle accent. Avoid the same ring language used by direct pointer interaction.

### Inventory-panel filtering

Selecting an atom type in the bottom inventory must not draw rings around every matching board piece.

If type filtering remains, express it by slightly dimming non-matching pieces while preserving matching pieces at normal brightness. Clearing the filter restores all pieces. Avoid scale changes and ring overlays.

### Inventory placement

The inventory panel must be compositionally attached to the board, not to the viewport bottom.

Position it relative to the board bounds with a small consistent gap. On responsive layouts, preserve the relationship between board and inventory rather than preserving a fixed distance from the screen edge.

The inventory surface itself should be visually light and compact; it should not look like a detached modal.

## Tutorial redesign

The current tutorial presentation is replaced.

### Structure

The tutorial contains exactly three presentation steps. The tutorial header uses real tutorial progress:

- `ОБУЧЕНИЕ · ШАГ 1/3`
- `ОБУЧЕНИЕ · ШАГ 2/3`
- `ОБУЧЕНИЕ · ШАГ 3/3`

Do not use remaining-piece counts such as `8/8` as tutorial progress.

### Copy

Show at most one short explanatory sentence at a time. Avoid all-caps imperative copy and multi-line instruction stacks that compete with the board.

Step 1 teaches availability: a piece can be removed when three neighboring empty cells are consecutive around it.

Step 2 teaches ordinary matching: select a legal matching pair.

Step 3 consolidates the current tutorial layout: opening new cells and clearing the remaining legal pairs. Do not introduce metal-chain or wildcard mechanics solely to satisfy presentation; the current tutorial data contains ordinary element pairs.

The exact localized wording may be tuned for clarity, but each step remains one short sentence.

### Visual guidance

- No animated expanding/contracting circles.
- No pulsing scale changes on tutorial targets.
- No simultaneous geometric overlays that create a second visual puzzle.
- Step 1 may show the three relevant empty neighboring cells with an extremely subtle static green outline/fill.
- Do not label those cells with `1 / 2 / 3`.
- When a tutorial step needs target pieces, give them a subtle static highlight only.
- Tutorial guidance must not overlap the board or navigation controls.

## Global utility navigation

### Shop and Settings controls

Shop and Settings remain direct global actions in the top-right utility cluster on key screens.

Use real semantic icons:

- Shop: cart/basket/store icon, never a gift/present icon.
- Settings: cog icon.

Both controls use the same visual container and click-target size. Normalize raster glyphs by visible content bounds so transparent padding in the source PNG does not make the icon appear tiny.

Target visible glyph occupancy should be approximately 55–70% of the icon-button interior.

### Board-to-utility navigation behavior

Opening Shop or Settings while a board is active must preserve the current board session without leaving a paused BoardScene rendered above the utility scene.

Required navigation behavior:

1. Board records that it is being covered by a utility scene.
2. Launch or wake the requested utility scene.
3. Bring that utility scene to the top of the scene stack.
4. Suspend or pause board input/update while utility UI is open.
5. The utility scene receives a return target identifying the board session.
6. Closing the utility scene returns directly to the same board and resumes it.

The active board must never visually cover the Shop/Settings scene.

This behavior should live in a shared utility-navigation helper rather than ad hoc copies in both Shop and Settings buttons.

## Level Select

### Layout

Keep the larger level tiles from the first overhaul, but refine their state language.

Desktop target: approximately 5–6 tiles per row, using the available central width without creating a tiny island of levels.

### Level states

A level's semantic state remains visible while hovered.

Hover must not swap every level to one generic hover texture/color. Instead:

- retain the tile's state surface/color;
- apply only a small brightness/alpha/scale response;
- completed remains completed;
- current/playable remains current/playable;
- locked remains locked.

Locked levels should not visually resemble hovered available levels.

### State markers

Use small, clear state markers only where helpful. Do not clutter every locked tile with a high-contrast `X` if the tile's disabled state already communicates lock status. Prefer a quiet lock symbol or reduced text/contrast.

Tutorial level `00` may remain visually distinct, but it should belong to the same grid system rather than look like a separate promotional button.

## Completion overlay

### Card

Keep the compact result-card direction, but fix its layering and spacing.

The result card must fit all content and actions without overlapping the bottom edge.

### Content hierarchy

Order:

1. success icon and `УРОВЕНЬ ПРОЙДЕН`;
2. primary score/result;
3. dust reward with dust icon;
4. campaign progress bar and `X / 24` progress text;
5. unlock message when applicable;
6. actions.

If score was already credited on a repeat clear, the primary line may say so, but it must not consume the space reserved for campaign progress.

### Progress bar

The campaign progress bar must render above the card background and remain visible. Its drawing layer/depth must be explicitly higher than the card fill/background.

### Buttons

Primary and secondary actions must have a fixed vertical gap and fit inside the card. Their center-to-center spacing must exceed the sum of their half-heights plus the intended gap.

Do not let the buttons touch or extend below the card.

## Shop

### Entry icon

Replace the temporary gift icon with a real cart/basket/store symbol before treating the screen as visually testable.

If the current asset packs do not contain a suitable icon, use a simple renderer-drawn cart icon temporarily or add a small suitable licensed system-icon asset. Do not use semantically incorrect imagery.

### Screen structure

Keep the three-card shop concept but remove decorative premade panel chrome. Cards use neutral renderer-owned surfaces.

Each product card contains:

- large item icon;
- item name;
- short one-line description where space permits;
- owned count;
- bundle quantity;
- dust price shown as icon + number;
- one buy action.

On short landscape layouts, description may be omitted to keep all three cards usable in one row.

The screen should be visually object-led rather than text-led.

## Buttons and icon controls

### Text duplication

Never duplicate an icon semantically in text.

Examples of forbidden combinations:

- arrow icon + text beginning with `←`;
- pause icon + `Ⅱ ПАУЗА`;
- cart icon + gift imagery;
- settings icon plus a redundant gear glyph in text.

### Text buttons

Use renderer-owned button surfaces for large text actions. Keep third-party texture dependency optional.

Button states should be expressed primarily with subtle surface/border/brightness changes, not completely different premade texture families.

### Icon-only buttons

Use consistent click targets. Raster glyphs must be normalized for transparent margins before visual sizing.

## Dust language

Dust remains an icon-led currency representation.

Use the same dust/coin icon consistently in:

- global HUD balance;
- Shop prices;
- completion rewards;
- purchase dialogs and any other player-facing economy display.

Avoid repeating the word `ПЫЛЬ` where the currency icon plus number is sufficient and unambiguous.

## Testing policy

Add/adjust tests only for semantic behavior that would remain valid through future visual reskins.

Good test targets:

- utility navigation brings Shop/Settings above Board and returns to the same board session;
- tutorial progress is true `1/3`, `2/3`, `3/3` state rather than remaining-piece count;
- level hover preserves level semantic state;
- completion layout data keeps progress bar above background and action rectangles non-overlapping;
- inventory filtering produces semantic dimming state rather than a ring requirement;
- icon controls do not include redundant arrow/pause glyph text.

Do not test:

- exact RGB values;
- exact PNG file names unless required for load integrity;
- pixel coordinates that are not semantic layout contracts;
- exact font family;
- exact hover glow radius;
- screenshot output.

## Files expected to participate

Likely active presentation files include:

- `src/game/ui.js`;
- `src/game/navigation-layout.js`;
- `src/game/responsive-layout.js`;
- `src/game/completion-overlay.js`;
- `src/game/scenes/BoardScene.js`;
- `src/game/scenes/LevelSelectScene.js`;
- `src/game/scenes/ShopScene.js`;
- `src/game/scenes/SettingsScene.js`;
- `src/game/scenes/MenuScene.js` where global utility controls are present;
- `src/art-assets.js` for semantic icon mappings only;
- focused new helper/module files if needed to isolate utility navigation or presentation-state calculations;
- focused semantic tests under `test/`.

Rules/generator/solver/economy logic are outside this change unless a test exposes an existing presentation boundary bug that requires a minimal adapter without changing game behavior.

## Acceptance criteria

B1 is acceptable when all of the following are true in live desktop testing:

- board cells are quiet and pieces dominate the board;
- ordinary hover no longer steals attention;
- inventory filtering does not create rings across the board;
- inventory sits compositionally with the board;
- tutorial shows three real steps with one short sentence each and no pulsing geometric clutter;
- level hover preserves the level's semantic state;
- Shop uses a cart/store metaphor, not a gift metaphor;
- Settings and Shop glyphs are visually large enough inside consistent controls;
- opening Shop or Settings during a board session visibly opens that scene and returns to the same board session without apparent freezing;
- completion campaign progress bar is visible;
- completion buttons do not overlap or leave the card bounds;
- Shop and completion rely on neutral renderer-owned surfaces rather than premade Cartoon UI chrome;
- puzzle rules, progression, economy, solver, and generator behavior remain unchanged.
