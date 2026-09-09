# Endless Clean Leaderboard Design

**Date:** 2026-09-09

## Goal

Add a Yandex Games leaderboard for Endless that ranks only the canonical clean result: the highest number of boards cleared in an Endless run without Hint or Rescue. Guests must be able to browse the public ranking without being forced to authorize. Authorization is an explicit opt-in action used only to publish a player's clean best and show their personal rank.

## Product Decisions

- Technical leaderboard name: `endless_clean_boards`.
- Leaderboard result type: numeric.
- Sort order: descending; more cleared boards is better.
- The public ranking surface is unlocked with Endless, after 10 contiguous Campaign solves.
- Guests can open the leaderboard and see the top 10 without signing in.
- The game never opens the Yandex authorization dialog automatically at startup, when Endless unlocks, when Endless starts, or when an Endless run ends.
- The guest leaderboard screen explains the benefit first, then offers an explicit `ВОЙТИ В ЯНДЕКС / SIGN IN TO YANDEX` action.
- Only `bestUnassistedBoards` is rankable. `bestAssistedBoards`, old score concepts, multipliers, streaks, level scores, and assisted runs never enter this leaderboard.
- Daily leaderboard is out of scope.
- The leaderboard is a ranking surface only. Existing Player Data remains the canonical persistence path for Campaign, Daily, Endless records, and settings.

## Yandex Console Contract

Before production testing, create a leaderboard in the Yandex Games Developer Console with:

- technical name: `endless_clean_boards`;
- score type: numeric;
- decimal offset: 0;
- sort order: descending (`DESC` / highest score first).

If this leaderboard does not exist, SDK leaderboard calls can return 404. Runtime must handle that as an unavailable ranking rather than breaking navigation or Endless.

## User Flow

### Discoverability

Once Endless is unlocked, the Home `☰` menu gains a `РЕЙТИНГ / LEADERBOARD` item. Before Endless unlocks, that item is absent.

Selecting it opens a dedicated `LeaderboardScene`. The scene uses the same current primitive visual system, language setting, responsive layout, and menu conventions as the rest of the functional product.

### Guest State

On entry, the scene requests the top 10 via the public leaderboard API without requesting authorization.

The screen shows:

- title: `ENDLESS · ЧИСТЫЙ РЕЙТИНГ` / `ENDLESS · CLEAN LEADERBOARD`;
- top 10 rows: rank, public player name, boards cleared;
- the local canonical clean best from `EndlessProgressStore.bestUnassistedBoards`;
- a short explanation that authorization is needed to publish the result and see personal placement;
- explicit `ВОЙТИ В ЯНДЕКС / SIGN IN TO YANDEX` button.

No authorization dialog opens until the player presses that button.

If public entries are unavailable, the player still sees their local clean best and an unobtrusive `РЕЙТИНГ ВРЕМЕННО НЕДОСТУПЕН / LEADERBOARD TEMPORARILY UNAVAILABLE` state.

### Authorization

When the player presses the sign-in button:

1. Check current authorization state using the current `Player` object.
2. If already authorized, skip the dialog and continue to synchronization.
3. Otherwise call `ysdk.auth.openAuthDialog()`.
4. After successful dialog completion, invalidate the adapter's cached `Player` and fetch a fresh one.
5. Re-check `player.isAuthorized()`; a closed/cancelled dialog that did not authorize is treated as a normal guest outcome, not an error.
6. Synchronize the local clean best with the leaderboard without allowing a score downgrade.
7. Reload top entries and the player's personal entry.

The sign-in flow never blocks continued play if Yandex authorization or network calls fail.

## Score Synchronization

The leaderboard service owns all ranking policy. `BoardScene` must not call raw Yandex leaderboard APIs.

### Prevent score downgrade

After authorization, synchronization compares the current local clean best with the existing remote leaderboard entry:

- no remote entry + local best > 0 → publish local best;
- remote score < local best → publish local best;
- remote score >= local best → do not call `setScore`;
- local best = 0 → do not create a zero-score entry unless a remote entry already exists.

This prevents a new device or stale local state from overwriting a better existing leaderboard result with a lower score.

The service does **not** import the remote leaderboard score back into `EndlessProgressStore`. Player Data remains the source of game-progress persistence; leaderboard data is not used as a substitute save file.

### New Endless record

When an Endless run ends, `EndlessProgressStore.submit()` remains the first operation.

If and only if all conditions are true:

- the run is unassisted;
- `bestUnassistedBoards` actually increased;
- the player is already authorized;

then the new clean best is submitted asynchronously to the leaderboard.

A leaderboard network failure must not delay or alter the Endless result overlay. Assisted runs never call leaderboard submission.

## Architecture

### `src/platform/yandex-games.ts`

Extend the existing Yandex adapter with normalized authorization and leaderboard primitives. The rest of the game must not depend on raw SDK object shapes.

Responsibilities:

- expose authorization status;
- explicitly request Yandex authorization;
- invalidate/refetch cached `Player` after authorization;
- check protected leaderboard method availability where required;
- fetch top entries;
- fetch the authorized player's entry;
- submit a score;
- normalize public leaderboard data into renderer-independent TypeScript objects;
- convert SDK/network/404/unavailable failures into stable result states instead of throwing into scenes.

The adapter must preserve existing Player Data, ads, lifecycle, and sticky-banner behavior.

### `src/endless-leaderboard.ts`

Create a renderer-independent `EndlessLeaderboardService` containing product policy.

Responsibilities:

- fixed leaderboard technical name `endless_clean_boards`;
- load public top 10;
- determine guest vs authorized presentation state;
- synchronize clean best after authorization without score downgrade;
- submit only improved clean records;
- expose stable load/sync result models for Phaser UI;
- never read or submit assisted bests.

The service should be Node-testable with a fake adapter and no Phaser dependency.

### `src/game/endless-leaderboard.ts`

Provide the shared Phaser-registry accessor for `EndlessLeaderboardService`, following the existing `game/endless-progress.ts` pattern.

### `src/game/scenes/LeaderboardScene.ts`

Dedicated visual scene.

Responsibilities:

- show sticky banner while open;
- obtain language, local `EndlessProgressStore`, and shared leaderboard service;
- render loading, guest, authorized, empty, and unavailable states;
- render up to 10 public rows without avatars in the first version;
- show the player's own row/position separately when authorized;
- offer the explicit sign-in CTA only to guests;
- refresh after successful authorization/synchronization;
- remain responsive on desktop, portrait phone, and short landscape;
- use `☰` menu with Rules, Settings, and Home consistent with the current contextual-menu design.

No final-art assets are introduced in this task.

### `src/game/scenes/MenuScene.ts`

Add `РЕЙТИНГ / LEADERBOARD` to the Home contextual menu only when `showEndless` is true. The Home layout itself does not gain another permanent card in this task.

### `src/game/scenes/BoardScene.ts`

On Endless completion:

1. snapshot the previous clean best;
2. submit the run to `EndlessProgressStore` as today;
3. if the clean best increased on an unassisted run, ask `EndlessLeaderboardService` to publish the new clean best asynchronously;
4. show the result overlay immediately regardless of leaderboard outcome.

No leaderboard UI is added to the Board scene.

### `src/main.ts`

Register `LeaderboardScene` in the active Phaser scene list.

## Normalized Data Model

The adapter/service boundary should expose a small app-owned shape, not Yandex SDK objects:

```ts
export interface LeaderboardEntry {
  rank: number;
  score: number;
  publicName: string;
  uniqueId: string;
}
```

The service load result should distinguish states explicitly, for example:

```ts
export type EndlessLeaderboardView =
  | { status: "ready"; authorized: boolean; top: readonly LeaderboardEntry[]; player: LeaderboardEntry | null }
  | { status: "unavailable"; authorized: boolean; top: readonly LeaderboardEntry[]; player: LeaderboardEntry | null };
```

Exact internal naming can vary during implementation, but scenes must receive app-owned normalized data and never raw SDK objects.

## Error and Rate-Limit Behavior

- `getEntries` is requested only on scene load/manual refresh/auth completion, not every frame or every layout call.
- `getPlayerEntry` is requested only for authorized synchronization/presentation.
- `setScore` is called only for an improved local clean best and only after checking protected-method availability.
- Repeated completion callbacks for the same clean best must not spam score writes.
- 404/missing leaderboard, unavailable SDK methods, network errors, and auth cancellation are non-fatal.
- The scene always has a way back to Home.

## Privacy and Identity

- Do not request profile scopes merely to render the leaderboard.
- Use the public name supplied by leaderboard entries; if unavailable/hidden/blank, show a generic localized fallback such as `ИГРОК / PLAYER`.
- Do not persist Yandex unique IDs, names, or avatar URLs in local Player Data.
- No avatar rendering in this version.

## Documentation Updates

Implementation must update product documentation so the new explicit decision is no longer contradicted by stale cleanup notes:

- `AGENTS.md`: remove the blanket prohibition on public leaderboard and document the single approved Endless Clean leaderboard; keep old score/multiplier leaderboard systems prohibited.
- `PROJECT.md`: add guest-visible Endless Clean leaderboard and voluntary Yandex authorization behavior.
- `CURRENT_STATE.md`: record the implemented leaderboard/auth surface and console dependency.
- `VALIDATION.md`: add manual acceptance checks for guest view, auth cancellation, successful auth, clean record publication, assisted exclusion, missing-leaderboard fallback, and mobile responsiveness.

## Testing

Use TDD. Required automated coverage:

- adapter authorization state and cached-player refresh after auth;
- adapter guest `getEntries` normalization;
- protected method availability for `setScore` / personal entry;
- service guest top-10 load;
- service no-score-downgrade synchronization;
- service zero local best behavior;
- service assisted exclusion / clean-only publication contract;
- Home menu item appears only after Endless unlock;
- `LeaderboardScene` registered in `main.ts` and source-contract checks for sticky banner/context menu;
- Board only requests publication when an unassisted clean best actually increases;
- missing leaderboard/auth cancellation/network failure remain non-blocking;
- existing Campaign/Daily/Endless, Player Data, lifecycle, rewarded, interstitial, sticky-banner, and navigation tests continue to pass.

Normal handoff gate remains:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

## Manual Acceptance

Before calling the feature accepted, verify on Yandex dev/proxy with the Console leaderboard created:

1. Guest opens leaderboard and sees top entries without an auth popup.
2. Guest cancels sign-in and remains on a usable leaderboard screen.
3. Successful sign-in refreshes the screen and shows the player's rank when an entry exists.
4. Existing remote score higher than local is not downgraded.
5. New unassisted Endless record is published.
6. Assisted Endless record never changes the leaderboard.
7. Missing/incorrect technical leaderboard name shows unavailable state rather than breaking the game.
8. Home/Leaderboard/Rules/Settings sticky banner behavior remains correct; Board hides it.
9. Desktop, portrait mobile, and short landscape remain navigable.
