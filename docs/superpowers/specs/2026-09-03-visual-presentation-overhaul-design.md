# Hex Garden — Visual Presentation Overhaul

## Status

Approved by the user for implementation on 2026-09-03.

## Goal

Rebuild the presentation layer of Hex Garden so the game feels like one deliberate puzzle product rather than a collection of generic asset-pack components.

This is a visual/UX architecture pass, not a gameplay rewrite. The existing rules, board logic, solver, generators, progression, scoring, economy values, persistence, Yandex rewarded-ad behavior, and public-mode contract remain unchanged.

The current Chequered Ink integration is useful as a technical baseline and provisional asset source, but it is not accepted as the final visual identity. The implementation must make future asset swaps easier rather than binding the product to the current gems or Cartoon UI.

## Problems to solve

The current live build has several systemic presentation issues:

- dark 3D hex tokens dominate the board and make the playfield feel heavy and cheap;
- pieces are visually subordinate to the cells instead of being the focus;
- hover/selection feedback is too bright and distracting;
- buttons duplicate meaning with both an icon and the same symbol in their text (for example icon + `← НАЗАД`, icon + `Ⅱ ПАУЗА`);
- global navigation icons are too small and inconsistent;
- the campaign screen wastes most of the available canvas while level tiles remain tiny;
- the completion overlay is oversized and text-heavy, and its layout becomes unstable after level completion;
- dust has no strong persistent visual identity and is often represented only by text;
- the shop is text-heavy, visually weak, and too deeply buried in navigation;
- the same generic framed panel treatment is overused, causing a visible asset-pack/demo look;
- the game needs a clearer hierarchy between board, navigation, economy, rewards, and secondary information.

## Core design principles

### 1. The board is the hero

The player should notice pieces and legal interaction first, not cell frames or HUD chrome.

- Empty board cells must recede visually.
- Pieces should be larger and carry most of the color.
- The board may still use the existing logical hex grid, but presentation should read as a coherent surface rather than 37/61/91 individual buttons.
- Decorative treatment must never obscure legal-state readability or hex boundaries.

### 2. UI recedes; information remains readable

The interface should use restrained containers and strong spacing rather than placing every text block inside a heavy framed rectangle.

- Avoid using the same button/panel frame for every semantic role.
- Prefer hierarchy through scale, spacing, typography, iconography, and grouped layout.
- Dynamic labels, counts, prices, scores, and localization remain renderer text.

### 3. One semantic role, one visual signal

Do not duplicate an icon with the same symbol in text.

Examples:

- back: arrow icon + `НАЗАД`, not arrow icon + `← НАЗАД`;
- pause: pause icon only, not pause icon + `Ⅱ ПАУЗА`;
- settings: gear icon only;
- shop: cart/basket icon only;
- dust: dust/coin icon + number, not repeated `ПЫЛЬ` labels where the icon already establishes the meaning.

### 4. Feedback is subtle by default

Hex Garden is a deliberate puzzle game. Hover should assist targeting, not compete with the board.

- Hover: slight brightness lift / soft halo / very small scale lift; no white disk and no thick ring.
- Selected: stronger than hover but still restrained.
- Hint: visually distinct from hover and selection, preferably a soft pulse.
- Blocked/illegal: readable but not aggressively saturated.

### 5. Asset identity stays replaceable

The code should continue to map semantic visual roles to asset files. The next final asset family may replace Chequered Ink without touching rules or progression.

## Architecture

### Presentation boundary

Rules and generation remain renderer-independent. Visual work should remain concentrated in:

- `src/art-assets.js`;
- `src/game/ui.js`;
- `src/game/scenes/BoardScene.js`;
- `src/game/scenes/MenuScene.js`;
- `src/game/scenes/LevelSelectScene.js`;
- `src/game/scenes/ShopScene.js`;
- `src/game/scenes/SettingsScene.js`;
- `src/game/scenes/LeaderboardScene.js` where shared global navigation applies;
- `src/game/completion-overlay.js`;
- existing layout/background helpers only when required by these screens.

Do not modify gameplay behavior in `rules.js`, `board.js`, `solver.js`, `generator.js`, `campaign.js`, `progression.js`, or economy constants as part of this pass.

### Shared UI primitives

The existing UI helpers should be extended/reorganized only as far as needed to establish reusable semantic primitives:

- icon-only global action button;
- icon + text navigation button;
- standard text button;
- level tile/card;
- compact currency display;
- product card;
- compact result/reward row.

These components should own icon sizing, spacing, hit target sizing, hover treatment, and text/icon duplication rules so individual scenes do not reinvent them.

Do not introduce a new general-purpose UI framework.

## Global navigation

### Shop and Settings

Shop and Settings are global first-class destinations.

On key product screens, place two consistent icon-only controls near the top-right:

```text
[ SHOP ] [ SETTINGS ]
```

Visually these are cart/basket and gear icons, not text labels.

Requirements:

- identical outer dimensions;
- sufficiently large click/tap targets;
- glyph occupies roughly 55–65% of the control instead of appearing as a tiny icon in a large box;
- same position/order across screens whenever both are present;
- Shop opens `ShopScene` directly with no intermediate menu;
- Settings opens `SettingsScene` directly;
- Shop button is omitted while already in `ShopScene`;
- Settings button may be omitted while already in `SettingsScene`;
- returning from Shop/Settings should preserve the appropriate previous destination using the existing navigation model rather than creating a second navigation stack.

### Board access

The board must also expose Shop and Settings directly. They should remain visually quiet so they do not compete with the puzzle.

Pause remains a separate control whose purpose is pausing, not serving as a navigation hub.

### Back

Back uses one arrow glyph plus plain localized text `НАЗАД` where text is useful. Never include a second arrow character in the string.

## Board presentation

### Cell treatment

Remove the current heavy 3D dark token treatment as the default board cell presentation.

Preferred implementation direction:

- use a flatter, lower-contrast cell/frame treatment;
- preserve enough separation to read the hex topology;
- avoid thick bevels and repeated high-contrast borders;
- keep empty cells darker/quieter than occupied cells;
- do not turn every empty cell into a strong button-like object.

The current flat token variants or renderer-drawn cells may be used for the first pass. This spec intentionally does not lock the game to a final cell asset.

### Pieces

- Increase piece prominence relative to the cell.
- Keep the current semantic asset mapping architecture.
- Current gem pieces remain provisional for this pass so layout and interaction can be evaluated independently of final art sourcing.
- Do not redesign rules around gem shape/color.

### Hover, selection, hint, blocked states

State precedence must remain logically unambiguous.

Suggested visual intensity from weakest to strongest:

```text
idle < hover < selected < explicit hint/attention
```

But hint must differ in motion/timing or hue from selection rather than merely being a brighter version of the same state.

Implementation requirements:

- remove the current bright filled hover disk;
- no thick yellow hover ring;
- hover may use slight alpha/brightness change, a soft additive halo, and/or ~3–5% scale lift;
- selected may use a thin soft ring or stronger halo;
- hint may pulse softly;
- feedback must render correctly for PNG pieces as well as fallback-rendered pieces.

## Dust / currency identity

Dust needs one persistent visual identity.

Use a dedicated currency icon with number wherever possible:

```text
[icon] 38
[icon] +8
30 [icon]
```

Requirements:

- persistent compact dust display on primary navigation/product screens;
- Shop header includes current dust balance;
- Completion overlay shows earned dust and resulting balance using the same icon;
- product prices use the same icon;
- avoid repeating the word `ПЫЛЬ` where the icon and location already establish meaning;
- dynamic values stay text, not baked into sprites.

The existing provisional gold coin/dust icon may be used until a stronger currency asset is found.

## Campaign / Level Select redesign

The current campaign layout is too sparse at screen level and too dense at tile level.

### Desktop target

Use the available central area with large level tiles/cards, approximately 5–6 per row depending on actual responsive width.

A desktop composition should read approximately as:

```text
                  КАМПАНИЯ
        Пройдено 7/24     Счёт 12 430     [dust]

      [ 01 ✓ ] [ 02 ✓ ] [ 03 ★ ] [ 04 ] [ 05 ] [ 06 ]
      [ 07   ] [ 08 🔒] [ 09 🔒] ...
```

Requirements:

- level tiles are substantially larger than the current implementation;
- the level grid uses a meaningful share of the viewport;
- locked/current/completed states are primarily visual, not tiny status text;
- tutorial remains a distinct accessible entry but should not be a tiny special-case button;
- responsive portrait/landscape behavior remains usable;
- no requirement for pixel-identical row counts across form factors.

## Shop redesign

The Shop is a major product screen, not a debug table.

### Desktop composition

Use three large product cards when width allows:

```text
                     МАГАЗИН                 [dust balance]

      ┌──────────┐   ┌──────────┐   ┌──────────┐
      │  ICON    │   │  ICON    │   │  ICON    │
      │  НАМЁК   │   │  ОТМЕНА  │   │ СПАСЕНИЕ │
      │ short    │   │ short    │   │ short    │
      │ owned xN │   │ owned xN │   │ owned xN │
      │ 30 [dust]│   │ 50 [dust]│   │ 60 [dust]│
      │ [КУПИТЬ] │   │ [КУПИТЬ] │   │ [КУПИТЬ] │
      └──────────┘   └──────────┘   └──────────┘
```

Requirements:

- product icon is a major visual element;
- title is concise;
- description is reduced to one short supporting line or moved to hover/tap detail if needed;
- owned count is visible but secondary;
- price uses dust icon + number;
- one clear purchase action per card;
- disabled purchase state communicates insufficient currency without flooding the card with text;
- responsive layouts may stack cards on narrow screens;
- retain existing economy values and purchasing behavior.

No forced addition of weak placeholder icons. If no acceptable semantic icon exists for a booster, a strong text-first/product-shape treatment is preferable to an unrelated icon.

## Completion overlay redesign

The completion overlay should become a compact result card rather than a near-full-screen dialog.

Target hierarchy:

1. `УРОВЕНЬ ПРОЙДЕН`;
2. primary score reward / result;
3. compact reward rows (dust, total score/progress);
4. unlock message when present;
5. primary next-level action;
6. secondary return action.

Requirements:

- target desktop card width roughly 500–600 px, adjusted responsively;
- no oversized empty regions;
- no vertical pile of equally weighted text blocks;
- completion content must remain stable when optional unlock/reward rows appear;
- buttons remain inside the card bounds at all supported layouts;
- dust reward uses the shared currency presentation;
- keep existing score/dust count-up behavior unless layout stability requires timing-only adjustments; do not change reward amounts.

## Settings and other icon buttons

- Increase gear and other icon glyph sizes inside their controls.
- Standardize global icon-control hit areas.
- Prefer icon-only controls for universally understood global actions.
- Do not shrink icons merely to fit old padding assumptions; update the component padding instead.

## Asset usage for this pass

### Provisional / allowed

- current Chequered Ink gems as temporary pieces;
- flatter board-token variants or renderer-drawn low-contrast cell treatment;
- Chequered Ink basic black UI where a neutral temporary control/background is needed;
- existing provisional dust/coin icon;
- other already-integrated compatible assets only when they clearly fit the semantic role.

### Explicitly not a goal

- proving Chequered Ink is the final style;
- forcing Animals, Pipes, chess pieces, flowers, weapons, food, potions, or unrelated Iconic GFX into the game;
- decorating every empty area;
- adding screenshot-specific art hacks that only work at one resolution.

Asset research continues in parallel after this structural pass.

## Responsive behavior

Preserve the existing contract for desktop, phone portrait, and phone landscape.

The redesign may change exact coordinates, row counts, margins, panel widths, and action-dock composition, but it must preserve:

- usable entire board;
- readable campaign grid;
- accessible Shop and Settings;
- stable completion card;
- usable purchase cards;
- visible back/navigation actions;
- no overlap that blocks primary interaction.

## Testing strategy

### What tests should protect

Add or update tests only for semantic behavior that should survive future art replacement, for example:

- icon/text composition does not duplicate an arrow/pause symbol in localized labels;
- global navigation exposes direct Shop and Settings destinations where required;
- shared currency presentation receives the correct numeric values;
- level-layout helper produces reasonable tile sizing/counts for representative desktop/portrait/landscape widths;
- shop card data preserves bundle quantity, price, owned count, and disabled/affordable state;
- completion layout data remains valid with and without unlock rows;
- board visual-state resolution distinguishes idle/hover/selected/hint without changing board rules.

### What tests must NOT protect

Do not add tests that freeze:

- exact PNG filenames unless testing asset-map completeness itself;
- specific Chequered Ink assets as permanent product requirements;
- exact colors;
- exact pixel coordinates;
- screenshot/pixel-diff output;
- exact decorative spacing;
- a final theme that has not been selected.

Existing gameplay/rules/generator/solver/economy tests remain the guardrail against accidental mechanics changes.

## Verification

Before implementation handoff:

1. run focused tests added for shared UI/layout behavior;
2. run the existing automated suite, documenting the known long-running `progression.test.js` separately if it still times out for the same pre-existing reason;
3. run `pnpm build` in an environment with installed dependencies;
4. manually smoke-test at least:
   - 37-cell board;
   - 61-cell board;
   - 91-cell board;
   - hover, selected, hint, blocked feedback;
   - direct Shop button from Board and Level Select;
   - Settings button sizing;
   - campaign screen on desktop and phone layouts;
   - Shop affordability/owned states;
   - completion overlay with and without an unlock;
   - dust balance consistency across board/navigation/shop/completion;
5. confirm no gameplay/economy constants changed.

## Success criteria

The pass is successful when:

- the board no longer reads as a wall of heavy 3D hex buttons;
- pieces visually dominate cells;
- hover feels subtle instead of attention-grabbing;
- icon duplication is removed consistently;
- Shop and Settings are one-click global destinations on key screens;
- level tiles use the available viewport and are comfortably readable;
- completion content is compact and stable;
- dust has a consistent icon-based identity;
- the Shop is primarily visual and scannable rather than a wall of text;
- future asset replacement can happen through the presentation mapping without rewriting game rules.
