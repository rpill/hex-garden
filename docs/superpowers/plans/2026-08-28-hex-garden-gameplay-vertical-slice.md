# Hex Garden Gameplay Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build one production-quality hand-inked BoardScene slice from the approved concepts and verify it on desktop, phone portrait, phone landscape, and live rotation.

**Architecture:** Rules, generation, progression, economy, solver, scoring, and persistence stay unchanged. A pure manifest and theme feed focused Phaser views for board pieces and inventory; BoardScene remains the coordinator. Missing textures fall back to the current live atom labels.

**Tech Stack:** Phaser 3.90, Vite 7, native ES modules, Node 20 node:test, project-owned PNGs, local Neucha under SIL OFL 1.1.

**Spec:** docs/superpowers/specs/2026-08-28-hex-garden-visual-system-design.md

## Global Constraints

- Use only the two approved references in docs/superpowers/specs/assets.
- Gold is a faceless ochre ring-and-dot medallion: no eyes, mouth, cheeks, rays, or expression.
- src/board.js remains rule authority. Renderer code never reimplements rules.
- Labels, counts, prices, scores, and translations remain live Phaser text.
- Map all 14 public standard atom types. Quintessence keeps the current fallback label.
- Bundle Neucha and its OFL file locally; add its provenance to THIRD_PARTY_ASSETS.md.
- No runtime CDN requests.
- The vertical slice loads stable individual PNGs only through the catalog. Physical atlas packing waits until the remaining scene art is approved; scene code never references file paths directly.
- Touch targets are at least 44 by 44 CSS px.
- Phone counts are at least 16 px; score and dust are at least 18 px.
- Desktop: top HUD and bottom dock. Portrait: two inventory rows when required. Phone landscape: side action dock.
- Rotation preserves board, selection, score, hints, inventory, and open modals.
- Other scenes are outside this plan.
- Commit after every task; never amend.

## File Map

Create:

- src/game/art-manifest.js
- src/game/art-loader.js
- src/game/theme.js
- src/game/board-visual-state.js
- src/game/board-piece-view.js
- src/game/inventory-view.js
- test/art-manifest.test.js
- test/art-assets.test.js
- test/theme.test.js
- test/board-visual-state.test.js
- public/assets/hex-garden/atoms/*.png
- public/assets/hex-garden/boosters/*.png
- public/assets/hex-garden/economy/*.png
- public/assets/hex-garden/flora/*.png
- public/assets/hex-garden/foundation/paper.png
- public/assets/hex-garden/fonts/Neucha.ttf
- public/assets/hex-garden/fonts/Neucha-OFL.txt

Modify:

- src/game/scenes/BoardScene.js
- src/game/responsive-layout.js
- src/game/ui.js
- src/game/completion-overlay.js
- src/styles.css
- src/main.js
- test/responsive-layout.test.js
- THIRD_PARTY_ASSETS.md

---

### Task 1: Art Manifest and Loader

**Files:**

- Create: src/game/art-manifest.js
- Create: src/game/art-loader.js
- Create: test/art-manifest.test.js

**Interfaces:**

- Produces: ATOM_ART, UI_ART, GARDEN_ART_ASSETS, atomArtFor(type), preloadGardenArt(scene).
- Consumers: BoardScene, BoardPieceView, InventoryView, asset tests.

- [ ] **Step 1: Write the failing tests**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import { Atom } from "../src/atom-types.js";
import { ATOM_ART, UI_ART, GARDEN_ART_ASSETS, atomArtFor } from "../src/game/art-manifest.js";
import { preloadGardenArt } from "../src/game/art-loader.js";

const publicTypes = [
  Atom.SALT, Atom.AIR, Atom.FIRE, Atom.WATER, Atom.EARTH,
  Atom.QUICKSILVER, Atom.GOLD, Atom.SILVER, Atom.COPPER,
  Atom.IRON, Atom.TIN, Atom.LEAD, Atom.VITAE, Atom.MORS,
];

test("manifest maps public atoms and leaves Q on fallback", () => {
  assert.deepEqual(
    Object.keys(ATOM_ART).map(Number).sort((a, b) => a - b),
    [...publicTypes].sort((a, b) => a - b),
  );
  assert.equal(atomArtFor(Atom.QUINTESSENCE), null);
});

test("keys and URLs are unique", () => {
  const keys = GARDEN_ART_ASSETS.map((item) => item.key);
  const urls = GARDEN_ART_ASSETS.map((item) => item.url);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((url) => url.startsWith("/assets/hex-garden/")));
  assert.ok(keys.every((key) => /^[\x20-\x7E]+$/.test(key)));
});

test("control keys are stable", () => {
  assert.equal(UI_ART.move.key, "booster-move");
  assert.equal(UI_ART.undo.key, "booster-undo");
  assert.equal(UI_ART.rescue.key, "booster-rescue");
  assert.equal(UI_ART.dustBottle.key, "dust-bottle");
});

test("loader queues only missing textures", () => {
  const existing = new Set([GARDEN_ART_ASSETS[0].key]);
  const queued = [];
  preloadGardenArt({
    textures: { exists: (key) => existing.has(key) },
    load: { image: (key, url) => queued.push({ key, url }) },
  });
  assert.equal(queued.length, GARDEN_ART_ASSETS.length - 1);
});
~~~

- [ ] **Step 2: Run and observe ERR_MODULE_NOT_FOUND**

Run: node --test test/art-manifest.test.js

- [ ] **Step 3: Implement the manifest**

~~~js
import { Atom } from "../atom-types.js";

const asset = (key, url) => Object.freeze({ key, url });
const atom = (type, slug) => Object.freeze({
  type,
  ...asset("atom-" + slug, "/assets/hex-garden/atoms/" + slug + ".png"),
});

export const ATOM_ART = Object.freeze({
  [Atom.SALT]: atom(Atom.SALT, "salt"),
  [Atom.AIR]: atom(Atom.AIR, "air"),
  [Atom.FIRE]: atom(Atom.FIRE, "fire"),
  [Atom.WATER]: atom(Atom.WATER, "water"),
  [Atom.EARTH]: atom(Atom.EARTH, "earth"),
  [Atom.QUICKSILVER]: atom(Atom.QUICKSILVER, "quicksilver"),
  [Atom.GOLD]: atom(Atom.GOLD, "gold"),
  [Atom.SILVER]: atom(Atom.SILVER, "silver"),
  [Atom.COPPER]: atom(Atom.COPPER, "copper"),
  [Atom.IRON]: atom(Atom.IRON, "iron"),
  [Atom.TIN]: atom(Atom.TIN, "tin"),
  [Atom.LEAD]: atom(Atom.LEAD, "lead"),
  [Atom.VITAE]: atom(Atom.VITAE, "vitae"),
  [Atom.MORS]: atom(Atom.MORS, "mors"),
});

export const UI_ART = Object.freeze({
  move: asset("booster-move", "/assets/hex-garden/boosters/move.png"),
  undo: asset("booster-undo", "/assets/hex-garden/boosters/undo.png"),
  rescue: asset("booster-rescue", "/assets/hex-garden/boosters/rescue.png"),
  dustBottle: asset("dust-bottle", "/assets/hex-garden/economy/dust-bottle.png"),
  dustScatter: asset("dust-scatter", "/assets/hex-garden/economy/dust-scatter.png"),
  paper: asset("paper", "/assets/hex-garden/foundation/paper.png"),
  ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return [
      "flora" + suffix,
      asset("flora-" + suffix, "/assets/hex-garden/flora/flora-" + suffix + ".png"),
    ];
  })),
});

export const GARDEN_ART_ASSETS = Object.freeze([
  ...Object.values(ATOM_ART),
  ...Object.values(UI_ART),
]);

export function atomArtFor(type) {
  return ATOM_ART[type] ?? null;
}
~~~

Create src/game/art-loader.js:

~~~js
import { GARDEN_ART_ASSETS } from "./art-manifest.js";

export function preloadGardenArt(scene) {
  for (const { key, url } of GARDEN_ART_ASSETS) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}
~~~

- [ ] **Step 4: Verify**

Run: node --test test/art-manifest.test.js

Expected: 4 PASS.

Run: pnpm test

Expected: full suite PASS.

- [ ] **Step 5: Commit**

~~~bash
git add src/game/art-manifest.js src/game/art-loader.js test/art-manifest.test.js
git commit -m "feat: define gameplay art contract"
~~~

---

### Task 2: Produce and Validate Art

**Files:**

- Create: public/assets/hex-garden/atoms/{salt,air,fire,water,earth,quicksilver,gold,silver,copper,iron,tin,lead,vitae,mors}.png
- Create: public/assets/hex-garden/boosters/{move,undo,rescue}.png
- Create: public/assets/hex-garden/economy/{dust-bottle,dust-scatter}.png
- Create: public/assets/hex-garden/flora/flora-01.png through flora-06.png
- Create: public/assets/hex-garden/foundation/paper.png
- Create: public/assets/hex-garden/fonts/Neucha.ttf
- Create: public/assets/hex-garden/fonts/Neucha-OFL.txt
- Create: test/art-assets.test.js
- Modify: THIRD_PARTY_ASSETS.md

**Interfaces:**

- Consumes: GARDEN_ART_ASSETS URLs.
- Produces: 26 local PNGs plus local font and license.

- [ ] **Step 1: Write failing file tests**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GARDEN_ART_ASSETS } from "../src/game/art-manifest.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const diskPath = (url) => root + "public" + url;

function pngInfo(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25],
  };
}

test("declared art exists and is large enough", async () => {
  for (const item of GARDEN_ART_ASSETS) {
    const info = pngInfo(await readFile(diskPath(item.url)));
    assert.ok(info.width >= 256, item.key + " width");
    assert.ok(info.height >= 256, item.key + " height");
    if (item.key !== "paper") assert.ok([4, 6].includes(info.colorType));
  }
});

test("font and OFL are bundled", async () => {
  assert.ok((await stat(root + "public/assets/hex-garden/fonts/Neucha.ttf")).size > 10000);
  const license = await readFile(
    root + "public/assets/hex-garden/fonts/Neucha-OFL.txt",
    "utf8",
  );
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
});
~~~

- [ ] **Step 2: Run and observe ENOENT**

Run: node --test test/art-assets.test.js

- [ ] **Step 3: Create transparent sprites with ImageGen**

Use imagegen once per non-paper asset, with state A as style/source and state B as selection reference:

~~~text
Use case: background-extraction.
Asset type: Hex Garden production sprite, 512x512 transparent PNG.
Preserve: approved handmade proportions, warm pigment, imperfect navy ink, subtle print texture.
Constraints: one centered object; transparent background; no hex; no UI; no text; no abbreviation; no count; readable at 48 px.
Avoid: new style, photorealism, glossy 3D, watermark, extra objects.
~~~

Exact subjects:

- salt: white six-petal crystal
- air: blue ribbon curl
- fire: rust flame
- water: blue drop
- earth: olive stone/seed
- quicksilver: silver droplet and one bead
- gold: ochre medallion containing only ring and center dot
- silver: pale faceted nugget
- copper: warm ore
- iron: dark block
- tin: light ingot
- lead: charcoal block
- vitae: gold seed and two leaves
- mors: purple struck seed
- move: navy dotted winning route
- undo: navy curved undo arrow
- rescue: broken branch and green sprout
- dust bottle: corked bottle with orange dust
- dust scatter: small orange scatter
- flora-01 through flora-06: six distinct concept sprouts/leaves/flowers

Gold additionally forbids eyes, mouth, cheeks, eyebrows, rays, and expression.

- [ ] **Step 4: Create paper**

~~~text
Use case: stylized-concept.
Asset type: seamless 512x512 tile.
Primary request: warm off-white handmade paper from the approved concepts.
Constraints: seamless; flat; extremely subtle fibers; no border, objects, writing, or gameplay-like stains.
~~~

Save as public/assets/hex-garden/foundation/paper.png.

- [ ] **Step 5: Bundle Neucha and license**

~~~powershell
curl.exe -L "https://raw.githubusercontent.com/google/fonts/main/ofl/neucha/Neucha.ttf" -o "public/assets/hex-garden/fonts/Neucha.ttf"
curl.exe -L "https://raw.githubusercontent.com/google/fonts/main/ofl/neucha/OFL.txt" -o "public/assets/hex-garden/fonts/Neucha-OFL.txt"
~~~

THIRD_PARTY_ASSETS.md records author Jovanny Lemonad, Google Fonts source, SIL OFL 1.1, both local paths, and that all PNGs are project-owned.

- [ ] **Step 6: Validate and inspect**

Run: node --test test/art-assets.test.js test/art-manifest.test.js

Expected: all PASS.

Inspect every PNG at 512 px and 48 px. Reject text, opaque corners, inconsistent ink, or a facial Gold mark.

- [ ] **Step 7: Commit**

~~~bash
git add public/assets/hex-garden THIRD_PARTY_ASSETS.md test/art-assets.test.js
git commit -m "feat: add hand-inked gameplay art set"
~~~

---

### Task 3: Theme and Shared UI

**Files:**

- Create: src/game/theme.js
- Create: test/theme.test.js
- Modify: src/game/ui.js
- Modify: src/styles.css
- Modify: src/main.js

**Interfaces:**

- Produces: GARDEN_THEME and themed makeText/makeButton.
- Consumers: all vertical-slice views.

- [ ] **Step 1: Write failing tests**

~~~js
import test from "node:test";
import assert from "node:assert/strict";
import { GARDEN_THEME } from "../src/game/theme.js";

test("theme locks approved hierarchy", () => {
  assert.equal(GARDEN_THEME.colors.paper, 0xf4ecd8);
  assert.equal(GARDEN_THEME.colors.ink, 0x14233c);
  assert.equal(GARDEN_THEME.colors.accent, 0xd8582f);
  assert.equal(GARDEN_THEME.fonts.display, "Neucha");
  assert.ok(Object.isFrozen(GARDEN_THEME));
});

test("theme locks accessibility sizes", () => {
  assert.equal(GARDEN_THEME.touch.minimum, 44);
  assert.ok(GARDEN_THEME.type.inventoryCount >= 16);
  assert.ok(GARDEN_THEME.type.primaryCounter >= 18);
});
~~~

- [ ] **Step 2: Run and observe ERR_MODULE_NOT_FOUND**

Run: node --test test/theme.test.js

- [ ] **Step 3: Implement tokens**

~~~js
export const GARDEN_THEME = Object.freeze({
  colors: Object.freeze({
    paper: 0xf4ecd8,
    paperShadow: 0xe6d8bd,
    ink: 0x14233c,
    inkMuted: 0x58606b,
    accent: 0xd8582f,
    selection: 0xe5a700,
    warning: 0xc9482f,
    success: 0x5f8b53,
  }),
  fonts: Object.freeze({
    display: "Neucha",
    body: 'Inter, Arial, "Segoe UI", sans-serif',
  }),
  type: Object.freeze({
    inventoryCount: 16,
    primaryCounter: 20,
    body: 16,
    caption: 14,
  }),
  touch: Object.freeze({ minimum: 44 }),
  strokes: Object.freeze({ normal: 2, selected: 4 }),
  state: Object.freeze({
    lockedAlpha: 0.38,
    depletedAlpha: 0.2,
    disabledAlpha: 0.4,
  }),
});
~~~

- [ ] **Step 4: Apply tokens**

makeText receives { display = false } and selects Neucha or body font. Add local @font-face for /assets/hex-garden/fonts/Neucha.ttf. Change root and Phaser fallback background to #f4ecd8. Keep all text live.

- [ ] **Step 5: Verify and commit**

Run: node --test test/theme.test.js

Expected: 2 PASS.

Run: pnpm build

Expected: PASS with no remote font URL.

~~~bash
git add src/game/theme.js src/game/ui.js src/styles.css src/main.js test/theme.test.js
git commit -m "feat: add hand-inked UI theme"
~~~

---

### Task 4: Responsive Geometry

**Files:**

- Modify: src/game/responsive-layout.js
- Modify: test/responsive-layout.test.js

**Interfaces:**

- Produces: boardSurfaceMetrics(width, height, { inventoryCount, actionCount }).
- Consumers: BoardScene and InventoryView.

- [ ] **Step 1: Add failing tests**

~~~js
test("desktop board dominates", () => {
  const value = boardSurfaceMetrics(1440, 900, { inventoryCount: 14, actionCount: 2 });
  assert.ok(value.board.width >= 1050);
  assert.ok(value.board.height >= 560);
  assert.equal(value.inventory.rows, 1);
});

test("portrait has two readable inventory rows", () => {
  const value = boardSurfaceMetrics(414, 896, { inventoryCount: 14, actionCount: 2 });
  assert.equal(value.inventory.rows, 2);
  assert.ok(value.board.width >= 386);
  assert.ok(value.board.height >= 500);
  assert.ok(value.inventory.countSize >= 16);
});

test("landscape uses side dock and a large board", () => {
  const value = boardSurfaceMetrics(896, 414, { inventoryCount: 14, actionCount: 3 });
  assert.equal(value.sideDock, true);
  assert.ok(value.actions.width >= 96);
  assert.ok(value.board.width >= 650);
  assert.ok(value.board.height >= 300);
  assert.equal(value.controls.touchSize, 44);
});
~~~

- [ ] **Step 2: Run and observe missing export**

Run: node --test test/responsive-layout.test.js

- [ ] **Step 3: Implement exact return shape**

~~~js
{
  compact,
  portrait,
  sideDock,
  header: { x, y, width, height },
  board: { x, y, width, height },
  actions: { x, y, width, height, vertical },
  inventory: { x, y, width, height, rows, countSize },
  controls: { touchSize: 44 },
}
~~~

Use 10-18 px margins, 104-116 px landscape dock, 118-154 px portrait inventory, and at most 118 px desktop bottom chrome. Compute board bounds last.

- [ ] **Step 4: Verify and commit**

Run: node --test test/responsive-layout.test.js test/navigation-layout.test.js

Expected: all PASS.

~~~bash
git add src/game/responsive-layout.js test/responsive-layout.test.js
git commit -m "feat: define responsive gameplay surface"
~~~

---

### Task 5: Board Atom Views

**Files:**

- Create: src/game/board-visual-state.js
- Create: src/game/board-piece-view.js
- Create: test/board-visual-state.test.js
- Modify: src/game/scenes/BoardScene.js lines 1-127, 225-359, 1351-1376, 1935-2043

**Interfaces:**

- Produces: pieceVisualState(flags), BoardPieceView.layout/render/destroy.
- Consumes: atomArtFor, GARDEN_THEME, existing BoardScene state.

- [ ] **Step 1: Write failing tests**

~~~js
test("selection outranks other outlines", () => {
  assert.deepEqual(
    pieceVisualState({ free: true, selected: true, hinted: true, panelMatch: true }),
    { alpha: 1, outline: "selected", hatch: false, blockedMark: false },
  );
});

test("locked piece has hatch", () => {
  const value = pieceVisualState({ free: false });
  assert.equal(value.alpha, 0.38);
  assert.equal(value.hatch, true);
});

test("blocked piece has blocked outline", () => {
  assert.equal(pieceVisualState({ free: true, blocked: true }).outline, "blocked");
});
~~~

- [ ] **Step 2: Run and observe missing module**

Run: node --test test/board-visual-state.test.js

- [ ] **Step 3: Implement state translation**

~~~js
import { GARDEN_THEME } from "./theme.js";

export function pieceVisualState({
  free = false,
  selected = false,
  hinted = false,
  panelMatch = false,
  blocked = false,
} = {}) {
  const outline = selected
    ? "selected"
    : blocked
      ? "blocked"
      : hinted
        ? "hinted"
        : panelMatch
          ? "panel"
          : "normal";
  return Object.freeze({
    alpha: free ? 1 : GARDEN_THEME.state.lockedAlpha,
    outline,
    hatch: !free,
    blockedMark: blocked && !selected,
  });
}
~~~

- [ ] **Step 4: Implement BoardPieceView**

Constructor:

~~~js
new BoardPieceView(scene, piece, {
  label,
  textureKey,
  onSelect,
})
~~~

It owns sprite, fallback live label, overlay Graphics, and circular hit zone. layout keeps the target at least 44 px. render applies alpha, locked hatching, and selected/hinted/blocked/panel rings. destroy releases all objects.

- [ ] **Step 5: Integrate BoardScene**

Add preloadGardenArt in preload(). Add paper tileSprite below chrome. Replace direct piece labels and circle fills with BoardPieceView. Preserve selectPiece, board.isFree, selected keys, hint keys, panel match, and blocked move. Hex borders stay code-native navy ink.

When a declared texture is absent, show the existing label fallback and emit one console warning per missing texture key, never one warning per frame. Deterministically choose flora-01 through flora-06 from the level seed plus hexKey for empty cells only; flora lives below atoms, has no hit zone, and is omitted when hexSize is below 18.

- [ ] **Step 6: Verify and commit**

Run: node --test test/board-visual-state.test.js test/rules.test.js test/panel-state.test.js

Run: pnpm test

Expected: all PASS.

~~~bash
git add src/game/board-visual-state.js src/game/board-piece-view.js src/game/scenes/BoardScene.js test/board-visual-state.test.js
git commit -m "feat: render hand-inked board atoms"
~~~

---

### Task 6: Inventory, HUD, and Booster Dock

**Files:**

- Create: src/game/inventory-view.js
- Modify: src/game/scenes/BoardScene.js lines 225-359, 941-960, 1378-1443, 1602-1755, 1868-1933, 2045-2144

**Interfaces:**

- Produces: InventoryView.rebuild/layout/render/destroy.
- Consumes: createPanelState, atomArtFor, boardSurfaceMetrics, UI_ART, existing callbacks.

- [ ] **Step 1: Implement InventoryView**

Each entry owns sprite, fallbackLabel, countText, badgeGraphics, and hitZone. Live count code is:

~~~js
countText
  .setText(entry.countVisible && !entry.depleted ? String(entry.count) : "")
  .setFontSize(Math.max(16, metrics.countSize));
~~~

Warning uses both red badge and exclamation. Preserve depleted, locked, current, selected, and two-second highlight states.

- [ ] **Step 2: Replace direct panelViews**

InventoryView owns Phaser objects. BoardScene still calls panelTypesForVariant(this.variant, this.initialPieces) and createPanelState, so only initially present types appear.

- [ ] **Step 3: Apply responsive HUD and actions**

Desktop/portrait place booster cards above inventory. Landscape puts pause/menu, Move, Undo, Rescue, and contextual Play in side dock. Preserve callbacks, purchase plus, rewarded cooldown, and hint counts. Add dust bottle beside live dust value.

- [ ] **Step 4: Verify and commit**

Run: node --test test/panel-state.test.js test/responsive-layout.test.js test/art-manifest.test.js

Run: pnpm build

Expected: all PASS.

~~~bash
git add src/game/inventory-view.js src/game/scenes/BoardScene.js
git commit -m "feat: add responsive gameplay inventory and dock"
~~~

---

### Task 7: Feedback and Overlays

**Files:**

- Modify: src/game/ui.js
- Modify: src/game/completion-overlay.js
- Modify: src/game/scenes/BoardScene.js

**Interfaces:**

- Consumes: GARDEN_THEME and existing callbacks/data.
- Produces: paper modals, removal feedback, completion reward surface.

- [ ] **Step 1: Add drawPaperCard**

~~~js
export function drawPaperCard(graphics, { x, y, width, height, alpha = 1 }) {
  graphics
    .fillStyle(GARDEN_THEME.colors.paper, alpha)
    .fillRoundedRect(x, y, width, height, 12);
  graphics
    .lineStyle(GARDEN_THEME.strokes.normal, GARDEN_THEME.colors.ink, alpha)
    .strokeRoundedRect(x, y, width, height, 12);
}
~~~

Use it for pause, mechanic, economy, and completion cards. Preserve blocking hit zones and callbacks.

- [ ] **Step 2: Restyle score feedback**

Keep score and multiplier math unchanged. Use live Neucha text in rust accent, animate upward from pair midpoint, then fade. Add no unrelated particles.

Restyle the existing proven-dead-end status as a blocking paper card with explicit restart/Undo/Rescue guidance. Do not change solver status, item consumption, or selection blocking.

- [ ] **Step 3: Restyle CompletionOverlay**

Keep show(data, callbacks), 900 ms count-up, delayed actions, and hide cleanup. Use paper/ink, dust bottle, larger live totals, and data-driven progress. Both actions remain visible at 844 by 390.

- [ ] **Step 4: Verify and commit**

Run: node --test test/economy.test.js test/campaign-progress.test.js test/navigation-layout.test.js test/yandex-games.test.js

Run: pnpm test

Expected: all PASS.

~~~bash
git add src/game/ui.js src/game/completion-overlay.js src/game/scenes/BoardScene.js
git commit -m "feat: skin gameplay feedback and rewards"
~~~

---

### Task 8: Browser QA and Final Regression

**Files:**

- Modify only files implicated by reproduced defects.

- [ ] **Step 1: Run automation**

~~~bash
pnpm test
pnpm build
pnpm check:campaign
~~~

Expected: all exit 0, including 55-piece and certificate tests.

- [ ] **Step 2: Start and open**

Run: pnpm dev

Open: http://localhost:5173/?test=all with browser:control-in-app-browser.

- [ ] **Step 3: Desktop QA**

At 1920 by 1080 and 1440 by 900 verify board dominance, identity, visible pause/menu, all state distinctions, readable counts, initial-type filtering, rewarded cooldown, dust purchase, and completion count-up.

- [ ] **Step 4: Portrait QA**

At 390 by 844 and 414 by 896 verify two rows when needed, 44 px targets, 16 px counts, unclipped modals, no overlap, and selection persistence after resize.

- [ ] **Step 5: Landscape QA**

At 844 by 390 and 896 by 414 verify side dock, board width at least 650 px at 896 by 414, readable counts, visible navigation, and reachable overlays.

- [ ] **Step 6: Rotation QA**

Rotate portrait to landscape to portrait with selected atom, active Move hint, economy modal, and completion overlay. Confirm no restart, score change, duplicate input, lost modal, or console error.

- [ ] **Step 7: Fix only reproduced defects**

First add the smallest failing assertion to responsive-layout, board-visual-state, or relevant authority test. Observe failure, make minimal fix, rerun focused test, then pnpm test.

- [ ] **Step 8: Final verification and optional fix commit**

~~~bash
pnpm test
pnpm build
pnpm check:campaign
git status --short
~~~

If fixes exist:

~~~bash
git add src test public THIRD_PARTY_ASSETS.md
git commit -m "fix: complete responsive gameplay visual slice"
~~~

If no defects exist, do not create an empty commit; Task 7 is the slice head.
