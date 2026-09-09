# Endless Clean Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guest-visible Yandex Games Endless Clean leaderboard with explicit opt-in Yandex authorization, no-score-downgrade synchronization, and automatic publication only when a new unassisted Endless record is achieved.

**Architecture:** Extend the existing Yandex adapter with app-owned auth/leaderboard primitives, keep ranking policy in a renderer-independent `EndlessLeaderboardService`, expose one shared service through Phaser registry, and render a dedicated `LeaderboardScene`. Home only exposes the ranking after Endless unlock; Board only reports a newly improved clean best to the service and never calls raw Yandex SDK leaderboard APIs.

**Tech Stack:** TypeScript, Phaser 3, Yandex Games SDK, Node test runner (`node --test`), existing primitive UI helpers.

**Spec:** `docs/superpowers/specs/2026-09-09-endless-clean-leaderboard-design.md`

## Global Constraints

- Technical leaderboard name is exactly `endless_clean_boards`.
- Console configuration: numeric score, decimal offset `0`, descending order.
- Public top 10 is visible to guests; authorization is never automatic.
- `ysdk.auth.openAuthDialog()` is invoked only after an explicit in-game sign-in action that explains the benefit.
- Only `bestUnassistedBoards` is rankable. Assisted records, old score concepts, multipliers, streaks, and level scores are never submitted.
- Player Data remains the canonical persistence path; leaderboard scores are never imported into `EndlessProgressStore`.
- Never overwrite a higher remote leaderboard score with a lower local score.
- Missing leaderboard (including 404), unavailable SDK methods, auth cancellation, and network failures are non-fatal.
- Do not request profile scopes or persist Yandex names/IDs/avatar URLs.
- Do not add Daily leaderboard or avatars in this plan.
- Keep current lifecycle, ads, sticky-banner, Player Data, Campaign/Daily/Endless behavior intact.
- Use TDD for every production behavior change.

---

## File Structure

- `src/platform/yandex-games.ts` — normalized Yandex auth and leaderboard primitives; no product-specific Endless policy.
- `src/endless-leaderboard.ts` — renderer-independent leaderboard policy and synchronization.
- `src/game/endless-leaderboard.ts` — Phaser registry accessor for the shared service.
- `src/game/scenes/LeaderboardScene.ts` — leaderboard UI, guest/auth/unavailable states, sign-in CTA, retry, contextual menu.
- `src/game/presentation-model.ts` — allow `leaderboard` as a utility return root so Rules/Settings can return without leaving paused scenes behind.
- `src/game/scenes/MenuScene.ts` — add contextual `РЕЙТИНГ / LEADERBOARD` only after Endless unlock.
- `src/game/scenes/BoardScene.ts` — publish only an improved unassisted Endless best and never await publication before showing result UI.
- `src/main.ts` — register `LeaderboardScene`.
- `test/yandex-leaderboard.test.js` — adapter auth/leaderboard tests.
- `test/endless-leaderboard.test.js` — policy/service tests.
- `test/leaderboard-scene-contract.test.js` — scene registration, menu visibility, utility navigation, sticky/banner/context-menu source contracts.
- `test/endless-leaderboard-publication.test.js` — Board publication source/runtime contract.
- `AGENTS.md`, `PROJECT.md`, `CURRENT_STATE.md`, `VALIDATION.md` — product truth and manual acceptance.

---

### Task 1: Yandex auth and leaderboard adapter primitives

**Files:**
- Modify: `src/platform/yandex-games.ts`
- Create: `test/yandex-leaderboard.test.js`

**Interfaces:**
- Produces:
  - `export interface LeaderboardEntry { rank: number; score: number; publicName: string; uniqueId: string }`
  - `export type AuthorizationResult = "authorized" | "guest" | "unavailable"`
  - `export type LeaderboardEntriesResult = { status: "ready"; entries: readonly LeaderboardEntry[] } | { status: "unavailable"; entries: readonly LeaderboardEntry[] }`
  - `export type LeaderboardPlayerEntryResult = { status: "ready"; entry: LeaderboardEntry } | { status: "not-present"; entry: null } | { status: "unavailable"; entry: null }`
  - `YandexGamesAdapter.isPlayerAuthorized(): Promise<boolean>`
  - `YandexGamesAdapter.requestPlayerAuthorization(): Promise<AuthorizationResult>`
  - `YandexGamesAdapter.getLeaderboardEntries(name: string, quantityTop?: number): Promise<LeaderboardEntriesResult>`
  - `YandexGamesAdapter.getLeaderboardPlayerEntry(name: string): Promise<LeaderboardPlayerEntryResult>`
  - `YandexGamesAdapter.setLeaderboardScore(name: string, score: number): Promise<boolean>`
- Consumes: existing `initialize()` and cached `#getPlayer()` behavior.

- [ ] **Step 1: Write failing adapter tests for auth refresh and public entry normalization**

Add tests equivalent to:

```js
test("requestPlayerAuthorization refreshes the cached Player after successful auth", async () => {
  let authorized = false;
  let getPlayerCalls = 0;
  const sdk = {
    getPlayer: async () => {
      getPlayerCalls += 1;
      return { isAuthorized: () => authorized };
    },
    auth: { openAuthDialog: async () => { authorized = true; } },
  };
  const adapter = adapterWithSdk(sdk);

  assert.equal(await adapter.isPlayerAuthorized(), false);
  assert.equal(await adapter.requestPlayerAuthorization(), "authorized");
  assert.equal(await adapter.isPlayerAuthorized(), true);
  assert.equal(getPlayerCalls, 2);
});

test("getLeaderboardEntries normalizes guest top entries without requesting auth", async () => {
  const sdk = {
    leaderboards: {
      getEntries: async (_name, options) => ({
        entries: [
          { rank: 1, score: 34, player: { publicName: "A", uniqueID: "u1" } },
          { rank: 2, score: 31, player: { publicName: "", uniqueID: "u2" } },
        ],
        ranges: [],
        userRank: 0,
      }),
    },
  };
  const adapter = adapterWithSdk(sdk);
  const result = await adapter.getLeaderboardEntries("endless_clean_boards", 10);

  assert.deepEqual(result, {
    status: "ready",
    entries: [
      { rank: 1, score: 34, publicName: "A", uniqueId: "u1" },
      { rank: 2, score: 31, publicName: "", uniqueId: "u2" },
    ],
  });
});
```

Also add failing tests for:
- closed/cancelled auth dialog that leaves `player.isAuthorized() === false` returns `"guest"`;
- missing auth method returns `"unavailable"`;
- `getLeaderboardPlayerEntry()` checks `isAvailableMethod("leaderboards.getPlayerEntry")` before calling;
- `setLeaderboardScore()` checks `isAvailableMethod("leaderboards.setScore")` before calling;
- `LEADERBOARD_PLAYER_NOT_PRESENT` maps to `{ status: "not-present", entry: null }`;
- 404/network/malformed entry maps to stable `"unavailable"` instead of throwing.

- [ ] **Step 2: Run the new adapter test and verify RED**

Run:

```powershell
node --test test/yandex-leaderboard.test.js
```

Expected: FAIL because auth/leaderboard methods and types do not exist yet.

- [ ] **Step 3: Extend only the SDK type surface required by these tests**

Add to `YandexPlayer`:

```ts
isAuthorized?: () => boolean;
```

Add to `YandexSdk`:

```ts
isAvailableMethod?: (method: string) => Promise<boolean>;
auth?: {
  openAuthDialog?: () => Promise<void>;
};
leaderboards?: {
  getEntries?: (
    leaderboardName: string,
    options: { includeUser?: boolean; quantityAround?: number; quantityTop?: number },
  ) => Promise<unknown>;
  getPlayerEntry?: (leaderboardName: string) => Promise<unknown>;
  setScore?: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
};
```

Do not request scopes; keep `getPlayer({ scopes: false })`.

- [ ] **Step 4: Implement app-owned normalization and auth methods**

Implement a private entry normalizer that accepts only finite non-negative scores/ranks and reads `player.publicName` / `player.uniqueID`. Preserve blank `publicName` for the UI layer to localize as `ИГРОК / PLAYER`.

`requestPlayerAuthorization()` must:
1. read current cached Player;
2. return `"authorized"` immediately when already authorized;
3. call `sdk.auth.openAuthDialog()` only when needed;
4. clear `#playerPromise` after dialog completion;
5. fetch a fresh Player;
6. return `"authorized"` only if the fresh player confirms authorization;
7. return `"guest"` for a normal cancelled/closed dialog that leaves the player unauthorized;
8. return `"unavailable"` on SDK/network failure.

`getLeaderboardEntries()` must call `getEntries(name, { quantityTop, includeUser: false })` and cap `quantityTop` to `1..20`.

Protected calls must use `isAvailableMethod()` before invoking the method.

- [ ] **Step 5: Run adapter tests and existing Yandex regression tests**

Run:

```powershell
node --test test/yandex-leaderboard.test.js test/yandex-games.test.js test/yandex-lifecycle.test.js test/player-data-storage.test.js test/sticky-banner.test.js test/interstitial-ads.test.js test/rewarded-ux-contract.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- src/platform/yandex-games.ts test/yandex-leaderboard.test.js
git commit -m "feat: add yandex leaderboard adapter"
```

---

### Task 2: Endless Clean leaderboard policy service

**Files:**
- Create: `src/endless-leaderboard.ts`
- Create: `src/game/endless-leaderboard.ts`
- Create: `test/endless-leaderboard.test.js`

**Interfaces:**
- Consumes Task 1 adapter methods and `LeaderboardEntry`.
- Produces:

```ts
export const ENDLESS_CLEAN_LEADERBOARD_NAME = "endless_clean_boards";

export type EndlessLeaderboardView = Readonly<{
  status: "ready" | "unavailable";
  authorized: boolean;
  top: readonly LeaderboardEntry[];
  player: LeaderboardEntry | null;
}>;

export class EndlessLeaderboardService {
  constructor({ platform = getYandexGamesAdapter() } = {});
  load(): Promise<EndlessLeaderboardView>;
  authorizeAndSync(localBest: number): Promise<EndlessLeaderboardView>;
  publishImprovedCleanBest(localBest: number): Promise<boolean>;
}
```

`src/game/endless-leaderboard.ts` produces:

```ts
export function getEndlessLeaderboard(scene: Phaser.Scene): EndlessLeaderboardService;
```

- [ ] **Step 1: Write failing service tests for guest load and sync policy**

Use a small fake platform implementing only the service-facing methods. Required tests:

```js
test("guest load returns public top 10 without personal entry", async () => {
  const platform = fakePlatform({ authorized: false, top: [entry(1, 34)] });
  const service = new EndlessLeaderboardService({ platform });

  assert.deepEqual(await service.load(), {
    status: "ready",
    authorized: false,
    top: [entry(1, 34)],
    player: null,
  });
});

test("authorizeAndSync never downgrades a higher remote score", async () => {
  const platform = fakePlatform({ authorized: true, remotePlayer: entry(7, 25) });
  const service = new EndlessLeaderboardService({ platform });

  await service.authorizeAndSync(17);
  assert.deepEqual(platform.setScoreCalls, []);
});

test("authorizeAndSync publishes a higher positive local best", async () => {
  const platform = fakePlatform({ authorized: true, remotePlayer: entry(7, 12) });
  const service = new EndlessLeaderboardService({ platform });

  await service.authorizeAndSync(17);
  assert.deepEqual(platform.setScoreCalls, [["endless_clean_boards", 17]]);
});
```

Also cover:
- local `0` + no remote entry → no `setScore`;
- remote missing + local `> 0` → publish;
- authorization cancelled → remain guest and do not publish;
- top load failure → `status: "unavailable"`, `top: []`, no throw;
- authorized personal-entry failure does not erase a successfully loaded public top;
- repeated `publishImprovedCleanBest(17)` in one service instance does not spam the same write;
- `publishImprovedCleanBest()` does nothing when unauthorized.

- [ ] **Step 2: Run service test and verify RED**

```powershell
node --test test/endless-leaderboard.test.js
```

Expected: FAIL because service/accessor do not exist.

- [ ] **Step 3: Implement the service with clean-only, no-downgrade policy**

Implementation rules:
- validate `localBest` as a non-negative safe integer;
- `load()` always attempts public top 10 first;
- only request personal entry when authorized;
- `authorizeAndSync()` calls explicit auth, then remote personal entry, compares scores, writes only when local is strictly greater and positive, then reloads view;
- `publishImprovedCleanBest()` rechecks authorization and remote score before writing, but keeps an in-memory `#lastPublishedScore` guard so repeated completion callbacks cannot spam writes;
- never read `bestAssistedBoards` here; service accepts only the clean number provided by caller.

- [ ] **Step 4: Implement Phaser registry accessor**

Follow `src/game/endless-progress.ts` exactly in structure, with registry key `endless-leaderboard` and default construction from `getYandexGamesAdapter()`.

- [ ] **Step 5: Run service and related Endless tests**

```powershell
node --test test/endless-leaderboard.test.js test/endless-progress.test.js test/endless-board-session.test.js test/endless-run.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- src/endless-leaderboard.ts src/game/endless-leaderboard.ts test/endless-leaderboard.test.js
git commit -m "feat: add endless clean leaderboard service"
```

---

### Task 3: Home discoverability, scene registration, and utility navigation root

**Files:**
- Modify: `src/game/presentation-model.ts`
- Modify: `src/game/scenes/MenuScene.ts`
- Modify: `src/main.ts`
- Create: `test/leaderboard-scene-contract.test.js`

**Interfaces:**
- Consumes: existing `HomeModel.showEndless` and contextual menu.
- Produces: scene key `leaderboard`; `UtilityRootSceneKey` accepts `"leaderboard"`.

- [ ] **Step 1: Write failing source-contract tests**

Required assertions:
- `main.ts` imports and registers `LeaderboardScene`;
- `MenuScene.openContextMenu()` contains `РЕЙТИНГ / LEADERBOARD` only behind `this.model.showEndless`;
- selecting the item starts `leaderboard`;
- `UtilityRootSceneKey` includes `leaderboard`;
- `utilityReturnPlan("leaderboard")` returns `{ kind: "resume", scene: "leaderboard" }` so Rules/Settings return to the already-loaded ranking scene without another network fetch.

Example behavioral test:

```js
test("leaderboard is a resumable utility root", () => {
  assert.deepEqual(utilityReturnPlan("leaderboard"), {
    kind: "resume",
    scene: "leaderboard",
  });
});
```

- [ ] **Step 2: Run contract test and verify RED**

```powershell
node --test test/leaderboard-scene-contract.test.js test/utility-navigation.test.js
```

Expected: FAIL because `leaderboard` scene/root does not exist.

- [ ] **Step 3: Add the Home contextual menu item without adding a permanent Home card**

Build the items array in `openContextMenu()` so the leaderboard item is inserted only when `this.model.showEndless` is true:

```ts
...(this.model.showEndless
  ? [{
      id: "leaderboard",
      label: this.english ? "LEADERBOARD" : "РЕЙТИНГ",
      onSelect: () => this.scene.start("leaderboard"),
    }]
  : []),
```

Keep Rules and Settings unchanged.

- [ ] **Step 4: Extend utility return typing and register the scene**

Add `"leaderboard"` to `UtilityRootSceneKey`; return `kind: "resume"` for `board` and `leaderboard`.

Import `LeaderboardScene` in `src/main.ts` and register it before `BoardScene`:

```ts
scene: [MenuScene, LevelSelectScene, SettingsScene, RulesScene, LeaderboardScene, BoardScene],
```

The import will intentionally fail until Task 4 creates the scene; for this task create a minimal test-only-compilable scene shell only if the runner requires module resolution. Do not build UI behavior before Task 4 tests exist.

- [ ] **Step 5: Run Home/navigation contracts**

```powershell
node --test test/leaderboard-scene-contract.test.js test/utility-navigation.test.js test/context-menu-contract.test.js test/presentation-model.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 6: Commit Task 3**

If a minimal `LeaderboardScene.ts` shell was required for module resolution, include it in this commit; Task 4 replaces the shell under TDD.

```powershell
git add -- src/game/presentation-model.ts src/game/scenes/MenuScene.ts src/main.ts src/game/scenes/LeaderboardScene.ts test/leaderboard-scene-contract.test.js
git commit -m "feat: expose endless leaderboard from home"
```

---

### Task 4: LeaderboardScene guest/auth/unavailable UI

**Files:**
- Create or replace: `src/game/scenes/LeaderboardScene.ts`
- Modify: `test/leaderboard-scene-contract.test.js`

**Interfaces:**
- Consumes: `getEndlessLeaderboard(scene)`, `getEndlessProgress(scene)`, `getSettings(scene)`, `ContextMenuOverlay`, `openUtilityScene`, `exitUtilityToScene`, primitive UI helpers.
- Produces: visual scene key `leaderboard` with public top 10 and explicit auth CTA.

- [ ] **Step 1: Add failing scene-contract tests for required states and actions**

Source/behavior contracts must assert the scene:
- calls `showStickyBanner()` in `create()`;
- calls service `load()` once on scene creation, not from `layout()`;
- displays local `bestUnassistedBoards` regardless of public leaderboard availability;
- has loading, ready, empty, guest, authorized, and unavailable presentation branches;
- guest CTA copy explicitly names Yandex and the benefit before invoking authorization;
- calls `authorizeAndSync(this.endlessProgress.snapshot.bestUnassistedBoards)` only from the explicit sign-in button handler;
- provides a retry button in unavailable state that calls `load()` once;
- contextual `☰` contains Rules, Settings, and Home;
- Rules/Settings use `openUtilityScene(..., { returnScene: "leaderboard" })`;
- Home uses `exitUtilityToScene`/direct root navigation without leaving a blocked paused scene;
- blank public names render localized fallback `ИГРОК / PLAYER`;
- no avatar API usage exists.

- [ ] **Step 2: Run scene contract and verify RED**

```powershell
node --test test/leaderboard-scene-contract.test.js
```

Expected: FAIL on missing UI behavior.

- [ ] **Step 3: Implement renderer state and async load boundaries**

The scene owns fields equivalent to:

```ts
view: EndlessLeaderboardView | null = null;
loading = true;
requestGeneration = 0;
```

Use a generation token so an older async request cannot repaint a newer state after retry/auth. `layout()` must only reposition existing objects and must never call the service.

- [ ] **Step 4: Implement primitive visual layout**

Use current `MINIMAL_UI_COLORS`, `makeMinimalText`, `makeMinimalButton`, and `ContextMenuOverlay`.

Required content:
- title `ENDLESS · ЧИСТЫЙ РЕЙТИНГ / ENDLESS · CLEAN LEADERBOARD`;
- up to 10 rows with columns rank / player / boards;
- local clean best line;
- authorized player's own row separately when present;
- guest explanation and `ВОЙТИ В ЯНДЕКС / SIGN IN TO YANDEX` button;
- unavailable text plus `ПОВТОРИТЬ / RETRY`;
- top-right `☰`.

Responsive rules:
- desktop: centered card, max width about 640 px;
- portrait: width minus safe 24–28 px margins, smaller fonts;
- short landscape: reduce row height and title spacing so all 10 rows plus controls remain accessible; if required, show 6 rows at once with simple previous/next page controls rather than clipping.

Do not introduce scrolling dependencies or final-art textures.

- [ ] **Step 5: Implement sign-in and refresh behavior**

On explicit sign-in:
1. disable sign-in/retry buttons;
2. call `authorizeAndSync(localBest)`;
3. if the scene is still active and generation matches, replace the view;
4. re-enable controls;
5. cancelled auth simply returns to guest presentation with no error modal.

- [ ] **Step 6: Run UI/navigation regression tests**

```powershell
node --test test/leaderboard-scene-contract.test.js test/context-menu-contract.test.js test/utility-navigation.test.js test/sticky-banner.test.js test/global-settings-access.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- src/game/scenes/LeaderboardScene.ts test/leaderboard-scene-contract.test.js
git commit -m "feat: add endless clean leaderboard screen"
```

---

### Task 5: Publish only newly improved unassisted Endless records

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Create: `test/endless-leaderboard-publication.test.js`

**Interfaces:**
- Consumes: `getEndlessLeaderboard(scene)` and `EndlessProgressStore.submit()`.
- Produces: asynchronous publication request only after a clean best increases.

- [ ] **Step 1: Write failing Board publication tests/contracts**

Cover these exact behaviors:
- snapshot previous clean best before `submit()`;
- assisted Endless completion never calls publication;
- unassisted completion equal to or below existing clean best never calls publication;
- unassisted completion that raises clean best calls `publishImprovedCleanBest(newBest)` exactly once;
- completion overlay is shown synchronously without awaiting leaderboard network work;
- no raw `getLeaderboardEntries`, `getLeaderboardPlayerEntry`, or `setLeaderboardScore` calls exist in `BoardScene.ts`.

Expected shape in source:

```ts
const previousCleanBest = this.endlessProgress.snapshot.bestUnassistedBoards;
const result = this.endlessProgress.submit({ ... });
if (!session.assisted && result.bestUnassistedBoards > previousCleanBest) {
  void this.endlessLeaderboard.publishImprovedCleanBest(result.bestUnassistedBoards);
}
this.completionOverlay.show(...);
```

- [ ] **Step 2: Run publication test and verify RED**

```powershell
node --test test/endless-leaderboard-publication.test.js
```

Expected: FAIL because Board has no leaderboard service/accessor.

- [ ] **Step 3: Wire the shared service into BoardScene**

Initialize `this.endlessLeaderboard = getEndlessLeaderboard(this)` next to `endlessProgress`. Keep the service shared in registry across runs/scenes.

In `showEndlessCompletion()` preserve current `EndlessProgressStore.submit()` as the first ranking-related operation, then trigger publication only on the strict clean-best increase condition. Do not await the publication before `completionOverlay.show()`.

- [ ] **Step 4: Run Endless completion and ads/lifecycle regressions**

```powershell
node --test test/endless-leaderboard-publication.test.js test/endless-progress.test.js test/endless-board-session.test.js test/completion-presentation.test.js test/interstitial-ads.test.js test/yandex-lifecycle.test.js
```

Expected: PASS, 0 fail.

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- src/game/scenes/BoardScene.ts test/endless-leaderboard-publication.test.js
git commit -m "feat: publish new clean endless records"
```

---

### Task 6: Documentation, full validation, and console checklist

**Files:**
- Modify: `AGENTS.md`
- Modify: `PROJECT.md`
- Modify: `CURRENT_STATE.md`
- Modify: `VALIDATION.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces release documentation and manual acceptance criteria.

- [ ] **Step 1: Update product truth without reviving removed score systems**

Document exactly:
- one approved public leaderboard: Endless Clean only;
- technical name `endless_clean_boards`;
- guest top 10 is visible without login;
- authorization is voluntary and only initiated from explicit CTA;
- only clean `bestUnassistedBoards` is submitted;
- assisted records and old score/multiplier/leaderboard architecture remain prohibited;
- leaderboard is not a save system and does not overwrite Player Data.

- [ ] **Step 2: Add manual acceptance cases to `VALIDATION.md`**

Add checkboxes for:

```text
[ ] Guest can open leaderboard and see public top 10 without auth dialog.
[ ] Guest local clean best is visible even when leaderboard is unavailable.
[ ] Closing/cancelling auth keeps game usable and returns to guest state.
[ ] Successful auth refreshes Player and shows personal placement when present.
[ ] Local 17 vs remote 25 performs no setScore call.
[ ] Local 17 vs remote 12 submits 17 once.
[ ] Local 0 with no remote entry does not create a zero entry.
[ ] Assisted Endless best never changes leaderboard score.
[ ] New clean Endless best publishes asynchronously without delaying result overlay.
[ ] Missing console leaderboard/404 shows unavailable state and Home remains reachable.
[ ] Rules/Settings opened from leaderboard return to leaderboard without duplicate fetch loops.
[ ] Desktop, portrait phone, and short-landscape layouts remain usable.
```

Also add Developer Console prerequisite:

```text
Technical name: endless_clean_boards
Type: numeric
Decimal offset: 0
Sort: DESC
```

- [ ] **Step 3: Run strict typecheck and build in the real project environment**

```powershell
pnpm typecheck
pnpm build
```

Expected: both commands exit 0. Do not accept Vite build alone as proof of type correctness.

- [ ] **Step 4: Run focused leaderboard suite**

```powershell
node --test test/yandex-leaderboard.test.js test/endless-leaderboard.test.js test/leaderboard-scene-contract.test.js test/endless-leaderboard-publication.test.js test/utility-navigation.test.js test/sticky-banner.test.js test/yandex-lifecycle.test.js
```

Expected: 0 failures.

- [ ] **Step 5: Run the complete existing JS test matrix**

Use the repository's normal `pnpm test` command if it runs the complete suite in the local environment:

```powershell
pnpm test
```

Expected: 0 failures; existing intentionally skipped optional database/factory tests may remain skipped.

- [ ] **Step 6: Manual Yandex SDK verification**

With Developer Console leaderboard configured and the Yandex dev environment active:
1. open leaderboard while logged out — verify no auth popup;
2. inspect top 10;
3. cancel explicit sign-in — verify scene remains usable;
4. sign in successfully — verify local-vs-remote no-downgrade behavior;
5. finish assisted Endless run — verify no leaderboard write;
6. set a new clean Endless record — verify result UI appears immediately and score later appears in leaderboard;
7. temporarily rename/remove console leaderboard — verify non-fatal unavailable UI;
8. test `Leaderboard → Rules → Back`, `Leaderboard → Settings → Back`, and `Leaderboard → Home`.

- [ ] **Step 7: Commit documentation and final integration state**

```powershell
git add -- AGENTS.md PROJECT.md CURRENT_STATE.md VALIDATION.md
git commit -m "docs: document endless clean leaderboard"
```

---

## Final Self-Review

- Spec coverage: auth opt-in, guest top 10, clean-only policy, no downgrade, automatic new-record publication, scene/menu integration, missing-board fallback, privacy, docs, and validation all map to Tasks 1–6.
- Placeholder scan: no `TODO`, `TBD`, or deferred implementation instructions remain.
- Type consistency: adapter returns normalized `LeaderboardEntry`; service consumes it and returns `EndlessLeaderboardView`; Phaser scene consumes only the service view; Board consumes only `publishImprovedCleanBest()`.
- Rate-limit discipline: `getEntries()` only on scene load/retry/auth completion; `getPlayerEntry()` only for authorized load/sync; `setScore()` only after strict improvement and remote comparison; in-memory duplicate suppression prevents repeated writes for the same clean best.
