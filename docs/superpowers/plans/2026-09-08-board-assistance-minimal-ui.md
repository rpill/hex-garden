# Board Assistance, Clean Attempts, Tutorial/Completion, and Minimal HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Campaign board play match the approved functional product: free Undo, solver-verified Hint, contextual one-use Rescue at true dead end, Clean attempt tracking, direct Next flow, and an asset-free sparse HUD.

**Architecture:** Split session/assistance policy out of the 2600+ line `BoardScene` into small pure/service modules. Solver work is performed before asking for a rewarded ad so an UNKNOWN result never wastes a reward. `BoardScene` orchestrates board rendering/input, while `BoardHud`, attempt state, and assistance service own narrow responsibilities.

**Tech Stack:** TypeScript, Phaser 3.90, existing `GardenBoard`, `findWinningRoute`, `findLastSolvableSnapshot`, Yandex rewarded adapter.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- True dead end is only `!won && legalMoveCount === 0`.
- Undo is free/unlimited during normal play and preserves Clean.
- Restart starts a fresh attempt and restores Clean eligibility.
- Hint/Rescue invalidate Clean for the current attempt.
- Campaign allows at most one Rescue per attempt.
- Campaign Levels 1–5: Hint and Rescue are free onboarding assistance; Level 6+: rewarded ad required.
- Hint must be a solver-verified route-to-clear move, never merely legal.
- Solver UNKNOWN grants/reveals nothing and must not claim doom.
- Rewarded effect occurs only after `RewardedAdStatus.REWARDED`.
- Remove permanent Rescue, Shop, Dust, inventory, score, and separate Move/Hint duplication from Board HUD.

---

### Task 1: Pure attempt-state model

**Files:**
- Create: `src/game/board/attempt-state.ts`
- Modify: `src/game/board-session-state.ts`
- Test: `test/board-session-state.test.js`

**Interfaces:**
- Produces `AttemptState`, `createAttemptState`, `markSolverAssisted`, `markRescueUsed`, `restartAttempt`, `isActualDeadEnd`, `canRescueAttempt`.

- [ ] **Step 1: Write failing state tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  canRescueAttempt,
  createAttemptState,
  isActualDeadEnd,
  markRescueUsed,
  markSolverAssisted,
  restartAttempt,
} from "../src/game/board/attempt-state.js";

test("only solver help invalidates clean", () => {
  const initial = createAttemptState();
  assert.equal(initial.cleanEligible, true);
  assert.equal(markSolverAssisted(initial).cleanEligible, false);
  assert.equal(restartAttempt(markSolverAssisted(initial)).cleanEligible, true);
});

test("rescue is one-use and only at a visible dead end", () => {
  const initial = createAttemptState();
  assert.equal(isActualDeadEnd({ won: false, legalMoveCount: 0 }), true);
  assert.equal(isActualDeadEnd({ won: false, legalMoveCount: 1 }), false);
  assert.equal(canRescueAttempt(initial, { won: false, legalMoveCount: 0 }), true);
  assert.equal(canRescueAttempt(markRescueUsed(initial), { won: false, legalMoveCount: 0 }), false);
});
```

- [ ] **Step 2: Implement state**

```ts
export interface AttemptState {
  cleanEligible: boolean;
  rescueUsed: boolean;
}

export const createAttemptState = (): Readonly<AttemptState> => Object.freeze({ cleanEligible: true, rescueUsed: false });
export const markSolverAssisted = (state: AttemptState) => Object.freeze({ ...state, cleanEligible: false });
export const markRescueUsed = (state: AttemptState) => Object.freeze({ cleanEligible: false, rescueUsed: true });
export const restartAttempt = (_state: AttemptState) => createAttemptState();
```

Use existing true-dead-end semantics. Remove old `mode === PlayMode.STANDARD` Rescue restriction.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/board-session-state.test.js
git add src/game/board/attempt-state.ts src/game/board-session-state.ts test/board-session-state.test.js
git commit -m "feat: model clean and rescue attempt state"
```

---

### Task 2: Assistance policy and rewarded gate

**Files:**
- Create: `src/game/board/assistance-policy.ts`
- Create: `src/game/board/BoardAssistance.ts`
- Test: `test/assistance-policy.test.js`
- Test: `test/yandex-games.test.js`

**Interfaces:**
- Produces `assistancePolicy(mode, level)`, `BoardAssistance.findHint`, `BoardAssistance.findRescue`, `BoardAssistance.confirmReward`.
- Consumes `findWinningRoute`, `findLastSolvableSnapshot`, `YandexGamesAdapter.showRewarded`.

- [ ] **Step 1: Test onboarding ad policy**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { PlayMode } from "../src/game/modes.js";
import { assistancePolicy } from "../src/game/board/assistance-policy.js";

test("campaign levels one through five have free onboarding assistance", () => {
  for (let level = 0; level < 5; level += 1) {
    assert.equal(assistancePolicy(PlayMode.CAMPAIGN, level).rewardRequired, false);
  }
  assert.equal(assistancePolicy(PlayMode.CAMPAIGN, 5).rewardRequired, true);
});
```

Daily and Endless always require rewarded Hint/Rescue once they are unlocked.

- [ ] **Step 2: Implement policy**

```ts
export function assistancePolicy(mode: PlayModeValue, campaignLevel?: number) {
  return Object.freeze({
    rewardRequired: mode === PlayMode.CAMPAIGN ? (campaignLevel ?? 0) >= 5 : mode !== PlayMode.TUTORIAL,
  });
}
```

Tutorial assistance is free.

- [ ] **Step 3: Implement solver-first assistance service**

```ts
export class BoardAssistance {
  constructor(private readonly rewarded: Pick<YandexGamesAdapter, "showRewarded">) {}

  findHint(pieces: readonly BoardPieceInput[], preferredSolution?: readonly (readonly HexCoord[])[]) {
    return findWinningRoute(pieces, { preferredSolution, maxMilliseconds: 500 });
  }

  findRescue<T extends HistorySnapshotBase>(history: readonly T[], pieces: readonly BoardPieceInput[], preferredSolution?: readonly (readonly HexCoord[])[]) {
    return findLastSolvableSnapshot(history, pieces, { preferredSolution, maxMilliseconds: 500 });
  }

  async confirmReward(required: boolean): Promise<boolean> {
    if (!required) return true;
    const result = await this.rewarded.showRewarded();
    return result.status === RewardedAdStatus.REWARDED;
  }
}
```

The caller must call `findHint/findRescue` **before** `confirmReward`; if solver status is UNKNOWN/DEAD_END where no verified action exists, never open an ad.

- [ ] **Step 4: Add service tests with a fake rewarded adapter**

Assert no ad is requested for an UNKNOWN solver result by testing the BoardScene orchestration helper introduced in Task 4, and `confirmReward(true)` returns false for CLOSED/UNAVAILABLE/BUSY.

- [ ] **Step 5: Run and commit**

```bash
node --import tsx --test test/assistance-policy.test.js test/yandex-games.test.js test/solver.test.js
git add src/game/board/assistance-policy.ts src/game/board/BoardAssistance.ts test/assistance-policy.test.js test/yandex-games.test.js
git commit -m "feat: gate verified assistance with rewarded ads"
```

---

### Task 3: Minimal Board HUD

**Files:**
- Rewrite: `src/game/board/BoardHud.ts`
- Modify: `src/game/presentation-layout.ts`
- Modify: `src/game/responsive-layout.ts`
- Test: `test/board-presentation-contract.test.js`
- Test: `test/presentation-layout.test.js`

**Interfaces:**
- `BoardHudActions`: `onBack`, `onUndo`, `onHint`, `onOverflow`.
- `BoardHud` displays level identity, remaining count, optional Clean indicator, Undo, Hint; no store/currency/restart/rescue permanent controls.

- [ ] **Step 1: Replace Board HUD source-contract assertions**

```js
const source = fs.readFileSync(new URL("../src/game/board/BoardHud.ts", import.meta.url), "utf8");
assert.doesNotMatch(source, /dust|shop|inventory|GAMEPLAY_UI_FRAMES|UI_FRAMES/);
assert.match(source, /onUndo/);
assert.match(source, /onHint/);
assert.match(source, /onOverflow/);
```

- [ ] **Step 2: Rewrite `BoardHud` using `MinimalButton` and plain text**

```ts
export interface BoardHudActions {
  onBack: () => void;
  onUndo: () => void;
  onHint: () => void;
  onOverflow: () => void;
}
```

Expose:

```ts
setIdentity(text: string): void;
setRemaining(count: number): void;
setCleanEligible(clean: boolean): void;
setUndoEnabled(enabled: boolean): void;
setHintBusy(busy: boolean): void;
layout(width: number, height: number): void;
```

Portrait layout: identity/back/overflow at top, full board in middle, remaining just above/below board, Undo and Hint as two large reachable bottom actions. Landscape may move remaining sideways but must not introduce side chrome.

- [ ] **Step 3: Run HUD/layout tests and commit**

```bash
node --import tsx --test test/board-presentation-contract.test.js test/presentation-layout.test.js
pnpm typecheck
git add src/game/board/BoardHud.ts src/game/presentation-layout.ts src/game/responsive-layout.ts test/board-presentation-contract.test.js test/presentation-layout.test.js
git commit -m "feat: reduce board HUD to undo and hint"
```

---

### Task 4: Split Campaign board session orchestration out of `BoardScene`

**Files:**
- Create: `src/game/board/CampaignBoardSession.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Test: `test/campaign-board-session.test.js`

**Interfaces:**
- `CampaignBoardSession` owns attempt state + removal history and exposes `undo`, `restart`, `requestHint`, `requestRescue`, `complete` metadata.
- `BoardScene` remains responsible for Phaser views/animations and delegates state decisions.

- [ ] **Step 1: Write a unit-level session test with no Phaser**

Test sequence:

1. create session with fixed campaign level;
2. apply one certified removal and `undo()` restores exact prior pieces without invalidating Clean;
3. mark/use Hint -> `cleanEligible === false`;
4. `restart()` restores initial pieces and `cleanEligible === true`;
5. at a constructed actual dead end, Rescue can be used once and marks not clean.

- [ ] **Step 2: Implement the session class**

Use a small snapshot type:

```ts
export interface BoardHistorySnapshot {
  pieces: readonly BoardPieceInput[];
}

export class CampaignBoardSession {
  readonly level: Readonly<CampaignLevelRecord>;
  attempt = createAttemptState();
  history: BoardHistorySnapshot[] = [];
  board: GardenBoard;

  recordBeforeRemoval(): void;
  undo(): boolean;
  restart(): void;
  markHintUsed(): void;
  markRescueUsed(): void;
  get cleanEligible(): boolean;
}
```

Do not put Phaser objects in this class.

- [ ] **Step 3: Switch `BoardScene` campaign loading to `getCampaignLevel(level)`**

Remove campaign dependency on `BrowserLevelGenerator.generateProgression`. Construct `GardenBoard` directly from fixed data. Preserve worker usage for modes not yet migrated.

- [ ] **Step 4: Delegate undo/restart/history to session**

Remove economy consumption for Undo/Restart. Disable Undo only when history is empty, board animation is busy, or Board is already in true-dead-end end state.

- [ ] **Step 5: Run session + campaign tests**

```bash
node --import tsx --test test/campaign-board-session.test.js test/campaign.test.js test/board-session-state.test.js
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/game/board/CampaignBoardSession.ts src/game/scenes/BoardScene.ts test/campaign-board-session.test.js
git commit -m "refactor: isolate campaign board session state"
```

---

### Task 5: Hint orchestration — verify route, then reward, then reveal

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/board/CampaignBoardSession.ts`
- Test: `test/campaign-board-session.test.js`
- Test: `test/solver.test.js`

**Interfaces:**
- BoardScene calls `assistance.findHint(currentPieces, preferredSolution)`.

- [ ] **Step 1: Add tests for clean invalidation and UNKNOWN behavior**

Use a fake assistance service returning `SolveStatus.UNKNOWN`; assert the session remains clean and the reward callback is not invoked. For `SOLVED`, assert first route move is the only move exposed and Clean becomes false only after reward confirmation succeeds.

- [ ] **Step 2: Implement exact flow**

```ts
const result = this.assistance.findHint(this.board.pieces(), this.currentSolution);
if (result.status !== SolveStatus.SOLVED || result.route.length === 0) {
  this.showTransientMessage(this.english ? "NO VERIFIED HINT AVAILABLE" : "ПОДСКАЗКА СЕЙЧАС НЕДОСТУПНА");
  return;
}
const rewarded = await this.assistance.confirmReward(policy.rewardRequired);
if (!rewarded) return;
this.campaignSession?.markHintUsed();
this.showMoveHint(result.route[0]);
```

Do not show “doomed” for `DEAD_END` while legal moves remain; use the same unavailable copy.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/campaign-board-session.test.js test/solver.test.js test/yandex-games.test.js
git add src/game/scenes/BoardScene.ts src/game/board/CampaignBoardSession.ts test/campaign-board-session.test.js
git commit -m "feat: make hint solver-verified direct assistance"
```

---

### Task 6: Contextual Campaign Rescue at true dead end

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/board/CampaignBoardSession.ts`
- Test: `test/campaign-board-session.test.js`
- Test: `test/board-session-state.test.js`

**Interfaces:**
- Rescue state appears only after actual dead end; no permanent HUD button.

- [ ] **Step 1: Add true-dead-end Rescue tests**

Assert:
- solver-proven unsolvable state with legal moves does **not** show Rescue;
- zero legal moves shows Restart + Rescue when unused;
- after successful Rescue, next true dead end shows Restart only;
- unsuccessful/unrewarded Rescue leaves board/history/attempt unchanged.

- [ ] **Step 2: Implement dead-end overlay/action state in `BoardScene`**

At the end of a removal animation call:

```ts
const deadEnd = isActualDeadEnd({ won: this.board.won, legalMoveCount: this.board.legalMoves().length });
if (deadEnd) this.enterCampaignDeadEndState();
```

`enterCampaignDeadEndState` disables normal Undo/Hint and creates two primitive actions: Restart and, when `!attempt.rescueUsed`, Rescue.

- [ ] **Step 3: Implement solver-first Rescue**

Find the Rescue result before ad. If `SolveStatus.SOLVED`, ask for reward according to onboarding policy. On confirmed reward restore `result.snapshot`, truncate history through `result.index`, mark Rescue used, leave dead-end state, rerender. On UNKNOWN/DEAD_END show only Restart/unavailable copy; no ad.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/campaign-board-session.test.js test/board-session-state.test.js test/solver.test.js
git add src/game/scenes/BoardScene.ts src/game/board/CampaignBoardSession.ts test/campaign-board-session.test.js
git commit -m "feat: offer one contextual rescue at campaign dead end"
```

---

### Task 7: Tutorial -> Level 1 and first-session milestone routing

**Files:**
- Modify: `src/tutorial.ts`
- Modify: `src/game/board/BoardTutorial.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Test: `test/tutorial.test.js`

**Interfaces:**
- Tutorial completion persists tutorial flag and starts Campaign Level 1 directly.
- Level 5 completion returns to Home once so Daily can be surfaced when Plan 4 is installed; Level 10 shows the Chapter 1 milestone and returns Home so Endless can be surfaced when Plan 5 is installed.

- [ ] **Step 1: Keep tutorial interaction to three guided concepts and no illegal-click hard block**

Update tests so tutorial remains certificate-solvable on a 37-cell canonical plate and guidance count remains short. Ensure BoardTutorial overlays/callouts never disable otherwise legal board input.

- [ ] **Step 2: Route tutorial completion directly**

```ts
this.progress.completeTutorial();
this.scene.restart({ mode: PlayMode.CAMPAIGN, level: 0 });
```

Do not return to Home between tutorial and Level 1.

- [ ] **Step 3: Add milestone routing helper**

Create pure helper:

```ts
export function campaignPostCompletionDestination(level: number) {
  if (level === 4) return Object.freeze({ kind: "home" as const, reveal: "daily" as const });
  if (level === 9) return Object.freeze({ kind: "home" as const, reveal: "endless" as const });
  if (level === 49) return Object.freeze({ kind: "home" as const, reveal: "campaign-complete" as const });
  if (level === 19 || level === 29 || level === 39) {
    return Object.freeze({ kind: "chapter-next" as const, level: level + 1 });
  }
  return Object.freeze({ kind: "next" as const, level: level + 1 });
}
```

Levels 9/19/29/39/49 all receive the stronger chapter milestone presentation. Level 9 returns Home after that milestone to expose the newly available Endless card once Plan 5 is installed; Levels 19/29/39 continue directly to the next chapter after the milestone.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/tutorial.test.js test/campaign-progress.test.js
git add src/tutorial.ts src/game/board/BoardTutorial.ts src/game/scenes/BoardScene.ts test/tutorial.test.js
git commit -m "feat: streamline first-session campaign flow"
```

---

### Task 8: Completion overlay becomes Solved/Clean + direct Next

**Files:**
- Rewrite: `src/game/completion-overlay.ts`
- Modify: `src/game/scenes/BoardScene.ts`
- Test: `test/completion-presentation.test.js`

**Interfaces:**
- `CompletionOverlayData` for Campaign contains `level`, `clean`, `cleanCount`, `chapterComplete`, `newRank?`.
- Actions: `onNext`, optional `onTryClean`, `onHome` only at explicit milestone/end.

- [ ] **Step 1: Replace score/Dust presentation tests**

Source contract: completion overlay contains no `dust`, `score`, `multiplier`, `shop`, or inventory imports/text. Pure model test verifies assisted completion offers `Try Clean`, while Clean completion does not need it.

- [ ] **Step 2: Complete campaign progress with attempt Clean state**

On board clear:

```ts
const clean = this.campaignSession?.cleanEligible === true;
const snapshot = this.progress.complete(this.level, { clean });
```

Render `◆ CLEAN SOLUTION` when Clean; otherwise `Solved with help`. Always make Next primary if destination is `next`.

- [ ] **Step 3: Implement Try Clean**

For assisted completion, secondary action restarts the same fixed level from its initial state; it does not roll back Solved progress.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/completion-presentation.test.js test/campaign-progress.test.js
pnpm typecheck
git add src/game/completion-overlay.ts src/game/scenes/BoardScene.ts test/completion-presentation.test.js
git commit -m "feat: show clean mastery on campaign completion"
```

---

### Task 9: Minimal circular-token / canonical-plate functional rendering

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/piece-visual-state.ts`
- Modify: `src/game/presentation-layout.ts`
- Test: `test/piece-visual-state.test.js`
- Test: `test/board-presentation-model.test.js`

**Interfaces:**
- Board renderer draws full `plateCells` as subtle primitive slots and occupied atoms as circles with text/glyph marks.
- No final token asset or material work.

- [ ] **Step 1: Update visual-state tests to semantic states only**

States: `locked`, `available`, `selected`, with alpha/scale/depth intent rather than premium texture names.

- [ ] **Step 2: Replace live campaign piece sprites with primitives**

For each plate cell, create a low-contrast `Graphics` circle/slot. For each piece, create a `Container` with circle + centered glyph/text. Available pieces use normal alpha/raised depth; locked pieces lower alpha; selected pieces scale 1.03 and increase depth. Do not use glow as primary availability cue.

- [ ] **Step 3: Ensure full canonical plate remains visible**

Layout must iterate `currentLevel.plateCells`, not occupied pieces, for slot rendering. This is the regression that prevents occupancy masks becoming public board silhouettes.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/piece-visual-state.test.js test/board-presentation-model.test.js test/plates.test.js
pnpm typecheck
pnpm build
git add src/game/scenes/BoardScene.ts src/game/piece-visual-state.ts src/game/presentation-layout.ts test/piece-visual-state.test.js test/board-presentation-model.test.js
git commit -m "feat: render functional board with primitive circular tokens"
```

## Plan 3 completion check

```bash
pnpm test
pnpm typecheck
pnpm build
```

Manual smoke on desktop + portrait + landscape: Campaign Level 1 loads fixed content; Undo is free; Hint is free on Levels 1–5 and rewarded from Level 6; true dead end offers one Rescue; Restart resets Clean; result shows Solved/Clean and Next; no Dust/Shop/inventory UI appears on Board.
