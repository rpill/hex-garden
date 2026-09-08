# Hex Garden — Project Contract

## Purpose

Hex-board clearing puzzle for Yandex Games built on the audited Garden rules. The current product is a functional, asset-independent implementation used to validate the complete progression loop before final visual production resumes.

## Authority

- Code and tests are the factual current implementation.
- `PROJECT.md` defines stable product intent.
- `CURRENT_STATE.md` is the implementation snapshot.
- `RULES_AUDIT.md` is the audited low-level rules reference.
- `ART_DIRECTION.md` is the visual-status reference.
- `VALIDATION.md` defines the current validation gates.
- `docs/archive/**` is historical only unless the user explicitly revives it.

If prose conflicts with code/tests, surface the mismatch. Do not silently reintroduce superseded product behavior to match stale documentation.

## Stable rules and board contract

- Preserve internal atom IDs from `src/atom-types.ts` and the audited selection/pairing/metal rules in `RULES_AUDIT.md`.
- Public gameplay uses the standard Garden ruleset. Campaign levels may use different compositions, but there are no mechanic-introduction rule variants or per-level rule overrides.
- Public plates are complete regular hexes only: radius 3 / 4 / 5 = 37 / 61 / 91 cells.
- Geometry, matching, solver behavior, Solved/Clean state, and assistance policy are renderer-independent contracts.
- Quintessence may remain in low-level rules/internal tooling, but it is not a public product mode.

## Campaign contract

- The campaign is the tutorial plus exactly 50 fixed levels in five chapters of ten:
  1. Basics / Основы
  2. Planning / Планирование
  3. Order / Порядок
  4. False Moves / Ложные ходы
  5. Mastery / Мастерство
- Runtime Campaign content comes from frozen `src/data/campaign-levels.json`; normal play does not procedurally regenerate campaign levels.
- Progress is sequential. Solving an unlocked level unlocks exactly the next level; saved progress is normalized around the contiguous solved prefix.
- `Solved` means the board was cleared. `Clean` means it was cleared without Hint or Rescue on that attempt.
- Undo and Restart do not invalidate Clean. Hint and Rescue invalidate only the current attempt; a later clean replay can upgrade a Solved level to Clean.
- Mastery rank depends only on Clean count: 0 Novice, 5 Apprentice, 15 Adept, 30 Strategist, 40 Expert, 50 Master.
- After all 50 levels are Solved, Continue targets the first non-Clean level until all 50 are Clean.
- Daily unlocks after the first 5 campaign levels are Solved. Endless unlocks after the first 10 are Solved.

## Daily contract

- Daily is one deterministic puzzle for the current Moscow calendar date.
- Day boundary is 00:00 `Europe/Moscow`; weeks are Monday–Sunday in the same timezone.
- Runtime date authority comes from the trusted platform clock when available; a Daily attempt that crosses into a new Moscow date is expired rather than recorded for the old date.
- Daily stores Solved/Clean state per date, keeps the latest 90 daily entries, and preserves aggregate best solved/clean week counts.
- Home shows the current seven-day week summary. Old days are history, not a selectable archive.
- Undo and Restart are free and preserve Clean. Hint/Rescue invalidate Clean for the attempt.
- Daily Hint and Rescue require a confirmed rewarded-ad callback. Rescue is available only at a true zero-legal-moves dead end and only once per attempt.

## Endless contract

- Endless is one session-scoped run of consecutive canonical standard boards. A new run gets a unique run seed and is not persisted across page reloads.
- Board sizes are staged: boards 0–1 use 37 cells, boards 2–4 use 61 cells, and board 5 onward uses 91 cells. Difficulty continues through difficulty-band/profile selection after size reaches 91.
- The result is **boards cleared**. There is no point score, per-piece score, streak multiplier, combo, or score-farming system.
- Clearing a board automatically advances to the next board in the same run.
- Undo is free before a visible dead end and does not mark the run assisted. Once a true dead end is entered, ordinary Undo is unavailable.
- Hint must come from a solver-verified route to a full clear and permanently marks the run assisted after the rewarded callback is confirmed.
- Rescue is offered only at a true zero-legal-moves dead end, restores a solver-verified recoverable history position, may be used once for the entire run, and marks the run assisted. A second true dead end after Rescue ends the run.
- Persistent Endless records store best unassisted boards cleared and best assisted boards cleared separately. Assisted results never replace the canonical clean/unassisted best shown on Home.

## Assistance contract

- Undo and Restart are free actions; there is no booster inventory.
- Hint and Rescue are direct solver-backed assistance actions, not purchasable items.
- Tutorial assistance is free. Campaign levels 1–5 use free onboarding assistance; later Campaign levels plus all Daily/Endless assistance require a confirmed rewarded callback.
- The solver is queried before showing a rewarded ad. If no verified Hint route or Rescue restore point can be produced, no ad is requested.
- Solver budget exhaustion is `unknown`, never a false dead-end proof.
- A player-facing dead end exists only when a non-cleared board has zero legal moves. Solver-proven unsolvability is not exposed while legal moves remain.
- Rescue is limited to one use per Campaign/Daily attempt or one use per Endless run.

## Removed product surfaces

The following are not part of the current product and must not be reintroduced without an explicit new product decision:

- Dust or any other spendable currency;
- Shop;
- booster inventory or consumable Hint/Undo/Rescue counts;
- campaign or Endless point scoring;
- score multipliers/streak scoring;
- public leaderboard navigation or ranked score submission;
- mechanic-introduction cards/progression gates;
- public shape-family progression contracts.

## Platform and persistence contract

- Phaser browser project targeting Yandex Games with responsive desktop, phone portrait, and phone landscape layouts.
- On-screen controls must be sufficient; keyboard shortcuts can be accelerators but never the only navigation path.
- Campaign progress, Daily progress, Endless records, and settings use the shared player-data storage boundary. It hydrates from Yandex Player Data when available and falls back to browser/in-memory storage for local/dev use.
- Russian/English language and global sound on/off persist through the same product storage path.
- Rewarded ads use the Yandex adapter; only a confirmed rewarded callback authorizes assisted Hint/Rescue.
- Forced/interstitial ads, real-money purchases, selectable difficulty modes, and public Quintessence remain outside the product contract.

## Presentation contract

- The live product target is an asset-free functional presentation built from Phaser primitives until playtest acceptance.
- Functional acceptance is based on readable board state, controls, responsive layout, progression, Daily/Endless flow, and assistance behavior — not on premium texture/frame names.
- Physical Premium / Club Table and the Physical UI Factory are frozen experiments. Their tooling/assets may remain isolated in the repository but are not runtime dependencies or acceptance requirements.
- Final art direction is intentionally unresolved and may be revisited only after functional playtest acceptance.
