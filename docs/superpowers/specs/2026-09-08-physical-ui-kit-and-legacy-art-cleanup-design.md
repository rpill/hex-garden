# Hex Garden — Physical UI Kit + Legacy Art Cleanup Design

## Status

Approved direction in chat on 2026-09-08. Implementation has not started yet.

## Goal

Bring every non-board visual on the live product into the same material, physical language as the accepted current board candidate, while removing obsolete experimental art/theme plumbing from the repository.

The board geometry, current V11-derived 256px runtime cell/piece sprites, gameplay rules, responsive layout contracts, progression/economy behavior, and immediate no-animation piece removal remain unchanged.

## Visual target

The interface should read as parts of one physical tabletop apparatus rather than flat game UI layered around a rendered board.

Material language:

- deep green felt for recessed/background surfaces;
- dark walnut / near-black lacquered wood for substantial structural plates;
- aged brass for thin trim, fasteners, separators, and hardware;
- ivory ceramic only for selected light inserts and neutral highlights;
- dark satin metal for compact system controls where wood would feel too heavy.

Avoid:

- fantasy/RPG ornament;
- casino/neon language;
- parchment/sketchbook treatment;
- generic mobile-game gradients;
- baking localized labels, counts, prices, or scores into raster assets.

## Production strategy

Use a hybrid system:

1. Blender generates a small reusable physical UI kit, not complete screens.
2. Phaser remains authoritative for layout, responsive sizing, state, localization, text, counts, interactions, and scene composition.
3. Raster UI components are exported as high-quality master art and converted to runtime-sized assets before entering `public/assets`.
4. Stretchable components use NineSlice-compatible geometry with visually quiet center regions.
5. Simple semantic glyphs are one coherent neutral system and are not inherited from Chequered Ink or Mechanized Magic.

The Blender factory is a source-art tool, not a runtime dependency.

## UI kit V1 components

### 1. `system-button`

Compact square/round physical control for Pause, Restart, Shop, Settings, Back where an icon-only control is appropriate.

- dark satin metal or dark lacquered wood body;
- thin brass rim;
- ivory/brass engraved glyph;
- separate idle/hover/pressed state should preferably be achieved in Phaser via small scale/brightness/depth changes instead of separate baked bitmaps unless a baked physical depression is materially better.

### 2. `action-button`

Wide physical control for Move, Undo, Rescue and primary textual actions.

- walnut body;
- brass edge/hardware;
- neutral center suitable for localized Phaser text;
- NineSlice-compatible;
- disabled state is renderer-driven desaturation/alpha, not a separately themed image family.

### 3. `hud-plate`

Long compact plate for Level / Remaining / Score information.

- walnut or dark metal structure;
- thin brass trim;
- no baked text;
- must scale horizontally without distorting corners/trim.

### 4. `inventory-tray`

Physical tray under the board inventory.

- walnut structure;
- felt recess;
- brass separators/edge only where needed;
- current physical atom sprites remain the inventory identity;
- counts remain Phaser text beside the sprites.

### 5. `counter-plate`

Small physical support for dust/currency and other compact counters.

- visually lighter than the main HUD plate;
- reuses the same coin asset for dust unless the dust identity is redesigned later;
- number remains Phaser text.

### 6. `panel`

Reusable modal/completion/settings surface.

- substantial walnut frame;
- felt or ivory inset depending on content density;
- brass edge/hardware;
- scalable with NineSlice;
- one base component supplies Pause, mechanic introduction, purchase dialogs, completion, and larger scene cards.

### 7. `card`

Medium physical card/slot for Shop products, campaign levels, leaderboard rows, and settings rows.

- derived from the same materials as `panel`, lighter visual weight;
- semantic state is renderer-owned via small tint/trim/accent changes;
- no independent fantasy/mobile art family per scene.

## Board-first rollout

The first live integration targets only the Board scene and its Board-owned overlays:

- Pause;
- Restart;
- Level / remaining / score HUD;
- dust display;
- Shop;
- Settings;
- atom inventory tray;
- Move / Undo / Rescue;
- mechanic introduction panel;
- depleted-item purchase dialog;
- Pause modal.

The Board must become visually coherent before the same kit is propagated to Menu, Level Select, Shop, Settings, Leaderboard, and Completion.

## Icon system

Replace the current Chequered Ink icon dependency with one coherent icon family.

Required semantic glyphs include at least:

- back;
- pause;
- restart;
- settings;
- shop;
- hint/move;
- undo;
- rescue;
- rating/leaderboard;
- success;
- failure;
- next;
- check;
- lock/unavailable;
- reward/count badges if still needed after UI simplification.

Glyphs should be simple geometric engravings/inlays, primarily ivory or muted brass. They may be renderer-drawn vectors or bundled SVG/PNG assets, but must share stroke weight, corner language, and physical treatment. Do not reuse old Chequered Ink icons in the final physical UI.

## Runtime asset pipeline

- Blender/source master raster: 1024px class where useful for source iteration.
- Runtime square icons/components: generally 256px or smaller according to actual display size.
- Large NineSlice panels may use larger masters only where the edge detail benefits from it.
- Runtime derivatives must be generated offline with premultiplied-alpha high-quality downsampling; Phaser should not be responsible for extreme 1024px -> ~50–150px reductions.
- Keep the accepted 256px board-cell and all 15 current piece sprites unchanged during this UI pass.

## Code architecture

### `src/art-theme.ts`

Remove the runtime theme switch once the physical UI no longer depends on Chequered assets. Physical Premium becomes the single active production art path rather than a `premium | chequered` comparison mode.

### `src/art-assets.ts`

Refactor from legacy `ci-*` frame identifiers into neutral production identifiers. It should preload only assets that remain in the product.

Do not preserve old names just to keep historical tests passing.

### `src/game/ui.ts`

Retain the existing reusable Phaser abstractions (`makePanel`, `AtlasButton`, NineSlice/responsive behavior), but make their production rendering use the new physical kit.

Renderer still owns:

- hover/pressed scale;
- disabled alpha/desaturation;
- semantic state accents;
- text and localization;
- responsive sizes;
- hit areas.

### Scenes

Scene semantics and layout contracts do not change during visual migration. Scene code should consume the same reusable UI primitives rather than directly depending on themed file paths.

## Legacy cleanup

Cleanup happens only after references are migrated and tests prove the files are dead.

### Delete completely

- `public/assets/art-tests/**` — rejected B5 Adventure/RPG/Space bake-off assets.
- `public/assets/mechanized-magic/**` — rejected live candidate.
- `public/assets/chequered-ink/**` — after the last production icon/frame reference is removed.
- `src/art-theme.ts` — after the comparison theme path is removed.
- `test/art-theme-contract.test.js` — obsolete once there is no theme switch.
- old B5/B6/B7 tests whose only purpose is to require rejected assets/theme branches; replace them with production physical-UI contracts instead of weakening them.

### Delete old source-art experiments from `assets/`

The current repository contains large historical art experiments that are not runtime sources and no longer define the active direction, including:

- `assets/Mechanized Magic/**`;
- `assets/alchemy_elements/**`;
- old paper/sketchbook background, board-state, button-state, controls, feedback, level-state, panel, FX and font experiments;
- `assets/v2/**`;
- `assets/v3/**`;
- old generated sheets and sketchbook references.

These should be removed from the working repository after confirming none are used by build/scripts/tests. The authoritative current art source is the physical asset factory kept outside/runtime-exported into `public/assets/physical-premium` plus the new physical UI factory/source bundle.

### Delete stale generated context copies

`_chatgpt_bundle/**` contains old generated handoff bundles and should not be versioned as current source. The project already has `pnpm context` / `pnpm context:last` to regenerate context on demand.

### Documentation cleanup

- remove or archive obsolete physical directions that explicitly describe rejected B5/B6 experiments;
- keep only design/history that is useful for understanding current product contracts;
- update `ART_DIRECTION.md`, `CURRENT_STATE.md`, `THIRD_PARTY_ASSETS.md`, and `TREE.txt` after migration;
- `docs/archive/**` may be removed if the user wants a genuinely lean repository; it must never remain a source of active requirements.

## Safety rules for cleanup

Before deleting any file/folder:

1. search `src/**`, `test/**`, `scripts/**`, root docs/config, and build inputs for references;
2. migrate production references first;
3. run typecheck/tests/build;
4. only then delete the dead asset family;
5. rerun typecheck/tests/build after deletion.

Never delete current physical board/piece assets simply because their source factory lives outside the game repository.

## Testing contract

Add/adjust tests so they verify production behavior rather than historical asset families:

- no runtime references to `chequered-ink`, `mechanized-magic`, or `art-tests`;
- no `ArtThemeId` / query-theme comparison path remains;
- every required physical UI frame has a runtime file;
- all runtime physical PNGs use bounded production dimensions;
- Board inventory and Board pieces still use the same accepted physical atom assets;
- UI text remains Phaser text rather than baked into images;
- Board responsive layout contracts are unchanged;
- immediate piece removal remains immediate and animation-free.

Required final verification:

```text
pnpm typecheck
pnpm test
pnpm build
```

## Rollout / commits

Do not combine the whole visual migration into one unreviewable commit.

Recommended checkpoints:

1. Physical UI factory/source kit + Board runtime components.
2. Board live integration accepted visually.
3. Remaining scenes migrated to the same kit.
4. Legacy theme/art deletion + documentation cleanup.

The cleanup commit should contain deletion only after the new physical path is already proven live.
