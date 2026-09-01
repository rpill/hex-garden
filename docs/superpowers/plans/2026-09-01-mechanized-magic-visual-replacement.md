# Mechanized Magic Visual Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every runtime Hex Garden visual asset with a coherent dark-and-gold Mechanized Magic theme.

**Architecture:** Copy a curated CC0 subset into `public/assets/mechanized-magic` and expose every image through `src/art-assets.js` as an individual Phaser texture key. Shared UI helpers preload the catalog and switch texture keys for component states; scenes consume semantic names and retain their existing behavior.

**Tech Stack:** Phaser 3, Vite, native ES modules, PNG assets.

**Spec:** `docs/superpowers/specs/2026-09-01-mechanized-magic-visual-replacement-design.md`

## Global Constraints

- Do not change rules, economy, scoring, progression, localization, or navigation behavior.
- Do not generate or bundle a bitmap background in this change.
- Do not use TDD; delete visual-only tests and retain behavioral coverage.
- Preserve all runtime labels as Phaser text and preserve internal atom IDs.
- Do not stage unrelated pre-existing deletions or untracked source assets.

---

### Task 1: Curate the runtime asset set

**Files:**
- Create: `public/assets/mechanized-magic/hud/*.png`
- Create: `public/assets/mechanized-magic/icons/*.png`
- Create: `public/assets/mechanized-magic/atoms/*.png`
- Create: `public/assets/mechanized-magic/LICENSE.txt`
- Modify: `THIRD_PARTY_ASSETS.md`

**Interfaces:**
- Consumes: CC0 PNG files under `assets/Mechanized Magic`.
- Produces: stable lowercase filenames used by `MECHANIZED_ASSET_URLS`.

- [ ] Copy dark HUD files for ordinary panels/buttons and matching gold HUD files for hover, selected, current, success, and reward states.
- [ ] Copy distinct Status/Icon images for all 15 internal atom types, including internal Quintessence contract coverage.
- [ ] Copy semantic control images for back, next/play, settings, pause, hint, undo, rescue, rating, dust, shop, lock, check, retry, success, failure, and reward.
- [ ] Copy `_License.txt` as the runtime license and record Dumivid's CC0 pack in `THIRD_PARTY_ASSETS.md`.
- [ ] Commit only the curated runtime directory and attribution as `assets: add mechanized magic runtime set`.

### Task 2: Replace the shared asset and UI layer

**Files:**
- Modify: `src/art-assets.js`
- Modify: `src/game/ui.js`
- Modify: `src/scene-background.js`
- Modify: `src/styles.css`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `MECHANIZED_ASSET_URLS`, `UI_FRAMES`, `GAMEPLAY_FRAMES`, `GAMEPLAY_UI_FRAMES`, `ATOM_GLYPH_FRAMES`, `preloadUiAssets(scene)`, and texture-key based `makePanel`/`AtlasButton` behavior.
- Consumes: semantic texture keys from Task 1.

- [ ] Replace atlas/font/background descriptors with a frozen key-to-URL catalog and a dark metallic color/font theme.
- [ ] Make `preloadUiAssets(scene)` load every catalog entry once with `scene.load.image(key, url)`.
- [ ] Change panels and buttons from atlas-frame switching to individual texture-key switching while retaining nine-slice sizing and interaction states.
- [ ] Replace image background loading with a procedural dark fill and restrained grid/edge treatment owned by `scene-background.js`.
- [ ] Align the canvas/CSS fallback colors and Phaser game background with the new theme.

### Task 3: Apply semantic textures and colors to every scene

**Files:**
- Modify: `src/game/scenes/MenuScene.js`
- Modify: `src/game/scenes/LevelSelectScene.js`
- Modify: `src/game/scenes/ShopScene.js`
- Modify: `src/game/scenes/SettingsScene.js`
- Modify: `src/game/scenes/LeaderboardScene.js`
- Modify: `src/game/scenes/BoardScene.js`
- Modify: `src/game/completion-overlay.js`

**Interfaces:**
- Consumes: semantic texture keys and theme colors from Task 2.
- Produces: fully Mechanized Magic-rendered scenes without old atlas or paper references.

- [ ] Replace atlas image construction in Board, Shop, and completion UI with individual texture keys.
- [ ] Recolor shared and scene-specific text, overlays, HUD chrome, panel indicators, highlights, and dead-end states for legibility on the dark theme.
- [ ] Render board-cell state textures and atom glyph textures through the semantic catalog while retaining selected/hovered/locked/filter/hint logic.
- [ ] Search `src` and remove every remaining reference to `hex-garden`, `gameplay-atlas`, `ui-atlas`, `paper-background`, and `Neucha`.
- [ ] Commit the shared layer and scene integration as `feat: apply mechanized magic visual system`.

### Task 4: Remove obsolete visual contracts and assets

**Files:**
- Delete: `test/gameplay-art.test.js`
- Delete: `test/responsive-layout.test.js`
- Delete: `test/navigation-layout.test.js`
- Delete: `public/assets/hex-garden/gameplay-atlas.png`
- Delete: `public/assets/hex-garden/gameplay-atlas.json`
- Delete: `public/assets/hex-garden/ui-atlas.png`
- Delete: `public/assets/hex-garden/ui-atlas.json`
- Delete: `public/assets/hex-garden/paper_background.png`
- Delete: `public/assets/fonts/Neucha.ttf`
- Delete: `public/assets/fonts/Neucha-OFL.txt`

**Interfaces:**
- Consumes: completed source migration from Task 3.
- Produces: no obsolete visual tests or runtime-owned visual files.

- [ ] Delete the three visual/layout test files requested by the user; retain renderer-independent mechanics and state tests.
- [ ] Delete the old runtime atlases, paper background, and bundled font after confirming no references remain.
- [ ] Run `rg` across source, tests, and public assets to prove old runtime names are absent.

### Task 5: Verify and commit the completed replacement

**Files:**
- Modify only files requiring fixes discovered by verification.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: a buildable, behaviorally verified visual experiment.

- [ ] Run `pnpm test` and resolve failures without restoring visual snapshot/layout assertions.
- [ ] Run `pnpm build` and resolve all missing texture, import, and bundling errors.
- [ ] Run the app and smoke-check Menu, Level Select, Shop, Settings, Leaderboard, Board, pause, purchase, and completion UI at desktop, portrait, and landscape viewport sizes.
- [ ] Confirm `git diff --check`, inspect the staged file list, and commit removal/verification work as `test: remove obsolete visual contracts`.
