# Hex Garden TypeScript Migration and BoardScene Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all runtime source under `src/**` from JavaScript to strict TypeScript while preserving behavior, then extract HUD, inventory, and tutorial presentation ownership from the monolithic `BoardScene`.

**Architecture:** Keep current runtime values and `.js` ESM specifiers stable while converting modules incrementally from the renderer-independent core outward. `BoardScene` remains orchestration/state owner; new `BoardHud`, `BoardInventory`, and `BoardTutorial` modules own only Phaser presentation objects and emit semantic callbacks. Existing behavioral tests remain authoritative, and `tsc --noEmit` becomes an additional gate rather than a replacement for tests.

**Tech Stack:** Node.js >=20, Phaser 3.90, Vite 7, native ES modules, TypeScript strict mode, `tsx` for Node test execution, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-03-typescript-migration-board-boundaries-design.md`

## Global Constraints

- Preserve all current gameplay rules, atom numeric IDs, serialized keys, mode strings, scoring, economy values, progression, Yandex behavior, persistence semantics, and current B1 visual behavior.
- Do not fix `positionDeadEnd` / unsolvable-position behavior in this migration.
- Do not add the contextual tutorial, floating HUD, direct restart control, spiral-fill intro, or new final art direction in this migration.
- Runtime source under `src/**` must end fully migrated to `.ts`; repository tooling under `scripts/*.mjs` remains JavaScript.
- Keep `.js` import specifiers inside migrated `.ts` modules.
- Final `tsconfig.json` must use `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `allowJs: false`, and `noEmit: true`.
- Do not introduce production `any` or `// @ts-ignore`; use `unknown` and explicit narrowing at external boundaries.
- Do not add screenshot, pixel-diff, exact-color, exact-coordinate, or exact-asset-filename tests.
- The supplied archive workspace has no Git history; commit steps are instructions for the user's real repository and are skipped during archive execution.

---

### Task 1: Bootstrap TypeScript without changing runtime behavior

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml` when dependency resolution is available
- Create: `tsconfig.json`
- Test: existing `test/*.test.js`

**Interfaces:**
- Consumes: existing Node/Vite/Phaser project.
- Produces: `pnpm typecheck`, TypeScript-aware `pnpm test`, temporary mixed-source configuration with `allowJs: true`.

- [ ] **Step 1: Record the unchanged behavioral baseline**

Run the focused fast suite excluding the historical slow progression test:

```bash
files=$(find test -maxdepth 1 -name '*.test.js' ! -name 'progression.test.js' -print | sort)
node --test $files
```

Expected: current B1 suite passes with only its existing intentional skips.

- [ ] **Step 2: Add toolchain dependencies and scripts**

`package.json` must contain:

```json
{
  "scripts": {
    "test": "node --import tsx --test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^7.1.3"
  }
}
```

Keep every existing script not shown above.

- [ ] **Step 3: Add temporary mixed-source `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useDefineForClassFields": true,
    "noEmit": true,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.js"]
}
```

- [ ] **Step 4: Verify bootstrap**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: unchanged JS runtime remains buildable/testable before source migration. If package installation is unavailable in the execution environment, record that limitation and use an installed `tsc` only for typecheck until the user's local `pnpm install` can update the lockfile and execute `tsx`/Vite.

- [ ] **Step 5: Commit in the real repository**

```bash
git add package.json pnpm-lock.yaml tsconfig.json
git commit -m "chore: bootstrap TypeScript"
```

---

### Task 2: Migrate and type the core board/rules foundation

**Files:**
- Rename: `src/atom-types.js` -> `src/atom-types.ts`
- Rename: `src/hex.js` -> `src/hex.ts`
- Rename: `src/rules.js` -> `src/rules.ts`
- Rename: `src/board.js` -> `src/board.ts`
- Test: `test/rules.test.js`
- Test: `test/hex.test.js`
- Test: `test/level-contract.test.js`

**Interfaces:**
- Produces: `AtomType`, `AtomTypeValue`, `HexCoord`, `HexKey`, `BoardPiece`, `GardenBoard`, typed selection/legal-move results.
- Runtime values of `Atom` and existing board API remain unchanged.

- [ ] **Step 1: Verify existing core behavior before refactor**

```bash
node --test test/rules.test.js test/hex.test.js test/level-contract.test.js
```

Expected: PASS on the JavaScript implementation.

- [ ] **Step 2: Type `atom-types` with stable numeric IDs**

Use a frozen const object and derive its union:

```ts
export const Atom = Object.freeze({
  SALT: 1,
  AIR: 2,
  FIRE: 3,
  WATER: 4,
  EARTH: 5,
  QUICKSILVER: 6,
  GOLD: 7,
  SILVER: 8,
  COPPER: 9,
  IRON: 10,
  TIN: 11,
  LEAD: 12,
  VITAE: 13,
  MORS: 14,
  QUINTESSENCE: 16,
} as const);

export type AtomType = (typeof Atom)[keyof typeof Atom];
```

Preserve all existing exported arrays/maps and their runtime contents, typing them with readonly arrays / `Record` where complete.

- [ ] **Step 3: Type hex coordinates and keys**

Define:

```ts
export interface HexCoord { q: number; r: number }
export type HexKey = string;
```

Keep existing coordinate math and string key format unchanged. Type all coordinate collections as readonly inputs where functions do not mutate them.

- [ ] **Step 4: Type rule predicates**

Accept `AtomType` and return `boolean`; preserve the metal chain and pairing rules exactly.

- [ ] **Step 5: Type `GardenBoard` state and selection results**

Define concrete piece/result shapes instead of loose objects. `GardenBoard.select()` must retain its current runtime return values and state transitions; type those current shapes as a discriminated union if the implementation already exposes status-like fields, otherwise use an explicit interface matching the current object.

- [ ] **Step 6: Run compiler and focused tests**

```bash
tsc --noEmit
node --test test/rules.test.js test/hex.test.js test/level-contract.test.js
```

Expected: no type errors in migrated core; tests still PASS.

- [ ] **Step 7: Commit in the real repository**

```bash
git add src/atom-types.ts src/hex.ts src/rules.ts src/board.ts
git add -u src
git commit -m "refactor: type core board rules"
```

---

### Task 3: Migrate solver, generation, progression, scoring, economy, and persistence

**Files:**
- Rename/type: `src/solver.js`, `src/generator.js`, `src/generator-worker.js`, `src/campaign.js`, `src/progression.js`, `src/endless-run.js`, `src/endless-score.js`, `src/economy.js`, `src/campaign-progress.js`, `src/database.js`, `src/mode-access.js`, `src/opening-levels.js`, `src/tutorial.js`, `src/mechanic-introductions.js`, `src/leaderboard.js`, `src/settings.js`
- Test: corresponding existing rule/generator/solver/economy/persistence tests

**Interfaces:**
- Produces typed `GeneratedLevel`, `SolutionStep`, `SolverResult`, `SolveStatusValue`, campaign/endless progression records, economy/persistence records.
- Worker messages become discriminated unions keyed by the existing request kind strings.

- [ ] **Step 1: Verify renderer-independent baseline**

```bash
node --test \
  test/generator.test.js \
  test/solver.test.js \
  test/campaign.test.js \
  test/campaign-progress.test.js \
  test/endless-run.test.js \
  test/endless-score.test.js \
  test/economy.test.js \
  test/database.test.js \
  test/mode-access.test.js \
  test/settings.test.js \
  test/leaderboard.test.js \
  test/tutorial.test.js \
  test/mechanic-introductions.test.js
```

Expected: PASS/SKIP exactly as current baseline.

- [ ] **Step 2: Migrate solver and generation first**

Type solver moves using the `HexKey` / `BoardPiece` contracts from Task 2. Type generator options and returned generated layouts without changing seed handling, masks, solution certificates, or standard/quintessence identifiers.

- [ ] **Step 3: Type worker protocol exhaustively**

Represent each existing request as a discriminated union, for example:

```ts
type GeneratorWorkerRequest =
  | { kind: "progression"; requestId: number; payload: ProgressionRequest }
  | { kind: "endless-run"; requestId: number; payload: EndlessRunRequest }
  | { kind?: undefined; requestId: number; payload: StandardGenerateRequest };
```

Mirror the *actual* current message fields from `generator-worker.js`; do not rename serialized keys. Narrow `event.data` from `unknown` before dispatching.

- [ ] **Step 4: Migrate progression/campaign/endless modules**

Preserve all campaign seeds, level counts, thresholds, scoring multipliers, plate sizes, and challenge-quality logic. Use typed const unions for mode/rule identifiers while preserving their string values.

- [ ] **Step 5: Migrate economy/persistence/settings/leaderboard modules**

Treat `JSON.parse`, localStorage values, and external persisted values as `unknown`; add small local predicates/default constructors where necessary. Preserve every current fallback/default value exactly.

- [ ] **Step 6: Run typecheck and focused tests**

```bash
tsc --noEmit
node --test \
  test/generator.test.js test/solver.test.js test/campaign.test.js \
  test/campaign-progress.test.js test/endless-run.test.js test/endless-score.test.js \
  test/economy.test.js test/database.test.js test/mode-access.test.js \
  test/settings.test.js test/leaderboard.test.js test/tutorial.test.js \
  test/mechanic-introductions.test.js
```

Expected: zero compiler errors and unchanged behavioral results.

- [ ] **Step 7: Commit in the real repository**

```bash
git add src
git commit -m "refactor: type generation and progression"
```

---

### Task 4: Migrate platform/browser adapters and typed presentation models

**Files:**
- Rename/type: `src/browser.js`, `src/platform/yandex-games.js`, `src/art-assets.js`, `src/scene-background.js`, `src/panel-state.js`
- Rename/type: `src/game/campaign-progress.js`, `campaign-test-mode.js`, `economy.js`, `leaderboard.js`, `modes.js`, `navigation-layout.js`, `piece-visual-state.js`, `presentation-layout.js`, `presentation-model.js`, `responsive-layout.js`, `settings.js`, `utility-navigation.js`
- Test: `test/panel-state.test.js`, `test/yandex-games.test.js`, B1 presentation-model/layout tests already present in the suite

**Interfaces:**
- Produces typed asset registries, presentation states, utility-scene route payloads, BrowserLevelGenerator protocol, Yandex boundary types.

- [ ] **Step 1: Verify presentation/platform baseline**

```bash
node --test test/panel-state.test.js test/yandex-games.test.js
```

Expected: PASS.

- [ ] **Step 2: Type asset registries compile-time completely**

Import `AtomType` and express the gameplay glyph map as:

```ts
export const ATOM_GLYPH_FRAMES = {
  // current exact mappings
} satisfies Record<AtomType, string>;
```

Do not change current filenames or player-visible output in this migration.

- [ ] **Step 3: Type browser Worker boundary**

`Worker.onmessage` data is `unknown` until checked. Keep existing Promise resolution/rejection behavior and request IDs unchanged.

- [ ] **Step 4: Type Yandex SDK boundary narrowly**

Define only the SDK surface actually accessed by this project. Read `globalThis.YaGames` via a typed optional global declaration or a narrow runtime guard; do not cast the entire global object to `any`.

- [ ] **Step 5: Type pure presentation/layout helpers**

Give exported functions explicit input/output interfaces, including button surface specs, board piece visual state, utility navigation data, and responsive layout modes. Keep all existing B1 numeric/layout values unchanged.

- [ ] **Step 6: Run typecheck and focused tests**

```bash
tsc --noEmit
node --test test/panel-state.test.js test/yandex-games.test.js
```

Expected: PASS with zero type errors.

- [ ] **Step 7: Commit in the real repository**

```bash
git add src
git commit -m "refactor: type platform and presentation models"
```

---

### Task 5: Migrate shared Phaser UI and simple scenes

**Files:**
- Rename/type: `src/game/ui.js` -> `src/game/ui.ts`
- Rename/type: `src/game/completion-overlay.js` -> `src/game/completion-overlay.ts`
- Rename/type: `src/game/scenes/MenuScene.js`, `LevelSelectScene.js`, `ShopScene.js`, `SettingsScene.js`, `LeaderboardScene.js`
- Test: existing presentation/layout/scene-independent tests

**Interfaces:**
- Produces typed reusable Phaser controls, typed scene init data, and current utility navigation behavior.

- [ ] **Step 1: Keep Phaser objects concrete rather than generic bags**

Type fields with Phaser classes such as `Phaser.GameObjects.Text`, `Graphics`, `Image`, `Container`, and `NineSlice`. For optional/lifecycle-created fields use `field?: Type` or `field: Type | null` according to actual lifetime; do not use broad object types.

- [ ] **Step 2: Type reusable UI factories**

Define explicit action callbacks and control handles, for example:

```ts
export interface UiButtonHandle {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  destroy(): void;
}
```

Match current factory return values rather than inventing unused abstractions.

- [ ] **Step 3: Narrow scene init payloads from `unknown`**

Each scene that accepts data defines its own interface and parses `init(data: unknown)`. Utility return scene keys must use the typed scene-key union from presentation/navigation models.

- [ ] **Step 4: Migrate completion overlay without layout redesign**

Type current overlay state, tween handles, callbacks, and result payloads. Preserve B1 layout and current progress/reward behavior.

- [ ] **Step 5: Run compiler and fast regression suite**

```bash
tsc --noEmit
files=$(find test -maxdepth 1 -name '*.test.js' ! -name 'progression.test.js' -print | sort)
node --test $files
```

Expected: no compiler errors; unchanged suite status.

- [ ] **Step 6: Commit in the real repository**

```bash
git add src
git commit -m "refactor: type shared UI and scenes"
```

---

### Task 6: Extract Board HUD, inventory, and tutorial presentation

**Files:**
- Create: `src/game/board/BoardHud.ts`
- Create: `src/game/board/BoardInventory.ts`
- Create: `src/game/board/BoardTutorial.ts`
- Modify while still JS or after rename: `src/game/scenes/BoardScene.js` / `.ts`
- Add test: `test/board-presentation-contract.test.js`

**Interfaces:**
- Produces `BoardHudState`, `BoardHudActions`, `BoardInventoryState`, `BoardInventoryActions`, `BoardTutorialState` and three presentation-owner classes.
- These classes may own Phaser display objects but never own `GardenBoard`, solver/progression stores, economy state, or scene navigation plugins.

- [ ] **Step 1: Write a failing structural contract test**

Create `test/board-presentation-contract.test.js` that reads source files and verifies the three modules exist and do not import forbidden domain owners:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const forbidden = ["../../board.js", "../../solver.js", "../../progression.js"];

for (const file of ["BoardHud.ts", "BoardInventory.ts", "BoardTutorial.ts"]) {
  test(`${file} stays presentation-only`, async () => {
    const text = await readFile(new URL(`../src/game/board/${file}`, import.meta.url), "utf8");
    for (const specifier of forbidden) assert.doesNotMatch(text, new RegExp(specifier.replaceAll(".", "\\.")));
  });
}
```

Before creating the modules, run the test and confirm it fails with missing files.

- [ ] **Step 2: Implement `BoardHud` by moving existing B1 HUD presentation code**

Expose state/actions matching the approved spec. Move only object creation/layout/update and callback invocation. `BoardScene` computes dust/score/remaining values and supplies callbacks for pause/shop/settings.

- [ ] **Step 3: Implement `BoardInventory` by moving existing inventory + hint/undo presentation code**

Keep B1 visual behavior exactly as-is during extraction, including current filtering. `BoardScene` supplies presentational state and semantic callbacks; the module does not call board legality/solver/economy APIs.

- [ ] **Step 4: Implement `BoardTutorial` by moving existing B1 tutorial presentation code**

Preserve the current B1 top tutorial behavior. `BoardScene` computes which tutorial step is active and supplies target keys; the module only renders/updates them.

- [ ] **Step 5: Verify the extraction**

```bash
tsc --noEmit
node --test test/board-presentation-contract.test.js
files=$(find test -maxdepth 1 -name '*.test.js' ! -name 'progression.test.js' -print | sort)
node --test $files
```

Expected: structural contract PASS and no behavioral regressions.

- [ ] **Step 6: Commit in the real repository**

```bash
git add src/game/board src/game/scenes/BoardScene.* test/board-presentation-contract.test.js
git commit -m "refactor: extract board presentation modules"
```

---

### Task 7: Migrate BoardScene and close the mixed-source window

**Files:**
- Rename/type: `src/game/scenes/BoardScene.js` -> `src/game/scenes/BoardScene.ts`
- Rename/type: `src/main.js` -> `src/main.ts`
- Rename/type: `src/index.js` -> `src/index.ts`
- Modify: `index.html` entry if it names `/src/main.js`
- Modify: `tsconfig.json`
- Modify: `CURRENT_STATE.md`
- Test: full existing suite plus `test/board-presentation-contract.test.js`

**Interfaces:**
- Produces fully TypeScript runtime tree with `BoardScene` as typed orchestration owner delegating HUD/inventory/tutorial presentation.

- [ ] **Step 1: Type `BoardScene` state explicitly**

Declare persistent scene fields rather than relying on constructor-time dynamic property creation. Type board/generator/store/solver/history/completion state with contracts from Tasks 2–4. `init(data: unknown)` narrows its optional mode/level data before use.

- [ ] **Step 2: Replace direct extracted-presentation ownership with module delegation**

`BoardScene` creates `BoardHud`, `BoardInventory`, and `BoardTutorial`, passes typed state on render/layout updates, and destroys/recreates them according to current scene lifecycle. Do not move domain decisions into those modules.

- [ ] **Step 3: Migrate entries and preserve public exports**

Rename `main` and `index`; preserve every current export from `src/index`. If `index.html` names `/src/main.js`, update only that entry to `/src/main.ts` because it is a source URL, not an emitted ESM specifier.

- [ ] **Step 4: Close TypeScript configuration**

Final `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useDefineForClassFields": true,
    "noEmit": true,
    "allowJs": false,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5: Verify no runtime JavaScript source remains**

```bash
find src -name '*.js' -print
```

Expected: no output.

Also scan for forbidden migration escapes:

```bash
grep -RInE '\bany\b|@ts-ignore' src --include='*.ts' || true
```

Expected: no production `any` type annotations/casts and no `@ts-ignore`; incidental English prose containing “any” must be reviewed rather than mechanically treated as a failure.

- [ ] **Step 6: Run final verification**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Additionally run the historical progression test separately if the full suite stalls:

```bash
node --import tsx --test test/progression.test.js
```

Report a pre-existing timeout separately; do not delete/skip the test.

- [ ] **Step 7: Update current-state documentation**

Record in `CURRENT_STATE.md`:

- runtime source is now strict TypeScript;
- `pnpm typecheck` is a required gate;
- `BoardScene` delegates HUD/inventory/tutorial presentation;
- next phase is the separately designed board UX pass: floating chrome, contextual tutorial, restart, dead-end semantics, and spiral intro.

- [ ] **Step 8: Commit in the real repository**

```bash
git add -A src index.html tsconfig.json package.json pnpm-lock.yaml test CURRENT_STATE.md docs/superpowers
git commit -m "refactor: complete TypeScript migration"
```

---

### Task 8: Package a repository-safe migration patch

**Files:**
- Read/verify all files changed by Tasks 1–7.
- Produce patch archive outside project root.

**Interfaces:**
- Produces a ZIP intended to overlay the user's current B1 repository checkout without `.git`, `node_modules`, build output, or context bundles.

- [ ] **Step 1: Re-run fresh final evidence**

Run typecheck, all fast tests, syntax/build where dependencies permit, and record exact counts/limitations.

- [ ] **Step 2: Verify behavior-critical files changed only through type/refactor work**

Use diffs where Git is available; in the archive workspace compare against the pre-migration copy if retained. Confirm no rule constants, scoring values, progression tables, economy values, or player-facing B1 layout values were intentionally changed.

- [ ] **Step 3: Package only source/config/test/doc changes**

Include renames/deletions explicitly so overlay instructions tell the user to remove old `.js` files after extraction. Because ZIP extraction cannot delete obsolete files, include a PowerShell cleanup command that removes the old `src/**/*.js` runtime files before or after extraction while leaving `scripts/*.mjs` untouched.

- [ ] **Step 4: Final handoff instructions**

Tell the user to apply the patch, run dependency install **without `--frozen-lockfile` only if the supplied lockfile could not be regenerated in the offline execution environment**, then run:

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Do not claim build/full-suite success unless those commands produced fresh exit-0 evidence.
