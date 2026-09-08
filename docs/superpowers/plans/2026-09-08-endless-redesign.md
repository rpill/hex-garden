# Endless Boards-Cleared Run Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace point/multiplier Endless with a session-scoped sequence of increasingly difficult canonical boards whose result is boards cleared, with free pre-dead-end Undo and one rewarded assisted Rescue.

**Architecture:** `endless-run.ts` becomes deterministic board-selection logic based on generic difficulty bands, while a separate pure run-session class tracks board index, assisted state, Rescue usage, and best-record eligibility. Persistent stats store only best unassisted/assisted boards cleared. `BoardScene` reuses shared board/assistance primitives and enforces a hard transition to end/rescue state at true dead end.

**Tech Stack:** TypeScript, Phaser, existing worker/candidate/scorer/solver infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- Primary result is boards cleared; no point score, multiplier, combo, per-piece score, or score farming.
- Run ends only at visible zero-legal-moves dead end, never merely solver-proven unsolvability with legal moves.
- Undo is free and non-assisted during active play; after true dead end it is unavailable for brute-force recovery.
- Hint permanently marks run assisted.
- One Rescue per run; Rescue marks assisted; second true dead end ends run.
- Assisted result cannot replace best unassisted record.
- Plate sizes stop at 91 cells; difficulty continues through decision profile and then caps at human-appropriate high band.
- Live run is session-scoped and not persisted across page reload.

---

### Task 1: Replace Endless score with persistent boards-cleared stats

**Files:**
- Create: `src/endless-progress.ts`
- Modify: `src/index.ts`
- Test: `test/endless-progress.test.js`

**Interfaces:**
- Produces `EndlessProgressStore`, snapshot `{version:1,bestUnassistedBoards,bestAssistedBoards}`.
- Old `endless-score.ts` remains temporarily unused until Plan 6 deletion.

- [ ] **Step 1: Write failing store tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { EndlessProgressStore } from "../src/index.js";

class MemoryStorage { values = new Map(); getItem(k){return this.values.get(k)??null;} setItem(k,v){this.values.set(k,String(v));} removeItem(k){this.values.delete(k);} }

test("assisted run never replaces unassisted best", () => {
  const store = new EndlessProgressStore({ storage: new MemoryStorage() });
  store.submit({ boardsCleared: 7, assisted: false });
  store.submit({ boardsCleared: 20, assisted: true });
  assert.equal(store.snapshot.bestUnassistedBoards, 7);
  assert.equal(store.snapshot.bestAssistedBoards, 20);
});
```

- [ ] **Step 2: Implement store using key `garden-js.endless-progress.v1`**

Validate non-negative safe integers; update max only. Do not read old leaderboard/endless-score keys.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/endless-progress.test.js
git add src/endless-progress.ts src/index.ts test/endless-progress.test.js
git commit -m "feat: persist endless boards-cleared records"
```

---

### Task 2: Deterministic Endless difficulty bands and plate schedule

**Files:**
- Rewrite: `src/endless-run.ts`
- Modify: `src/generator-worker.ts`
- Modify: `src/browser.ts`
- Modify: `src/index.ts`
- Test: `test/endless-run.test.js`

**Interfaces:**
- Produces `endlessPlateSize(index)`, `endlessDifficultyBand(index)`, `generateEndlessRunLevel(index,{runSeed})`.

- [ ] **Step 1: Replace old compact/medium/large score-phase tests**

Assert:

```js
assert.deepEqual(Array.from({length: 8}, (_, i) => endlessPlateSize(i)), [
  "small","small","medium","medium","medium","large","large","large"
]);
assert.equal(endlessDifficultyBand(0), "easy");
assert.equal(endlessDifficultyBand(4), "medium");
assert.equal(endlessDifficultyBand(9), "hard");
assert.equal(endlessDifficultyBand(100), "mastery");
```

Also assert level 100 remains radius 5 and generation deterministic for same run seed/index.

- [ ] **Step 2: Implement finite plate growth and capped difficulty**

Use:

```ts
export type EndlessDifficultyBand = "easy" | "medium" | "hard" | "mastery";

export function endlessPlateSize(index: number): PlateSizeValue {
  if (index < 2) return PlateSize.SMALL;
  if (index < 5) return PlateSize.MEDIUM;
  return PlateSize.LARGE;
}

export function endlessDifficultyBand(index: number): EndlessDifficultyBand {
  if (index < 2) return "easy";
  if (index < 5) return "medium";
  if (index < 10) return "hard";
  return "mastery";
}
```

Define four fixed `DifficultyProfile`s. `mastery` is a cap, not a formula that continues rising.

- [ ] **Step 3: Generate 12 candidates per run board and choose best profile fit**

Seed each candidate `${runSeed}:board:${index}:candidate:${candidateIndex}`. Use full standard composition. Return `seed`, `level:index`, `plateCells`, `pieces`, `solution`, `difficulty`; no score/streak fields.

- [ ] **Step 4: Keep worker method name `generateEndlessRun` but change its options**

```ts
generateEndlessRun(level: number, { runSeed }: { runSeed: string }): Promise<BrowserResult<EndlessRunLevel>>
```

Remove dependence on campaign seed/progression levels.

- [ ] **Step 5: Run and commit**

```bash
node --import tsx --test test/endless-run.test.js test/puzzle-generation.test.js
pnpm typecheck
git add src/endless-run.ts src/generator-worker.ts src/browser.ts src/index.ts test/endless-run.test.js
git commit -m "feat: generate capped endless difficulty sequence"
```

---

### Task 3: Pure Endless run session

**Files:**
- Create: `src/game/board/EndlessBoardSession.ts`
- Test: `test/endless-board-session.test.js`

**Interfaces:**
- Produces `EndlessBoardSession` with `boardsCleared`, `assisted`, `rescueUsed`, `deadEnd`, current history.

- [ ] **Step 1: Write run-state tests**

Assert:
- starts at 0 boards, unassisted;
- clearing board increments count and resets per-board removal history, not run assisted state;
- Undo before dead end does not assist;
- Hint sets `assisted=true` permanently;
- entering true dead end disables ordinary Undo;
- Rescue can be used once and sets assisted;
- second dead end after Rescue returns terminal result.

- [ ] **Step 2: Implement session**

```ts
export class EndlessBoardSession {
  boardsCleared = 0;
  assisted = false;
  rescueUsed = false;
  deadEnd = false;
  history: BoardHistorySnapshot[] = [];

  markHintUsed(): void { this.assisted = true; }
  enterDeadEnd(): void { this.deadEnd = true; }
  markRescueUsed(): void { this.rescueUsed = true; this.assisted = true; this.deadEnd = false; }
  clearBoard(): void { this.boardsCleared += 1; this.history = []; this.deadEnd = false; }
  canUndo(): boolean { return !this.deadEnd && this.history.length > 0; }
  canRescue(): boolean { return this.deadEnd && !this.rescueUsed; }
}
```

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/endless-board-session.test.js
git add src/game/board/EndlessBoardSession.ts test/endless-board-session.test.js
git commit -m "feat: model endless run assistance and dead end"
```

---

### Task 4: Integrate Endless run into BoardScene

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/board/BoardHud.ts`
- Test: `test/board-session-state.test.js`
- Test: `test/endless-board-session.test.js`

**Interfaces:**
- BoardScene `PlayMode.ENDLESS` owns one session + generated current level.

- [ ] **Step 1: Start a run with a unique session seed**

Create once per Home click:

```ts
const runSeed = `endless-v2:${Date.now()}:${Math.random().toString(36).slice(2)}`;
this.scene.start("board", { mode: PlayMode.ENDLESS, level: 0, runSeed });
```

The seed is not persisted. Within a session, board index deterministically reproduces its board.

- [ ] **Step 2: On board clear load next board immediately**

Call `session.clearBoard()`, briefly show `N BOARDS CLEARED`, then request `generateEndlessRun(session.boardsCleared,{runSeed})`. Do not return Home between boards.

- [ ] **Step 3: Enforce true-dead-end boundary**

After a removal reaches `legalMoves.length===0 && !won`, call `session.enterDeadEnd()` and disable normal Undo/Hint. Show `End Run` and, if `session.canRescue()`, `Rescue Run`.

Solver-proven dead state while legal moves remain does nothing visible.

- [ ] **Step 4: Reuse Hint/Rescue direct assistance**

Hint: verify route, rewarded ad, then `session.markHintUsed()` and show move. Rescue: verify solvable history, rewarded ad, restore, `session.markRescueUsed()`. One Rescue total for the run.

- [ ] **Step 5: Run and commit**

```bash
node --import tsx --test test/endless-board-session.test.js test/board-session-state.test.js test/solver.test.js
pnpm typecheck
git add src/game/scenes/BoardScene.ts src/game/board/BoardHud.ts test/endless-board-session.test.js
git commit -m "feat: run endless as consecutive puzzle boards"
```

---

### Task 5: Endless result + Home best record

**Files:**
- Modify: `src/game/completion-overlay.ts`
- Modify: `src/game/home-model.ts`
- Modify: `src/game/scenes/MenuScene.ts`
- Create: `src/game/endless-progress.ts`
- Test: `test/completion-presentation.test.js`
- Test: `test/ui-state-model.test.js`

**Interfaces:**
- Registry helper `getEndlessProgress(scene)` mirrors campaign/settings helper pattern.

- [ ] **Step 1: Add result model tests**

Unassisted 8-board result with previous best 6 becomes canonical best 8. Assisted 12-board result leaves canonical best unchanged and may update assisted best.

- [ ] **Step 2: Submit result on terminal dead end**

```ts
const result = this.endlessProgress.submit({
  boardsCleared: session.boardsCleared,
  assisted: session.assisted,
});
```

Display:

```text
RUN COMPLETE
8 BOARDS
BEST 8
```

or assisted:

```text
RUN COMPLETE
12 BOARDS · WITH HELP
BEST CLEAN 8
```

Primary action is `TRY AGAIN`; secondary Home.

- [ ] **Step 3: Home Endless card**

When unlocked, show `Best: N boards`; no score/multiplier/leaderboard copy.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/endless-progress.test.js test/completion-presentation.test.js test/ui-state-model.test.js
pnpm build
git add src/game/completion-overlay.ts src/game/home-model.ts src/game/scenes/MenuScene.ts src/game/endless-progress.ts test/completion-presentation.test.js test/ui-state-model.test.js
git commit -m "feat: show endless boards-cleared records"
```

## Plan 5 completion check

```bash
pnpm test
pnpm typecheck
pnpm build
```

Manual smoke: clear several Endless boards, confirm sizes stop at 91, Hint marks assisted, Undo does not, true dead end removes Undo, Rescue works once, assisted run cannot replace clean best, and no score multiplier appears anywhere.
