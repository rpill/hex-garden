# Campaign Progress, Mastery, Unlocks, Home, and Chapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace score/economy-centered campaign progression with 50-level Solved/Clean mastery, progressive Daily/Endless unlocks, and a minimal asset-free Home/Chapters flow.

**Architecture:** Campaign state becomes a versioned store with solved/clean level sets and derived mastery/rank/Continue targets. Mode access is pure domain logic. Existing `MenuScene` and `LevelSelectScene` remain scene keys to minimize routing churn, but their content is rebuilt with a new Phaser-primitives UI helper rather than paper/nine-slice/economy widgets.

**Tech Stack:** TypeScript, Phaser 3.90, `node:test`, existing settings registry/store.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- Campaign has 50 fixed levels.
- Solved unlocks next; Clean never gates progress.
- Undo/Restart may later preserve Clean; Hint/Rescue invalidate attempt (implemented in Plan 3).
- Daily hidden before five solved levels; Endless hidden before ten solved levels.
- Continue dominates Home; after 50 solved but <50 Clean it targets earliest solved-not-clean level.
- No Dust, Shop, campaign score, leaderboard destination, or locked-mode teaser cards.
- Temporary UI is primitives/text only; preserve language/sound settings.

---

### Task 1: Campaign progress v3 — Solved/Clean only

**Files:**
- Modify: `src/campaign-progress.ts`
- Modify: `src/game/campaign-progress.ts`
- Modify: `src/index.ts`
- Test: `test/campaign-progress.test.js`

**Interfaces:**
- Produces `CampaignProgressSnapshotV3`, `CampaignProgressStore.complete(level,{clean})`, `isSolved`, `isClean`, `cleanCount`, `solvedCount`.
- Uses a new storage key `garden-js.campaign-progress.v3`; old v1/v2 data is intentionally ignored.

- [ ] **Step 1: Replace campaign progress tests with the new contract**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { CampaignProgressStore, CAMPAIGN_PROGRESS_STORAGE_KEY } from "../src/index.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("new campaign progress starts empty and uses a new save key", () => {
  assert.equal(CAMPAIGN_PROGRESS_STORAGE_KEY, "garden-js.campaign-progress.v3");
  const storage = new MemoryStorage();
  storage.setItem("garden-js.campaign-progress.v1", JSON.stringify({ completedLevels: [0,1,2] }));
  const store = new CampaignProgressStore({ storage });
  assert.equal(store.snapshot.solvedLevels.length, 0);
  assert.equal(store.snapshot.cleanLevels.length, 0);
  assert.equal(store.snapshot.highestUnlocked, 0);
});

test("solved and clean upgrade independently", () => {
  const store = new CampaignProgressStore({ storage: new MemoryStorage() });
  store.complete(0, { clean: false });
  assert.equal(store.isSolved(0), true);
  assert.equal(store.isClean(0), false);
  assert.equal(store.snapshot.highestUnlocked, 1);
  store.complete(0, { clean: true });
  assert.equal(store.isClean(0), true);
  assert.equal(store.snapshot.solvedLevels.length, 1);
});
```

- [ ] **Step 2: Verify failure**

```bash
node --import tsx --test test/campaign-progress.test.js
```

- [ ] **Step 3: Implement v3 snapshot and normalization**

```ts
export const CAMPAIGN_PROGRESS_STORAGE_KEY = "garden-js.campaign-progress.v3";

export interface CampaignProgressSnapshot {
  version: 3;
  tutorialCompleted: boolean;
  solvedLevels: number[];
  cleanLevels: number[];
  highestUnlocked: number;
  campaignCompleted: boolean;
}
```

Normalize `solvedLevels` as sorted unique valid level IDs and `cleanLevels` as sorted unique valid IDs that are also solved. Derive the contiguous solved prefix separately by scanning levels 0..49 until the first unsolved level; set `highestUnlocked = min(contiguousSolvedCount, 49)` and `campaignCompleted = solvedLevels.length === 50`. This keeps normal progression sequential while allowing `unlockAll` test mode to record a non-contiguous level without fabricating earlier completion. Do not read legacy keys.

Implement:

```ts
complete(level: number, { clean = false }: { clean?: boolean } = {}): CampaignProgressSnapshot
isSolved(level: number): boolean
isClean(level: number): boolean
```

A second Clean completion upgrades an already-solved level without altering unlocks.

- [ ] **Step 4: Preserve test mode without persisting it**

`unlockAll: true` returns all levels unlocked, but **does not mark them solved or clean**. This prevents the old `allUnlockedSnapshot` behavior from faking completion/mastery.

- [ ] **Step 5: Run tests**

```bash
node --import tsx --test test/campaign-progress.test.js
```

- [ ] **Step 6: Commit**

```bash
git add src/campaign-progress.ts src/game/campaign-progress.ts src/index.ts test/campaign-progress.test.js
git commit -m "feat: store solved and clean campaign progress"
```

---

### Task 2: Derived mastery rank and Continue target

**Files:**
- Create: `src/mastery.ts`
- Modify: `src/index.ts`
- Test: `test/mastery.test.js`

**Interfaces:**
- Produces `MasteryRank`, `masteryRank(cleanCount)`, `campaignContinueTarget(snapshot)`.

- [ ] **Step 1: Write failing mastery tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { MasteryRank, campaignContinueTarget, masteryRank } from "../src/index.js";

test("mastery thresholds match the product design", () => {
  assert.equal(masteryRank(0), MasteryRank.NOVICE);
  assert.equal(masteryRank(5), MasteryRank.APPRENTICE);
  assert.equal(masteryRank(15), MasteryRank.ADEPT);
  assert.equal(masteryRank(30), MasteryRank.STRATEGIST);
  assert.equal(masteryRank(40), MasteryRank.EXPERT);
  assert.equal(masteryRank(50), MasteryRank.MASTER);
});

test("continue advances campaign then targets earliest missing clean", () => {
  assert.deepEqual(campaignContinueTarget({ solvedLevels: [0,1], cleanLevels: [0] }), { kind: "campaign", level: 2 });
  assert.deepEqual(campaignContinueTarget({ solvedLevels: Array.from({length: 50}, (_, i) => i), cleanLevels: [0,1] }), { kind: "mastery", level: 2 });
  assert.deepEqual(campaignContinueTarget({ solvedLevels: Array.from({length: 50}, (_, i) => i), cleanLevels: Array.from({length: 50}, (_, i) => i) }), { kind: "complete" });
});
```

- [ ] **Step 2: Implement mastery domain**

```ts
export const MasteryRank = Object.freeze({
  NOVICE: "novice",
  APPRENTICE: "apprentice",
  ADEPT: "adept",
  STRATEGIST: "strategist",
  EXPERT: "expert",
  MASTER: "master",
} as const);

const RANKS = Object.freeze([
  { threshold: 50, rank: MasteryRank.MASTER },
  { threshold: 40, rank: MasteryRank.EXPERT },
  { threshold: 30, rank: MasteryRank.STRATEGIST },
  { threshold: 15, rank: MasteryRank.ADEPT },
  { threshold: 5, rank: MasteryRank.APPRENTICE },
  { threshold: 0, rank: MasteryRank.NOVICE },
]);
```

`campaignContinueTarget` first finds the lowest unsolved level in 0..49; if one exists it returns `{kind:"campaign", level}`. Once all 50 are solved, it finds the lowest level not in `cleanLevels` and returns `{kind:"mastery", level}`; only 50/50 Clean returns `complete`.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/mastery.test.js
git add src/mastery.ts src/index.ts test/mastery.test.js
git commit -m "feat: derive campaign mastery and continue target"
```

---

### Task 3: Pure mode-access rules for Daily and Endless

**Files:**
- Modify: `src/mode-access.ts`
- Modify: `src/game/modes.ts`
- Modify: `src/index.ts`
- Test: `test/mode-access.test.js`

**Interfaces:**
- Produces `dailyAccess(snapshot)`, `endlessAccess(snapshot)` and Play modes `tutorial/campaign/daily/endless`.
- Board variants remain generator internals and are no longer user-facing play-mode constants.

- [ ] **Step 1: Replace old mechanic-derived unlock test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { dailyAccess, endlessAccess } from "../src/index.js";

const snapshot = (count) => ({ solvedLevels: Array.from({ length: count }, (_, i) => i) });

test("daily unlocks after level five and endless after level ten", () => {
  assert.equal(dailyAccess(snapshot(4)).unlocked, false);
  assert.equal(dailyAccess(snapshot(5)).unlocked, true);
  assert.equal(endlessAccess(snapshot(9)).unlocked, false);
  assert.equal(endlessAccess(snapshot(10)).unlocked, true);
});
```

- [ ] **Step 2: Implement fixed completion thresholds**

```ts
export const DAILY_REQUIRED_COMPLETIONS = 5;
export const ENDLESS_REQUIRED_COMPLETIONS = 10;
```

Each access function counts the contiguous solved prefix from `snapshot.solvedLevels` and returns `{ unlocked, requiredCompletedLevels, completedRequiredLevels, remainingLevels }`. Delete dependency on `getProgressionLevelDefinition` and Gold introduction.

Update `PlayMode` to:

```ts
export const PlayMode = Object.freeze({
  TUTORIAL: "tutorial",
  CAMPAIGN: "campaign",
  DAILY: "daily",
  ENDLESS: "endless",
} as const);
```

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/mode-access.test.js test/campaign-progress.test.js
git add src/mode-access.ts src/game/modes.ts src/index.ts test/mode-access.test.js
git commit -m "feat: unlock daily and endless by campaign progress"
```

---

### Task 4: Asset-free minimal UI primitives

**Files:**
- Create: `src/game/minimal-ui.ts`
- Test: `test/minimal-ui-contract.test.js`

**Interfaces:**
- Produces `makeMinimalButton`, `makeMinimalCard`, `makeMinimalText`, `layoutMinimalButton`.
- Later Home/Chapters/Board scenes consume this helper instead of `art-assets.ts`/nine-slice helpers.

- [ ] **Step 1: Add a source-contract test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/game/minimal-ui.ts", import.meta.url), "utf8");

test("minimal UI does not depend on generated or premium art assets", () => {
  assert.doesNotMatch(source, /art-assets|GAMEPLAY_UI_FRAMES|UI_FRAMES|NineSlice|preloadUiAssets/);
  assert.match(source, /Phaser\.GameObjects\.Graphics|scene\.add\.graphics/);
});
```

- [ ] **Step 2: Implement primitive controls**

`makeMinimalButton(scene,label,onClick)` returns a `Phaser.GameObjects.Container` with a `Graphics` rounded rectangle and centered `Text`, enables pointer cursor, and redraws on hover/down/up. Expose methods via a small class:

```ts
export class MinimalButton extends Phaser.GameObjects.Container {
  setLabel(text: string): this;
  setEnabled(enabled: boolean): this;
  setSize(width: number, height: number): this;
}
```

Use only plain neutral colors defined as constants in the same module. Do not load textures.

- [ ] **Step 3: Run and commit**

```bash
node --import tsx --test test/minimal-ui-contract.test.js
git add src/game/minimal-ui.ts test/minimal-ui-contract.test.js
git commit -m "feat: add asset-free functional UI primitives"
```

---

### Task 5: Rebuild Home around Continue with progressive disclosure

**Files:**
- Modify: `src/game/scenes/MenuScene.ts`
- Modify: `src/game/navigation-layout.ts`
- Test: `test/ui-state-model.test.js`
- Test: `test/board-presentation-contract.test.js` (remove Home-specific premium assertions if present)

**Interfaces:**
- Consumes `campaignContinueTarget`, `masteryRank`, `dailyAccess`, `endlessAccess`, `MinimalButton`.
- Produces Home actions: Start/Tutorial, Continue, Chapters, Settings now; exposes `showDaily/showEndless` state for Plans 4/5, which add those cards only when the modes actually exist.

- [ ] **Step 1: Add a pure Home view-model helper to `MenuScene.ts` or a new `src/game/home-model.ts`**

Preferred new file `src/game/home-model.ts`:

```ts
export interface HomeModel {
  firstLaunch: boolean;
  continueTarget: ReturnType<typeof campaignContinueTarget>;
  solvedCount: number;
  cleanCount: number;
  rank: MasteryRankValue;
  showDaily: boolean;
  showEndless: boolean;
}

export function createHomeModel(snapshot: CampaignProgressSnapshot): Readonly<HomeModel> { /* pure */ }
```

- [ ] **Step 2: Test progressive disclosure**

```js
test("home hides unreached modes instead of showing locked cards", () => {
  const fresh = createHomeModel({ tutorialCompleted: false, solvedLevels: [], cleanLevels: [] });
  assert.equal(fresh.firstLaunch, true);
  assert.equal(fresh.showDaily, false);
  assert.equal(fresh.showEndless, false);
  const five = createHomeModel({ tutorialCompleted: true, solvedLevels: [0,1,2,3,4], cleanLevels: [] });
  assert.equal(five.showDaily, true);
  assert.equal(five.showEndless, false);
});
```

- [ ] **Step 3: Rebuild `MenuScene` without paper/art/economy/leaderboard imports**

The first-launch scene shows `HEX GARDEN`, `START`, Settings. After tutorial, create one dominant Continue button plus small Chapters and Settings actions. Display `◆ clean/50` and localized rank text. Do not instantiate economy/leaderboard stores. **Do not render Daily/Endless cards in this plan yet**: their access flags are already present in the Home model, but Plan 4 adds Daily only after its mode is implemented and Plan 5 adds Endless only after its mode is implemented. This keeps every intermediate plan runnable.

- [ ] **Step 4: Route Continue directly to Board**

For `{ kind: "campaign" | "mastery", level }`:

```ts
this.scene.start("board", { mode: PlayMode.CAMPAIGN, level });
```

For `{ kind: "complete" }`, keep Continue absent/disabled and emphasize Daily/Endless instead.

- [ ] **Step 5: Run Home model + typecheck**

```bash
node --import tsx --test test/ui-state-model.test.js test/mode-access.test.js test/mastery.test.js
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/game/home-model.ts src/game/scenes/MenuScene.ts src/game/navigation-layout.ts test/ui-state-model.test.js
git commit -m "feat: rebuild home around campaign continue"
```

---

### Task 6: Rebuild Chapters as secondary 5×10 navigation

**Files:**
- Modify: `src/game/scenes/LevelSelectScene.ts`
- Modify: `src/game/presentation-layout.ts`
- Test: `test/level-contract.test.js`
- Test: `test/presentation-layout.test.js`

**Interfaces:**
- Consumes `CampaignChapter`, `CampaignProgressStore`, `MinimalButton`.
- Level states are only `locked/current/solved/clean`.

- [ ] **Step 1: Replace 24-level/score assertions**

Add a pure helper `campaignLevelState(snapshot, level)` and test:

```js
assert.equal(campaignLevelState({ solvedLevels: [], cleanLevels: [], highestUnlocked: 0 }, 0), "current");
assert.equal(campaignLevelState({ solvedLevels: [0], cleanLevels: [], highestUnlocked: 1 }, 0), "solved");
assert.equal(campaignLevelState({ solvedLevels: [0], cleanLevels: [0], highestUnlocked: 1 }, 0), "clean");
assert.equal(campaignLevelState({ solvedLevels: [0], cleanLevels: [], highestUnlocked: 1 }, 2), "locked");
```

- [ ] **Step 2: Render five chapter sections with ten level buttons each**

Use chapter labels `Основы/Планирование/Порядок/Ложные ходы/Мастерство` (or English counterparts). Each button shows level number and one state mark: `✓` solved, `◆` clean, no star system. Summary shows `Solved X/50 · ◆ Y/50`; no score/Dust.

- [ ] **Step 3: Keep Chapters secondary**

Back returns to Home. Selecting an unlocked level starts `BoardScene` directly. Do not route ordinary completion back here; Plan 3 completion overlay owns Next.

- [ ] **Step 4: Run and commit**

```bash
node --import tsx --test test/level-contract.test.js test/presentation-layout.test.js
pnpm typecheck
git add src/game/scenes/LevelSelectScene.ts src/game/presentation-layout.ts test/level-contract.test.js test/presentation-layout.test.js
git commit -m "feat: present campaign as five mastery chapters"
```

## Plan 2 completion check

```bash
pnpm test
pnpm typecheck
pnpm build
```

Manual smoke: fresh save shows only Start + Settings; after tutorial completion Home centers Continue; Home model reports Daily unlocked at five solved and Endless unlocked at ten solved, but their cards remain intentionally absent until Plans 4/5; Chapters shows 50 levels and Clean diamonds without score/Dust.
