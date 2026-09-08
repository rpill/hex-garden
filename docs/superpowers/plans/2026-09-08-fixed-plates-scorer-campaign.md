# Fixed Plates, Difficulty Scorer, and Campaign Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 24-level mechanic/shape progression with a reusable fixed-plate puzzle candidate pipeline and a provisional frozen 50-level campaign matching the approved 37/61/91 schedule.

**Architecture:** Introduce small domain modules for canonical plates and difficulty profiles, then extract the useful scorer logic from `progression.ts` into a progression-agnostic analyzer. Candidate generation uses one canonical full plate for presentation and a connected occupancy mask without named shape families; campaign generation is an offline authoring tool whose selected output is frozen as data consumed by runtime.

**Tech Stack:** TypeScript, Node >=20, `node:test`, existing `GardenBoard`, solver/generator infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- Preserve all audited pairing/freedom/metal rules.
- Canonical public plate radii are exactly 3/4/5 with 37/61/91 cells.
- Campaign has exactly 50 fixed levels and the exact plate schedule in the spec.
- Do not expose old `compact/wide/diagonal/branches/hollow` or rotational shape families as campaign variety.
- Size controls duration/information volume; difficulty is measured separately.
- V1 scorer keeps freedom/risk/deception/route-win metrics and adds consequence depth; explicit metal-pressure scoring is deferred.
- Campaign runtime reads frozen level records; it must not generate a different campaign for different players.
- No final art changes in this plan.

---

### Task 1: Canonical plate domain and 50-level schedule

**Files:**
- Create: `src/plates.ts`
- Modify: `src/index.ts`
- Test: `test/plates.test.js`

**Interfaces:**
- Produces: `PlateSize`, `PlateSizeValue`, `PlateSpec`, `PLATE_SPECS`, `CAMPAIGN_PLATE_SCHEDULE`, `plateSpec(size)`, `campaignPlateSize(level)`.
- Consumes: `enumerateHexPlate(radius)` from `src/hex.ts` only in tests/consumers; `src/plates.ts` remains data-only.

- [ ] **Step 1: Write the failing plate contract test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_PLATE_SCHEDULE,
  PlateSize,
  campaignPlateSize,
  enumerateHexPlate,
  plateSpec,
} from "../src/index.js";

test("canonical plates are exactly 37, 61, and 91 cells", () => {
  assert.equal(enumerateHexPlate(plateSpec(PlateSize.SMALL).radius).length, 37);
  assert.equal(enumerateHexPlate(plateSpec(PlateSize.MEDIUM).radius).length, 61);
  assert.equal(enumerateHexPlate(plateSpec(PlateSize.LARGE).radius).length, 91);
});

test("campaign plate schedule is the approved 50-level schedule", () => {
  assert.equal(CAMPAIGN_LEVEL_COUNT, 50);
  assert.equal(CAMPAIGN_PLATE_SCHEDULE.length, 50);
  assert.deepEqual(CAMPAIGN_PLATE_SCHEDULE.map((size) => plateSpec(size).cellCount), [
    37,37,37,37,37,37,37,61,37,61,
    37,61,61,37,61,61,37,61,61,61,
    61,61,37,61,61,91,61,37,61,91,
    61,37,61,91,61,61,37,91,61,91,
    61,91,37,61,91,61,37,91,61,91,
  ]);
  assert.equal(campaignPlateSize(0), PlateSize.SMALL);
  assert.equal(campaignPlateSize(49), PlateSize.LARGE);
  assert.throws(() => campaignPlateSize(-1), RangeError);
  assert.throws(() => campaignPlateSize(50), RangeError);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --import tsx --test test/plates.test.js
```

Expected: FAIL because `src/plates.ts` exports do not exist.

- [ ] **Step 3: Implement the canonical plate module**

```ts
export const CAMPAIGN_LEVEL_COUNT = 50;

export const PlateSize = Object.freeze({
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const);
export type PlateSizeValue = (typeof PlateSize)[keyof typeof PlateSize];

export interface PlateSpec {
  size: PlateSizeValue;
  radius: 3 | 4 | 5;
  cellCount: 37 | 61 | 91;
  minPieces: number;
  maxPieces: number;
}

export const PLATE_SPECS: Readonly<Record<PlateSizeValue, Readonly<PlateSpec>>> = Object.freeze({
  small: Object.freeze({ size: PlateSize.SMALL, radius: 3, cellCount: 37, minPieces: 21, maxPieces: 33 }),
  medium: Object.freeze({ size: PlateSize.MEDIUM, radius: 4, cellCount: 61, minPieces: 31, maxPieces: 47 }),
  large: Object.freeze({ size: PlateSize.LARGE, radius: 5, cellCount: 91, minPieces: 43, maxPieces: 55 }),
});

export const CAMPAIGN_PLATE_SCHEDULE = Object.freeze([
  "small","small","small","small","small","small","small","medium","small","medium",
  "small","medium","medium","small","medium","medium","small","medium","medium","medium",
  "medium","medium","small","medium","medium","large","medium","small","medium","large",
  "medium","small","medium","large","medium","medium","small","large","medium","large",
  "medium","large","small","medium","large","medium","small","large","medium","large",
] as const satisfies readonly PlateSizeValue[]);

export function plateSpec(size: PlateSizeValue): Readonly<PlateSpec> {
  const spec = PLATE_SPECS[size];
  if (!spec) throw new RangeError(`Unknown plate size: ${String(size)}`);
  return spec;
}

export function campaignPlateSize(level: number): PlateSizeValue {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`);
  }
  const size = CAMPAIGN_PLATE_SCHEDULE[level];
  if (!size) throw new Error(`Campaign plate schedule is missing level ${level + 1}`);
  return size;
}
```

Export these names from `src/index.ts`.

- [ ] **Step 4: Run the focused test**

```bash
node --import tsx --test test/plates.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/plates.ts src/index.ts test/plates.test.js
git commit -m "feat: define canonical campaign plates"
```

---

### Task 2: Progression-agnostic difficulty analyzer

**Files:**
- Create: `src/difficulty.ts`
- Modify: `src/progression.ts`
- Modify: `src/index.ts`
- Test: `test/difficulty.test.js`
- Modify: `test/progression.test.js`

**Interfaces:**
- Produces: `DifficultyInput`, `DifficultyMetrics`, `analyzePuzzleDifficulty(input)`.
- Consumes: `GardenBoard`, `findWinningRoute` semantics, current deterministic rollout helpers moved from `src/progression.ts`.
- Later tasks consume `initial/averageMeaningfulMoveCount`, `earlyRiskyDecisionSteps`, `earlyDeceptiveDecisionSteps`, `sampledRouteWinProbability`, `consequenceDepthMedian`, and `consequenceDepthMax`.

- [ ] **Step 1: Add a failing analyzer API test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { analyzePuzzleDifficulty, generateProgressionLevel } from "../src/index.js";

test("difficulty analysis is independent of progression chapter metadata", () => {
  const record = generateProgressionLevel(4, { campaignSeed: "difficulty-api" });
  const metrics = analyzePuzzleDifficulty({
    pieces: record.pieces,
    solution: record.solution,
    plateCells: record.plateCells,
    sampleSeed: "difficulty-api",
  });
  assert.ok(metrics.initialLegalMoveCount >= 0);
  assert.ok(metrics.averageMeaningfulMoveCount >= 0);
  assert.ok(metrics.earlyRiskyDecisionSteps >= 0);
  assert.ok(metrics.earlyDeceptiveDecisionSteps >= 0);
  assert.ok(metrics.sampledRouteWinProbability >= 0 && metrics.sampledRouteWinProbability <= 1);
  assert.ok(metrics.consequenceDepthMedian === null || metrics.consequenceDepthMedian >= 1);
  assert.ok(metrics.consequenceDepthMax === null || metrics.consequenceDepthMax >= metrics.consequenceDepthMedian);
});
```

- [ ] **Step 2: Verify failure**

```bash
node --import tsx --test test/difficulty.test.js
```

Expected: FAIL because `analyzePuzzleDifficulty` does not exist.

- [ ] **Step 3: Extract the existing generic analysis helpers**

Move, without changing their deterministic behavior, the generic logic currently used by `analyzeProgressionDifficulty` into `src/difficulty.ts`:

```ts
export interface DifficultyInput {
  pieces: readonly BoardPiece[];
  solution: readonly (readonly HexCoord[])[];
  plateCells: readonly HexCoord[];
  sampleSeed: string;
}

export interface DifficultyMetrics {
  pieceCount: number;
  moveCount: number;
  plateFill: number;
  initialFreeCount: number;
  initialLegalMoveCount: number;
  minimumLegalMoveCount: number;
  maximumLegalMoveCount: number;
  averageLegalMoveCount: number;
  forcedCertificateSteps: number;
  initialMeaningfulMoveCount: number;
  minimumMeaningfulMoveCount: number;
  maximumMeaningfulMoveCount: number;
  averageMeaningfulMoveCount: number;
  sampledRouteWinProbability: number;
  earlyDecisionStepsAnalyzed: number;
  earlyChoiceSteps: number;
  earlyRiskyAlternativeMoves: number;
  earlyRiskyDecisionSteps: number;
  firstRiskyDecisionStep: number | null;
  earlyDeceptiveRiskyMoves: number;
  earlyDeceptiveDecisionSteps: number;
  firstDeceptiveRiskStep: number | null;
  consequenceDepthSamples: number;
  consequenceDepthMedian: number | null;
  consequenceDepthMax: number | null;
}
```

Keep the current `moveTypeSignature`, deterministic seeded rollout, and early-alternative cap of six. `src/progression.ts` may temporarily wrap the new analyzer so old tests remain green until legacy progression is removed in Plan 6.

- [ ] **Step 4: Add deterministic consequence-depth sampling**

For each early alternative already classified as risky (`rolloutWinProbability <= 0.25`), run eight deterministic continuations capped at twelve removals. Count only continuations that reach a **visible** dead end (`!board.won && board.legalMoves().length === 0`). Record the number of removals from the risky alternative to that visible dead end.

Implement this helper in `src/difficulty.ts`:

```ts
function sampledDeadEndDepths(
  start: GardenBoard,
  seed: string,
  { samples = 8, maxDepth = 12 }: { samples?: number; maxDepth?: number } = {},
): number[] {
  const depths: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    const random = createSeededRandom(`${seed}:depth:${sample}`);
    const board = start.clone();
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const moves = board.legalMoves();
      if (moves.length === 0) {
        if (!board.won) depths.push(depth - 1);
        break;
      }
      const move = moves[Math.floor(random() * moves.length)];
      if (!move) break;
      applyMove(board, move);
      if (board.won) break;
      if (board.legalMoves().length === 0) {
        depths.push(depth);
        break;
      }
    }
  }
  return depths;
}
```

Aggregate all risky-alternative depth samples, sort them, and expose median/max or `null` when no sampled risky branch reaches visible failure inside the cap.

- [ ] **Step 5: Make `analyzeProgressionDifficulty` a compatibility wrapper**

Replace its chapter-specific metric assembly with:

```ts
const generic = analyzePuzzleDifficulty({
  pieces: record.pieces,
  solution: record.solution,
  plateCells: record.plateCells,
  sampleSeed: record.seed,
});
```

Retain only old `challengeScore/challengeQualified` compatibility fields in `src/progression.ts` until Plan 6 deletes them.

- [ ] **Step 6: Run difficulty + progression regression tests**

```bash
node --import tsx --test test/difficulty.test.js test/progression.test.js test/solver.test.js test/rules.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/difficulty.ts src/progression.ts src/index.ts test/difficulty.test.js test/progression.test.js
git commit -m "refactor: extract puzzle difficulty analysis"
```

---

### Task 3: Canonical candidate generator without named occupancy families

**Files:**
- Create: `src/puzzle-generation.ts`
- Modify: `src/generator-worker.ts`
- Modify: `src/browser.ts`
- Modify: `src/index.ts`
- Test: `test/puzzle-generation.test.js`

**Interfaces:**
- Produces: `PuzzleComposition`, `PuzzleCandidateOptions`, `GeneratedPuzzleCandidate`, `generatePuzzleCandidate(options)`.
- `GeneratedPuzzleCandidate.plateCells` is always the complete `enumerateHexPlate(radius)` result; occupied `pieces` are a subset.
- Later tasks consume `generatePuzzleCandidate` for authoring, Daily, and Endless.

- [ ] **Step 1: Write failing canonical-generation tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  Atom,
  PlateSize,
  generatePuzzleCandidate,
  hexKey,
  plateSpec,
  replaySolution,
} from "../src/index.js";

const fullStandardComposition = Object.freeze({
  saltPairCount: 1,
  saltElementPairCount: 1,
  oppositePairCount: 2,
  metalDepth: 6,
});

test("canonical candidate exposes the full plate even when occupancy is smaller", () => {
  const record = generatePuzzleCandidate({
    seed: "canonical-medium",
    plateSize: PlateSize.MEDIUM,
    targetPieceCount: 43,
    composition: fullStandardComposition,
  });
  assert.equal(record.plateCells.length, 61);
  assert.equal(record.pieces.length, 43);
  const plate = new Set(record.plateCells.map(hexKey));
  assert.equal(record.pieces.every((piece) => plate.has(hexKey(piece))), true);
  assert.equal(replaySolution(record.pieces, record.solution), true);
  assert.equal(record.pieces.some((piece) => piece.type === Atom.GOLD), true);
  assert.equal(record.shape, undefined);
});

test("candidate generation rejects impossible parity/count requests", () => {
  assert.throws(() => generatePuzzleCandidate({
    seed: "bad-count",
    plateSize: PlateSize.SMALL,
    targetPieceCount: 22,
    composition: fullStandardComposition,
  }), /piece count/i);
});
```

- [ ] **Step 2: Verify failure**

```bash
node --import tsx --test test/puzzle-generation.test.js
```

Expected: FAIL because the candidate API does not exist.

- [ ] **Step 3: Implement composition scheduling**

Create `src/puzzle-generation.ts` with the standard-rule composition contract:

```ts
export interface PuzzleComposition {
  saltPairCount: number;
  saltElementPairCount: number;
  oppositePairCount: number;
  metalDepth: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export interface PuzzleCandidateOptions {
  seed: string;
  plateSize: PlateSizeValue;
  targetPieceCount: number;
  composition: Readonly<PuzzleComposition>;
  maskAttempts?: number;
  placementAttempts?: number;
}

export interface GeneratedPuzzleCandidate {
  seed: string;
  variant: typeof BoardVariant.STANDARD;
  plateSize: PlateSizeValue;
  plateRadius: 3 | 4 | 5;
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  board: GardenBoard;
}
```

Build ordinary move specs from Salt, Salt+element, Vitae/Mors, and cyclic element pairs. Interleave the existing metal chain exactly as current `interleaveMetalSpecs` does. When `metalDepth === 6`, include Gold as the final one-piece move. Derive the number of ordinary element pairs required to hit `targetPieceCount`; throw when the requested count cannot match the composition parity or plate capacity.

- [ ] **Step 4: Implement one neutral connected-mask generator**

Port the connected-growth logic from current `growConnectedMask`, but remove `MaskFamily` and every family-specific scoring branch. Use only:

```ts
const structureScore = adjacentSelected * 1.1 - radius * 0.18 + random() * 3.2;
```

Start from `BOARD_CENTER`, grow to `targetPieceCount`, then use the current reverse `assignSchedule` approach. Always return the **full** plate from `enumerateHexPlate(spec.radius)` as `plateCells`; the occupancy mask is internal and is not returned as a named shape.

- [ ] **Step 5: Add a worker request for generic candidates**

Extend `src/generator-worker.ts` with:

```ts
type GeneratorWorkerRequest =
  | { requestId: number; kind: "puzzle-candidate"; options: PuzzleCandidateOptions }
  | /* existing temporary compatibility requests */;
```

and `src/browser.ts` with:

```ts
generatePuzzleCandidate(options: PuzzleCandidateOptions): Promise<BrowserResult<GeneratedPuzzleCandidate>> {
  return this.#request({ kind: "puzzle-candidate", options });
}
```

Keep old worker request kinds until their callers are migrated by later plans.

- [ ] **Step 6: Run generation/rules tests**

```bash
node --import tsx --test test/puzzle-generation.test.js test/generator.test.js test/rules.test.js test/solver.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/puzzle-generation.ts src/generator-worker.ts src/browser.ts src/index.ts test/puzzle-generation.test.js
git commit -m "feat: add canonical puzzle candidate generator"
```

---

### Task 4: Difficulty profiles and relative candidate ranking

**Files:**
- Create: `src/difficulty-profiles.ts`
- Modify: `src/index.ts`
- Test: `test/difficulty-profiles.test.js`

**Interfaces:**
- Produces: `CampaignChapter`, `CampaignChapterValue`, `DifficultyProfile`, `CAMPAIGN_DIFFICULTY_PROFILES`, `CAMPAIGN_DIFFICULTY_RHYTHM`, `campaignChapterForLevel(level)`, `campaignDifficultyProfile(level)`, `rankCandidatesForProfile(candidates, profile)`.
- Consumes `DifficultyMetrics` from Task 2.

- [ ] **Step 1: Write failing chapter/profile tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_DIFFICULTY_PROFILES,
  CampaignChapter,
  campaignChapterForLevel,
} from "../src/index.js";

test("campaign chapters are five fixed groups of ten", () => {
  assert.equal(campaignChapterForLevel(0), CampaignChapter.BASICS);
  assert.equal(campaignChapterForLevel(9), CampaignChapter.BASICS);
  assert.equal(campaignChapterForLevel(10), CampaignChapter.PLANNING);
  assert.equal(campaignChapterForLevel(49), CampaignChapter.MASTERY);
});

test("false-moves profile values deception more than basics", () => {
  assert.ok(
    CAMPAIGN_DIFFICULTY_PROFILES.falseMoves.weights.deception >
    CAMPAIGN_DIFFICULTY_PROFILES.basics.weights.deception,
  );
});
```

- [ ] **Step 2: Verify failure**

```bash
node --import tsx --test test/difficulty-profiles.test.js
```

- [ ] **Step 3: Implement chapter identities and profile weights**

Use these V1 profiles:

```ts
export const CampaignChapter = Object.freeze({
  BASICS: "basics",
  PLANNING: "planning",
  ORDER: "order",
  FALSE_MOVES: "falseMoves",
  MASTERY: "mastery",
} as const);

export interface DifficultyProfile {
  weights: Readonly<{ freedom: number; risk: number; deception: number; consequence: number; route: number }>;
  target: Readonly<{ freedom: number; risk: number; deception: number; consequence: number; routeWin: number }>;
}

export const CAMPAIGN_DIFFICULTY_PROFILES = Object.freeze({
  basics:      Object.freeze({ weights: { freedom: 0.30, risk: 0.20, deception: 0.05, consequence: 0.15, route: 0.30 }, target: { freedom: 0.75, risk: 0.20, deception: 0.10, consequence: 0.15, routeWin: 0.65 } }),
  planning:    Object.freeze({ weights: { freedom: 0.25, risk: 0.25, deception: 0.10, consequence: 0.20, route: 0.20 }, target: { freedom: 0.60, risk: 0.40, deception: 0.20, consequence: 0.30, routeWin: 0.50 } }),
  order:       Object.freeze({ weights: { freedom: 0.20, risk: 0.30, deception: 0.15, consequence: 0.20, route: 0.15 }, target: { freedom: 0.52, risk: 0.58, deception: 0.38, consequence: 0.42, routeWin: 0.38 } }),
  falseMoves:  Object.freeze({ weights: { freedom: 0.15, risk: 0.30, deception: 0.30, consequence: 0.15, route: 0.10 }, target: { freedom: 0.55, risk: 0.72, deception: 0.72, consequence: 0.55, routeWin: 0.25 } }),
  mastery:     Object.freeze({ weights: { freedom: 0.15, risk: 0.30, deception: 0.25, consequence: 0.20, route: 0.10 }, target: { freedom: 0.48, risk: 0.80, deception: 0.75, consequence: 0.70, routeWin: 0.18 } }),
} as const satisfies Readonly<Record<string, DifficultyProfile>>);
```

Add the approved within-chapter rhythm as a deterministic target adjustment:

```ts
export const CAMPAIGN_DIFFICULTY_RHYTHM = Object.freeze([
  0.00, 0.08, 0.16, -0.06, 0.24, 0.05, 0.22, 0.32, 0.10, 0.40,
] as const);

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function campaignDifficultyProfile(level: number): Readonly<DifficultyProfile> {
  const chapter = campaignChapterForLevel(level);
  const base = CAMPAIGN_DIFFICULTY_PROFILES[chapter];
  const delta = CAMPAIGN_DIFFICULTY_RHYTHM[level % 10] ?? 0;
  return Object.freeze({
    weights: base.weights,
    target: Object.freeze({
      freedom: clamp01(base.target.freedom - delta * 0.35),
      risk: clamp01(base.target.risk + delta),
      deception: clamp01(base.target.deception + delta * 0.85),
      consequence: clamp01(base.target.consequence + delta * 0.75),
      routeWin: clamp01(base.target.routeWin - delta * 0.35),
    }),
  });
}
```

`rankCandidatesForProfile` must normalize each raw axis to a 0..1 percentile **within candidates of the same plate size**, then score distance to the target weighted by `weights`. Lower weighted distance ranks first. Reject candidates with `averageMeaningfulMoveCount < 1.5`, `sampledRouteWinProbability <= 0.01`, or `consequenceDepthMax !== null && consequenceDepthMax > 12`.

- [ ] **Step 4: Add a deterministic ranking test with synthetic metrics**

Create three synthetic same-size candidates and assert the candidate closest to `falseMoves.target` ranks first; include a fourth candidate with `averageMeaningfulMoveCount: 1` and assert it is rejected.

- [ ] **Step 5: Run focused tests**

```bash
node --import tsx --test test/difficulty-profiles.test.js test/difficulty.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/difficulty-profiles.ts src/index.ts test/difficulty-profiles.test.js
git commit -m "feat: rank puzzle candidates by difficulty profile"
```

---

### Task 5: Offline campaign shortlist/freeze tooling

**Files:**
- Create: `scripts/generate-campaign-shortlist.mjs`
- Create: `scripts/freeze-campaign.mjs`
- Create: `src/campaign-levels.ts`
- Create: `src/data/campaign-levels.json`
- Modify: `package.json`
- Modify: `src/campaign.ts`
- Modify: `src/index.ts`
- Test: `test/campaign.test.js`

**Interfaces:**
- Produces runtime `CampaignLevelRecord`, `CAMPAIGN_LEVELS`, `getCampaignLevel(level)`.
- `generateCampaignLevel` becomes a compatibility alias for `getCampaignLevel` during migration; no runtime RNG is used for Campaign.
- Authoring scripts consume Tasks 1–4 and write JSON; runtime imports only frozen JSON/data helpers.

- [ ] **Step 1: Replace campaign runtime tests with the fixed-content contract**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_LEVEL_COUNT,
  CAMPAIGN_LEVELS,
  campaignPlateSize,
  getCampaignLevel,
  hexKey,
  plateSpec,
  replaySolution,
} from "../src/index.js";

test("campaign is fifty fixed certificate-solvable levels", () => {
  assert.equal(CAMPAIGN_LEVELS.length, CAMPAIGN_LEVEL_COUNT);
  for (let level = 0; level < CAMPAIGN_LEVEL_COUNT; level += 1) {
    const record = getCampaignLevel(level);
    const expected = plateSpec(campaignPlateSize(level));
    assert.equal(record.level, level);
    assert.equal(record.plateRadius, expected.radius);
    assert.equal(record.plateCells.length, expected.cellCount);
    assert.equal(replaySolution(record.pieces, record.solution), true);
    const plate = new Set(record.plateCells.map(hexKey));
    assert.equal(record.pieces.every((piece) => plate.has(hexKey(piece))), true);
    assert.deepEqual(getCampaignLevel(level).pieces, record.pieces);
  }
});
```

- [ ] **Step 2: Verify the test fails against current runtime generation**

```bash
node --import tsx --test test/campaign.test.js
```

- [ ] **Step 3: Implement the shortlist authoring script**

Add package script:

```json
"author:campaign": "node --import tsx scripts/generate-campaign-shortlist.mjs",
"freeze:campaign": "node --import tsx scripts/freeze-campaign.mjs"
```

`generate-campaign-shortlist.mjs` must, for each level 0..49:

1. read `campaignPlateSize(level)`;
2. choose deterministic target occupancy inside that plate's approved range using seed `campaign-v2:level:<level>`; if the composition contains Gold choose an odd count, otherwise choose an even count, so requested counts are always representable;
3. generate 64 candidates for small, 48 for medium, 32 for large;
4. analyze each with `analyzePuzzleDifficulty`;
5. rank by `campaignDifficultyProfile(level)` so the approved ten-level rhythm is present inside every chapter;
6. write the best five candidates per level to `build/campaign-shortlist.json` with pieces, solution, metrics, seed, level, plate size/radius.

Use full standard composition for levels 6+; Levels 1–5 may use simplified compositions, but the rules engine itself remains unchanged. For the provisional functional build use:

```js
const onboardingComposition = [
  { saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 0, metalDepth: 0 },
  { saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 0, metalDepth: 0 },
  { saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 1, metalDepth: 0 },
  { saltPairCount: 0, saltElementPairCount: 0, oppositePairCount: 1, metalDepth: 3 },
  { saltPairCount: 1, saltElementPairCount: 1, oppositePairCount: 1, metalDepth: 3 },
];
```

For Levels 6–50 use `{ saltPairCount: 1, saltElementPairCount: 1, oppositePairCount: 2, metalDepth: 6 }`.

- [ ] **Step 4: Implement the deterministic provisional freeze script**

`freeze-campaign.mjs` reads `build/campaign-shortlist.json` and, when no explicit selection file is supplied, chooses candidate index 0 for every level. It writes `src/data/campaign-levels.json` with exactly 50 records. Support a later curation input:

```bash
pnpm freeze:campaign -- --selection build/campaign-selection.json
```

where `campaign-selection.json` is exactly:

```json
{"levels":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}
```

Each integer is 0..4 and chooses one shortlist candidate. Validate length/range before writing.

- [ ] **Step 5: Implement runtime fixed-data access**

In `src/campaign-levels.ts`:

```ts
export interface CampaignLevelRecord {
  level: number;
  seed: string;
  plateSize: PlateSizeValue;
  plateRadius: 3 | 4 | 5;
  plateCells: HexCoord[];
  pieces: BoardPiece[];
  solution: Solution;
  difficulty: DifficultyMetrics;
}

export const CAMPAIGN_LEVELS: readonly Readonly<CampaignLevelRecord>[] = /* normalized frozen JSON */;

export function getCampaignLevel(level: number): Readonly<CampaignLevelRecord> {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) throw new RangeError(/* exact range */);
  const record = CAMPAIGN_LEVELS[level];
  if (!record) throw new Error(`Missing campaign level ${level + 1}`);
  return record;
}
```

`src/campaign.ts` should expose `getCampaignLevel`; temporarily implement `generateCampaignLevel(level)` as `return getCampaignLevel(level)` so solver tests/callers migrate without a large simultaneous break.

- [ ] **Step 6: Generate and freeze the provisional campaign**

```bash
pnpm author:campaign
pnpm freeze:campaign
```

Expected: `src/data/campaign-levels.json` contains 50 fixed records and does not change when the two commands are repeated with the same code/seeds.

- [ ] **Step 7: Run campaign/generation regression tests**

```bash
node --import tsx --test test/campaign.test.js test/plates.test.js test/difficulty.test.js test/puzzle-generation.test.js test/solver.test.js
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/generate-campaign-shortlist.mjs scripts/freeze-campaign.mjs src/campaign.ts src/campaign-levels.ts src/data/campaign-levels.json src/index.ts test/campaign.test.js
git commit -m "feat: freeze fifty-level campaign content"
```

---

### Task 6: Browser/worker campaign loading no longer generates runtime campaign content

**Files:**
- Modify: `src/browser.ts`
- Modify: `src/generator-worker.ts`
- Test: `test/progression.test.js`
- Test: `test/campaign.test.js`

**Interfaces:**
- Campaign consumers call `getCampaignLevel(level)` synchronously.
- Worker remains for generic candidate/Daily/Endless generation only.

- [ ] **Step 1: Add a regression test that Campaign needs no worker request**

In `test/campaign.test.js`, instantiate `getCampaignLevel(0)` in an environment with no `Worker` and assert it succeeds and replays to completion.

- [ ] **Step 2: Remove Campaign generation request from `BrowserLevelGenerator`**

Delete the generic `generate(level, campaignSeed/variant)` runtime path once all current BoardScene campaign callers are switched in Plan 3. For this task, mark it deprecated but make it simply resolve fixed data without posting to the worker:

```ts
generate(level: number): Promise<BrowserResult<CampaignLevel>> {
  const record = getCampaignLevel(level);
  return Promise.resolve({ ...record, board: new GardenBoard(record.pieces) });
}
```

- [ ] **Step 3: Keep worker compatibility only for current progression/endless until their later migration**

Do not delete `progression`/`endless-run` kinds yet; Plan 5/6 owns that cleanup.

- [ ] **Step 4: Run the focused suite**

```bash
node --import tsx --test test/campaign.test.js test/progression.test.js
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add src/browser.ts src/generator-worker.ts test/campaign.test.js
git commit -m "refactor: load campaign from frozen data"
```

## Plan 1 completion check

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Manual check: inspect several 37/61/91 provisional campaign levels and confirm the **full regular plate** is available in level data even when only part of it is occupied. Do not judge final visuals yet.
