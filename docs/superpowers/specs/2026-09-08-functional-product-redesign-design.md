# Hex Garden Functional Product Redesign — Design

## Status

Consolidated design draft for user review, 2026-09-08.

The individual product decisions in this document were developed and accepted incrementally in chat. This document is the single reviewable specification before implementation planning begins.

This is an architectural redesign. It intentionally changes the current campaign, progression, economy, assistance, Endless, menu, and Board HUD product contracts while preserving the audited Garden rules.

## Goal

Turn Hex Garden into a compact, replayable, low-asset puzzle product whose retention comes from puzzle quality rather than currencies, shops, cosmetic collections, or a growing set of mechanics.

The product should answer three different player motivations using the same rules and the same board system:

- **Campaign:** progress through increasingly clever fixed puzzles and master them cleanly.
- **Daily:** return for one shared puzzle each day and build a lightweight weekly history.
- **Endless:** test how many increasingly difficult boards can be cleared in one run.

Before any final art-direction work resumes, the entire redesigned product must be playable in a deliberately minimal, asset-free presentation close to the project's early prototype style.

## Non-goals

This redesign does **not** add:

- new public puzzle mechanics;
- new atom IDs or renamed internal atom IDs;
- cosmetic collections or themes;
- premium currency;
- Dust;
- a Shop;
- booster inventory;
- lives or energy;
- three-star level scoring;
- campaign score;
- Endless score multipliers or combo systems;
- global competitive leaderboards in the first release of this redesign;
- a second public Quintessence mode;
- final production art;
- a new Blender/UI asset factory.

The paused Physical Asset/UI Factory work is outside this redesign and must remain frozen until the functional product is accepted in playtesting.

---

# 1. Stable gameplay rules

The audited rules in `RULES_AUDIT.md`, `src/atom-types.ts`, and `src/board.ts` remain authoritative.

In particular:

- an occupied atom is geometrically free when at least three consecutive positions in its circular six-neighbour ring are empty;
- off-plate positions count as empty;
- Air/Air, Fire/Fire, Water/Water, and Earth/Earth are valid identical-element pairs;
- Salt pairs with Salt or any cardinal element;
- Vitae pairs only with Mors;
- Quicksilver pairs with any non-Gold metal;
- metals unlock globally in `Pb -> Sn -> Fe -> Cu -> Ag -> Au` order;
- free unlocked Gold is removed alone;
- a mismatching ordinary second selection replaces the first selection;
- Quintessence remains internal and is not part of the public Campaign, Daily, or Endless product.

The redesign changes **how puzzles are selected, presented, progressed, and monetized**, not these underlying rules.

## Same rules throughout the campaign

Campaign chapters must no longer enable or disable mechanics as a progression device.

All public standard rules exist from the beginning. Early curated levels may intentionally use a simpler subset of atom types so the player can learn by doing, but no chapter introduces a new rule that did not previously exist.

The campaign gets harder by producing more demanding decision structures under the same rules.

---

# 2. Canonical board geometry

## One outer shape only

Public puzzles use one recognizable shape: a complete regular hexagonal plate.

The public plate sizes are fixed to:

| Plate | Radius | Cell count |
|---|---:|---:|
| Small | 3 | 37 |
| Medium | 4 | 61 |
| Large | 5 | 91 |

Remove campaign/public reliance on occupancy-shape families such as:

- `compact`;
- `wide`;
- `diagonal`;
- `branches`;
- `hollow`;
- sixfold/threefold/twofold silhouette families as a player-facing variety system.

The **plate itself** always reads as the same regular hexagon. A puzzle may occupy only a subset of its cells, but empty positions still visibly belong to the canonical plate; they must not redefine the outer silhouette into a special level shape.

## Size is not difficulty

Plate size primarily controls duration and information volume. It does not directly define intellectual difficulty.

A difficult 37-cell puzzle may appear late in the campaign, and a comparatively forgiving 91-cell puzzle may appear earlier.

Working initial occupancy ranges for candidate generation are:

| Plate | Approximate occupied pieces |
|---|---:|
| 37 | 21–33 |
| 61 | 31–47 |
| 91 | 43–55 |

These are generation starting ranges, not player-facing rules. Candidate quality metrics may justify tightening them during implementation.

---

# 3. Product information architecture

The redesigned first-release navigation is:

```text
HOME
├── Continue
├── Daily
├── Endless
├── Chapters
└── Settings
```

There is no Shop and no public Leaderboard entry in the initial redesign.

## Progressive disclosure

### First launch

Show only the game identity, a primary `Start` action, and unobtrusive Settings access. `Start` enters the tutorial directly.

### After tutorial

Home is centered on `Continue`, which resumes the next campaign objective.

### After Campaign Level 5

Daily becomes visible and usable.

### After Campaign Level 10 / Chapter 1 completion

Endless becomes visible and usable.

Do not show locked Daily/Endless cards to a brand-new player merely to advertise future systems.

## Continue priority

`Continue` is always the dominant home action while the campaign is incomplete.

It shows at minimum:

- current chapter;
- current level;
- solved progress;
- clean mastery progress.

After all 50 levels are solved but fewer than 50 are Clean, `Continue` changes to a mastery action and opens the earliest solved-but-not-clean level.

After `50 / 50 Clean`, the campaign is genuinely complete. Home still exposes Daily, Endless, Chapters, and the completed Master status without inventing prestige levels.

---

# 4. Campaign structure

## Scope

The public campaign becomes:

- one interactive tutorial;
- five chapters;
- ten levels per chapter;
- **50 fixed campaign levels total**.

Campaign puzzles are fixed content. They may be produced using the generator/solver/scorer toolchain, but after curation their coordinates/types are stored as campaign data rather than regenerated into a different puzzle for each player.

The first five campaign levels must be deliberately curated and manually playtested. The rest of the campaign may also be generator-assisted but must receive human selection before shipping.

## Chapter identities

The chapters describe the **kind of thinking** required, not newly unlocked rules:

1. **Basics** — reading availability, matching, opening space.
2. **Planning** — considering what a removal opens or closes.
3. **Order** — stronger dependence on future sequencing, especially metals.
4. **False Moves** — several legal-looking choices, with meaningful bad alternatives.
5. **Mastery** — mixed high-level puzzles with deeper consequences.

Localized Russian working names:

1. `Основы`
2. `Планирование`
3. `Порядок`
4. `Ложные ходы`
5. `Мастерство`

## Level-size schedule

The planned plate sizes are:

| Chapter | Levels | Plate sizes |
|---|---|---|
| Basics | 1–10 | `37, 37, 37, 37, 37, 37, 37, 61, 37, 61` |
| Planning | 11–20 | `37, 61, 61, 37, 61, 61, 37, 61, 61, 61` |
| Order | 21–30 | `61, 61, 37, 61, 61, 91, 61, 37, 61, 91` |
| False Moves | 31–40 | `61, 37, 61, 91, 61, 61, 37, 91, 61, 91` |
| Mastery | 41–50 | `61, 91, 37, 61, 91, 61, 37, 91, 61, 91` |

37-cell puzzles intentionally remain present in the final chapter so the player does not learn the false rule `larger board = harder puzzle`.

## Difficulty rhythm inside a chapter

Difficulty must not rise monotonically every single level.

Each ten-level chapter should approximately follow this rhythm:

```text
1  introduction / reset
2  slightly harder
3  harder
4  relief
5  local peak
6  different character, slightly easier
7  harder
8  strong challenge
9  relief or unusual puzzle
10 chapter exam
```

The intended emotional curve is closer to:

```text
▂ ▃ ▄ ▂ ▅ ▃ ▅ ▆ ▄ █
```

This gives the player periodic satisfying wins instead of fifty consecutive turns of the difficulty screw.

---

# 5. Solved and Clean mastery

Campaign completion has exactly two meaningful states.

## Solved

A level becomes `Solved` when the board is cleared by any allowed route, including runs that used solver assistance.

Solved:

- unlocks the next campaign level;
- remains permanently recorded;
- is sufficient to complete the campaign.

## Clean

A successful attempt becomes `Clean` when the board is cleared **without solver-provided information**.

The following are allowed and do not invalidate Clean:

- Undo;
- Restart.

The following invalidate Clean for the current attempt:

- Hint;
- Rescue.

Restart begins a fresh attempt and resets the current attempt's assistance flag. Therefore a player may use a Hint, restart, then solve from the starting position without Hint/Rescue and still earn Clean.

Clean never gates campaign progress.

## Mastery count and ranks

The only mastery total is `Clean levels / 50`.

Working rank thresholds are:

| Clean | Rank |
|---:|---|
| 0 | Новичок / Novice |
| 5 | Ученик / Apprentice |
| 15 | Знаток / Adept |
| 30 | Стратег / Strategist |
| 40 | Эксперт / Expert |
| 50 | Мастер / Master |

Ranks are derived from Clean count. They are status only and unlock no gameplay or currency.

## Level-select states

A level has only these meaningful visual states:

- locked;
- current/unresolved;
- solved;
- clean.

Use a simple distinction such as:

- `✓` for Solved;
- `◆` for Clean.

Do not add three-star ratings, numerical per-level scores, crowns, chests, keys, or reward tracks.

## Chapter screen role

The Chapters screen is secondary navigation, not the primary campaign flow.

Its purposes are:

- inspect progress;
- revisit an older solved level;
- pursue missing Clean results.

After ordinary level completion, the primary flow goes directly to `Next`, not back to level select.

---

# 6. Tutorial and first-session flow

## Tutorial goal

The tutorial should take roughly 60–90 seconds and teach through direct interaction rather than a rules slideshow.

The instructional order is:

1. remove a valid pair;
2. understand that removal opens space and affects availability;
3. understand the three-consecutive-empty-neighbour freedom rule;
4. understand remaining composition / metal ordering when relevant.

The tutorial must not hard-block otherwise legal clicks.

## First five campaign levels

The first five levels are curated around these learning goals:

1. **Level 1 — satisfying clearing.** Small board, many safe moves, very high first-attempt success probability.
2. **Level 2 — opening the board.** A removal visibly frees several future options.
3. **Level 3 — first meaningful choice.** Two attractive choices exist; one develops the board better without requiring a severe punishment.
4. **Level 4 — metal order becomes visibly relevant.** The existing metal chain matters to the solution.
5. **Level 5 — first real small puzzle.** A plausible route can reach an actual dead end, but the mistake becomes visible quickly.

Early composition may be simplified for pedagogy, but no hidden rules are disabled or unlocked by chapter progression.

## First-session reveal

- Tutorial completes -> directly enter Campaign Level 1.
- After Level 5 -> return to Home once and reveal Daily.
- After Level 10 -> show a Chapter 1 completion moment and reveal Endless.

Avoid currency rewards, loot, or feature-tour popups during this flow.

---

# 7. Campaign Board HUD

The Board is the primary visual object. Permanent UI is intentionally sparse.

## Always available

- back/menu navigation;
- chapter + level identity;
- remaining-piece information;
- Undo;
- Hint;
- overflow/pause menu containing Restart, Settings, and Exit.

Restart does not require premium currency and is always available.

## Remove from permanent Board HUD

- Dust;
- Shop entry;
- booster inventory counts;
- permanent Rescue button;
- separate `Move` and `Hint` actions when they represent the same solver-help concept;
- campaign score;
- oversized decorative HUD plaques.

## Hint

The current `Move` concept becomes the player-facing **Hint**.

A Hint must still come from a solver-verified route to a full clear. A merely legal move is not sufficient.

Using Hint invalidates Clean for the current attempt.

During the tutorial and Campaign Levels 1–5, Hint is available without an advertisement so the player can learn what assistance does. Starting with Campaign Level 6, normal Hint use requires a confirmed rewarded advertisement. Free onboarding Hint still invalidates Clean for that attempt.

If the solver cannot verify a winning route within its bounded budget:

- no reward/charge is consumed;
- no false hint is shown;
- do not tell the player the position is mathematically doomed while legal moves remain.

## Undo

Undo is free and unlimited within the current attempt while normal play is active.

Undo restores the state immediately before the latest successful removal.

Undo provides no new solver information and therefore does **not** invalidate Campaign Clean.

## Actual dead end

A player-facing dead end exists only when:

```text
board is not cleared AND legal move count == 0
```

Solver-proven unsolvability while legal moves remain stays internal.

At an actual Campaign dead end, replace the normal action state with a focused choice:

- `Restart`;
- `Rescue attempt` (free during onboarding Levels 1–5, rewarded from Level 6 onward).

A successful Rescue restores a solver-proven safe history state and invalidates Clean for that attempt.

Campaign allows at most **one Rescue per attempt**. During Campaign Levels 1–5 that Rescue is available without an advertisement as onboarding; starting with Level 6 it requires a confirmed rewarded advertisement. In either case Rescue invalidates Clean. After the one Rescue is used, a later true dead end in the same attempt offers Restart only.

---

# 8. Completion flow

## Ordinary Campaign level

After clearing a level, show a compact result state.

If Clean was earned:

```text
LEVEL COMPLETE
◆ CLEAN SOLUTION
18 / 50 CLEAN

[NEXT]
```

If assistance was used:

```text
LEVEL COMPLETE
Solved with help

[NEXT]
[Try Clean]
```

`Next` is always the dominant action while another campaign level remains.

## Chapter completion

After Levels 10, 20, 30, 40, and 50, show a slightly stronger milestone state with:

- chapter name;
- `10 / 10 solved`;
- clean count within the chapter;
- a newly reached mastery rank when applicable;
- next chapter / completion CTA.

No chest, currency reward, or unique chapter art is required.

---

# 9. Daily mode

## Core contract

Daily provides exactly one shared puzzle per calendar day.

All players on the same build/day receive the same board. Daily generation must therefore use a global deterministic date key rather than browser-local time.

For the Yandex-focused product, the global day boundary is **00:00 Europe/Moscow**, and the week runs Monday through Sunday in the same timezone.

A suitable conceptual seed namespace is:

```text
daily-v1:YYYY-MM-DD
```

The generated puzzle must pass the same solvability and quality gates used by the Campaign candidate pipeline.

## Availability

- Daily unlocks after Campaign Level 5 is solved.
- Today's puzzle is playable only during its calendar day.
- Missed previous days are not backfilled as an archive.
- Today's puzzle may be replayed any number of times until the day changes.

## Daily result states

For each date store:

- solved or not solved;
- clean or not clean.

Undo and Restart preserve Clean eligibility. Hint/Rescue invalidate it for that attempt exactly as in Campaign. A later fresh attempt may still earn Clean.

## Weekly history instead of fragile infinite streak

Do not use a single endless consecutive-day streak that resets to zero after one missed day.

Show the current week as seven daily slots:

```text
MON TUE WED THU FRI SAT SUN
 ◆   ✓   ◆   ·   ·   ·   ·
```

At week end, preserve summary/history such as:

- days solved out of 7;
- days clean out of 7;
- best completed week.

Missing one day does not erase previous history or make the rest of the week pointless.

## Daily difficulty rhythm

Daily is not random from trivial to extreme.

Use a controlled target profile with a light weekly rhythm:

- Monday–Thursday: medium;
- Friday: medium-hard;
- Saturday: hard;
- Sunday: interesting/challenge.

This rhythm is an internal generation target and does not require explicit difficulty labels in the UI.

## Daily monetization

Daily uses the same assistance contract as Campaign:

- Undo free;
- Hint via rewarded ad after onboarding;
- Rescue offered only at a true dead end and limited to one per attempt;
- solver assistance prevents Clean for that attempt.

There is no Daily coin/chest/booster reward.

---

# 10. Endless mode

## Core fantasy

Endless answers one question:

> How many increasingly difficult boards can I clear in one run?

The primary run result is **boards cleared**.

Remove the current product emphasis on:

- per-piece score;
- board-clear point values;
- streak score multipliers;
- multiplier thresholds;
- score farming.

## Run flow

A run starts with an easier board. Clearing it immediately advances to the next board with a higher target difficulty band.

Conceptually:

```text
Board 1 -> Board 2 -> Board 3 -> ... -> true dead end -> result
```

The plate size may progress through 37, 61, and 91 cells, but after reaching the large phase intellectual difficulty continues to rise through puzzle structure rather than ever-growing board dimensions.

After a high but still human-appropriate difficulty ceiling is reached, later boards remain inside that difficult range instead of generating increasingly pathological solver monsters.

## End condition

A run ends only at a **true player-visible dead end**:

```text
board is not cleared AND legal move count == 0
```

Do not end the run merely because the solver has proven that no full clear remains while legal moves still exist.

## Undo in Endless

Undo is free and does not mark a run assisted while normal play is active.

However, once the player reaches a true zero-legal-moves dead end, ordinary Undo is no longer offered as a way to repeatedly brute-force alternate branches. The run is in its end/rescue state.

This preserves meaningful risk without monetizing ordinary correction.

## Hint and assisted runs

Using Hint marks the run `ASSISTED` permanently.

The player may continue the run, but its final result cannot replace the best unassisted record or enter any future competitive ranking.

Undo alone does **not** mark a run assisted in the redesigned rules.

## Rescue

At the first true dead end, the player may:

- end the run; or
- watch a rewarded ad to Rescue the run.

Rescue restores the most recent solver-proven solvable history state and marks the run `ASSISTED`.

Only **one Rescue per Endless run** is allowed. A later true dead end ends the run.

## Persistent Endless statistics

Persist at minimum:

- best unassisted boards-cleared record;
- optionally the furthest assisted run for personal display, but never as the canonical best.

Do not ship a global leaderboard in this redesign. A future fair competitive version should use a shared seeded sequence such as Weekly Endless so all ranked players face the same boards.

---

# 11. Assistance monetization and removal of economy

## Remove

The redesign removes all public product dependency on:

- Dust balances;
- campaign Dust rewards;
- Endless Dust rewards;
- Shop bundles;
- owned Move/Undo/Rescue quantities;
- depleted-item purchase dialogs;
- currency-driven booster acquisition.

Existing code may be removed or disconnected as implementation requires, but no dead economy UI may remain visible.

## Keep rewarded ads as direct assistance

Rewarded ads should purchase an immediate, understandable action rather than an intermediate currency.

Examples:

- `Show a hint` -> rewarded ad -> one verified Hint;
- `Save this attempt` -> rewarded ad -> Rescue.

The existing platform rule remains: a reward takes effect only after the platform adapter confirms the rewarded callback. Early close, unavailable SDK, error, or concurrent request grants nothing.

Remove the current persistent 60-second product-level rewarded cooldown. The platform adapter must still reject concurrent rewarded requests and obey SDK availability/callback rules, but the redesigned product does not impose its own arbitrary timer between completed rewarded ads.

## Interstitials

The functional redesign does not enable forced/interstitial ads during the gameplay-validation phase.

If retention later validates the product, a separate monetization pass may test rare interstitials only between completed levels/runs, never during an active board, never before Rescue, and never immediately after a rewarded ad.

---

# 12. Generator and difficulty scorer redesign

## Architecture principle

Do not replace the solver unnecessarily.

The existing generator already produces certified solvable boards, and the existing progression analysis already computes useful route/choice metrics. The redesign should build on that infrastructure while replacing the old chapter-mechanic and shape-family selection logic.

The target pipeline is:

```text
canonical plate size
        ↓
generate many solvable candidates
        ↓
solver / route analysis
        ↓
difficulty metrics
        ↓
chapter or mode target profile
        ↓
quality filter + ranking
        ↓
Campaign: human curation and freeze
Daily/Endless: deterministic runtime selection
```

## V1 difficulty axes

Do not reduce puzzle quality to one opaque scalar. Preserve a profile.

### Freedom

How much meaningful choice the player has.

Use existing metrics such as:

- initial legal move count;
- average/min/max legal move count;
- meaningful move count.

### Risk

How often a legal-looking decision leads away from a solvable route.

Use/extend existing early risky decision analysis.

### Deception

How often alternatives that look equivalent at the surface have substantially different future outcomes.

Use/extend existing early deceptive decision analysis.

### Consequence depth

Add a V1 metric describing how long a bad choice can remain non-obvious before it reaches a player-visible dead end.

A practical bounded implementation may estimate this from sampled losing continuations and exact search on small boards. The metric must represent **delay between the losing decision and visible zero-legal-moves failure**, not merely whether a bad choice exists.

Avoid selecting puzzles whose mistakes are so delayed that they become tedious rather than insightful.

### Route win probability

Keep sampled route win probability as a useful aggregate signal of how forgiving a board is under plausible/random legal play.

## Deferred V2 metric: metal pressure

Metal dependency is an important part of the game's depth, but a dedicated `metalPressure` metric is not required for the first scorer refactor.

First ship the fixed-plate pipeline using existing choice/risk/deception/route metrics plus consequence depth. Add explicit metal-pressure analysis only if manual curation shows that the existing metrics cannot reliably separate Order/Mastery candidates.

## Relative normalization

Where practical, compare metrics within candidate pools of the same plate size and use relative percentile bands rather than hard-coding one raw legal-move threshold across 37/61/91-cell boards.

This prevents board size from masquerading as difficulty.

## Chapter target profiles

Working relative targets:

| Chapter | Freedom | Risk | Deception | Consequence depth |
|---|---:|---:|---:|---:|
| 1 Basics | high | low | very low | 1–2 moves |
| 2 Planning | medium-high | low-medium | low | 2–3 moves |
| 3 Order | medium | medium-high | medium | 2–4 moves |
| 4 False Moves | medium | high | high | 3–5 moves |
| 5 Mastery | low-medium to medium-high depending on puzzle archetype | high | high | 4–7 moves |

Mastery must not simply maximize every metric simultaneously. Reject pathological candidates with almost no meaningful freedom, excessive delayed punishment, or other solver-hostile characteristics that make the puzzle unpleasant rather than clever.

## Candidate counts and curation

For each campaign target profile, generation should be able to create a large candidate pool (hundreds to thousands as performance permits), filter it, and expose a small shortlist for human playtesting.

The generator is a **level-designer tool**, not the final campaign author.

---

# 13. Minimal functional presentation phase

The redesign must be implemented and evaluated before final visual work resumes.

## Temporary visual language

Use an intentionally simple, asset-free presentation similar to early Hex Garden prototypes:

- plain or softly colored background;
- canonical hex plate drawn with Phaser primitives;
- circular colored tokens;
- simple text/glyph atom marks;
- plain rectangular/text actions;
- clear typography and spacing;
- simple hover/selected/locked states;
- no decorative material assets;
- no generated textures;
- no wooden/leather/brass panels;
- no Blender-rendered UI;
- no cosmetic theme work.

The temporary presentation should be pleasant enough for real playtesting but must not become a second art-direction project.

## Functional acceptance questions

Before resuming final art direction, playtesting should answer:

- Does `Next` create a one-more-level loop?
- Do the five chapters feel meaningfully different without new mechanics?
- Is Clean motivating without blocking weaker players?
- Does Daily create a natural reason to return?
- Is weekly Daily history preferable to a fragile infinite streak?
- Does Endless feel tense enough with free Undo but a hard boundary at true dead end?
- Are Hint and Rescue useful without turning the game into ad farming?
- Are 37/61/91 enough to create duration variety?
- Does the fixed canonical plate feel stronger than variable silhouettes?

Final art work should begin only after these questions are answered satisfactorily.

---

# 14. Persistence model

The redesign should move to explicit versioned stores whose data matches the simplified product.

## Campaign progress

Persist:

- tutorial completion;
- solved level IDs;
- clean level IDs;
- highest unlocked level / contiguous solved prefix;
- campaign completed flag if useful as a derived cache.

Do **not** persist campaign score or per-level score in the new product model.

Mastery count/rank are derived from clean levels.

## Daily progress

Persist a compact bounded history keyed by global Daily date containing:

- solved;
- clean.

Persist the latest **90 Daily date entries** for calendar/history UI plus compact all-time summaries such as best solved week and best clean week. Entries older than the rolling 90-day window may be discarded after their aggregate summaries are updated.

## Endless progress

Persist:

- best unassisted boards cleared;
- optional best assisted boards cleared.

A live Endless run is **session-scoped** in the first redesign and is not resumed after a full page/app restart. Deterministic board generation still reproduces each board from its run seed/index while the session is active. Persistent resume can be evaluated later only if playtesting shows it is necessary.

## Settings

Preserve existing persistent language and sound preferences.

## Migration from current development saves

The current 24-level score/economy save format is incompatible with the new 50-level Solved/Clean model and has not shipped as a stable production contract.

For the redesign migration:

- preserve language and sound settings;
- start the new campaign progression from a clean new-version state;
- ignore/remove legacy Dust, booster inventory, campaign score, and old Endless score records from the public UI;
- do not attempt to map old 24-level completion to the new curated 50-level campaign.

This avoids silently claiming mastery of levels the player has never played.

---

# 15. Responsive UX principles

The functional redesign remains responsive on:

- desktop landscape;
- phone portrait;
- phone landscape.

Portrait is the primary constraint for Board HUD simplicity.

## Board priorities

1. keep the full plate readable;
2. keep remaining information understandable;
3. keep Undo and Hint reachable;
4. move secondary controls into overflow rather than shrinking everything into tiny buttons.

No full-width decorative top/bottom chrome is required.

## Home priorities

The primary `Continue` card/action must dominate. Daily and Endless are secondary. Chapters and Settings are navigation utilities.

The menu should use actual game state/content rather than requiring unique illustrations for every mode, but the minimal functional phase may use plain text/cards until final visual design resumes.

---

# 16. Current implementation contracts explicitly superseded by this design

Once implementation of this design begins, the following current contracts in `PROJECT.md`, `AGENTS.md`, `CURRENT_STATE.md`, and tests are intentionally replaced and must be updated rather than preserved accidentally:

- 24-level campaign -> 50 fixed levels;
- chapter progression by mechanic introduction -> chapter progression by decision difficulty;
- variable public campaign shape families -> one regular hex plate in 37/61/91 sizes;
- campaign score -> removed;
- Dust economy -> removed;
- Shop -> removed;
- booster inventory -> removed;
- paid/owned Undo -> free unlimited Undo during normal play;
- Undo marking Endless assisted -> **removed**; Undo is non-assisted;
- permanent Move/Undo/Rescue inventory HUD -> minimal Undo + Hint HUD, contextual Rescue;
- Rescue being Endless-only -> Rescue also becomes a one-per-attempt rewarded option at true dead ends in Campaign/Daily;
- existing Endless point score and multiplier ladder -> boards-cleared record;
- current local/fake leaderboard as a main product destination -> removed from first-release navigation;
- Endless unlock after Level 9 -> unlock after Chapter 1 / Level 10;
- Daily absent -> Daily added after Level 5;
- completion reward screen centered on score/Dust -> compact Solved/Clean result and direct Next flow;
- current Physical Premium presentation as the live focus -> temporarily replaced by minimal functional primitives during this redesign.

The audited Garden move rules and internal atom IDs are **not** superseded.

---

# 17. Testing and acceptance contract

Implementation planning must include automated and manual coverage for at least the following.

## Rules regression

- all audited pairing rules;
- freedom geometry;
- off-plate emptiness;
- metal chain;
- Gold removal;
- solver unknown vs proven-unsolvable semantics.

## Fixed plate geometry

- exact 37/61/91 plate cell counts;
- no public campaign shape-family selection;
- generated occupied positions are always inside the canonical plate;
- board presentation retains the full canonical outer plate regardless of occupancy.

## Campaign

- exactly 50 levels;
- ten levels per chapter;
- exact planned plate-size schedule;
- sequential unlock;
- Solved and Clean persistence;
- Undo/Restart preserve Clean eligibility;
- Hint/Rescue invalidate only the current attempt;
- restart after assistance can still earn Clean;
- completion flows directly to Next;
- post-50 mastery Continue selects an unresolved Clean target.

## Unlocks

- Daily hidden before Level 5 completion and visible after it;
- Endless hidden before Level 10 completion and visible after it.

## Daily

- deterministic same-day seed;
- Moscow-time day/week boundary;
- unlimited same-day replays;
- no backfill of missed days;
- solved/clean weekly history;
- Daily candidate passes solver/quality gate.

## Endless

- result is boards cleared;
- difficulty band increases without unbounded board-size growth;
- legal moves remain playable even when solver has proven the state unsolvable;
- true zero-legal-moves dead end triggers run-end state;
- free Undo works before dead end and does not mark assisted;
- Undo is unavailable as brute-force recovery after true dead end;
- Hint marks assisted;
- one Rescue per run;
- Rescue marks assisted;
- assisted result cannot replace best unassisted result.

## Assistance / ads

- Hint only uses a solver-verified winning route;
- failed/unknown solver result does not consume reward or expose hidden doom;
- rewarded action is granted only after confirmed reward callback;
- campaign/daily Rescue is limited to one per attempt;
- no Dust/Shop/inventory UI remains reachable.

## Responsive flows

Smoke test the full first-session flow and all primary mode flows on desktop, portrait phone, and landscape phone.

---

# 18. Implementation sequencing constraint

This specification deliberately separates **functional redesign** from **final visual redesign**.

Implementation planning should therefore prioritize:

1. product/persistence contract changes;
2. fixed-plate campaign and scorer pipeline;
3. Campaign Solved/Clean/mastery flow;
4. minimal Board/Home/Chapters UI;
5. Daily;
6. Endless redesign;
7. economy/shop/legacy-product cleanup;
8. final functional playtest and balancing;
9. only then a separate visual-design specification.

Do not restart asset generation as part of this implementation plan.

---

# Final product definition

Hex Garden is a puzzle game about clearing a regular hexagonal field by making legal pair/removal decisions whose consequences depend on spatial availability and ordering.

The player progresses through 50 fixed puzzles, can master them by solving without solver assistance, returns for one shared Daily puzzle, and tests endurance in Endless. The product uses one ruleset, one canonical board geometry in three sizes, and one generator/solver/scorer infrastructure.

Retention comes from:

1. satisfying board clearing;
2. increasingly clever decision structure;
3. Campaign progression;
4. Clean mastery and ranks;
5. Daily weekly history;
6. Endless personal best.

It does not depend on a content treadmill, cosmetic collection, currency economy, or continuous addition of new mechanics.
