# Hex Garden Visual Presentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Hex Garden's presentation hierarchy so the board, campaign, Shop, currency, global navigation, and completion flow feel like one deliberate puzzle product while keeping gameplay/economy behavior unchanged and keeping future asset replacement cheap.

**Architecture:** Keep renderer-independent rules/generation untouched. Add small pure presentation-model/layout helpers that can be Node-tested, extend the existing Phaser UI primitives for icon-only actions and currency rows, then migrate scenes one at a time. Board feedback remains semantic in `piece-visual-state.js`; Shop/Settings launched from the Board pause/resume the existing Board scene rather than destroying the current run.

**Tech Stack:** Phaser 3.90, native ES modules, Vite 7, Node `node:test`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-03-visual-presentation-overhaul-design.md`

## Global Constraints

- Do not change rules, solver, generators, campaign progression, scoring, economy values, persistence, Yandex rewarded-ad behavior, or public-mode exposure.
- Keep dynamic labels, counts, prices, scores, and localized strings as renderer text.
- Shop and Settings must be direct one-click destinations on key screens; Board access must preserve the current run.
- Back uses one arrow glyph plus plain `НАЗАД` / `BACK`; Pause, Shop, and Settings are icon-only global actions.
- Hover must be subtle: no bright filled disk and no thick yellow ring. Selection is stronger but restrained; hint is distinct and softly pulsed.
- Level Select must use materially larger tiles and meaningful viewport area; target approximately 5–6 columns on desktop.
- Shop must be visually card-led, with a large semantic icon, concise copy, owned count, price with dust icon, and one clear buy action.
- Completion must remain compact and stable with and without unlock text; reward amounts and count-up behavior remain unchanged.
- Do not add screenshot/pixel-diff tests, exact-color tests, exact-position tests, or tests that permanently lock Chequered Ink filenames/theme.
- Existing Chequered Ink gems/icons are provisional implementation assets only.

---

## File Structure

### New pure presentation helpers

- `src/game/presentation-model.js` — semantic action copy, currency formatting data, Shop card data, utility-scene return plan.
- `src/game/presentation-layout.js` — responsive level-grid, Shop-card, and completion-card metrics.

### Existing shared presentation files

- `src/game/ui.js` — Phaser primitives: text button, icon-only button, currency display.
- `src/game/navigation-layout.js` — header layout for back + multiple right-side utilities.
- `src/game/piece-visual-state.js` — semantic Board feedback priority and visual intensity data.
- `src/art-assets.js` — semantic asset mapping only; do not make current filenames a gameplay dependency.

### Scene migrations

- `src/game/scenes/BoardScene.js` — lighter renderer-drawn cells, larger pieces, subtle feedback, direct Shop/Settings.
- `src/game/scenes/LevelSelectScene.js` — large responsive level tiles, persistent dust, global utilities.
- `src/game/scenes/ShopScene.js` — three visual product cards, icon-led price/owned data, Board-safe return behavior.
- `src/game/scenes/SettingsScene.js` — clean back label, larger global icons, Board-safe return behavior, direct Shop.
- `src/game/scenes/MenuScene.js` — global Shop/Settings controls, remove redundant text-first Shop entry where duplicated.
- `src/game/scenes/LeaderboardScene.js` — shared header/global controls where layout allows.
- `src/game/completion-overlay.js` — compact reward hierarchy with dust icon/value row.

### Tests

- `test/presentation-model.test.js`
- `test/presentation-layout.test.js`
- Extend `test/piece-visual-state.test.js`

---

### Task 1: Introduce semantic presentation models and shared icon/currency primitives

**Files:**
- Create: `src/game/presentation-model.js`
- Create: `test/presentation-model.test.js`
- Modify: `src/game/ui.js:72-263`

**Interfaces:**
- Produces: `GlobalAction`, `globalActionPresentation(action, english)`, `currencyPresentation(value, { signed })`, `shopProductPresentation(product, snapshot, english)`, `utilityReturnPlan(returnScene)`.
- Produces: `makeIconButton(scene, frame, onClick, { size, glyphSize })` and `makeCurrencyDisplay(scene, frame, value, { iconSize, fontSize, color })` from `ui.js`.
- Consumes: existing `AtlasButton`, `makeText`, `GAMEPLAY_UI_FRAMES`, economy product/snapshot shapes.

- [ ] **Step 1: Write failing semantic-model tests**

Create `test/presentation-model.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  GlobalAction,
  currencyPresentation,
  globalActionPresentation,
  shopProductPresentation,
  utilityReturnPlan,
} from "../src/game/presentation-model.js";

test("global action copy never duplicates icon symbols in text", () => {
  assert.deepEqual(globalActionPresentation(GlobalAction.BACK, false), {
    label: "НАЗАД",
    iconOnly: false,
  });
  assert.deepEqual(globalActionPresentation(GlobalAction.BACK, true), {
    label: "BACK",
    iconOnly: false,
  });
  for (const action of [GlobalAction.PAUSE, GlobalAction.SHOP, GlobalAction.SETTINGS]) {
    assert.equal(globalActionPresentation(action, false).label, "");
    assert.equal(globalActionPresentation(action, false).iconOnly, true);
  }
});

test("currency presentation carries only the dynamic numeric text", () => {
  assert.deepEqual(currencyPresentation(38), { value: 38, text: "38" });
  assert.deepEqual(currencyPresentation(8, { signed: true }), { value: 8, text: "+8" });
});

test("shop product presentation preserves economy data and affordability", () => {
  const product = {
    id: "move-3",
    hint: "move",
    title: "Намёк",
    titleEn: "Move",
    description: "Один доступный ход",
    descriptionEn: "One available move",
    amount: 3,
    price: 30,
  };
  const snapshot = { dust: 38, hints: { move: 2 } };
  assert.deepEqual(shopProductPresentation(product, snapshot, false), {
    id: "move-3",
    hint: "move",
    title: "Намёк",
    description: "Один доступный ход",
    amount: 3,
    price: 30,
    owned: 2,
    affordable: true,
    buyLabel: "КУПИТЬ",
  });
});

test("utility scenes resume a paused board but start ordinary return scenes", () => {
  assert.deepEqual(utilityReturnPlan("board"), { kind: "resume", scene: "board" });
  assert.deepEqual(utilityReturnPlan("level-select"), { kind: "start", scene: "level-select" });
  assert.deepEqual(utilityReturnPlan("menu"), { kind: "start", scene: "menu" });
  assert.deepEqual(utilityReturnPlan("unknown"), { kind: "start", scene: "menu" });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/presentation-model.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/game/presentation-model.js`.

- [ ] **Step 3: Implement the minimal pure model**

Create `src/game/presentation-model.js` with this API:

```js
export const GlobalAction = Object.freeze({
  BACK: "back",
  PAUSE: "pause",
  SHOP: "shop",
  SETTINGS: "settings",
});

export function globalActionPresentation(action, english = false) {
  if (action === GlobalAction.BACK) {
    return Object.freeze({ label: english ? "BACK" : "НАЗАД", iconOnly: false });
  }
  if ([GlobalAction.PAUSE, GlobalAction.SHOP, GlobalAction.SETTINGS].includes(action)) {
    return Object.freeze({ label: "", iconOnly: true });
  }
  throw new Error(`Unknown global action: ${action}`);
}

export function currencyPresentation(value, { signed = false } = {}) {
  const rounded = Math.round(value);
  const formatted = rounded.toLocaleString("ru-RU");
  return Object.freeze({
    value: rounded,
    text: signed && rounded > 0 ? `+${formatted}` : formatted,
  });
}

export function shopProductPresentation(product, snapshot, english = false) {
  return Object.freeze({
    id: product.id,
    hint: product.hint,
    title: english ? product.titleEn : product.title,
    description: english ? product.descriptionEn : product.description,
    amount: product.amount,
    price: product.price,
    owned: snapshot.hints[product.hint],
    affordable: snapshot.dust >= product.price,
    buyLabel: english ? "BUY" : "КУПИТЬ",
  });
}

export function utilityReturnPlan(returnScene) {
  if (returnScene === "board") return Object.freeze({ kind: "resume", scene: "board" });
  if (returnScene === "level-select" || returnScene === "menu") {
    return Object.freeze({ kind: "start", scene: returnScene });
  }
  return Object.freeze({ kind: "start", scene: "menu" });
}
```

- [ ] **Step 4: Run the model tests and verify GREEN**

Run:

```bash
node --test test/presentation-model.test.js
```

Expected: 4 tests PASS, 0 fail.

- [ ] **Step 5: Add shared Phaser primitives without changing scene behavior yet**

Extend `src/game/ui.js` after `makeLevelButton`:

```js
export function makeIconButton(
  scene,
  frame,
  onClick,
  { size = 48, glyphSize = Math.round(size * 0.6) } = {},
) {
  return makeButton(scene, "", onClick, 1)
    .setIcon(frame, glyphSize, true)
    .setFixedSize(size, size);
}

export function makeCurrencyDisplay(
  scene,
  frame,
  value = 0,
  { iconSize = 22, fontSize = 14, color = THEME_COLORS.gold } = {},
) {
  const icon = scene.add.image(0, 0, frame).setDisplaySize(iconSize, iconSize);
  const text = makeText(scene, "", fontSize, color).setOrigin(0, 0.5).setFontStyle("bold");
  const container = scene.add.container(0, 0, [icon, text]);
  container.icon = icon;
  container.valueText = text;
  container.setValue = (next) => {
    text.setText(Math.round(next).toLocaleString("ru-RU"));
    text.setPosition(iconSize / 2 + 7, 0);
    icon.setPosition(-Math.max(12, text.width / 2), 0);
    return container;
  };
  return container.setValue(value);
}
```

- [ ] **Step 6: Run existing context/presentation-safe tests**

Run:

```bash
node --test test/presentation-model.test.js test/art-assets.test.js test/piece-visual-state.test.js
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/presentation-model.js src/game/ui.js test/presentation-model.test.js
git commit -m "refactor: add shared presentation primitives"
```

---

### Task 2: Add reusable responsive presentation metrics and multi-utility headers

**Files:**
- Create: `src/game/presentation-layout.js`
- Create: `test/presentation-layout.test.js`
- Modify: `src/game/navigation-layout.js:3-46`

**Interfaces:**
- Produces: `levelGridMetrics(width, height, itemCount, contentTop)`, `shopGridMetrics(width, height, itemCount, contentTop)`, `completionCardMetrics(width, height, { hasUnlock })`.
- Produces: `layoutSceneHeader({ title, backButton, utilityButtons, utilityText }, width, height)` where `utilityButtons` is an ordered array rendered right-to-left with Settings at the far right.

- [ ] **Step 1: Write failing responsive-layout tests**

Create `test/presentation-layout.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  completionCardMetrics,
  levelGridMetrics,
  shopGridMetrics,
} from "../src/game/presentation-layout.js";

test("desktop campaign layout uses large tiles and at most six columns", () => {
  const layout = levelGridMetrics(1768, 864, 25, 80);
  assert.equal(layout.columns, 6);
  assert.ok(layout.tileWidth >= 120);
  assert.ok(layout.tileHeight >= 82);
  assert.ok(layout.gridWidth > 700);
});

test("portrait campaign layout remains readable without ten tiny columns", () => {
  const layout = levelGridMetrics(390, 844, 25, 72);
  assert.ok(layout.columns >= 3 && layout.columns <= 4);
  assert.ok(layout.tileWidth >= 80);
});

test("shop uses three cards on desktop and stacks on narrow portrait", () => {
  assert.equal(shopGridMetrics(1200, 760, 3, 80).columns, 3);
  assert.equal(shopGridMetrics(390, 844, 3, 72).columns, 1);
});

test("completion card stays compact and makes room for optional unlock row", () => {
  const plain = completionCardMetrics(1200, 760, { hasUnlock: false });
  const unlocked = completionCardMetrics(1200, 760, { hasUnlock: true });
  assert.ok(plain.width >= 500 && plain.width <= 600);
  assert.ok(unlocked.height > plain.height);
  assert.ok(unlocked.height < 500);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test test/presentation-layout.test.js
```

Expected: FAIL with missing `presentation-layout.js`.

- [ ] **Step 3: Implement deterministic metrics**

Create `src/game/presentation-layout.js` with formulas that satisfy the tests and the spec. Use these concrete rules:

```js
export function levelGridMetrics(width, height, itemCount, contentTop = 72) {
  const columns = width >= 1000 ? 6 : width >= 700 ? 5 : width >= 480 ? 4 : 3;
  const rows = Math.ceil(itemCount / columns);
  const gapX = width < 480 ? 8 : 12;
  const gapY = width < 480 ? 8 : 12;
  const maxGridWidth = Math.min(width - 28, 940);
  const tileWidth = Math.floor((maxGridWidth - gapX * (columns - 1)) / columns);
  const usableHeight = Math.max(240, height - contentTop - 36);
  const tileHeight = Math.max(72, Math.min(112, Math.floor((usableHeight - gapY * (rows - 1)) / rows)));
  const gridWidth = tileWidth * columns + gapX * (columns - 1);
  const gridHeight = tileHeight * rows + gapY * (rows - 1);
  return Object.freeze({ columns, rows, gapX, gapY, tileWidth, tileHeight, gridWidth, gridHeight });
}

export function shopGridMetrics(width, height, itemCount, contentTop = 72) {
  const columns = width >= 820 ? Math.min(3, itemCount) : width >= 560 ? 2 : 1;
  const rows = Math.ceil(itemCount / columns);
  const gap = width < 560 ? 12 : 18;
  const maxGridWidth = Math.min(width - 28, 1040);
  const cardWidth = Math.floor((maxGridWidth - gap * (columns - 1)) / columns);
  const cardHeight = columns === 1 ? 190 : 300;
  return Object.freeze({ columns, rows, gap, cardWidth, cardHeight, maxGridWidth, contentTop });
}

export function completionCardMetrics(width, height, { hasUnlock = false } = {}) {
  const compact = width < 560;
  const short = height < 520;
  const cardWidth = Math.min(width - 24, compact ? 520 : 560);
  const baseHeight = short ? 330 : compact ? 380 : 360;
  const cardHeight = Math.min(height - 20, baseHeight + (hasUnlock ? 34 : 0));
  return Object.freeze({ width: cardWidth, height: cardHeight, compact, short });
}
```

- [ ] **Step 4: Run layout tests and verify GREEN**

```bash
node --test test/presentation-layout.test.js
```

Expected: 4 PASS.

- [ ] **Step 5: Extend scene header to multiple utilities**

Update `src/game/navigation-layout.js` so `sceneHeaderMetrics()` returns `utilityGap` and `utilityXs(count)`. Update `layoutSceneHeader()` to accept `utilityButtons = []` and position each control at the standard square `utilitySize`, ordered from right edge inward. Preserve `utilityText` support for existing callers until all scenes migrate.

Concrete placement rule:

```js
const utilityGap = 8;
const utilityXs = (count) => Array.from(
  { length: count },
  (_, index) => width - margin - utilitySize / 2 - index * (utilitySize + utilityGap),
);
```

- [ ] **Step 6: Verify pure tests**

```bash
node --test test/presentation-layout.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/presentation-layout.js src/game/navigation-layout.js test/presentation-layout.test.js
git commit -m "refactor: add responsive presentation metrics"
```

---

### Task 3: Rebuild Board chrome, cell treatment, and interaction feedback

**Files:**
- Modify: `src/game/piece-visual-state.js`
- Modify: `test/piece-visual-state.test.js`
- Modify: `src/game/scenes/BoardScene.js:233-360, 1680-1818, 2020-2205`
- Modify only if needed for semantic mapping: `src/art-assets.js:52-76`

**Interfaces:**
- Extends: `resolvePieceVisualState({ free, selected, hovered, hinted, blocked, panelMatch, now }) -> { kind, alpha, scale, haloAlpha, haloWidth }`.
- Consumes: `makeIconButton`, `makeCurrencyDisplay`, `GlobalAction`, `globalActionPresentation` from Task 1.
- Consumes: utility-scene return behavior from Task 1 for Board -> Shop/Settings launch/resume.

- [ ] **Step 1: Extend the existing piece-visual-state tests and verify RED**

Add to `test/piece-visual-state.test.js`:

```js
import { resolvePieceVisualState } from "../src/game/piece-visual-state.js";

test("board visual state keeps hover subtle and hint stronger/distinct", () => {
  const idle = resolvePieceVisualState({ free: true });
  const hover = resolvePieceVisualState({ free: true, hovered: true });
  const selected = resolvePieceVisualState({ free: true, selected: true });
  const hinted = resolvePieceVisualState({ free: true, hinted: true, now: 250 });

  assert.equal(idle.kind, "idle");
  assert.equal(hover.kind, "hover");
  assert.ok(hover.scale > 1 && hover.scale <= 1.05);
  assert.ok(hover.haloAlpha < selected.haloAlpha);
  assert.equal(hinted.kind, "hinted");
  assert.ok(hinted.haloAlpha > hover.haloAlpha);
});

test("blocked feedback wins over hint/selection and locked pieces stay muted", () => {
  const blocked = resolvePieceVisualState({
    free: false,
    selected: true,
    hinted: true,
    blocked: true,
    now: 0,
  });
  assert.equal(blocked.kind, "blocked");
  assert.ok(blocked.alpha < 0.7);
});
```

Run:

```bash
node --test test/piece-visual-state.test.js
```

Expected: FAIL because `resolvePieceVisualState` is not exported.

- [ ] **Step 2: Implement semantic visual state**

Extend `src/game/piece-visual-state.js`:

```js
export function resolvePieceVisualState({
  free = true,
  selected = false,
  hovered = false,
  hinted = false,
  blocked = false,
  panelMatch = false,
  now = 0,
} = {}) {
  const kind = blocked
    ? "blocked"
    : hinted
    ? "hinted"
    : selected
    ? "selected"
    : hovered
    ? "hover"
    : panelMatch
    ? "panel-match"
    : "idle";
  const pulse = 0.5 + 0.5 * Math.sin(now / 180);
  const alpha = free ? 1 : 0.42;
  const scale = kind === "hover" ? 1.035 : kind === "selected" ? 1.045 : kind === "hinted" ? 1.04 : 1;
  const haloAlpha =
    kind === "hover" ? 0.12 :
    kind === "selected" ? 0.28 :
    kind === "hinted" ? 0.32 + pulse * 0.18 :
    kind === "blocked" ? 0.26 :
    kind === "panel-match" ? 0.18 : 0;
  const haloWidth = kind === "idle" ? 0 : kind === "hover" ? 1 : 2;
  return Object.freeze({ kind, alpha, scale, haloAlpha, haloWidth });
}
```

- [ ] **Step 3: Run Board-state tests and verify GREEN**

```bash
node --test test/piece-visual-state.test.js
```

Expected: all PASS.

- [ ] **Step 4: Replace heavy cell sprites with quiet renderer-drawn cells**

In `BoardScene.render()` stop calling `renderAtlasCells()` as the default path. Draw every cell into `cellGraphics` with low-contrast fill and a one-pixel-ish boundary, for example:

```js
for (const cell of this.plateCells) {
  const position = this.hexToScreen(cell);
  this.drawHex(
    this.cellGraphics,
    position.x,
    position.y,
    this.hexSize * 0.95,
    0x141a22,
    0x2a3440,
    Math.max(1, this.hexSize * 0.025),
  );
}
```

Do not delete `GAMEPLAY_FRAMES`/asset mappings yet; keeping them unused preserves cheap future experimentation.

- [ ] **Step 5: Make pieces dominate cells and use semantic feedback**

In the piece render loop:

- call `resolvePieceVisualState()` with `selected.has(key)`, `hoveredPieceKey`, hint/blocked/panel-match and `this.time.now`;
- draw only a soft stroke/halo (no filled white disk);
- set PNG glyph display size to roughly `radius * 1.78 * state.scale` instead of `radius * 1.55`;
- preserve locked alpha from `state.alpha`;
- use thin feedback strokes: hover neutral/white low alpha, selected warm low alpha, hint green pulse, blocked red low alpha.

The hover branch must never fill a circle behind the piece.

- [ ] **Step 6: Convert Board Pause, Shop, Settings to global icon controls**

At `BoardScene.create()`:

```js
this.menuButton = makeIconButton(
  this,
  GAMEPLAY_UI_FRAMES.pause,
  () => this.openPauseMenu(),
  { size: 46, glyphSize: 28 },
).setDepth(10);

this.shopButton = makeIconButton(
  this,
  GAMEPLAY_UI_FRAMES.shop,
  () => this.openUtilityScene("shop"),
  { size: 46, glyphSize: 28 },
).setDepth(10);

this.settingsButton = makeIconButton(
  this,
  GAMEPLAY_UI_FRAMES.settings,
  () => this.openUtilityScene("settings"),
  { size: 46, glyphSize: 28 },
).setDepth(10);
```

Add:

```js
openUtilityScene(key) {
  if (this.pauseMenuVisible) this.closePauseMenu();
  this.scene.pause();
  this.scene.launch(key, { returnScene: "board" });
}
```

Remove `this.menuButton.setText("Ⅱ  ПАУЗА")` from `render()` entirely.

- [ ] **Step 7: Replace text-only Board dust HUD with shared currency display**

Create `this.dustHud = makeCurrencyDisplay(this, GAMEPLAY_UI_FRAMES.dust, 0, { iconSize: 22, fontSize: 12 })` and update `updateEconomyUi()` to call `this.dustHud.setValue(snapshot.dust)` rather than setting `ПЫЛЬ 38` text.

Place Pause left/top and Shop + Settings right/top in both ordinary and side-dock layouts. Keep them at least 42 px hit targets and keep Shop/Settings ordered consistently with Settings farthest right.

- [ ] **Step 8: Run focused non-Phaser tests**

```bash
node --test test/piece-visual-state.test.js test/presentation-model.test.js test/presentation-layout.test.js test/rules.test.js test/solver.test.js
```

Expected: PASS.

- [ ] **Step 9: Manual Board smoke test before proceeding**

Run:

```bash
pnpm dev
```

Check a 37-cell board and a larger generated/campaign board:

- empty cells visually recede;
- pieces are larger than before and do not overlap neighboring cells;
- hover is a slight glow/scale lift only;
- selected is stronger than hover but not a white disk;
- hint pulse is distinct;
- Shop/Settings open in one click;
- returning from either utility resumes the same Board state.

- [ ] **Step 10: Commit**

```bash
git add src/game/piece-visual-state.js src/game/scenes/BoardScene.js test/piece-visual-state.test.js
git commit -m "feat: rebuild board presentation feedback"
```

---

### Task 4: Redesign Level Select around large tiles and global economy/navigation

**Files:**
- Modify: `src/game/scenes/LevelSelectScene.js:1-180`
- Modify: `src/game/navigation-layout.js`
- Consume: `src/game/presentation-layout.js`, `src/game/presentation-model.js`, `src/game/ui.js`

**Interfaces:**
- Consumes: `levelGridMetrics()`, `makeCurrencyDisplay()`, `makeIconButton()`, `globalActionPresentation()`.
- Produces: Level Select with large responsive tiles, direct Shop/Settings, and persistent dust balance.

- [ ] **Step 1: Add Level Select economy/global controls**

In `create()` load `getEconomy(this)` and create:

```js
this.dust = makeCurrencyDisplay(this, GAMEPLAY_UI_FRAMES.dust, 0, { iconSize: 22, fontSize: 13 });
this.shopButton = makeIconButton(this, GAMEPLAY_UI_FRAMES.shop, () => {
  this.scene.start("shop", { returnScene: "level-select" });
}, { size: 46, glyphSize: 28 });
this.settingsButton = makeIconButton(this, GAMEPLAY_UI_FRAMES.settings, () => {
  this.scene.start("settings", { returnScene: "level-select" });
}, { size: 46, glyphSize: 28 });
```

Back label becomes plain `НАЗАД`/`BACK` while retaining the arrow sprite.

- [ ] **Step 2: Make level state visual instead of micro-status text**

Change each tile label from `01\nИГРАТЬ`/`ЗАКРЫТ` to the large level number only. Use `setLevelState()` plus `lockSmall`/`check` icon as the secondary state signal:

```js
button.setText(String(level + 1).padStart(2, "0"));
button.setIcon(
  completed ? GAMEPLAY_UI_FRAMES.check : !unlocked ? GAMEPLAY_UI_FRAMES.lockSmall : undefined,
  24,
  false,
);
```

If the existing `AtlasButton` icon+text layout is too cramped on a tile, position the state icon in the tile corner via a dedicated child image rather than shrinking it.

- [ ] **Step 3: Replace ten-column layout with `levelGridMetrics()`**

Use `levelGridMetrics(width, height, 25, header.contentTop + 44)` and position tutorial + 24 levels inside a centered grid. On 1768×864 this must render 6 columns with tile width >= 120 px. Tutorial remains visually distinct using `current/completed` state and label `00` plus a short `УЧЕБА`/`LEARN` sublabel if space allows.

- [ ] **Step 4: Rebuild summary/header hierarchy**

Keep title centered, but move summary into a concise row beneath it. Use `ПРОЙДЕНО 7/24` and `СЧЁТ 12 430` without a heavy surrounding panel for every item. Position the dust display and Shop/Settings through the shared header utilities.

- [ ] **Step 5: Refresh economy + campaign state together**

In `refresh()` call `this.dust.setValue(this.economy.snapshot.dust)` and keep existing unlock/completion logic unchanged.

- [ ] **Step 6: Run relevant tests**

```bash
node --test test/presentation-layout.test.js test/campaign-progress.test.js test/campaign.test.js test/mode-access.test.js
```

Expected: PASS.

- [ ] **Step 7: Manual responsive smoke**

Check 1768×864, ~390×844 portrait, and short landscape. Confirm large readable tiles, no overlap, Shop/Settings visible, and every unlocked button reachable.

- [ ] **Step 8: Commit**

```bash
git add src/game/scenes/LevelSelectScene.js src/game/navigation-layout.js
git commit -m "feat: redesign campaign level selection"
```

---

### Task 5: Redesign Shop into visual product cards and make Board return lossless

**Files:**
- Modify: `src/game/scenes/ShopScene.js:1-175`
- Modify: `src/game/scenes/SettingsScene.js:1-130` for shared Board-safe return pattern
- Consume: `src/game/presentation-model.js`, `src/game/presentation-layout.js`, `src/game/ui.js`

**Interfaces:**
- Consumes: `shopProductPresentation()`, `shopGridMetrics()`, `utilityReturnPlan()`, `makeCurrencyDisplay()`, `makeIconButton()`.
- Produces: `goBack()` in both utility scenes that either resumes Board or starts menu/level-select based on `utilityReturnPlan()`.

- [ ] **Step 1: Teach Shop and Settings to return to a paused Board**

Allow `returnScene: "board"` in both scenes. Implement the same `goBack()` logic:

```js
goBack() {
  const plan = utilityReturnPlan(this.returnScene);
  if (plan.kind === "resume") {
    this.scene.stop();
    this.scene.resume(plan.scene);
    return;
  }
  this.scene.start(plan.scene);
}
```

For `SettingsScene`, preserve current language/sound behavior exactly.

- [ ] **Step 2: Build Shop product views around icon-led cards**

Map booster semantics to existing provisional frames:

```js
const PRODUCT_ICON = Object.freeze({
  move: GAMEPLAY_UI_FRAMES.hint,
  undo: GAMEPLAY_UI_FRAMES.undo,
  rescue: GAMEPLAY_UI_FRAMES.rescue,
});
```

Each product view owns:

- panel/card;
- 64–84 px product icon;
- title;
- one short description line;
- owned line;
- dust icon + numeric price;
- buy button whose text is only `КУПИТЬ` / `BUY`.

Do not put `×3 / 30 ПЫЛИ` into the buy-button label.

- [ ] **Step 3: Use `shopProductPresentation()` in `refresh()`**

For each product:

```js
const model = shopProductPresentation(view.product, snapshot, this.english);
view.title.setText(model.title);
view.description.setText(model.description);
view.owned.setText(`${this.english ? "OWNED" : "В ИНВЕНТАРЕ"} ×${model.owned}`);
view.price.setValue(model.price);
view.buy.setText(model.buyLabel).setEnabled(model.affordable);
```

Keep purchase amounts/prices from `HINT_PRODUCTS`; do not duplicate constants in scene code.

- [ ] **Step 4: Replace vertical debug rows with responsive card grid**

Use `shopGridMetrics()`. Desktop >=820 px: 3 columns. Narrow portrait: 1 column with shorter horizontal-ish cards so all three remain scroll-free at common phone heights. Two-column medium layout is acceptable.

Header contains title, current dust balance, Back, and Settings; Shop icon is omitted because already in Shop.

- [ ] **Step 5: Reduce text feedback after purchase**

Success message: `+3 НАМЁК` / equivalent concise localized copy. Insufficient funds message may remain explicit, but do not repeat a paragraph of explanatory text. Disabled affordability is already conveyed by the button.

- [ ] **Step 6: Run economy/model tests**

```bash
node --test test/presentation-model.test.js test/economy.test.js
```

Expected: PASS.

- [ ] **Step 7: Manual Shop smoke**

From Board click Shop, buy/inspect affordability, return, and confirm the exact Board position is still present. Repeat from Level Select and Menu. Check Shop on desktop and portrait.

- [ ] **Step 8: Commit**

```bash
git add src/game/scenes/ShopScene.js src/game/scenes/SettingsScene.js
git commit -m "feat: rebuild shop product cards"
```

---

### Task 6: Rebuild Completion Overlay into a compact stable reward card

**Files:**
- Modify: `src/game/completion-overlay.js:1-293`
- Consume: `completionCardMetrics()`, `makeCurrencyDisplay()`

**Interfaces:**
- Consumes existing completion data contract unchanged: `scoreAward`, `totalScore`, `dustAward`, `dustTotal`, progress fields, optional `unlockText`, labels/callbacks.
- Produces same `CompletionOverlay.show(data, { onContinue, onExit })` public interface.

- [ ] **Step 1: Replace dust text block with icon/value display**

Create a dedicated `dustIcon` + `dustValue` (or shared `makeCurrencyDisplay`) so the row renders `[dust icon] +8` and, in secondary text, resulting balance if needed. Remove the repeated `ПЫЛЬ`/`DUST` word from the primary reward row.

- [ ] **Step 2: Use `completionCardMetrics()` for card size**

Call:

```js
const metrics = completionCardMetrics(width, height, {
  hasUnlock: Boolean(this.data?.unlockText),
});
```

Target desktop width 500–560 px. Keep buttons inside card bounds in all cases.

- [ ] **Step 3: Collapse the visual hierarchy**

Lay out in this order:

1. success icon (44–52 px, not oversized);
2. title;
3. primary score reward;
4. compact total-score + dust reward rows;
5. progress row/bar;
6. optional unlock line;
7. primary Continue button;
8. secondary Exit button.

Do not give subtitle, total, dust, progress, and unlock equal vertical weight. If `subtitle` is low-value mode detail, render it muted directly under title at <=11–12 px.

- [ ] **Step 4: Preserve count-up behavior**

Keep the existing `countTween`, `fadeTween`, and delayed button reveal. Only text composition/layout changes; score/dust/progress tween target values and duration remain unchanged unless a timing-only adjustment is required to prevent visual overlap.

- [ ] **Step 5: Validate both optional-content shapes manually**

Trigger one completion with unlock text and one without. Ensure the card height adjusts without moving buttons outside the frame and count-up values remain correct.

- [ ] **Step 6: Run campaign/economy tests**

```bash
node --test test/campaign-progress.test.js test/campaign.test.js test/economy.test.js test/endless-score.test.js test/endless-run.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/completion-overlay.js
git commit -m "feat: compact completion reward presentation"
```

---

### Task 7: Normalize Menu, Settings, Leaderboard, and global icon sizing

**Files:**
- Modify: `src/game/scenes/MenuScene.js`
- Modify: `src/game/scenes/SettingsScene.js`
- Modify: `src/game/scenes/LeaderboardScene.js`
- Modify: `src/game/navigation-layout.js` only if shared header polish is needed

**Interfaces:**
- Consumes `makeIconButton()`, `globalActionPresentation()`, `layoutSceneHeader()`.
- Produces consistent top-right order `[Shop][Settings]` where both exist, with Settings at far right.

- [ ] **Step 1: Remove duplicated symbol copy in Settings and other back buttons**

Replace all strings such as `"←  НАЗАД"`, `"← BACK"`, `"Ⅱ ПАУЗА"` with semantic copy from `globalActionPresentation()` or plain localized text while retaining the icon itself.

Search before editing:

```bash
grep -RniE '←|Ⅱ|II PAUSE|Ⅱ  PAUSE' src/game
```

Expected after the task: no duplicated icon symbols remain in user-facing button strings.

- [ ] **Step 2: Make Settings/Shop global icons consistently 46–50 px**

Use `makeIconButton(scene, frame, onClick, { size: 46, glyphSize: 28 })` for standard global controls (or `size: 48, glyphSize: 30` on roomy desktop) instead of tiny 20–22 px icons inside arbitrary boxes.

- [ ] **Step 3: Put Shop + Settings at the top-right of Menu and appropriate supporting screens**

On Menu, use icon-only Shop/Settings global controls and remove the redundant text Shop button if it duplicates the same destination. Keep Ranking as a text/secondary destination unless a clear semantic icon already exists.

On Settings, omit Settings itself and expose Shop. On Leaderboard, expose Shop + Settings if header width allows; on very narrow layouts, preserve Back first and keep at least Settings accessible.

- [ ] **Step 4: Re-run semantic model test plus scene-independent suites**

```bash
node --test test/presentation-model.test.js test/settings.test.js test/leaderboard.test.js
```

Expected: PASS.

- [ ] **Step 5: Manual navigation smoke**

Confirm Shop is reachable directly from Menu, Level Select, Board, Settings/Leaderboard where shown; Settings is direct on key screens; Back never renders a duplicated arrow; global glyphs are visibly larger.

- [ ] **Step 6: Commit**

```bash
git add src/game/scenes/MenuScene.js src/game/scenes/SettingsScene.js src/game/scenes/LeaderboardScene.js src/game/navigation-layout.js
git commit -m "refactor: normalize global navigation controls"
```

---

### Task 8: Update active presentation documentation and run full verification

**Files:**
- Modify: `ART_DIRECTION.md`
- Modify: `CURRENT_STATE.md`
- Modify only if asset-source facts changed: `THIRD_PARTY_ASSETS.md`
- Add/keep: `docs/superpowers/specs/2026-09-03-visual-presentation-overhaul-design.md`
- Add/keep: `docs/superpowers/plans/2026-09-03-visual-presentation-overhaul.md`

**Interfaces:**
- Produces updated active truth: structural presentation overhaul implemented; Chequered Ink still provisional, not final art direction.

- [ ] **Step 1: Update `ART_DIRECTION.md` without falsely selecting a final theme**

Record these now-valid presentation rules:

- board is hero; cells recede;
- hover is subtle;
- UI uses semantic global actions;
- Shop/Settings direct-access pattern;
- large campaign tiles and visual Shop cards;
- Chequered Ink remains a temporary implementation baseline while asset research continues.

Do not promote Chequered Ink to final style.

- [ ] **Step 2: Update `CURRENT_STATE.md`**

State that the presentation architecture now includes direct Shop/Settings navigation, icon-based currency presentation, redesigned Level Select/Shop/completion hierarchy, and renderer-drawn low-contrast board cells. Keep current gameplay/product facts unchanged.

- [ ] **Step 3: Run focused new tests**

```bash
node --test \
  test/presentation-model.test.js \
  test/presentation-layout.test.js \
  test/piece-visual-state.test.js
```

Expected: all PASS.

- [ ] **Step 4: Run the automated suite**

```bash
pnpm test
```

If `test/progression.test.js` still exhibits the already-known long-running behavior, capture that separately and run the remaining suite explicitly rather than claiming a fully green suite. Any new failure outside that known case must be fixed before handoff.

- [ ] **Step 5: Run production build**

```bash
pnpm build
```

Expected: exit 0 in the user's dependency-installed environment.

- [ ] **Step 6: Manual cross-screen smoke matrix**

Verify:

```text
Board:       37 / 61 / 91 cells; hover; selected; hint; blocked; Shop; Settings
LevelSelect: desktop / portrait / short-landscape; all 25 entries reachable
Shop:        desktop 3-card / portrait stack; affordable + unaffordable; owned refresh
Settings:    language; sound; direct Shop; return to paused Board
Completion:  unlock + no-unlock; dust/score count-up; both buttons inside card
Currency:    same balance on Board / Level Select / Shop / Completion
Navigation:  no duplicated arrow/pause symbols; global glyphs large enough
```

- [ ] **Step 7: Confirm gameplay/economy source files were not modified**

Before Task 1, record the implementation base once with `git rev-parse HEAD > .git/presentation-overhaul-base`. At verification time run:

```bash
BASE=$(cat .git/presentation-overhaul-base)
git diff --name-only "$BASE"..HEAD -- \
  src/rules.js src/board.js src/solver.js src/generator.js \
  src/campaign.js src/progression.js src/economy.js
```

Expected: no output. (`src/game/economy.js` may be read by scenes but should not require behavior changes either.)

- [ ] **Step 8: Commit documentation/checkpoint**

```bash
git add ART_DIRECTION.md CURRENT_STATE.md THIRD_PARTY_ASSETS.md docs/superpowers/specs docs/superpowers/plans
git commit -m "docs: record presentation overhaul"
```

- [ ] **Step 9: Generate handoff bundle**

```bash
pnpm context:last
```

Expected: one `last-commit` context bundle describing the completed presentation checkpoint.
