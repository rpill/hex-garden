# Legacy Product Cleanup and Functional Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove superseded economy/score/leaderboard/progression surfaces, delete tests that accidentally enforce the abandoned live premium UI, update project docs, and verify the complete minimal functional redesign end-to-end.

**Architecture:** This plan is intentionally last: all new product paths already exist, so legacy code can be deleted rather than shimmed. Isolated asset-factory sources may remain frozen for reference, but no runtime scene or active contract test may require them. Final checks combine automated regression with a manual responsive/product matrix and a campaign curation checkpoint.

**Tech Stack:** TypeScript, Phaser, Node >=20, Vite, `node:test`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- No Dust, Shop, booster inventory, campaign score, Endless score/multiplier, or public leaderboard navigation remains reachable.
- Preserve Yandex rewarded callback/concurrency behavior, settings persistence, audited rules, Daily/Endless/Campaign functionality.
- Do not restart final art generation.
- Keep asset-factory files only as frozen, non-runtime experiments if deletion is not useful; they must not constrain functional UI.

---

### Task 1: Remove economy and Shop runtime dependencies

**Files:**
- Delete: `src/economy.ts`
- Delete: `src/game/economy.ts`
- Delete: `src/game/scenes/ShopScene.ts`
- Modify: `src/main.ts`
- Modify: `src/index.ts`
- Delete: `test/economy.test.js`
- Modify: any tests importing economy symbols

**Interfaces:**
- Rewarded ads are accessed only through `BoardAssistance`/platform adapter; no wallet/inventory store remains.

- [ ] **Step 1: Search all runtime references before deletion**

```bash
rg -n "getEconomy|EconomyStore|HintType|dust|HINT_PRODUCTS|ShopScene|scene\.start\(\"shop\"" src test
```

Expected before cleanup: only known legacy references. Migrate any surviving direct rewarded-use caller to `BoardAssistance` first.

- [ ] **Step 2: Delete economy/Shop files and scene registration**

Remove `ShopScene` import/config from `src/main.ts`; remove economy exports from `src/index.ts`. Delete economy test rather than rewriting it: its product contract is intentionally superseded.

- [ ] **Step 3: Assert no public runtime economy strings**

Create `test/removed-product-contract.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sources(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sources(full) : entry.name.endsWith(".ts") ? [full] : [];
  });
}

test("runtime product has no economy or shop surface", () => {
  const text = sources(fileURLToPath(new URL("../src/game", import.meta.url))).map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(text, /EconomyStore|getEconomy|HINT_PRODUCTS|CAMPAIGN SCORE|МАГАЗИН|scene\.start\(["']shop/);
});
```

- [ ] **Step 4: Run and commit**

```bash
pnpm test
pnpm typecheck
git add -A src/economy.ts src/game/economy.ts src/game/scenes/ShopScene.ts src/main.ts src/index.ts test/economy.test.js test/removed-product-contract.test.js
git commit -m "refactor: remove dust economy and shop"
```

---

### Task 2: Remove old Endless score and public leaderboard product

**Files:**
- Delete: `src/endless-score.ts`
- Delete: `src/leaderboard.ts`
- Delete: `src/game/leaderboard.ts`
- Delete: `src/game/scenes/LeaderboardScene.ts`
- Modify: `src/main.ts`
- Modify: `src/index.ts`
- Delete: `test/endless-score.test.js`
- Delete: `test/leaderboard.test.js`

**Interfaces:**
- `EndlessProgressStore` from Plan 5 is the only persistent Endless result store.

- [ ] **Step 1: Search for old score/leaderboard references**

```bash
rg -n "endless-score|LocalLeaderboard|leaderboard|streakMultiplier|scoreRemovedAtoms|campaignScore" src test
```

Migrate any surviving Home/Board copy to boards-cleared/Clean progress first.

- [ ] **Step 2: Delete files and scene registration**

Remove exports/imports and obsolete tests. Do not replace with fake leaderboard data.

- [ ] **Step 3: Extend removed-product contract test**

Assert runtime scenes contain none of `CAMPAIGN SCORE`, `STREAK MULTIPLIER`, `RANKING`, `РЕЙТИНГ`, `scoreRemovedAtoms`, `LocalLeaderboardStore`.

- [ ] **Step 4: Run and commit**

```bash
pnpm test
pnpm typecheck
git add -A src/endless-score.ts src/leaderboard.ts src/game/leaderboard.ts src/game/scenes/LeaderboardScene.ts src/main.ts src/index.ts test/endless-score.test.js test/leaderboard.test.js test/removed-product-contract.test.js
git commit -m "refactor: remove endless score and public leaderboard"
```

---

### Task 3: Remove old mechanic-progression and shape-family campaign contracts

**Files:**
- Delete: `src/mechanic-introductions.ts`
- Delete: `src/game/campaign-progress.ts` only if superseded registry helper was relocated; otherwise keep the new helper.
- Refactor/Delete: `src/progression.ts` after extracting any still-used generic logic
- Modify: `src/generator.ts`
- Modify: `src/generator-worker.ts`
- Modify: `src/browser.ts`
- Modify: `src/index.ts`
- Delete/Rewrite: `test/mechanic-introductions.test.js`
- Delete/Rewrite: `test/progression.test.js`
- Modify: `test/generator.test.js`

**Interfaces:**
- Public generation surfaces are fixed Campaign data, generic canonical candidate, Daily, and Endless.

- [ ] **Step 1: Confirm no runtime caller needs old progression**

```bash
rg -n "generateProgressionLevel|getProgressionLevelDefinition|ProgressionChapter|mechanicIntroductionForLevel|BoardShape" src --glob '!progression.ts' --glob '!generator.ts'
```

Expected: no live Campaign/Daily/Endless scene dependencies.

- [ ] **Step 2: Delete old progression-specific module/tests**

If `progression.ts` contains any helper still used by canonical generation/difficulty, move that helper to `puzzle-generation.ts`/`difficulty.ts` first, then delete `progression.ts` and its exports.

- [ ] **Step 3: Remove public `BoardShape` API from `generator.ts`**

Keep Quintessence internal generation only if still needed by rule/test tooling, but standard public generation must not select `sixfold/threefold/twofold/outer-rings`. Replace old shape-family generator tests with canonical candidate tests already owned by Plan 1.

- [ ] **Step 4: Simplify worker request union**

After this task it should contain only the runtime asynchronous requests actually used:

```ts
type GeneratorWorkerRequest =
  | { requestId: number; kind: "puzzle-candidate"; options: PuzzleCandidateOptions }
  | { requestId: number; kind: "daily"; dateKey: string }
  | { requestId: number; kind: "endless-run"; level: number; runSeed: string };
```

- [ ] **Step 5: Run and commit**

```bash
pnpm test
pnpm typecheck
pnpm build
git add -A src/progression.ts src/mechanic-introductions.ts src/generator.ts src/generator-worker.ts src/browser.ts src/index.ts test/progression.test.js test/mechanic-introductions.test.js test/generator.test.js
git commit -m "refactor: remove legacy mechanic and shape progression"
```

---

### Task 4: Remove live premium/physical UI assertions while freezing factory work

**Files:**
- Modify/Delete as appropriate: `test/board-presentation-contract.test.js`
- Delete live-integration-only tests if they require abandoned runtime presentation:
  - `test/physical-premium-contract.test.js`
  - `test/physical-premium-raster-contract.test.js`
  - `test/premium-tabletop-contract.test.js`
  - `test/physical-piece-family.test.js`
- Keep isolated factory tests only if they pass without requiring runtime use:
  - `test/physical-ui-factory-contract.test.js`
  - `test/physical-factory-runtime.test.js`
  - Python factory tests under `tests/`
- Modify: `ART_DIRECTION.md`
- Modify: `CURRENT_STATE.md`

**Interfaces:**
- Runtime Board/Menu tests assert minimal functional primitives, not physical premium texture/frame names.

- [ ] **Step 1: Classify each physical test**

A test stays only if it validates an isolated frozen tool without asserting that current gameplay imports/uses its output. A test is removed/replaced if it forces `BoardScene`, `MenuScene`, `BoardHud`, or level-select to load premium/physical textures.

- [ ] **Step 2: Update art/current-state docs**

Add explicit state:

```text
Physical premium / Physical UI Factory: FROZEN EXPERIMENT, not the live runtime presentation.
Current runtime target: asset-free functional redesign with Phaser primitives until product playtest acceptance.
```

Do not delete the factory itself solely for cleanup.

- [ ] **Step 3: Run JS + Python tests that remain relevant**

```bash
pnpm test
python tests/run_tests.py
```

If Blender itself is not installed locally, factory tests that require Blender should retain their existing skip/availability semantics rather than become a product build dependency.

- [ ] **Step 4: Commit**

```bash
git add -A test ART_DIRECTION.md CURRENT_STATE.md
git commit -m "test: stop enforcing frozen premium runtime presentation"
```

---

### Task 5: Update project contracts/documentation to the new product

**Files:**
- Modify: `PROJECT.md`
- Modify: `CURRENT_STATE.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `VALIDATION.md`

**Interfaces:**
- Docs must describe what the code now does, not the old 24-level/economy product.

- [ ] **Step 1: Replace superseded product facts**

Document exactly:

- Tutorial + 50 fixed campaign levels, 5×10;
- canonical 37/61/91 full hex plates;
- same standard rules throughout campaign;
- Solved/Clean/mastery thresholds;
- Daily after level 5 with Moscow calendar + weekly history;
- Endless after level 10 with boards-cleared best and assisted flag;
- free Undo/Restart;
- solver-verified rewarded Hint/Rescue, one Rescue per attempt/run;
- no Dust/Shop/inventory/score multiplier/public leaderboard;
- functional minimal presentation and frozen art-factory status.

- [ ] **Step 2: Update validation commands**

Ensure docs list:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm author:campaign   # authoring only, not normal runtime validation
```

Do not require regenerating campaign JSON during normal build/test.

- [ ] **Step 3: Commit**

```bash
git add PROJECT.md CURRENT_STATE.md AGENTS.md README.md VALIDATION.md
git commit -m "docs: describe functional product redesign"
```

---

### Task 6: Campaign curation and difficulty playtest checkpoint

**Files:**
- Input: `build/campaign-shortlist.json`
- Create/update: `build/campaign-selection.json`
- Regenerate: `src/data/campaign-levels.json`
- Add notes: `docs/campaign-playtest.md`

**Interfaces:**
- No product-code API changes. Selected candidate indices are data-only.

- [ ] **Step 1: Playtest Levels 1–5 against explicit goals**

Record pass/fail for:

1. Level 1: high first-attempt success and satisfying clear.
2. Level 2: one removal visibly opens multiple future options.
3. Level 3: first meaningful choice without harsh punishment.
4. Level 4: metal order visibly matters.
5. Level 5: plausible route can reach a true dead end quickly enough to teach planning.

If a level fails, choose another candidate 0..4 from its shortlist or regenerate only that level's authoring pool with a different authoring seed namespace version.

- [ ] **Step 2: Review all 50 for chapter identity/rhythm**

For each level record `keep/replace` plus a one-line reason. Verify relief levels 4/9 in each chapter are not harder than both surrounding peaks and chapter 10 feels like a local exam. For Chapter 3 (`Порядок`), explicitly reject a shortlist choice if metal sequencing is incidental rather than materially affecting planning; this manual check is the V1 substitute for the deferred `metalPressure` metric.

- [ ] **Step 3: Freeze selected indices**

```bash
pnpm freeze:campaign -- --selection build/campaign-selection.json
node --import tsx --test test/campaign.test.js
```

- [ ] **Step 4: Commit curated data + playtest notes**

```bash
git add src/data/campaign-levels.json docs/campaign-playtest.md
git commit -m "content: curate fifty campaign puzzles"
```

---

### Task 7: Full automated acceptance

**Files:**
- Modify/create targeted tests as needed; no product behavior changes should be introduced here.

- [ ] **Step 1: Rules regression**

```bash
node --import tsx --test test/rules.test.js test/solver.test.js test/hex.test.js
```

Verify freedom geometry, off-plate emptiness, all pairings, metal chain, Gold, UNKNOWN semantics.

- [ ] **Step 2: Product regression**

```bash
node --import tsx --test \
  test/plates.test.js \
  test/campaign.test.js \
  test/campaign-progress.test.js \
  test/mastery.test.js \
  test/mode-access.test.js \
  test/daily-calendar.test.js \
  test/daily-progress.test.js \
  test/daily.test.js \
  test/endless-progress.test.js \
  test/endless-run.test.js \
  test/board-session-state.test.js \
  test/assistance-policy.test.js
```

- [ ] **Step 3: Full build gate**

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all PASS; no warnings/errors caused by removed runtime imports.

- [ ] **Step 4: Commit any test-only acceptance fixes**

```bash
git add test src
# Only if test harness/import cleanup was required; no behavior changes here.
git commit -m "test: cover functional redesign acceptance"
```

---

### Task 8: Manual responsive/product acceptance matrix

**Files:**
- Create: `docs/functional-redesign-acceptance.md`

- [ ] **Step 1: Desktop landscape**

Verify first launch -> tutorial -> Level 1; Continue; Chapters; Level 5 Daily reveal; Level 10 Endless reveal; Campaign Hint/Rescue; Daily; Endless; Settings return paths.

- [ ] **Step 2: Phone portrait**

Verify full plate readable at 37/61/91, Undo/Hint reachable, overflow controls accessible, no clipped completion/dead-end overlays, Home Continue dominates.

- [ ] **Step 3: Phone landscape**

Verify full plate remains visible, secondary UI does not shrink tokens below comfortable click size, Daily week row and Endless result fit.

- [ ] **Step 4: Product acceptance questions**

Record yes/no + notes for all spec questions:

- Next creates one-more-level loop;
- chapters feel different without new mechanics;
- Clean motivates without blocking;
- Daily provides a return reason;
- weekly history feels better than fragile streak;
- Endless has enough tension with free pre-dead-end Undo;
- Hint/Rescue are useful without ad farming;
- 37/61/91 provide enough duration variety;
- fixed canonical plate feels stronger than variable silhouettes.

- [ ] **Step 5: Final functional commit**

```bash
git add docs/functional-redesign-acceptance.md
git commit -m "docs: record functional redesign playtest acceptance"
```

## Plan 6 completion gate

Do **not** start final art direction until Task 8 acceptance notes say the functional product is ready. Any failed product question becomes a new bounded/architectural design task before visual work resumes.
