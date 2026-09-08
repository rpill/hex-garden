# Physical UI Kit + Legacy Art Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining flat/legacy UI art with one reusable physical tabletop UI kit, migrate every scene to neutral production asset identifiers, and delete obsolete art/theme experiments without changing gameplay or board geometry.

**Architecture:** Blender produces seven reusable physical UI surfaces plus one coherent glyph sheet/source family; Phaser remains authoritative for layout, text, localization, interaction, state, and responsive sizing. The accepted 256px physical board/piece sprites remain unchanged. Legacy art is deleted only after all runtime references are migrated and the full build/test suite is green.

**Tech Stack:** Phaser 3.90, TypeScript, Vite, Node test runner + tsx, Blender 5.2 Python, offline PNG downsampling.

**Spec:** `docs/superpowers/specs/2026-09-08-physical-ui-kit-and-legacy-art-cleanup-design.md`

## Global Constraints

- Do not change board geometry, piece placement, gameplay rules, progression/economy behavior, or immediate animation-free removal.
- Keep the accepted `public/assets/physical-premium/board-cell.png` and all 15 current 256px piece sprites unchanged during this pass.
- Blender/source masters may be 1024px class; runtime derivatives must be bounded and generated offline with high-quality premultiplied-alpha downsampling.
- Localized labels, counts, prices, scores, and other dynamic strings remain Phaser text.
- No fantasy/RPG ornament, casino/neon language, parchment/sketchbook treatment, or generic mobile gradients.
- No runtime references to rejected Chequered Ink, Mechanized Magic, or B5 art-test families after migration.
- Required final verification: `pnpm typecheck`, `pnpm test`, `pnpm build`.

---

## File structure

### New source-art tool

- Create `tools/physical-ui-factory/physical_ui_factory.py` — Blender geometry/material generation for the seven reusable UI components and neutral engraved glyph source meshes.
- Create `tools/physical-ui-factory/render_ui_preview.py` — renders one contact-sheet style preview scene and individual masters.
- Create `tools/physical-ui-factory/ui_manifest.json` — dimensions, NineSlice borders, material parameters, export filenames, icon list.
- Create `tools/physical-ui-factory/README_RU.md` — exact Blender 5.2 commands and tweakable controls.
- Create `scripts/build-physical-ui-runtime.mjs` — converts masters into bounded runtime PNGs using deterministic offline resizing and writes `public/assets/physical-ui/manifest.json`.

### Runtime art boundary

- Modify `src/art-assets.ts` — remove theme branching and legacy `ci-*` identifiers; expose neutral `PHYSICAL_UI_FRAMES`, `GAMEPLAY_UI_FRAMES`, current piece frames, and only production URLs.
- Delete `src/art-theme.ts` after all call sites are migrated.
- Modify `src/game/ui.ts` — make `RendererSurface` map semantic material roles directly to the new physical UI frames; keep Phaser-owned state/hover/pressed/disabled behavior.

### Board-first scene migration

- Modify `src/game/board/BoardHud.ts` — use physical `system-button`, `hud-plate`, and `counter-plate` roles.
- Modify `src/game/board/BoardInventory.ts` — use physical `inventory-tray` and `action-button` roles.
- Modify `src/game/scenes/BoardScene.ts` — use physical `panel` for mechanic/purchase/pause overlays without changing layout or behavior.
- Modify `src/game/completion-overlay.ts` only where Board completion is shown during the Board-first acceptance pass.

### Remaining scene migration

- Modify `src/game/scenes/MenuScene.ts`
- Modify `src/game/scenes/LevelSelectScene.ts`
- Modify `src/game/scenes/ShopScene.ts`
- Modify `src/game/scenes/SettingsScene.ts`
- Modify `src/game/scenes/LeaderboardScene.ts`
- Modify `src/game/completion-overlay.ts`

### Cleanup + docs

- Delete `public/assets/art-tests/**`, `public/assets/mechanized-magic/**`, `public/assets/chequered-ink/**`.
- Delete rejected source-art families under `assets/**` after reference audit.
- Delete `_chatgpt_bundle/**`.
- Delete obsolete theme/visual tests and replace them with production physical-UI contracts.
- Update `ART_DIRECTION.md`, `CURRENT_STATE.md`, `THIRD_PARTY_ASSETS.md`, `TREE.txt`.

---

### Task 1: Add the physical UI Blender factory and runtime export pipeline

**Files:**
- Create: `tools/physical-ui-factory/physical_ui_factory.py`
- Create: `tools/physical-ui-factory/render_ui_preview.py`
- Create: `tools/physical-ui-factory/ui_manifest.json`
- Create: `tools/physical-ui-factory/README_RU.md`
- Create: `scripts/build-physical-ui-runtime.mjs`
- Test: `test/physical-ui-factory-contract.test.js`

**Interfaces:**
- Produces runtime files under `public/assets/physical-ui/` named `system-button.png`, `action-button.png`, `hud-plate.png`, `inventory-tray.png`, `counter-plate.png`, `panel.png`, `card.png`, and `icon-<semantic>.png`.
- Produces `public/assets/physical-ui/manifest.json` with `{ version, surfaces, icons }` and NineSlice border metadata.
- Later tasks consume only these runtime files/metadata, never Blender Python at runtime.

- [ ] **Step 1: Write the failing factory contract test**

Create `test/physical-ui-factory-contract.test.js` with assertions that the manifest declares exactly the seven required surfaces, that each stretchable surface has positive NineSlice borders smaller than half its dimensions, and that the required semantic icon set contains `back`, `pause`, `restart`, `settings`, `shop`, `hint`, `undo`, `rescue`, `rating`, `success`, `failure`, `next`, `check`, and `lock`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --import tsx --test test/physical-ui-factory-contract.test.js`
Expected: FAIL because `tools/physical-ui-factory/ui_manifest.json` does not exist.

- [ ] **Step 3: Implement the Blender factory and manifest**

Use one material system shared by all components:

```python
MATERIALS = {
    "walnut": {"base": (0.12, 0.055, 0.025, 1.0), "roughness": 0.34},
    "brass": {"base": (0.42, 0.22, 0.055, 1.0), "metallic": 0.86, "roughness": 0.28},
    "felt": {"base": (0.018, 0.095, 0.070, 1.0), "roughness": 0.78},
    "ivory": {"base": (0.80, 0.68, 0.48, 1.0), "roughness": 0.31},
    "dark_metal": {"base": (0.035, 0.040, 0.042, 1.0), "metallic": 0.78, "roughness": 0.37},
}
```

Build the seven components from beveled boxes/cylinders with quiet centers. `action-button`, `hud-plate`, `panel`, and `card` must preserve corners/trim inside the manifest-declared NineSlice borders. No text is generated into these surfaces.

- [ ] **Step 4: Implement deterministic runtime conversion**

`scripts/build-physical-ui-runtime.mjs` must read the source manifest and masters, downsample to the manifest runtime dimensions, copy the runtime manifest, and fail if any declared source image is absent. Use a deterministic offline image tool already available in the repository environment; if no image dependency exists, the script must fail with a clear instruction rather than silently letting Phaser scale 1024px masters.

- [ ] **Step 5: Run the contract tests GREEN**

Run: `node --import tsx --test test/physical-ui-factory-contract.test.js`
Expected: PASS.

- [ ] **Step 6: Render locally in Blender and visually accept Board UI kit V1 before Task 2**

Run from the factory folder with Blender 5.2:

```powershell
& "D:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python-exit-code 1 --python .\render_ui_preview.py
```

Required review artifact: one preview containing all seven surfaces at practical UI sizes and the neutral glyph family. Do not migrate scenes until this preview is accepted.

- [ ] **Step 7: Commit checkpoint**

```bash
git add tools/physical-ui-factory scripts/build-physical-ui-runtime.mjs test/physical-ui-factory-contract.test.js
git commit -m "add physical ui asset factory"
```

---

### Task 2: Replace legacy theme plumbing with neutral production asset identifiers

**Files:**
- Modify: `src/art-assets.ts`
- Modify: `src/game/ui.ts`
- Modify: `src/main.ts`
- Delete: `src/art-theme.ts`
- Delete: `test/art-theme-contract.test.js`
- Test: `test/physical-ui-runtime-contract.test.js`
- Test: `test/art-assets.test.js`

**Interfaces:**
- Produces `PHYSICAL_UI_FRAMES` for the seven surfaces.
- Keeps `GAMEPLAY_UI_FRAMES` as semantic names, but every URL resolves inside `/assets/physical-ui/` or `/assets/physical-premium/`.
- `RendererSurface.setMaterialRole(role)` remains the public semantic surface API used by scenes.

- [ ] **Step 1: Write the failing production-art test**

Add assertions that `src/art-assets.ts`, `src/game/ui.ts`, and `src/main.ts` contain no `ACTIVE_ART_THEME`, `ArtThemeId`, `chequered-ink`, `mechanized-magic`, or `ci-` token; every `GAMEPLAY_UI_FRAMES` value is neutral; and every required physical UI runtime file exists.

- [ ] **Step 2: Run RED**

Run: `node --import tsx --test test/physical-ui-runtime-contract.test.js test/art-assets.test.js`
Expected: FAIL on legacy theme/`ci-*` references.

- [ ] **Step 3: Implement neutral frame maps**

`src/art-assets.ts` must expose production-only maps like:

```ts
export const PHYSICAL_UI_FRAMES = Object.freeze({
  systemButton: "physical-ui-system-button",
  actionButton: "physical-ui-action-button",
  hudPlate: "physical-ui-hud-plate",
  inventoryTray: "physical-ui-inventory-tray",
  counterPlate: "physical-ui-counter-plate",
  panel: "physical-ui-panel",
  card: "physical-ui-card",
});
```

`GAMEPLAY_UI_FRAMES` remains semantic but maps to neutral keys such as `physical-ui-icon-pause`, never `ci-icon-pause`.

- [ ] **Step 4: Collapse `RendererSurface` to one production path**

Remove `redrawLegacy()` and the `ACTIVE_ART_THEME` branch. `physicalFrameForRole()` maps semantic roles directly to the seven new surface frames. Preserve existing hover/pressed/disabled behavior and text rendering.

- [ ] **Step 5: Remove the theme switch**

Delete `src/art-theme.ts`, remove its imports/exports and query/F2 comparison handling from `src/main.ts`, and delete the obsolete theme test.

- [ ] **Step 6: Run GREEN**

Run: `node --import tsx --test test/physical-ui-runtime-contract.test.js test/art-assets.test.js test/ui-state-model.test.js`
Expected: PASS.

- [ ] **Step 7: Commit checkpoint**

```bash
git add src/art-assets.ts src/game/ui.ts src/main.ts test/physical-ui-runtime-contract.test.js test/art-assets.test.js test/ui-state-model.test.js
git rm src/art-theme.ts test/art-theme-contract.test.js
git commit -m "switch runtime to physical ui assets"
```

---

### Task 3: Migrate the Board UI without changing Board layout or gameplay

**Files:**
- Modify: `src/game/board/BoardHud.ts`
- Modify: `src/game/board/BoardInventory.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/completion-overlay.ts`
- Test: `test/board-presentation-contract.test.js`
- Test: `test/presentation-layout.test.js`
- Test: `test/removal-feedback-contract.test.js`
- Create: `test/physical-board-ui-contract.test.js`

**Interfaces:**
- Board HUD consumes `system-control`, `card/hud`, and `counter` material roles.
- Board inventory consumes `walnut-tray` and `button` roles.
- Board overlays consume `panel`/`card` roles.
- Immediate removal contract remains: no transient copy, no line, no pull, no fade/scale tween, no removal delay.

- [ ] **Step 1: Write the failing Board physical-UI contract**

Assert that Board-owned source files use only semantic UI frame/material-role APIs and contain no direct path strings or legacy asset-family identifiers. Assert the existing removal contract still forbids transient removal animation.

- [ ] **Step 2: Run RED**

Run: `node --import tsx --test test/physical-board-ui-contract.test.js test/board-presentation-contract.test.js test/removal-feedback-contract.test.js`
Expected: FAIL until Board material roles are migrated.

- [ ] **Step 3: Apply the new roles without moving controls**

Use:

```ts
headerPanel.setMaterialRole("hud-plate");
inventoryPanel.setMaterialRole("inventory-tray");
actionButton.setMaterialRole("action-button");
systemButton.setMaterialRole("system-control");
modalPanel.setMaterialRole("panel");
```

If `MaterialRole` does not yet contain these exact values, extend the type in `src/game/ui.ts` rather than encoding frame keys in scene files.

- [ ] **Step 4: Keep responsive metrics unchanged**

Do not change `boardFloatingMetrics`, `inventoryAnchorMetrics`, board scale, hit areas, or tutorial placement unless the new NineSlice edge sizes mathematically require a local visual offset. Any such offset must be isolated from gameplay geometry.

- [ ] **Step 5: Run Board tests GREEN**

Run: `node --import tsx --test test/physical-board-ui-contract.test.js test/board-presentation-contract.test.js test/presentation-layout.test.js test/removal-feedback-contract.test.js`
Expected: PASS.

- [ ] **Step 6: Live visual acceptance**

Run `pnpm dev`, inspect desktop + phone portrait + phone landscape, and accept Board before migrating the rest of the product.

- [ ] **Step 7: Commit checkpoint**

```bash
git add src/game/board/BoardHud.ts src/game/board/BoardInventory.ts src/game/scenes/BoardScene.ts src/game/completion-overlay.ts test/physical-board-ui-contract.test.js test/board-presentation-contract.test.js test/presentation-layout.test.js test/removal-feedback-contract.test.js
git commit -m "apply physical ui kit to board"
```

---

### Task 4: Migrate the remaining scenes to the same UI kit

**Files:**
- Modify: `src/game/scenes/MenuScene.ts`
- Modify: `src/game/scenes/LevelSelectScene.ts`
- Modify: `src/game/scenes/ShopScene.ts`
- Modify: `src/game/scenes/SettingsScene.ts`
- Modify: `src/game/scenes/LeaderboardScene.ts`
- Modify: `src/game/completion-overlay.ts`
- Test: `test/physical-product-ui-contract.test.js`
- Test: existing scene/presentation/economy/settings/leaderboard tests

**Interfaces:**
- Scenes consume semantic surfaces/icons only.
- `panel` supplies large cards/modals, `card` supplies list/product/level rows, `action-button` supplies text actions, `system-button` supplies compact global actions.

- [ ] **Step 1: Write the failing whole-product UI contract**

Scan `src/game/**` and assert there are no `ci-`, `chequered-ink`, `mechanized-magic`, or direct legacy file-path dependencies. Assert every icon reference comes from `GAMEPLAY_UI_FRAMES` and every scalable surface is created through `makePanel`/`AtlasButton` semantic roles.

- [ ] **Step 2: Run RED**

Run: `node --import tsx --test test/physical-product-ui-contract.test.js`
Expected: FAIL on remaining legacy assumptions/direct frames.

- [ ] **Step 3: Migrate each scene without changing semantics**

Replace only material/frame choices; preserve navigation, saved settings, economy products, leaderboard data, level states, completion rewards, hit areas, localization, and responsive metrics.

- [ ] **Step 4: Run scene tests GREEN**

Run: `node --import tsx --test test/physical-product-ui-contract.test.js test/completion-presentation.test.js test/economy.test.js test/settings.test.js test/leaderboard.test.js test/presentation-model.test.js test/utility-navigation.test.js`
Expected: PASS.

- [ ] **Step 5: Live acceptance of Menu / Level Select / Shop / Settings / Leaderboard / Completion**

Run `pnpm dev` and visually inspect the migrated scenes. Do not start deletion until the live product no longer needs legacy assets.

- [ ] **Step 6: Commit checkpoint**

```bash
git add src/game/scenes src/game/completion-overlay.ts test/physical-product-ui-contract.test.js test/completion-presentation.test.js test/economy.test.js test/settings.test.js test/leaderboard.test.js test/presentation-model.test.js test/utility-navigation.test.js
git commit -m "extend physical ui kit across product"
```

---

### Task 5: Delete legacy art/theme sources and replace historical contracts

**Files:**
- Delete: `public/assets/art-tests/**`
- Delete: `public/assets/mechanized-magic/**`
- Delete: `public/assets/chequered-ink/**`
- Delete: rejected source-art families under `assets/**`
- Delete: `_chatgpt_bundle/**`
- Delete/replace: obsolete B5/B6/B7 art/theme-only tests
- Modify: `THIRD_PARTY_ASSETS.md`
- Modify: `ART_DIRECTION.md`
- Modify: `CURRENT_STATE.md`
- Regenerate: `TREE.txt`
- Test: `test/legacy-art-cleanup-contract.test.js`

**Interfaces:**
- Product runtime after this task depends only on current physical board/pieces, physical UI assets, renderer text/geometry, and genuinely still-used product resources.

- [ ] **Step 1: Write the failing cleanup contract**

Assert the legacy directories and `_chatgpt_bundle` do not exist, and recursively scan `src/**`, `test/**`, `scripts/**`, root docs/config for forbidden runtime references.

- [ ] **Step 2: Run RED**

Run: `node --import tsx --test test/legacy-art-cleanup-contract.test.js`
Expected: FAIL because legacy directories still exist.

- [ ] **Step 3: Audit before deletion**

Run:

```bash
grep -R "art-tests\|mechanized-magic\|chequered-ink\|assets/Mechanized Magic\|assets/alchemy_elements\|assets/v2\|assets/v3\|_chatgpt_bundle" -n src test scripts *.md package.json vite.config.* 2>/dev/null
```

Expected: only intentional cleanup-history/documentation references. Migrate any production reference before continuing.

- [ ] **Step 4: Delete dead runtime and source-art families**

Remove the legacy directories from the spec. Keep `public/assets/physical-premium/**` and `public/assets/physical-ui/**`.

- [ ] **Step 5: Replace obsolete tests rather than weakening them**

Remove tests whose only purpose is to preserve rejected theme branches. Keep or rewrite contracts that protect current piece quality, runtime dimensions, physical UI frame presence, responsive layout, and immediate removal.

- [ ] **Step 6: Update docs and regenerate tree**

`ART_DIRECTION.md` states Physical Premium + physical UI kit as the active production direction; `CURRENT_STATE.md` lists the live asset paths; `THIRD_PARTY_ASSETS.md` removes deleted pack entries unless retained for historical/legal reasons; regenerate `TREE.txt` with the project context tooling.

- [ ] **Step 7: Run cleanup test GREEN**

Run: `node --import tsx --test test/legacy-art-cleanup-contract.test.js`
Expected: PASS.

- [ ] **Step 8: Commit deletion-only checkpoint**

```bash
git add -u public/assets assets _chatgpt_bundle src test
git add ART_DIRECTION.md CURRENT_STATE.md THIRD_PARTY_ASSETS.md TREE.txt test/legacy-art-cleanup-contract.test.js
git commit -m "remove rejected legacy art paths"
```

---

### Task 6: Full verification and handoff

**Files:**
- Verify all changed files from Tasks 1–5.

- [ ] **Step 1: Run TypeScript verification**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 2: Run full tests**

Run: `pnpm test`
Expected: all tests pass, 0 failures.

- [ ] **Step 3: Run production build**

Run: `pnpm build`
Expected: Vite exits 0 and creates `dist/`.

- [ ] **Step 4: Run final forbidden-reference scan**

Run:

```bash
grep -R "chequered-ink\|mechanized-magic\|art-tests\|ACTIVE_ART_THEME\|ArtThemeId\|ci-" -n src test scripts public package.json 2>/dev/null
```

Expected: no production references; test strings may exist only inside explicit negative-contract assertions.

- [ ] **Step 5: Final live smoke test**

Verify Board, Pause, Restart, inventory filtering, Move/Undo/Rescue, Shop round-trip, Settings round-trip, completion, Menu, Level Select, Shop, Settings, Leaderboard, and immediate removal.

- [ ] **Step 6: Final commit if any verification-only docs changed**

```bash
git add ART_DIRECTION.md CURRENT_STATE.md THIRD_PARTY_ASSETS.md TREE.txt
git commit -m "document physical ui production path"
```

---

## Self-review

- Spec coverage: all seven physical UI components, Board-first rollout, remaining-scene migration, neutral icon system, theme removal, runtime downsampling, cleanup safety, documentation, and final verification are covered.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation step remains.
- Type consistency: scene code consumes semantic material roles and neutral frame maps introduced in Task 2; cleanup starts only after Tasks 3–4 remove legacy consumers.
- Cleanup safety: deletion is isolated into its own checkpoint after live migration acceptance, matching the approved spec.
