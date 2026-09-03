# Hex Garden TypeScript Migration and BoardScene Boundaries

## Status

Approved architectural direction for the next development phase. This change is a **behavior-preserving migration** from JavaScript to TypeScript plus a targeted split of the oversized `BoardScene` presentation responsibilities.

It deliberately does **not** implement the next board-UX redesign (floating HUD, contextual tutorial bubbles, direct restart control, spiral-fill intro, or revised dead-end behavior). Those changes belong to the following design/spec after this migration is green.

## Why this change comes now

The runtime has grown beyond a small rules prototype. The current `src/` tree contains dozens of JavaScript modules, and `src/game/scenes/BoardScene.js` alone is roughly 2,400 lines. That scene currently coordinates gameplay state, solver status, score/economy state, scene navigation, HUD, tutorial presentation, inventory rendering, hints, modals, completion flow, and responsive layout.

Recent visual work exposed two distinct risks:

1. important contracts are represented by untyped numbers/strings/objects and can be wired incorrectly without any compiler signal;
2. `BoardScene` contains too many independent responsibilities, so presentation changes can accidentally affect unrelated state or navigation.

TypeScript is being introduced to make these contracts explicit and mechanically checked. The scene split is being introduced so the subsequent UX pass can change one presentation area without repeatedly editing a monolithic scene.

## Goals

1. Migrate all runtime/game source under `src/**` from `.js` to `.ts` without changing game rules or intended runtime behavior.
2. Add strict TypeScript checking as a required project verification step.
3. Preserve the current public module API and current `.js` import specifiers where practical, so the migration does not become an unrelated import-style rewrite.
4. Give core domain objects explicit types: atom IDs, hex coordinates, pieces, board results, legal moves, generated levels, solver results, economy state, persisted state, scene init data, worker messages, and presentation models.
5. Replace unsafe cross-module “magic string/number” contracts with typed unions or typed `const` objects while preserving their existing runtime values.
6. Split the existing `BoardScene` presentation responsibilities into focused modules for HUD, inventory, and tutorial, while leaving `BoardScene` as the orchestration/state owner.
7. Keep all existing gameplay, progression, scoring, economy, Yandex integration, persistence, and current B1 presentation behavior unchanged during this migration.
8. Make the next board-UX redesign safer: its work should mostly land inside the extracted presentation modules plus narrowly scoped `BoardScene` orchestration changes.

## Non-goals

This migration must not itself:

- change Sigmar-style removal rules, atom IDs, metal ordering, generator output, solver semantics, campaign progression, endless scoring, economy values, rewarded ads, or persistence behavior;
- fix or reinterpret `SolveStatus.DEAD_END` / `positionDeadEnd` interaction behavior yet;
- add the contextual tutorial bubble design;
- remove the top/bottom board chrome yet;
- add the direct in-board restart button yet;
- add the spiral board-fill intro animation yet;
- select a final art pack or replace the current provisional pieces;
- rename player-facing concepts merely because internal identifiers still use alchemy terms;
- rewrite all tests in TypeScript solely for consistency;
- convert repository tooling scripts under `scripts/*.mjs` unless a script directly needs a TypeScript-aware invocation change.

## Toolchain

### Dependencies

Add development dependencies:

- `typescript` — compiler/type checker;
- `tsx` — TypeScript-aware Node ESM execution for the existing Node test runner;
- `@types/node` — Node types used by source modules and test/tool execution.

Vite already understands `.ts` source files, so no separate Vite TypeScript plugin is required.

### Package scripts

Keep the existing runtime scripts and add:

```json
{
  "typecheck": "tsc --noEmit"
}
```

During the mixed JS/TS migration, change the test command to run the existing Node tests through `tsx`:

```json
{
  "test": "node --import tsx --test"
}
```

The existing test files may remain `.js`. They should continue importing public modules with `.js` specifiers. `tsx` resolves those specifiers to migrated `.ts` source during development/test execution.

### `tsconfig.json`

Use a strict browser + Node-compatible configuration:

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

`allowJs: true` is temporary and exists only to support incremental migration. The final migration task changes it to `false` and narrows `include` to `src/**/*.ts`. At that point no runtime `.js` source remains under `src/`.

### Import convention

Migrated TypeScript modules keep ESM import specifiers ending in `.js`, for example:

```ts
import { Atom } from "./atom-types.js";
```

TypeScript/Vite resolve the source module during development, while the specifier remains correct for JavaScript output semantics. This avoids a repository-wide extension churn unrelated to the migration.

## Type-safety rules

### No weakening the compiler to finish the migration

The migration must not be completed by disabling strictness in individual modules.

Under `src/**`:

- do not introduce `any` as an escape hatch;
- do not use `// @ts-ignore`;
- prefer `unknown` at external/untrusted boundaries and narrow it with explicit checks;
- use `// @ts-expect-error` only in tests that deliberately prove a compile-time contract, not in production source;
- do not add broad index signatures merely to silence property errors;
- do not cast an object to a target interface until its shape is either constructed locally or validated.

A narrow third-party compatibility declaration is acceptable only when Phaser/Yandex types genuinely lack an API used at runtime, and the declaration must describe only that missing surface.

### Preserve runtime IDs with typed const objects

Existing runtime values remain stable. Prefer this pattern:

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

The same pattern applies to `SolveStatus`, `BoardVariant`, `PlayMode`, `HintType`, global action names, and other runtime string/number registries. Avoid TypeScript `enum` unless a module already requires enum runtime behavior; const-object unions preserve today's serialized/runtime values exactly.

### Typed maps must be complete where completeness matters

Mappings whose correctness depends on every atom/state being covered should use `satisfies`, for example:

```ts
const glyphFrames = {
  [Atom.SALT]: "...",
  // ...
  [Atom.QUINTESSENCE]: "...",
} satisfies Record<AtomType, string>;
```

This is specifically intended to prevent bugs such as assigning a visual entry to numeric key `15` while the actual `Atom.QUINTESSENCE` ID is `16`.

## Domain type boundaries

Types should live beside the module that owns their semantics rather than in one global `types.ts` dumping ground.

### `src/atom-types.ts`

Owns:

```ts
export type AtomType = (typeof Atom)[keyof typeof Atom];
```

All atom arrays/maps (`ELEMENT_TYPES`, `METAL_TYPES`, `PREVIOUS_METAL`, `ATOM_NAMES`) are typed from `AtomType`.

### `src/hex.ts`

Owns:

```ts
export interface HexCoord {
  q: number;
  r: number;
}

export type HexKey = `${number},${number}`;
```

All coordinate helpers consume/return `HexCoord`; `hexKey()` returns `HexKey`.

### `src/board.ts`

Owns the core piece and interaction shapes:

```ts
export interface BoardPiece extends HexCoord {
  type: AtomType;
}

export type LegalMove = readonly BoardPiece[];

export type BoardSelectionKind =
  | "ignored"
  | "selected"
  | "deselected"
  | "removed";

export interface BoardSelectionResult {
  kind: BoardSelectionKind;
  removed: BoardPiece[];
  selected: HexCoord[];
}
```

`GardenBoard` private collections, constructor input, `pieces()`, `legalMoves()`, `select()`, and `toJSON()` become explicit. No rule behavior changes are allowed.

### `src/solver.ts`

Owns:

```ts
export type SolveStatusValue = (typeof SolveStatus)[keyof typeof SolveStatus];

export interface SolverResult {
  status: SolveStatusValue;
  route: readonly LegalMove[];
  visited: number;
}
```

The migration only types the existing meaning of `DEAD_END`; it does not alter how `BoardScene` reacts to it.

### Generator/progression types

`generator.ts`, `progression.ts`, `campaign.ts`, `endless-run.ts`, and `browser.ts` must expose explicit shapes for:

- generated piece arrays;
- plate cells/radius;
- solution certificates;
- campaign/progression level definitions;
- endless-run results;
- generator request/response messages.

The browser worker protocol becomes a discriminated union rather than loosely shaped objects.

Example direction:

```ts
type GeneratorWorkerRequest =
  | { id: number; kind: "progression"; level: number; seed: string }
  | { id: number; kind: "endless-run"; level: number; seed: string }
  | { id: number; kind: "full"; variant: BoardVariantValue; seed: string };
```

The exact fields must match current runtime payloads; migration must not invent new protocol data.

### Persistence and external boundaries

LocalStorage reads and Yandex SDK access are treated as untrusted boundaries.

- parse stored JSON as `unknown`;
- validate/narrow before using it as campaign/economy/settings/leaderboard state;
- define the minimal Yandex SDK interface actually consumed by `src/platform/yandex-games.ts` rather than typing the global as `any`;
- preserve all current fallback behavior when storage or SDK data is unavailable.

## Phaser scene typing

Every scene class explicitly types its persistent fields instead of creating loosely shaped properties in the constructor.

Scene init payloads use module-owned interfaces, for example:

```ts
export interface BoardSceneInitData {
  mode?: PlayModeValue;
  level?: number;
}
```

`init(data: unknown)` must narrow the incoming value before reading it. The same principle applies to `returnScene` payloads for Shop/Settings and any completion/navigation data.

Do not rely on unchecked casts of arbitrary Phaser scene data.

## `BoardScene` responsibility split

The migration uses the current B1 UI as the behavioral baseline. It extracts presentation ownership without redesigning it.

### 1. `src/game/board/BoardHud.ts`

Owns creation/layout/update of the board's top-level HUD presentation:

- pause control;
- level/remaining display;
- campaign/endless score display;
- dust display;
- Shop and Settings utility controls.

It receives callbacks and data from `BoardScene`; it does not own campaign, economy, solver, or navigation state.

Suggested interface:

```ts
export interface BoardHudState {
  mode: PlayModeValue;
  level: number;
  levelCount: number;
  remaining: number;
  initialCount: number;
  dust: number;
  campaignScore: number;
  endlessScore: number;
}

export interface BoardHudActions {
  onPause(): void;
  onShop(): void;
  onSettings(): void;
}
```

`BoardHud` may internally own Phaser display objects and a `layout(width, height)` method, but it must not mutate game-domain state.

### 2. `src/game/board/BoardInventory.ts`

Owns creation/layout/update of the bottom atom inventory and hint/undo controls.

It consumes typed panel/inventory presentation state and emits semantic actions:

```ts
export interface BoardInventoryActions {
  onSelectType(type: AtomType): void;
  onHint(): void;
  onUndo(): void;
  onPurchaseHint(hint: HintTypeValue): void;
}
```

It does not decide whether a move is legal, whether a hint is affordable, or which atoms remain; `BoardScene` supplies those values.

The current B1 visuals/behavior remain unchanged during extraction, including the current filter behavior. The later board-UX spec will replace that interaction.

### 3. `src/game/board/BoardTutorial.ts`

Owns tutorial copy and tutorial-specific presentation objects/target highlights.

It consumes a typed presentation model from `BoardScene`:

```ts
export interface BoardTutorialState {
  visible: boolean;
  step: 0 | 1 | 2;
  english: boolean;
  targetKeys: readonly HexKey[];
}
```

It does not decide whether the tutorial step is complete. `BoardScene` remains responsible for progressing tutorial state based on real board interaction.

The migration preserves the current B1 top tutorial presentation exactly enough for behavior equivalence. The following UX spec will replace it with contextual near-target callouts.

### What remains in `BoardScene.ts`

`BoardScene` remains the orchestration layer for:

- loading/generating a level;
- owning `GardenBoard`;
- interpreting board selection results;
- campaign/endless scoring;
- solver state and known winning routes;
- removal history and undo/rescue behavior;
- economy/ad flow orchestration;
- completion orchestration;
- scene navigation decisions;
- responsive board geometry and piece/cell view orchestration;
- passing typed state into `BoardHud`, `BoardInventory`, and `BoardTutorial`.

The extraction is successful when presentation modules can be restyled/relaid out without needing direct access to `GardenBoard`, progression stores, solver internals, or Phaser scene navigation plugins.

## Migration order

The repository stays runnable after every phase. Do not rename all files at once.

### Phase 1 — TypeScript bootstrap

- add TypeScript/tsx/Node type dependencies;
- add `tsconfig.json` with temporary `allowJs: true`;
- add `pnpm typecheck`;
- make `pnpm test` TypeScript-aware through `tsx`;
- verify the unchanged JS baseline still builds/tests under the new runner before migrating source files.

### Phase 2 — Pure rule/domain foundation

Migrate and type:

- `atom-types`;
- `hex`;
- `rules`;
- `board`.

These modules are renderer-independent and already have strong Node tests. They establish `AtomType`, `HexCoord`, `BoardPiece`, legal move, and selection result contracts used by every later phase.

### Phase 3 — Solver, generation, progression, scoring, economy

Migrate and type the renderer-independent modules that consume Phase 2 contracts:

- solver;
- generator and worker protocol;
- progression/campaign/endless generation;
- scoring;
- economy;
- persistence model modules;
- mode-access and opening/tutorial generation helpers.

No algorithm changes are part of the migration.

### Phase 4 — Browser/platform and presentation models

Migrate/type:

- browser generator wrapper and worker entry;
- Yandex adapter boundary;
- art asset registry;
- scene background;
- panel state;
- presentation model/layout/piece visual state;
- game stores/settings/navigation helpers.

All asset maps keyed by atom/state become compile-time complete where appropriate.

### Phase 5 — Shared Phaser UI and simple scenes

Migrate/type:

- `game/ui`;
- completion overlay;
- Menu;
- Level Select;
- Shop;
- Settings;
- Leaderboard.

Explicitly type reusable controls (`AtlasButton`, renderer surfaces, currency displays) and each scene's init/navigation payloads.

### Phase 6 — Extract and migrate Board presentation modules

Create the three focused modules:

- `game/board/BoardHud.ts`;
- `game/board/BoardInventory.ts`;
- `game/board/BoardTutorial.ts`.

Move current B1 presentation creation/layout/update logic into them with no UX redesign. Add renderer-independent tests for any newly extracted pure layout/presentation functions; do not add screenshot or pixel-diff tests.

### Phase 7 — Migrate `BoardScene`, entries, and close the mixed-source window

Migrate:

- `game/scenes/BoardScene`;
- `main`;
- `index`;
- any remaining `src/**/*.js` runtime module.

Then:

- set `allowJs: false`;
- change TypeScript include to `src/**/*.ts`;
- verify `find src -name '*.js'` returns no runtime source files;
- retain `.js` import specifiers inside `.ts` modules;
- keep repository scripts as `.mjs` unless they directly require migration.

## Testing strategy

### Existing behavioral tests remain authoritative

The migration should make the current test suite pass without changing expected gameplay outputs. Existing rule/generator/solver/progression/economy/persistence/presentation tests are behavior regression protection.

Do not rewrite a failing behavioral expectation just to satisfy the compiler.

### Add compile-time contract fixtures only where they catch migration-specific risk

High-value migration tests/checks include:

- `ATOM_GLYPH_FRAMES`/equivalent mapping satisfies `Record<AtomType, ...>`;
- worker request/response handlers exhaustively narrow all supported message kinds;
- scene init payloads are explicitly narrowed from `unknown`;
- persistence parsers return typed defaults for malformed/unavailable data.

Prefer `tsc --noEmit` itself over bespoke “type tests” when a normal production declaration can express the contract.

### No visual lock-in tests

Do not introduce:

- screenshots;
- pixel diffs;
- assertions for exact colors, coordinates, PNG filenames, or current provisional asset pack;
- tests that would prevent later UI/asset redesign while semantic behavior remains correct.

### Verification gates

At the end of every migration phase:

1. `pnpm typecheck` must exit 0 for all source migrated so far;
2. the relevant focused tests must pass;
3. `pnpm test` should be run at checkpoints when practical;
4. `pnpm build` must exit 0 before the migration is considered complete.

The repository has a known historical issue where `test/progression.test.js` can take an unusually long time or hang in some environments. This migration must not silently skip or delete that test. If it remains slow, report it separately from TypeScript migration status rather than weakening the suite.

## Completion criteria

The TypeScript migration is complete only when all of the following are true:

- every runtime source file under `src/**` is `.ts`;
- `tsconfig.json` has `strict: true` and final `allowJs: false`;
- `pnpm typecheck` succeeds without production `any`/`@ts-ignore` escape hatches;
- `pnpm build` succeeds;
- existing behavioral tests pass, subject only to separately reported pre-existing progression-test runtime issues;
- core serialized/runtime IDs and strings are unchanged;
- `src/index.ts` preserves the current public exports;
- `BoardScene.ts` delegates HUD, inventory, and tutorial presentation to focused modules;
- the extracted presentation modules do not own gameplay rules, solver decisions, progression stores, or scene navigation state;
- no visual/pixel tests constrain the next redesign;
- `CURRENT_STATE.md` records that runtime source is TypeScript and that the next phase is the board UX/contextual tutorial/spiral-intro redesign.

## Follow-up phase after this migration

Once this migration is green, create a separate design/implementation cycle for the board UX redesign already agreed in conversation. That next phase will address:

- removal of full-width top and bottom chrome bars;
- floating HUD/action groups;
- contextual tutorial callouts next to the actual pieces/cells;
- removal of inventory badge overlap and dim-everything filtering;
- explicit distinction between “position cannot be fully solved” and “no legal moves remain”;
- direct in-board restart access when recovery is needed;
- the centre-out spiral board-fill intro with live free/locked visual transitions and skip-on-input.

Keeping this follow-up separate ensures any behavior regression can be attributed either to language/type migration or to the later UX changes, rather than both changing simultaneously.
