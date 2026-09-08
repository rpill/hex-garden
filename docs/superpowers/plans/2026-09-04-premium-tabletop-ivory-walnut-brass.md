# Premium Tabletop — Ivory + Walnut + Brass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Hex Garden UI into a light premium tabletop presentation with ivory surfaces, walnut structure, restrained brass accents, and tactile club-table feedback while preserving all current gameplay and responsive behavior.

**Architecture:** Keep the existing renderer-owned UI architecture and current Chequered Ink piece mapping. Replace B5 theme/raster dependencies in the active candidate with one material-aware `RendererSurface`, add explicit material roles where the Board needs a walnut tray/system-control distinction, and propagate the palette through existing scenes without changing layout contracts. B5 cleanup remains a separate post-acceptance task.

**Tech Stack:** Phaser 3.90, strict TypeScript, Vite 7, Node test runner via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-04-premium-tabletop-ivory-walnut-brass-design.md`

## Global Constraints

- Preserve all rules, solver, progression, economy, scoring, intro/reveal, removal-feedback, and navigation behavior.
- Preserve desktop, portrait, and phone-landscape layout contracts.
- Keep the current Chequered Ink board-piece mapping during this UI pass.
- Do not add sound assets in this pass; only prepare tactile visual press states. Sound design is a later pass.
- Do not use Kenney/B5 raster UI assets for the premium candidate.
- Dynamic text remains Phaser-rendered.
- B5 Adventure/RPG/Space cleanup happens only after live acceptance.
- Before handoff run `pnpm typecheck`, `pnpm test`, and `pnpm build`.

---

### Task 1: Lock the premium material system

**Files:**
- Modify: `src/art-assets.ts`
- Modify: `src/game/ui.ts`
- Modify: `src/scene-background.ts`
- Test: `test/art-assets.test.js`
- Create: `test/premium-tabletop-contract.test.js`

**Interfaces:**
- Consumes: existing `UI_FRAMES`, `THEME_COLORS`, `makePanel`, `makeButton`, and `RendererSurface`.
- Produces: one premium default palette; renderer-owned material roles for ivory, walnut, success/failure, locked, selected, and button states; no active dependency on B5 raster surfaces.

- [ ] **Step 1: Write failing premium palette/material tests**

Add assertions that the active candidate exposes warm light canvas/surface colors, walnut + brass material tokens, and that `makePanel` resolves to renderer-owned surfaces rather than `RasterSurface`.

Use source-contract checks for:
```js
assert.match(artSource, /walnut/);
assert.match(artSource, /brass/);
assert.match(artSource, /canvas:\s*0xe9dfc8/i);
assert.doesNotMatch(uiSource, /return USES_RASTER_UI\s*\?/);
assert.match(uiSource, /MaterialRole/);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:
```bash
node --import tsx --test test/premium-tabletop-contract.test.js
```

Expected: FAIL because premium material tokens/roles do not yet exist and `makePanel` still branches into B5 raster UI.

- [ ] **Step 3: Implement the premium palette in `src/art-assets.ts`**

Make the default candidate use the approved ivory/walnut/brass family:
```ts
canvas: 0xe9dfc8,
chrome: 0xf5eedc,
chromeRaised: 0xfaf5e8,
line: 0xa99a82,
text: "#2d2923",
textMuted: "#746a5e",
gold: "#b88a45",
success: "#66795a",
danger: "#9a554b",
cellFillNumber: 0xe1d4ba,
cellLineNumber: 0xb8a98d,
```

Add explicit material tokens:
```ts
walnut: 0x5a3d2a,
walnutDark: 0x38271d,
brass: 0xb88a45,
brassSoft: 0xd2b77e,
ivory: 0xf5eedc,
ivoryRaised: 0xfaf5e8,
shadow: 0x2d2118,
```

Keep current Chequered Ink icon/piece URLs unchanged.

- [ ] **Step 4: Replace generic dark `RendererSurface` styling with material-aware drawing**

Introduce:
```ts
export type MaterialRole =
  | "card"
  | "button"
  | "button-primary"
  | "walnut-tray"
  | "system-control"
  | "success"
  | "failure"
  | "locked";
```

`RendererSurface.redraw()` draws shallow physical layers:
1. soft shadow offset 2–3 px;
2. optional walnut base/edge for buttons/trays;
3. matte ivory face;
4. one restrained brass or warm line;
5. pressed state translates visual weight inward rather than increasing brightness.

`makePanel()` returns `RendererSurface` for the premium candidate. Do not use B5 raster NineSlices.

- [ ] **Step 5: Simplify `layoutPaperBackground()` into a quiet club-table canvas**

Remove top/bottom band chrome and the viewport border for the premium candidate. Render a warm ivory canvas with at most a very subtle central value variation; do not add parchment noise, scroll edges, or decorative motifs.

- [ ] **Step 6: Run focused tests and confirm GREEN**

Run:
```bash
node --import tsx --test test/art-assets.test.js test/premium-tabletop-contract.test.js
```

Expected: PASS.

---

### Task 2: Give the Board a walnut tray and tactile control hierarchy

**Files:**
- Modify: `src/game/board/BoardInventory.ts`
- Modify: `src/game/board/BoardHud.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/ui.ts`
- Test: `test/board-presentation-contract.test.js`
- Test: `test/premium-tabletop-contract.test.js`

**Interfaces:**
- Consumes: `RendererSurface.setMaterialRole(role)`, existing Board layout metrics and intro state.
- Produces: walnut inventory tray, light compact HUD plaque, distinct system controls, tactile consumable buttons; no layout/state-machine changes.

- [ ] **Step 1: Write failing Board material-role tests**

Assert:
- BoardInventory assigns `walnut-tray`;
- BoardHud header uses `card`;
- Pause/Shop/Settings/Restart use `system-control`;
- Move/Undo/Rescue use the standard/primary physical button role;
- existing intro visibility/disabled contracts remain present.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
```bash
node --import tsx --test test/board-presentation-contract.test.js test/premium-tabletop-contract.test.js
```

Expected: premium role assertions fail while existing Board contracts continue to pass.

- [ ] **Step 3: Style the inventory as a low walnut token tray**

Keep `BoardInventory.layout()` calculations unchanged.

Apply a `walnut-tray` role to the existing panel. Use warm brass separators/arrows at low alpha instead of neutral gray:
```ts
THEME_COLORS.brassNumber
```

Counts use warm ivory text rather than pure white. Intro awakening/count-pop logic remains byte-for-byte behaviorally equivalent.

- [ ] **Step 4: Restyle Board HUD without changing anchors**

Keep `BoardHud` object ownership and layout calls unchanged. Make the level/remaining plaque a compact ivory card, campaign/endless supporting text lighter, dust a small brass-accented chip, and global icon buttons `system-control`.

Do not create a full-width top bar.

- [ ] **Step 5: Give buttons tactile press states**

In `AtlasButton.applyVisualState()` preserve existing `buttonVisualState()` alpha/scale semantics, but add a shallow local face displacement/edge compression on `pressed`. Hover gets a brass edge emphasis; it must not glow or brighten the entire control.

- [ ] **Step 6: Keep board cells quiet**

Continue using the renderer-drawn hex geometry in `BoardScene`; only switch its palette to the new warm-neutral cell fill/line tokens. Do not change hex sizes, positions, input, selection, reveal, or removal effects.

- [ ] **Step 7: Run focused Board tests and confirm GREEN**

Run:
```bash
node --import tsx --test test/board-presentation-contract.test.js test/board-presentation-model.test.js test/removal-feedback-contract.test.js test/premium-tabletop-contract.test.js
```

Expected: PASS.

---

### Task 3: Propagate the same physical surface language to overlays and product scenes

**Files:**
- Modify: `src/game/completion-overlay.ts`
- Modify: `src/game/scenes/MenuScene.ts`
- Modify: `src/game/scenes/LevelSelectScene.ts`
- Modify: `src/game/scenes/ShopScene.ts`
- Modify: `src/game/scenes/SettingsScene.ts`
- Modify: `src/game/scenes/LeaderboardScene.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Test: `test/completion-presentation.test.js`
- Test: `test/ui-state-model.test.js`
- Test: `test/premium-tabletop-contract.test.js`

**Interfaces:**
- Consumes: material-aware `makePanel` / `makeButton`, premium palette, current layout functions.
- Produces: consistent premium tabletop cards/buttons across menu, level select, shop, settings, leaderboard, mechanic card, pause/economy dialogs, and completion.

- [ ] **Step 1: Write failing scene-surface contract tests**

Assert that the completion card, mechanic card, pause/economy dialogs, shop cards, and level tiles continue to use renderer primitives and do not reference `ART_SURFACE_URLS`/B5 raster surfaces.

Assert that semantic state frames remain distinct for current/completed/locked/success/failure.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
```bash
node --import tsx --test test/completion-presentation.test.js test/ui-state-model.test.js test/premium-tabletop-contract.test.js
```

Expected: FAIL on the new premium scene-role assertions.

- [ ] **Step 3: Apply compact ivory-card roles to Board dialogs**

Mechanic intro, pause, economy purchase dialog, and completion use matte ivory cards with a shallow walnut edge/shadow and restrained brass emphasis. Preserve all current dimensions, delays, hit zones, text, and actions.

- [ ] **Step 4: Apply the same hierarchy to non-Board scenes**

Menu / Level Select / Shop / Settings / Leaderboard:
- quiet ivory canvas;
- cards use matte ivory;
- important action uses `button-primary`;
- secondary controls use `button`;
- level semantic states remain visually meaningful;
- shop remains card-led;
- no page-wide fantasy frame or decorative border.

Do not restructure navigation or responsive layout.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:
```bash
node --import tsx --test test/completion-presentation.test.js test/ui-state-model.test.js test/utility-navigation.test.js test/premium-tabletop-contract.test.js
```

Expected: PASS.

---

### Task 4: Remove premium candidate dependence on B5 switching without deleting the rejected files yet

**Files:**
- Modify: `src/art-assets.ts`
- Modify: `src/game/ui.ts`
- Modify: `src/main.ts`
- Modify: `src/art-theme.ts`
- Modify: `test/art-theme-contract.test.js`
- Test: `test/premium-tabletop-contract.test.js`

**Interfaces:**
- Consumes: premium renderer style from Tasks 1–3.
- Produces: premium tabletop as the normal runtime appearance; B5 asset files remain on disk only for later cleanup after live acceptance.

- [ ] **Step 1: Write failing default-theme contract**

Require the normal runtime to resolve to the premium candidate without needing `?art=adventure|rpg|space`, and require gameplay rendering not to depend on B5 raster surfaces.

Keep an explicit temporary dev-only route only if needed for comparison with `chequered`; do not cycle rejected Adventure/RPG/Space candidates with F2.

- [ ] **Step 2: Run focused test and confirm RED**

Run:
```bash
node --import tsx --test test/art-theme-contract.test.js test/premium-tabletop-contract.test.js
```

Expected: FAIL because current F2 cycle still includes Adventure/RPG/Space.

- [ ] **Step 3: Make premium tabletop the normal visual path**

Reduce theme plumbing so B5 rejected raster themes are not runtime candidates. Preserve the current Chequered piece asset URLs.

If a comparison switch is retained for this live evaluation, limit it to:
```text
premium <-> chequered-baseline
```
and label it as temporary dev functionality.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run:
```bash
node --import tsx --test test/art-theme-contract.test.js test/premium-tabletop-contract.test.js
```

Expected: PASS.

---

### Task 5: Full verification and handoff

**Files:**
- No production changes unless verification exposes a regression.
- Update: `ART_DIRECTION.md`
- Update: `CURRENT_STATE.md`

**Interfaces:**
- Produces: a patch ready for live visual review; no cleanup/deletion yet.

- [ ] **Step 1: Update active visual docs**

Record Premium Tabletop Ivory/Walnut/Brass as the new **live candidate**, not yet final-approved. Record B5 Adventure/RPG/Space as rejected visual experiments pending cleanup after acceptance.

- [ ] **Step 2: Run full TypeScript verification**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: exit 0, zero failed tests.

- [ ] **Step 4: Run production build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Package only the changed/new files into a patch ZIP**

The patch must preserve the user's repository paths exactly.

- [ ] **Step 6: Live-review gate — do not ask for a git commit yet**

User checks desktop gameplay first, especially:
- top HUD hierarchy;
- empty-cell quietness;
- walnut inventory tray;
- system-vs-consumable distinction;
- mechanic card;
- completion;
- whether the result evokes weighted billiards/poker/roulette-table tactility rather than parchment/fantasy/mobile UI.

Only after visual acceptance should we provide the cleanup patch for B5 assets/theme code and then tell the user to commit the combined accepted visual change.
