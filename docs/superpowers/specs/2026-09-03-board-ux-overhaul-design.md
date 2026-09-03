# Hex Garden Board UX Overhaul Design

## Status

Revised and approved in chat on 2026-09-03 after live playtest feedback.

This design replaces the current B1 board presentation and the first Board UX patch decisions that still produced weak onboarding hierarchy, misplaced contextual guidance, an unclear tutorial completion CTA, consumable/system-action mixing, and an intro animation that resolves too quickly to appreciate.

## Goal

Make the active board screen feel like a deliberate puzzle interface rather than a debug/product-UI composition: the board remains the visual hero, the tutorial teaches the player's core action before secondary rules, inventory information becomes meaningful at the moment it matters, system controls are separated from consumables, and board assembly has enough time to be perceived as a satisfying ritual without becoming a delay.

## Scope

This pass changes board presentation, tutorial sequencing, board-intro pacing, one player-facing dead-end behavior contract, and two implementation/test-boundary issues discovered during verification.

Primary implementation files:

- `src/game/scenes/BoardScene.ts`
- `src/game/board/BoardHud.ts`
- `src/game/board/BoardInventory.ts`
- `src/game/board/BoardTutorial.ts`
- `src/game/board/BoardIntroAnimator.ts`
- `src/game/piece-visual-state.ts`
- `src/game/presentation-model.ts` or a new renderer-independent tutorial-placement helper if needed
- responsive/layout helpers only where required
- `AGENTS.md`
- `PROJECT.md`
- `CURRENT_STATE.md`
- `ART_DIRECTION.md`

Renderer-independent rules, atom IDs, scoring values, economy prices/rewards, campaign generation, endless staging, persistence formats, and Yandex rewarded-ad behavior remain unchanged.

## Product principles

1. The board is the hero. UI must not create two giant horizontal slabs around it.
2. The tutorial teaches the core verb before constraints around that verb.
3. Guidance belongs next to the thing it explains and appears just-in-time.
4. System/session controls are visually separate from consumable inventory.
5. Solver knowledge must not reveal or enforce an invisible future loss while legal play remains.
6. Attention signals should add information without darkening or visually destroying the rest of the board.
7. The start-of-board presentation may dramatize the board, but its duration must be perceptible and context-sensitive rather than fixed per piece.
8. A completed tutorial must end with one obvious primary transition into Level 1.

---

## 1. Floating board HUD; no full-width board chrome

### Remove

Remove the current board-specific full-width top bar and bottom dock treatment.

Also remove decorative top/bottom background bands that recreate the same slab effect from `scene-background.ts` when used for the active board screen.

Full-screen darkening remains valid for true modal states such as Pause, purchase dialog, mechanic card, and completion overlay.

### Desktop structure

The desktop board screen should read approximately as:

```text
[Pause] [Restart]        Level / remaining / score          Dust   Shop   Settings


                              BOARD


                 atom inventory visually attached to board
                    Move        Undo        Rescue
```

No single background rectangle spans the entire top or bottom edge.

### System/session control group

`Pause` and `Restart` are not consumables. They form a small system/session control group, preferably at the upper-left on desktop.

- Pause: icon-only or compact icon control.
- Restart: compact `↻`; desktop may expose `ЗАНОВО` / `RESTART` through tooltip/hover text if useful.
- They must not share the same card/row grammar as Move, Undo, or Rescue.

Restart is always reachable without opening Pause.

### Consumable action group

Move, Undo, and Rescue are inventory-backed player aids and belong together.

Preferred conceptual grouping:

```text
[ХОД ×3]   [ОТМЕНА ×2]   [СПАСЕНИЕ ×1]
```

Campaign may omit Rescue where it is not applicable.

The exact shape of these controls remains provisional, but their grouping by consumable semantics is part of the design.

### Other HUD groups

`BoardHud` owns small floating groups for:

- Pause + Restart on the left;
- compact level/remaining/score information near the visual centre/top;
- Dust + Shop + Settings on the right.

All groups remain readable on desktop, portrait, and landscape without reintroducing full-width bars.

---

## 2. Tutorial onboarding sequence: action → freedom → remaining counts

### Why the order changes

The previous tutorial explained geometric freedom before the player had been taught the game's core verb. That makes the first sentence technically true but operationally weak: the player still does not know what action to perform.

The new tutorial teaches in the order the player needs information:

1. what to do;
2. why some pieces can or cannot be used;
3. where to read remaining composition information.

There is no global `STEP 1/3` header.

### Step 1 — teach the core action first

Highlight one authored valid matching pair.

Russian copy:

`Очисти поле: выбери две одинаковые доступные фишки.`

English copy should preserve the same meaning concisely.

Visual guidance:

- emphasize exactly the intended pair;
- no board-wide dimming;
- no numbered markers;
- no pulse/breathing loop;
- after the first click, use the normal selected state for that piece;
- the other target remains softly emphasized.

The player immediately performs the central action of the game.

### Step 2 — explain geometric freedom after one successful removal

After the player has removed the first pair, choose an authored/derived example where one piece and three contiguous empty neighbour cells clearly demonstrate availability.

Russian copy:

`Три пустые клетки подряд делают фишку доступной.`

Visual guidance:

- lightly emphasize one target piece;
- lightly emphasize the relevant three empty cells;
- no numbers;
- no pulsing/scaling;
- no whole-board dimming.

#### Placement preference

This callout should be deliberately close to the highlighted empty-neighbour group. For the current tutorial composition, prefer a position above/right of the target cluster when space permits, matching the live-playtest feedback that the previous lower placement was visually disconnected.

Responsive fallback may use top/bottom/left/right candidates when the preferred placement would leave the viewport or overlap the target.

### Step 3 — explain the remaining-piece panel at the moment it changes

After another successful removal, briefly emphasize the atom inventory/count panel and the count that just changed.

Russian copy:

`Здесь видно, сколько фишек каждого типа осталось.`

English equivalent should preserve the same meaning.

The callout belongs immediately above or beside the inventory panel rather than over the board.

The player has just seen a count decrease, so this explanation is tied to a visible consequence rather than abstract UI description.

After this teaching condition is satisfied, tutorial guidance disappears and the player finishes the field without further instructional text.

### Tutorial interaction contract

The tutorial must not hard-block arbitrary legal clicks with a tutorial-only legality gate.

If the player clicks elsewhere:

- normal board rules still apply;
- the current teaching callout remains until its semantic condition is satisfied;
- do not replace normal board legality with tutorial legality.

### Callout placement architecture

Placement logic must be renderer-independent enough to test without importing Phaser into Node.

Do not put the pure candidate-selection function in a module whose top-level import requires Phaser.

A suitable boundary is either:

- a new pure helper such as `src/game/tutorial-callout-layout.ts`; or
- an existing pure presentation/layout module.

`BoardTutorial.ts` consumes the result and only owns Phaser objects.

Candidate sides remain the explicit union:

```ts
"top" | "bottom" | "left" | "right"
```

Do not allow object-literal inference to widen `side` to plain `string`.

---

## 3. Tutorial completion: one obvious transition to Level 1

The current small `ИГРАТЬ` button below the board is rejected. It is visually easy to miss and does not read as a completion transition.

When the tutorial board is cleared, show a normal focused completion state.

Preferred structure:

```text
ОБУЧЕНИЕ ПРОЙДЕНО

[ УРОВЕНЬ 1 → ]
```

Requirements:

- one obvious primary CTA;
- CTA is centred in the completion card/state;
- no secondary competing action of equal visual weight;
- button directly transitions to Campaign Level 1;
- localised equivalent in English;
- tutorial completion persistence remains unchanged.

This may reuse the existing completion-overlay architecture if that produces the same hierarchy cleanly; do not create a second large completion subsystem solely for tutorial.

---

## 4. Dead-end semantics: no early warning from solver unsolvability

### Current problem

The current implementation conflates two facts:

1. the solver has proven that the current position cannot be fully cleared;
2. the board has no legal moves.

Those are not the same player-facing state.

A position may be mathematically unsolvable while still containing legal moves. The player must be allowed to continue playing until the board itself offers no legal move.

### New contract

#### Solver-unsolvable

If `findWinningRoute()` proves no full clear is possible while `board.legalMoves().length > 0`:

- keep that result internal;
- do not display a dead-end warning;
- do not dim the board;
- do not block selection;
- do not end Endless;
- do not enable Rescue merely because the solver knows the future is lost.

The solver result may still be used by the Move booster. If no verified winning route exists, Move is not consumed.

A short neutral message such as `ПОДСКАЗКА НЕ НАЙДЕНА` / `NO HINT FOUND` is acceptable when the player explicitly asks for Move and no verified route can be provided. It must not reveal that the position is mathematically doomed.

#### Actual dead end

A player-facing dead end exists only when:

```ts
!board.won && board.legalMoves().length === 0
```

Only then may the UI show a concise `ХОДОВ НЕТ` / `NO MOVES` state.

No special early warning is shown before this point.

### Campaign actual dead end

When no legal moves remain:

- normal piece input naturally has nothing legal to select;
- Undo remains available when history permits;
- Restart remains visible in the system/session group;
- the player may recover or restart without opening Pause.

### Endless actual dead end

When no legal moves remain:

- Rescue becomes available;
- Undo remains governed by its existing inventory/history rules;
- Restart/New Run remains immediately reachable;
- Rescue uses the existing history + solver mechanism to find the most recent previously solvable state;
- if no proven safe restore point exists, Rescue is not consumed;
- using Rescue still marks the run `ASSISTED`.

### Remove old player-facing `positionDeadEnd` semantics

The implementation should distinguish at least:

- solver status / known winning route knowledge;
- actual board no-moves state.

Do not use one boolean to mean both.

`SolveStatus.DEAD_END` may continue to mean solver-proven unsolvability internally if that remains the solver API. It must not directly drive interaction lockout or player-facing dead-end UI while legal moves exist.

---

## 5. Inventory presentation and type filtering

### Inventory layout

The atom inventory remains visually attached to the board rather than the viewport edge.

Counts sit beside the glyph on the same visual baseline rather than overlapping the icon.

Preferred grammar:

```text
[glyph] ×3    [glyph] ×6    [glyph] ×2
```

Do not use a numeric badge hovering over the glyph.

The panel is not merely decorative: Tutorial Step 3 explicitly teaches it as the place to read remaining type counts.

### Filtering interaction

Clicking an atom type may still act as a visual locator/filter, but the signal changes fundamentally.

Do not:

- dim non-matching pieces;
- draw circles around matching pieces;
- flood the board with yellow/white rings;
- animate all matches with permanent pulsing/scaling.

Instead:

- leave all non-matching pieces visually unchanged;
- give matching pieces a subtle positive highlight only.

Preferred treatment is a shape-following glow: a low-alpha copy/silhouette of the same glyph behind the matching piece, slightly larger than the piece.

The glow follows the piece shape rather than using a generic circle.

Repeated selection of the same inventory type turns the filter off.

Exact glow color, alpha, and scale are presentation details and are deliberately not test-locked.

---

## 6. Board intro spiral-fill animation

### Purpose

Before a freshly loaded board becomes interactive, reveal pieces from the centre outward so the board visually assembles itself.

The first patch is rejected as too fast to perceive. The new timing is based on target total duration rather than a nearly fixed tiny delay per piece.

### Architecture

`src/game/board/BoardIntroAnimator.ts` owns:

- deterministic centre-out reveal ordering;
- reveal timing;
- temporary `revealedKeys` state;
- per-piece intro tween state;
- skip/finish lifecycle;
- intro speed profile (`fresh` vs `restart`).

It must not own or mutate `GardenBoard` rules, scoring, solver state, campaign state, or economy state.

### Reveal order

The reveal starts at/nearest the board centre and proceeds outward by hex distance/rings.

Within a ring, order should be deterministic and visually continuous around the ring so the result reads as a spiral rather than random radial popping.

Exact clockwise/counter-clockwise orientation remains a presentation choice.

### Fresh-board timing

Use a target total-duration model.

Desired perceptual ranges:

- tutorial/small fresh field: approximately **1.6–1.9 s**;
- ordinary new field: approximately **2.3–3.0 s**;
- 55-piece/full field: cap around **3.2 s**.

The exact formula may derive stagger from piece count and target duration.

Per-piece entrance may use:

- alpha `0 -> 1`;
- scale around `0.9 -> 1`;
- local tween roughly **180–220 ms**;
- overlapping tweens so the board flows continuously rather than waiting for each piece to finish.

Do not add particles, rotation, bounce, or sound in this pass.

### Restart timing

Restart must not force the player to watch the full fresh-board flourish every time.

Use a faster restart profile with a target total duration around **0.8–1.0 s**.

The restart reveal may use the same order and visual treatment, only compressed.

### Temporary freedom/locked presentation

During intro, the real board state remains intact.

For presentation only, evaluate piece freedom against the subset of already revealed pieces. As more neighbours appear, a piece may transition from free/brighter to locked/muted.

This is a visual simulation over a reveal mask. It must not alter:

- actual `GardenBoard` occupancy;
- certified solution;
- selection rules;
- generator output;
- scoring;
- persistence.

At intro completion, render the normal full board state.

### Interaction and skip

While intro is active, piece selection is disabled.

Any ordinary pointer/tap input intended for the board may finish the intro immediately.

Finishing means:

- stop pending intro tweens/timers;
- reveal all pieces;
- render final normal piece states;
- mark intro inactive.

Do not add a dedicated Skip button.

The input used to finish the intro is consumed for the intro; it must not also remove/select a piece on the same event.

### When intro runs

Use the **fresh** profile on:

- first tutorial load;
- fresh campaign level load;
- new Endless field;
- new Endless run first field.

Use the **restart** profile on:

- restart of the current campaign/tutorial field;
- restart/retry path that reconstructs the same board where applicable.

Do not rerun intro when returning from Shop or Settings to an already active Board session.

If a mechanic-introduction card appears first, the intro waits until that card is dismissed so the animation is visible rather than playing behind the modal.

---

## 7. Presentation ownership and boundaries

### `BoardHud.ts`

Owns only Phaser presentation for:

- Pause;
- Restart;
- compact status/score/remaining information;
- Dust;
- Shop;
- Settings.

It receives state and callbacks from `BoardScene`.

It does not visually group Restart with consumable boosters.

### `BoardInventory.ts`

Owns:

- atom inventory rendering/layout;
- counts beside icons;
- Move/Undo/Rescue consumable action presentation;
- click callbacks for type filtering and boosters.

It does not decide board legality, solver state, inventory pricing, or Rescue eligibility.

### `BoardTutorial.ts`

Owns:

- contextual callout surface;
- target-cell/piece presentational markers;
- presentation of an already-computed callout placement.

It does not reject clicks, own board rules, or expose pure layout helpers that force Node tests to import Phaser.

### Pure tutorial-placement helper

A renderer-independent helper owns callout candidate selection and overlap avoidance.

It accepts plain numeric rectangles/points and returns a typed side + position.

This separation keeps `board-presentation-model.test.js` and similar Node tests free from Phaser browser globals.

### `BoardIntroAnimator.ts`

Owns only intro presentation lifecycle, reveal-mask sequencing, and fresh/restart speed profiles.

### `BoardScene.ts`

Remains the orchestration owner for:

- board/session state;
- score and progression;
- actual no-moves detection;
- solver route knowledge;
- history/Undo/Rescue orchestration;
- economy/ad orchestration;
- tutorial semantic-step state;
- tutorial completion transition;
- scene navigation;
- choosing fresh vs restart intro profile;
- feeding typed state/callbacks into presentation modules.

Do not move domain logic into presentation modules.

---

## 8. Responsive behavior

The design must continue to support:

- desktop landscape;
- phone portrait;
- phone landscape;
- live resize/orientation changes.

Responsive layouts may rearrange floating groups, inventory rows, consumable action positions, and contextual callout side.

They must not reintroduce full-width top/bottom chrome merely to simplify mobile layout.

On narrow layouts, system controls and consumables must remain semantically separated even if both groups move.

The board must remain fully usable and readable in all supported orientations.

---

## 9. Technical corrections discovered during verification

### `CalloutPlacement.side` type widening

The first patch currently fails strict TypeScript because candidate object literals widen `side` to `string` before mapping into `CalloutPlacement`.

Fix at the typed-data source, not with a cast that hides a bad boundary.

Valid approaches include:

- explicitly typing the candidate array as `readonly CalloutPlacement[]`; or
- using a dedicated candidate type with `side: CalloutSide` where `CalloutSide = "top" | "bottom" | "left" | "right"`.

Do not use `as any`, `@ts-ignore`, or weaken strict TypeScript.

### Node test importing Phaser

The current `board-presentation-model.test.js` failure comes from importing a Phaser-backed module into Node, causing Phaser to evaluate browser-only `window` access.

Fix the architecture rather than creating fake browser globals in the test.

Move the pure callout-placement calculation to a renderer-independent module and import that module from the Node test.

`BoardTutorial.ts` should depend on the pure helper, not the other way around.

---

## 10. Documentation contract updates

This pass intentionally changes the active product contract around dead ends and the active presentation contract around tutorial ordering, system controls, completion, and intro pacing.

Update `AGENTS.md`, `PROJECT.md`, `CURRENT_STATE.md`, and relevant active visual documentation so they no longer claim that a solver-proven unsolvable position:

- is immediately shown as a player-facing dead end;
- blocks further legal play;
- immediately ends Endless;
- immediately enables Rescue.

The active dead-end contract is:

- solver-proven unsolvability is internal while legal moves remain;
- actual player-facing dead end means no legal moves remain on a non-empty board;
- Rescue is Endless-only and available only in that actual no-moves state;
- Move still requires a solver-verified route and is not consumed if such a route cannot be produced.

Update active presentation documentation to record:

- tutorial order is pair action → freedom → remaining-count panel;
- tutorial ends with an obvious Level 1 CTA;
- Restart belongs to system/session controls, not consumables;
- Move/Undo/Rescue form the consumable action group;
- fresh intro uses a perceptible multi-second target duration;
- restart uses a faster intro profile;
- full-width board chrome remains rejected.

Historical design/spec files remain historical records and do not need retroactive rewriting.

---

## 11. Testing strategy

### Protect semantic behavior

Add or update tests for:

1. A solver-proven unsolvable position that still has legal moves does not become an interaction-blocking board state.
2. Actual dead end is `!won && legalMoves().length === 0`.
3. Rescue is available only in actual Endless dead end.
4. Move is not consumed when no verified winning route can be produced.
5. Pause and Restart are part of the system/session Board HUD contract.
6. Restart is not rendered as part of the consumable booster group.
7. Tutorial guidance does not introduce a tutorial-only legality gate.
8. Tutorial semantic order is pair action → freedom → remaining-count panel.
9. Tutorial Step 2 callout preference places guidance near the target cluster and supports responsive fallback.
10. Tutorial Step 3 targets/emphasizes the inventory/count panel.
11. Tutorial completion exposes one primary Level 1 transition.
12. Pure callout-placement tests import no Phaser-backed module.
13. `CalloutPlacement.side` remains the strict side union rather than `string`.
14. Inventory filtering leaves non-matching piece alpha unchanged and requests only a positive match emphasis.
15. Inventory count layout places count beside the glyph rather than above/overlapping it.
16. Spiral reveal ordering begins with the most central ring and ends with outer rings.
17. Spiral reveal order is deterministic for a given layout.
18. Fresh intro target duration falls within the approved size-dependent perceptual range.
19. Restart intro uses a materially faster profile than fresh intro.
20. Intro finish/skip reveals every piece and transitions to inactive state.
21. Returning from Shop/Settings to the same Board session does not restart intro.
22. A mechanic card defers intro until dismissal.
23. Fresh load/new field starts fresh-profile intro; restart starts restart-profile intro.

### Do not freeze presentation details

Do not add tests for:

- screenshots or pixel diffs;
- exact glow colors/alpha;
- exact HUD coordinates;
- exact callout pixels;
- exact per-piece tween duration within the approved ranges;
- exact spiral clockwise/counter-clockwise orientation;
- provisional Chequered Ink filenames or permanent asset identity;
- exact desktop row spacing.

### Existing guardrails

Keep existing rules, generator, solver, progression, economy, scoring, persistence, Yandex, and TypeScript contract tests as regression protection.

Do not weaken those tests to make the UX pass easier.

### Verification gates

Before handoff:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

All three must exit successfully before the pass is considered complete.
