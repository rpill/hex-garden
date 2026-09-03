# Hex Garden Board UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the first Board UX patch after live playtest so onboarding teaches the core action first, tutorial callouts sit next to their targets, completion has one obvious Level 1 CTA, Restart is separated from consumables, and board intro pacing is perceptible while preserving the already-approved dead-end semantics.

**Architecture:** Keep `BoardScene.ts` as orchestration owner. Move pure callout placement to a Phaser-free helper, keep `BoardTutorial.ts` renderer-only, keep system controls in `BoardHud.ts`, consumables/counts in `BoardInventory.ts`, and extend `BoardIntroAnimator.ts` with fresh/restart timing profiles. Reuse existing completion architecture rather than adding a second completion system.

**Tech Stack:** Phaser 3.90, Vite 7, strict TypeScript, Node test runner via `tsx`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-03-board-ux-overhaul-design.md`

## Global Constraints

- Preserve atom IDs, GardenBoard rules, scoring, progression, economy prices/rewards, persistence formats, Yandex rewarded-ad behavior, and public mode structure.
- Solver-proven unsolvability stays internal while legal moves remain; actual dead end is only `!board.won && board.legalMoves().length === 0`.
- Rescue is Endless-only and only in actual no-moves state.
- Tutorial order is matching pair → freedom rule → remaining-count panel.
- Tutorial must not add a tutorial-only legality gate.
- Restart is a system/session control; Move/Undo/Rescue are consumables.
- Fresh board intro target duration is perceptible and size-dependent; restart uses a faster profile.
- No screenshot/pixel tests, no exact color/coordinate lock-in, no production `any`, no `@ts-ignore`.
- Final verification requires `pnpm typecheck`, `pnpm test`, and `pnpm build` all exit 0.

---

### Task 1: Extract pure callout placement and fix strict typing

**Files:**
- Create: `src/game/tutorial-callout-layout.ts`
- Modify: `src/game/board/BoardTutorial.ts`
- Modify: `test/board-presentation-model.test.js`

**Interfaces:**
- Produces `CalloutSide`, `RectBounds`, `CalloutPlacement`, `CalloutPlacementInput`, and `chooseCalloutPlacement(input)` from a Phaser-free module.
- `BoardTutorial.ts` consumes only the typed placement result.

- [ ] **Step 1: Write the failing Node test**

Change `test/board-presentation-model.test.js` to import `chooseCalloutPlacement` from `../src/game/tutorial-callout-layout.js`, then assert a preferred `right`/`top` placement can be requested and still avoids overlap.

- [ ] **Step 2: Verify RED**

Run:
```powershell
node --import tsx --test test/board-presentation-model.test.js
```
Expected: FAIL because `tutorial-callout-layout.ts` does not exist.

- [ ] **Step 3: Implement the pure typed helper**

Create:
```ts
export type CalloutSide = "top" | "bottom" | "left" | "right";

export interface RectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CalloutPlacement {
  side: CalloutSide;
  x: number;
  y: number;
}

export interface CalloutPlacementInput {
  targetBounds: RectBounds;
  viewport: Readonly<{ width: number; height: number }>;
  callout: Readonly<{ width: number; height: number }>;
  preferredSides?: readonly CalloutSide[];
  gap?: number;
  margin?: number;
}
```
Build the candidate array as `readonly CalloutPlacement[]`, ordered by `preferredSides` followed by unused sides. Clamp to viewport and choose the first non-overlapping candidate, then least-overlap fallback.

- [ ] **Step 4: Make `BoardTutorial.ts` import the helper**

Delete the local placement interfaces/functions. Import `chooseCalloutPlacement` and `RectBounds` from `../tutorial-callout-layout.js`.

- [ ] **Step 5: Verify GREEN**

Run:
```powershell
node --import tsx --test test/board-presentation-model.test.js
pnpm typecheck
```
Expected: Node test PASS and the previous `side: string` TS2322 error is gone.

---

### Task 2: Reorder tutorial semantics and teach remaining counts

**Files:**
- Modify: `src/game/presentation-model.ts`
- Modify: `src/game/board/BoardTutorial.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `test/board-presentation-model.test.js`
- Modify: `test/board-presentation-contract.test.js`

**Interfaces:**
- `tutorialPresentationStep(0..2)` returns pair-action, freedom-rule, remaining-count copy in that order.
- `TutorialGuideState` can target either board geometry or an explicit UI rectangle for the inventory callout.

- [ ] **Step 1: Write failing tutorial-order tests**

Assert Russian copies exactly:
```js
[
  "Очисти поле: выбери две одинаковые доступные фишки.",
  "Три пустые клетки подряд делают фишку доступной.",
  "Здесь видно, сколько фишек каждого типа осталось.",
]
```
Also assert `BoardScene.ts` has no `tutorialAllowsPiece` gate and that tutorial step 2/third semantic step passes inventory bounds into tutorial presentation.

- [ ] **Step 2: Verify RED**

Run:
```powershell
node --import tsx --test test/board-presentation-model.test.js test/board-presentation-contract.test.js
```
Expected: FAIL on old order/missing inventory-target integration.

- [ ] **Step 3: Implement semantic progression**

Update `tutorialPresentationStep()` copy/order. In `BoardScene`, advance tutorial state by successful removals: initial authored pair target → after first removal show freedom example → after second removal show inventory-count explanation → then dismiss guidance after the condition is satisfied. Do not block other legal board actions.

- [ ] **Step 4: Implement contextual placement preferences**

For the freedom step, call placement with:
```ts
preferredSides: ["right", "top", "bottom", "left"]
```
For the inventory step, use the inventory panel bounds and prefer `top`, then `right/left/bottom` as responsive fallback.

- [ ] **Step 5: Verify GREEN**

Run:
```powershell
node --import tsx --test test/board-presentation-model.test.js test/board-presentation-contract.test.js test/tutorial.test.js
```
Expected: PASS.

---

### Task 3: Make tutorial completion one obvious Level 1 transition

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/board/BoardHud.ts`
- Modify: `test/board-presentation-contract.test.js`
- Modify: `test/completion-presentation.test.js` only if the existing completion surface is reused there.

**Interfaces:**
- Tutorial completion exposes one primary action labelled `УРОВЕНЬ 1 →` / `LEVEL 1 →` and routes directly to Campaign level index 0.
- The ordinary floating HUD does not leave a tiny tutorial `ИГРАТЬ` button under the board.

- [ ] **Step 1: Write failing source/behavior contract**

Assert the tutorial completion path contains localized `УРОВЕНЬ 1` / `LEVEL 1`, does not show the generic HUD `nextButton` for tutorial completion, and starts Campaign level 0 directly.

- [ ] **Step 2: Verify RED**

Run:
```powershell
node --import tsx --test test/board-presentation-contract.test.js test/completion-presentation.test.js
```
Expected: FAIL against the current `ИГРАТЬ` path.

- [ ] **Step 3: Reuse the focused completion overlay/state**

On tutorial board clear, persist tutorial completion, then present a centered result with title `ОБУЧЕНИЕ ПРОЙДЕНО` / `TUTORIAL COMPLETE` and one primary CTA `УРОВЕНЬ 1 →` / `LEVEL 1 →`. The callback starts Board scene in campaign mode at level 0. Hide/disable the old HUD next button for this path.

- [ ] **Step 4: Verify GREEN**

Run the same focused tests and `pnpm typecheck`.

---

### Task 4: Separate system controls from consumable actions

**Files:**
- Modify: `src/game/board/BoardHud.ts`
- Modify: `src/game/board/BoardInventory.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `test/board-presentation-contract.test.js`

**Interfaces:**
- `BoardHud` owns Pause + Restart as one system group.
- `BoardInventory` owns only Move/Undo/Rescue consumable controls beneath/near the inventory panel.

- [ ] **Step 1: Write failing structural tests**

Assert `restartButton` is laid out adjacent to `pauseButton` in `BoardScene`/HUD layout and never appears in the consumable action placement loop. Assert Move/Undo/Rescue remain in `BoardInventory.hintButtons`.

- [ ] **Step 2: Verify RED**

Run:
```powershell
node --import tsx --test test/board-presentation-contract.test.js
```
Expected: FAIL because current layout places Restart with boosters.

- [ ] **Step 3: Move Restart layout to the system group**

Position Pause and Restart together in the upper-left floating group on desktop; retain semantic separation on portrait/landscape. Keep Restart always reachable.

- [ ] **Step 4: Keep consumables together**

Layout Move/Undo/Rescue as one inventory-backed group. Campaign hides Rescue. Do not move Restart into `BoardInventory`.

- [ ] **Step 5: Verify GREEN**

Run the focused contract test and `pnpm typecheck`.

---

### Task 5: Replace fixed intro stagger with fresh/restart timing profiles

**Files:**
- Modify: `src/game/board/BoardIntroAnimator.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `test/board-intro.test.js`

**Interfaces:**
```ts
export type BoardIntroProfile = "fresh" | "restart";
export function boardIntroTiming(pieceCount: number, profile: BoardIntroProfile): Readonly<{
  totalDurationMs: number;
  staggerMs: number;
  pieceTweenMs: number;
}>;
```
`BoardIntroAnimator.start(profile?: BoardIntroProfile)` defaults to `fresh`.

- [ ] **Step 1: Write failing timing tests**

Assert:
- small fresh fields fall in 1600–1900 ms;
- medium fresh fields fall in 2300–3000 ms;
- 55-piece fresh fields are `<= 3200` and `>= 2500` ms;
- restart is 800–1000 ms and materially faster than fresh;
- `pieceTweenMs` is 180–220 ms for fresh.

- [ ] **Step 2: Verify RED**

Run:
```powershell
node --import tsx --test test/board-intro.test.js
```
Expected: FAIL because no timing profiles exist and current stagger is fixed 22 ms.

- [ ] **Step 3: Implement target-duration timing**

Use a piece-count-based fresh target, for example interpolation from 1750 ms for small tutorial counts toward 2800 ms for ordinary boards and cap at 3200 ms for full boards. Compute stagger as `(totalDurationMs - pieceTweenMs) / max(1, pieceCount - 1)` so the final piece entrance finishes inside the target total duration. Restart targets 900 ms with compressed stagger/tween. Track reveal start time per piece and expose `entranceProgress(key, now)` so BoardScene can apply overlapping fade/scale entrances while the intro is active.

- [ ] **Step 4: Integrate profiles and local entrance tween state in `BoardScene`**

Fresh level/new field calls `startBoardIntro("fresh")`; restart/retry of the same board calls `startBoardIntro("restart")`. Utility resume does not call either. Mechanic-card dismissal preserves the pending requested profile. While intro is active, BoardScene redraws and multiplies piece alpha by `entranceProgress`, with scale moving from roughly 0.9 to 1; the final reveal tween ends at the profile target duration.

- [ ] **Step 5: Verify GREEN**

Run:
```powershell
node --import tsx --test test/board-intro.test.js
pnpm typecheck
```
Expected: PASS.

---

### Task 6: Update active documentation and run full verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT.md`
- Modify: `CURRENT_STATE.md`
- Modify: `ART_DIRECTION.md`
- Modify: `README.md` where it describes board UX/tutorial/dead-end behavior.
- Modify: `docs/superpowers/specs/2026-09-03-board-ux-overhaul-design.md`
- Modify: `docs/superpowers/plans/2026-09-03-board-ux-overhaul.md`

**Interfaces:** None; documentation must match runtime behavior.

- [ ] **Step 1: Update active prose**

Record tutorial order, remaining-count teaching, Level 1 CTA, system-vs-consumable grouping, fresh/restart intro timing, and hidden solver-unsolvable semantics. Remove stale claims that Rescue activates on solver proof or that Restart sits with boosters.

- [ ] **Step 2: Run focused regression suite**

```powershell
node --import tsx --test test/board-presentation-model.test.js test/board-presentation-contract.test.js test/board-intro.test.js test/board-session-state.test.js test/tutorial.test.js test/completion-presentation.test.js
```
Expected: PASS.

- [ ] **Step 3: Run final gates**

```powershell
pnpm typecheck
pnpm test
pnpm build
```
Expected: all three exit 0. The Vite chunk-size warning is non-blocking.

- [ ] **Step 4: Manual playtest checklist**

Verify: first callout teaches pair action; second sits near highlighted empty cells; third teaches changed inventory count; tutorial clear presents one obvious Level 1 CTA; Restart is beside Pause rather than boosters; fresh spiral is visibly slow enough to appreciate; restart spiral is faster; Shop/Settings return does not replay intro.
