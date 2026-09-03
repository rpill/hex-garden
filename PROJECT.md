# Hex Garden — Project Contract

## Purpose

Hex-board clearing puzzle for Yandex Games built on the audited Garden rules.

## Authority

- Code/tests = factual current implementation.
- `RULES_AUDIT.md` = audited low-level rule reference.
- `CURRENT_STATE.md` = implementation snapshot.
- `ART_DIRECTION.md` = current visual decisions.

If active prose conflicts with code/tests, do not silently change the implementation to match prose. Treat code/tests as the factual current state and surface the mismatch.

## Stable gameplay contract

- Preserve internal atom IDs from `src/atom-types.ts`.
- Preserve free-atom geometry and pairing/unlock rules audited in `RULES_AUDIT.md`.
- Campaign and standard Endless are the public product modes; Quintessence stays internal unless explicitly re-approved.
- Solver-backed Move/Undo/Rescue behavior and assisted-run policy remain renderer-independent contracts.
- Runtime presentation may be fully reskinned without changing the underlying mechanics.

## Campaign contract

- The public campaign currently contains 24 curated progression levels plus the interactive tutorial flow.
- Progress is sequential: completing a level unlocks the next one; saved progress is normalized to a contiguous completion prefix.
- Campaign score uses 10 base points per removed atom plus the size-based board-clear bonus; there is no streak multiplier.
- A level contributes persistent campaign score only on its first scored completion.
- Campaign completion, level scores, tutorial completion, and unlock state persist locally.
- Campaign generation and puzzle-quality filtering remain separate from the public Endless run.

## Endless contract

- Standard Endless is the only public endless/competitive ruleset.
- It unlocks after the standard mechanics have been introduced in campaign (currently after the first 9 campaign levels).
- A run starts with two 37-cell fields, then three 61-cell fields, then uses 91-cell / 55-piece fields from the sixth board onward.
- Every removed atom awards 10 base points. Board clears award 1000 / 1500 / 2000 base points for 37 / 61 / 91-cell plates.
- Cleared-board streak multipliers are ×1.0 from 0, ×1.25 from 3, ×1.5 from 5, ×2.0 from 8, and ×2.5 from 12; ×2.5 is the cap.
- Solver-proven unsolvability does not end or visibly interrupt play while legal moves remain. A player-facing dead end exists only when a non-cleared field has zero legal moves; in Endless, Rescue may then restore a proven solvable history state.
- Using Move, Undo, or Rescue permanently marks that Endless run `ASSISTED`; assisted runs must not be submitted as ranked results.
- Quintessence generation remains available for internal experiments/tests but is not a public mode.

## Economy and assistance contract

- A normal profile starts with 30 dust.
- First campaign clears award 8 / 12 / 18 dust for 37 / 61 / 91-cell plates; claims are idempotent.
- Endless clears award 2 / 4 / 6 dust for 37 / 61 / 91-cell plates.
- Shop bundles are: 3 Move for 30 dust, 2 Undo for 50 dust, 1 Rescue for 60 dust.
- Rewarded ads grant one explicit booster without spending dust and share a persistent 60-second cooldown.
- A reward is granted only after the platform adapter reports a confirmed rewarded callback.
- Move must come from a solver-verified route to a full clear; an unverified merely legal move is insufficient. If no verified route can be produced, the booster is not consumed and player-facing copy stays neutral rather than revealing solver unsolvability.
- Undo restores the board and score to immediately before the latest removal.
- Rescue is Endless-only and becomes eligible only when the non-cleared board has zero legal moves. It restores the most recent proven solvable history state while identifying/blocking the losing move; solver-proven unsolvability with legal moves does not enable Rescue.
- Solver budget exhaustion returns an unknown result rather than a false dead-end proof.

## Platform and product UI contract

- The game is a Phaser browser project intended for Yandex Games and responsive desktop/phone layouts.
- On-screen navigation must remain sufficient; keyboard shortcuts may be accelerators but cannot be the only way to leave or control a scene.
- Board onboarding teaches matching first, then the three-empty-neighbour freedom rule, then the remaining-piece count panel. Tutorial completion has one primary `LEVEL 1` action that enters campaign level index 0.
- Pause + Restart are system/session controls and are visually distinct from the consumable Move/Undo/Rescue group. Fresh fields use a skippable centre-out intro with a size-dependent multi-second profile; restart uses a faster roughly one-second profile.
- Russian/English language choice and global sound on/off persist locally.
- Rewarded ads use a deterministic simulation on localhost and `?test=all`; the Yandex adapter uses the SDK when available.
- The current leaderboard is local/simulated UI backed by local persistence and fake comparison entries. Do not describe it as a live Yandex leaderboard until that integration exists.
- Forced/interstitial ads, real-money purchases, selectable difficulty modes, and a second public Quintessence mode are outside the current product contract unless explicitly approved later.

## Visual independence

Gameplay and progression contracts above are intentionally independent of presentation. See `ART_DIRECTION.md` for the only active visual sourcing/direction decisions.
