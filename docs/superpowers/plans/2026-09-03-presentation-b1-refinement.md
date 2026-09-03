# Presentation B1 Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the first-pass generic Cartoon UI presentation with calm renderer-owned surfaces, fix utility-scene navigation bugs, simplify the tutorial, and repair level-select, inventory, shop, and completion presentation without touching puzzle mechanics.

**Architecture:** Keep rules/generator/solver/economy renderer-independent. Add small presentation helpers for semantic state, utility navigation, and primitive UI surfaces, then update scenes to consume them. Raster assets remain for pieces and a few icons only; panels/buttons/level tiles/cards move to Phaser-drawn surfaces so future asset swaps do not require layout rewrites.

**Tech Stack:** Phaser 3.90, native ES modules, Node `node:test`, Vite, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-03-presentation-b1-refinement-design.md`

## Global Constraints

- Do not change puzzle rules, generator behavior, solver behavior, scoring, campaign progression, economy values, or persistence contracts.
- Do not rename internal atom IDs or rule concepts solely for presentation.
- No screenshot/pixel-diff tests, exact-color tests, or tests tied to a specific third-party PNG filename.
- Chequered Ink gems/icons remain temporary; Cartoon UI panel/button chrome must stop defining the main UI.
- Shop and Settings must remain direct top-right actions and must return to the same active board session when opened from play.
- Tutorial has exactly three presentation steps with one short sentence per step and no animated target circles or 1/2/3 neighbour labels; step 3 consolidates the remaining ordinary pairs in the current tutorial data.
- Inventory filtering dims non-matches instead of drawing rings around matches.

---

### Task 1: Renderer-owned UI primitives and state-preserving hover

**Files:**
- Modify: `src/game/ui.js`
- Modify: `src/game/presentation-model.js`
- Test: `test/presentation-model.test.js`
- Create: `test/ui-state-model.test.js`

**Interfaces:**
- Produces `buttonVisualState({ semanticState, hovered, pressed, enabled })` returning semantic state plus subtle alpha/scale deltas without replacing level state.
- Produces renderer-owned button/panel primitives used by later tasks.

- [ ] Write failing tests asserting level hover preserves `completed/current/locked` semantic state and only returns a small scale/alpha response.
- [ ] Run `node --test test/presentation-model.test.js test/ui-state-model.test.js` and verify RED.
- [ ] Add `buttonVisualState` and update `AtlasButton` so level hover never swaps to one generic hover frame; use renderer-drawn rounded rectangles for button/panel backgrounds and low-contrast borders.
- [ ] Keep icon/text APIs stable (`setIcon`, `setFixedSize`, `setLevelState`, `setEnabled`) so scenes do not need a wholesale rewrite.
- [ ] Normalize raster icon occupancy by cropping transparent padding at load-time display using known source-frame bounds or a reusable visible-bounds scale helper; settings/back/pause should visually occupy roughly 55–70% of the control interior.
- [ ] Run focused tests and `node --check src/game/ui.js`.
- [ ] Commit in a real Git checkout: `git commit -am "refactor: make presentation surfaces renderer-owned"`.

### Task 2: Shared utility-scene navigation and board resume

**Files:**
- Create: `src/game/utility-navigation.js`
- Modify: `src/game/presentation-model.js`
- Modify: `src/game/scenes/BoardScene.js`
- Modify: `src/game/scenes/ShopScene.js`
- Modify: `src/game/scenes/SettingsScene.js`
- Test: `test/presentation-model.test.js`
- Create: `test/utility-navigation.test.js`

**Interfaces:**
- `openUtilityScene(scene, key, { returnScene })` launches/wakes target, brings target to top, pauses source when needed, and passes return target.
- `closeUtilityScene(scene, returnScene)` stops current utility scene and resumes/starts the return target according to the model.

- [ ] Write failing tests against a minimal fake scene-manager verifying call order: launch/wake target → bringToTop target → pause source; return from utility stops current → resumes board/shop/settings or starts ordinary scenes.
- [ ] Run focused tests and verify RED reproduces the missing bring-to-top behavior.
- [ ] Implement helper and replace Board/Shop/Settings ad-hoc launch/pause/resume code.
- [ ] Verify focused tests GREEN and syntax-check modified scenes.
- [ ] Commit in a real Git checkout: `git commit -am "fix: preserve board when opening utility scenes"`.

### Task 3: Calm board interaction, attached inventory, and three-step tutorial

**Files:**
- Modify: `src/game/scenes/BoardScene.js`
- Modify: `src/game/responsive-layout.js`
- Modify: `src/tutorial.js`
- Test: `test/tutorial.test.js`
- Modify: `test/presentation-layout.test.js`
- Create: `test/board-presentation-model.test.js`

**Interfaces:**
- `tutorialPresentationStep(step, english)` returns `{ header, copy }` for steps 0..2.
- `pieceAlphaForFilter({ matchesFilter, filterActive, locked })` dims non-matches only.
- `inventoryAnchorMetrics(boardBounds, panelHeight, viewport)` returns panel position relative to board bottom.

- [ ] Write failing tests for exactly three tutorial presentation steps, no remaining-piece-count header, and one-sentence copy.
- [ ] Write failing tests for inventory filtering: matches stay normal; non-matches dim; no ring/scale state is requested.
- [ ] Write failing layout test asserting inventory Y is derived from board bounds rather than viewport bottom.
- [ ] Run focused tests and verify RED.
- [ ] Remove tutorial neighbour number labels and expanding/pulsing circles; keep only subtle static target/neighbour guidance.
- [ ] Replace old inventory match rings with non-match alpha dimming.
- [ ] Re-anchor inventory directly below board bounds with a small responsive gap; keep compact surface.
- [ ] Reduce ordinary hover to ~2–4% scale + subtle brightness; selected/hint remain distinct but restrained.
- [ ] Run focused tests, syntax-check BoardScene, then run `node --test test/tutorial.test.js test/presentation-layout.test.js test/board-presentation-model.test.js`.
- [ ] Commit in a real Git checkout: `git commit -am "refactor: calm board tutorial and inventory feedback"`.

### Task 4: Level select state language

**Files:**
- Modify: `src/game/scenes/LevelSelectScene.js`
- Modify: `src/game/presentation-layout.js`
- Modify: `test/presentation-layout.test.js`
- Modify: `test/ui-state-model.test.js`

**Interfaces:**
- Existing `levelGridMetrics` remains the grid source.
- Level tile semantic state stays visible during hover.

- [ ] Add failing test that locked state does not gain the same hover treatment as current/playable, and completed remains completed.
- [ ] Run focused tests and verify RED if behavior is not yet covered by Task 1.
- [ ] Remove high-contrast `X` marker from every locked tile; use quiet disabled styling and optional small lock symbol only when needed.
- [ ] Keep tutorial tile in same grid language and reduce promotional green treatment.
- [ ] Tune hover to tiny scale/brightness response while preserving base state.
- [ ] Run `node --test test/presentation-layout.test.js test/ui-state-model.test.js` and syntax-check LevelSelectScene.
- [ ] Commit in a real Git checkout: `git commit -am "refine: clarify campaign level states"`.

### Task 5: Renderer-owned Shop and semantic cart icon

**Files:**
- Modify: `src/game/scenes/ShopScene.js`
- Modify: `src/game/ui.js`
- Modify: `src/game/navigation-layout.js`
- Modify: `src/art-assets.js`
- Test: `test/presentation-layout.test.js`
- Modify: `test/presentation-model.test.js`

**Interfaces:**
- `makeCartIconButton(scene, onClick, options)` draws a simple cart glyph using Phaser primitives, not gift imagery.
- Shop cards use renderer-owned surfaces while retaining economy/product presentation models.

- [ ] Add failing semantic test that global SHOP action is represented as `cart`, never `gift`.
- [ ] Run focused test and verify RED.
- [ ] Add renderer-drawn cart icon helper and switch all global Shop controls to it.
- [ ] Replace shop `makePanel` card chrome with neutral primitive card surfaces; keep large product icon, title, one-line description where space permits, owned, bundle amount, dust price, and buy action.
- [ ] Make cards more object-led by increasing item icon size and lowering copy density; short landscape omits descriptions.
- [ ] Verify shop layout tests and syntax-check ShopScene.
- [ ] Commit in a real Git checkout: `git commit -am "refactor: make shop object-led and renderer-owned"`.

### Task 6: Completion overlay layering and spacing

**Files:**
- Modify: `src/game/completion-overlay.js`
- Modify: `src/game/presentation-layout.js`
- Modify: `test/presentation-layout.test.js`
- Create: `test/completion-presentation.test.js`

**Interfaces:**
- `completionActionMetrics(cardHeight, buttonHeights, gap)` returns positions with guaranteed positive vertical gap.
- Completion progress graphics render above card background.

- [ ] Write failing tests asserting action rectangles do not overlap and remain inside card, and progress bar depth is above card surface depth through a pure presentation constant/model.
- [ ] Run focused tests and verify RED.
- [ ] Split dim-background graphics from progress-bar graphics or set explicit depths so the bar cannot be covered by the card.
- [ ] Recompute action positions from bottom padding + explicit gap; ensure compact and short layouts fit.
- [ ] Restore visible campaign progress bar/text between dust reward and unlock message.
- [ ] Run focused tests and syntax-check completion overlay.
- [ ] Commit in a real Git checkout: `git commit -am "fix: repair completion progress and actions"`.

### Task 7: Documentation, regression sweep, and patch packaging

**Files:**
- Modify: `CURRENT_STATE.md`
- Modify: `ART_DIRECTION.md`
- Keep: `docs/superpowers/specs/2026-09-03-presentation-b1-refinement-design.md`
- Keep: `docs/superpowers/plans/2026-09-03-presentation-b1-refinement.md`

**Interfaces:**
- Documentation states B1 is current presentation baseline while final asset direction remains unresolved.

- [ ] Update current-state/art-direction docs without promoting temporary gems/icons to final art.
- [ ] Run all presentation-focused tests plus all existing tests except the known long-running `test/progression.test.js` if it still fails to finish in the environment.
- [ ] Run `node --check` on every modified JS file.
- [ ] Run `pnpm build` when dependencies are available; otherwise report the environment limitation instead of claiming build success.
- [ ] Verify `src/rules.js`, `src/board.js`, `src/solver.js`, `src/generator.js`, `src/campaign.js`, `src/progression.js`, and `src/economy.js` remain unchanged.
- [ ] Package only changed/new B1 files as a patch archive for the user's real repository.
