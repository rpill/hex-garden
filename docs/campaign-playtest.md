# Campaign Curation Playtest — Functional V1

Date: 2026-09-09

This checkpoint curates the fixed 50-level Campaign data only. It does not change runtime APIs, rules, assistance, navigation, or presentation.

## Method

The starting point was the deterministic `campaign-v2` shortlist/frozen Campaign. The original `build/campaign-shortlist.json` is an authoring artifact and was not present in the supplied checkout, so the current candidate-0 records were treated as the already-frozen shortlist winners and the deterministic shortlist pools were regenerated only for levels that failed review. The final selection is recorded in `build/campaign-selection.json`.

Review used the existing difficulty metrics plus direct board-state inspection:

- sampled route win probability for forgiveness / failure pressure;
- early risky and deceptive decision steps for choice pressure;
- median consequence depth for how long a bad choice can stay hidden;
- direct solver checks for the onboarding openings;
- a bounded breadth-first search for Level 5's first true zero-moves dead end;
- metal-order pressure for Chapter 3: a step counts when a later metal would be geometrically removable with available Quicksilver but is blocked specifically by the Lead -> Tin -> Iron -> Copper -> Silver -> Gold order.

The rhythm comparisons below are curation aids, not new runtime metrics. Final responsive/feel acceptance still belongs to Plan 6 Task 8.

## Frozen selection

All unspecified levels keep shortlist candidate index `0`.

| Level | Candidate index | Selected seed | Why replaced |
| ---: | ---: | --- | --- |
| 22 | 2 | `campaign-v2:level:21:candidate:0` | Old choice had zero observable metal-order pressure; replacement has eight blocked-order steps, starting immediately. |
| 24 | 3 | `campaign-v2:level:23:candidate:43` | Softer relief profile and stronger order identity: five blocked-order steps instead of two late ones. |
| 29 | 4 | `campaign-v2:level:28:candidate:24` | Better pre-exam relief while retaining five metal-order pressure steps. |
| 39 | 2 | `campaign-v2:level:38:candidate:6` | Old level was harder than both L38 and L40 on the review proxy; replacement is a real relief without losing false-move pressure. |

No new authoring namespace was needed.

## Levels 1–5 onboarding goals

### Level 1 — PASS

High first-attempt success and satisfying clear. Sampled route win probability is `0.9375`; all seven legal opening moves were solver-verified as still leading to a solution. The board therefore teaches removal/freedom without punishing reasonable experimentation.

### Level 2 — PASS

One removal visibly opens future options. The certificate opening increases legal moves from `8` to `10`, while all eight starting branches remain solver-solvable. The opening demonstrates that removing a pair can expose multiple new choices rather than just advance a forced sequence.

### Level 3 — PASS

First meaningful choice without harsh punishment. The initial state has two meaningful move categories and seven concrete legal moves; every opening branch tested remains solvable. It introduces choice before the Campaign starts attaching real cost to a wrong branch.

### Level 4 — PASS

Metal order visibly matters. At the start Lead is available while Tin and Iron are order-locked. Along the certificate, Lead is removed first, Tin becomes available next, and Iron only becomes available after Tin. The rule is therefore observable rather than merely described.

### Level 5 — PASS

Planning can fail for real. The first risky decision appears at step 1, sampled route win probability drops to `0.34375`, and an actual zero-legal-moves dead end is reachable in six removals. This is early enough to teach that a plausible sequence can poison the board without making the level an immediate coin flip.

## 50-level keep / replace review

### Chapter 1 — Basics

| Level | Decision | Reason |
| ---: | --- | --- |
| 1 | KEEP | Very forgiving opener: `0.9375` sampled win and no risky early decisions. |
| 2 | KEEP | Opening removal expands legal options `8 -> 10`, clearly teaching exposure. |
| 3 | KEEP | First meaningful branching exists, but opening choices are still solver-safe. |
| 4 | KEEP | Intended relief plus visible three-metal order introduction; `0.96875` sampled win. |
| 5 | KEEP | First real planning lesson: risky from step 1 and true dead end reachable in six removals. |
| 6 | KEEP | Recovery after L5: `0.5625` sampled win and only two risky early decision steps. |
| 7 | KEEP | Gentle second ramp: `0.59375` sampled win with one risky early step. |
| 8 | KEEP | First strong peak and first medium plate: nine risky early steps, median consequence `8.5`. |
| 9 | KEEP | Clear relief from L8/L10: `0.4375` sampled win and only three risky steps. |
| 10 | KEEP | Chapter exam: all ten analyzed early decisions risky, three deceptive, median consequence `10`. |

### Chapter 2 — Planning

| Level | Decision | Reason |
| ---: | --- | --- |
| 11 | KEEP | Re-establishes room to plan after the first exam: `0.40625` sampled win, three risky steps. |
| 12 | KEEP | Strong ramp: eight risky steps and median consequence `10`. |
| 13 | KEEP | Sustains planning pressure with `0.125` sampled win and three deceptive steps. |
| 14 | KEEP | Strong relief: `0.4375` sampled win, only two risky steps, median consequence `5`. |
| 15 | KEEP | Returns to a medium-plate peak with eight risky and three deceptive steps. |
| 16 | KEEP | Mid-chapter reset: risk falls to six steps and deception to one. |
| 17 | KEEP | Compact small-plate planning drill before the late peak. |
| 18 | KEEP | Late peak: eight risky, four deceptive, median consequence `9`. |
| 19 | KEEP | Relief is subtle but real: same route pressure as L18 with less deception and shorter consequences. |
| 20 | KEEP | Chapter exam: ten risky steps, three deceptive steps, `0.15625` sampled win. |

### Chapter 3 — Order

| Level | Decision | Reason |
| ---: | --- | --- |
| 21 | KEEP | Order chapter opens with four observable metal-order pressure steps. |
| 22 | REPLACE -> 2 | Old candidate had **zero** metal-order pressure; selected candidate has eight blocked-order steps from step 1. |
| 23 | KEEP | Compact sequencing drill with three blocked-order steps and comparatively forgiving `0.28125` sampled win. |
| 24 | REPLACE -> 3 | Better relief and clearer identity: `0.25` sampled win, five blocked-order steps from step 1. |
| 25 | KEEP | First order peak: eight blocked-order steps, nine risky steps, `0.0625` sampled win. |
| 26 | KEEP | Large-plate reset still preserves five sequencing-pressure steps. |
| 27 | KEEP | Strong ramp: six order-pressure steps and nine risky early decisions. |
| 28 | KEEP | Small-plate late-chapter variation; three order-pressure steps keep sequencing relevant. |
| 29 | REPLACE -> 4 | Softer pre-exam relief (`0.25` sampled win) while retaining five order-pressure steps. |
| 30 | KEEP | Local exam: five order-pressure steps, ten risky decisions, five deceptive, median consequence `11`. |

Every selected Chapter 3 board has at least one state where metal order blocks an otherwise geometrically available metal move; no selected board treats metal sequencing as purely incidental.

### Chapter 4 — False Moves

| Level | Decision | Reason |
| ---: | --- | --- |
| 31 | KEEP | Establishes false-move pressure immediately: nine risky and three deceptive early steps. |
| 32 | KEEP | Gives a modest route-win rebound while preserving eight risky and two deceptive steps. |
| 33 | KEEP | Strong pre-relief peak: ten risky, four deceptive, median consequence `10`. |
| 34 | KEEP | Relief is intentionally shallow, but it is not harder than both neighboring peaks and preserves four deceptive steps. |
| 35 | KEEP | Mid-chapter trap peak: `0.03125` sampled win, ten risky, five deceptive. |
| 36 | KEEP | Reset from L35: sampled win rises to `0.15625` and deception drops to three. |
| 37 | KEEP | Small-plate deception drill: nine risky, four deceptive, shorter median consequence `8`. |
| 38 | KEEP | Late peak: ten risky and six deceptive steps. |
| 39 | REPLACE -> 2 | New relief is below both L38 and L40 on the review proxy while still carrying ten risky/four deceptive steps. |
| 40 | KEEP | Chapter exam remains the local culmination after L39 relief: `0.0625` sampled win, ten risky, five deceptive. |

### Chapter 5 — Mastery

| Level | Decision | Reason |
| ---: | --- | --- |
| 41 | KEEP | Mastery baseline already demands sustained risk: nine risky and four deceptive steps. |
| 42 | KEEP | Large-plate pressure with ten risky decisions and median consequence `10`. |
| 43 | KEEP | Compact small-plate mastery check with ten risky and three deceptive steps. |
| 44 | KEEP | Clear relief from adjacent levels: nine risky, two deceptive, median consequence `8`. |
| 45 | KEEP | Large-plate peak with ten risky/four deceptive decisions and consequence median `11`. |
| 46 | KEEP | Route pressure spikes to `0.03125` sampled win while ten early decisions remain risky. |
| 47 | KEEP | Small-plate reset: eight risky steps, sampled win rebounds to `0.125`. |
| 48 | KEEP | Late mastery peak: `0.03125` sampled win and median consequence `11`. |
| 49 | KEEP | Relief before the finale: sampled win `0.125`, below the surrounding peak pressure. |
| 50 | KEEP | Final exam: `0.03125` sampled win, ten risky and seven deceptive steps — strongest deception finish. |

## Rhythm check

The chapter rhythm uses positions 4 and 9 as relief beats and position 10 as the local exam.

- Chapter 1: L4 and L9 are clear drops; L10 is the strongest local exam.
- Chapter 2: L14 is a strong drop; L19 reduces deception/consequence versus L18 and feeds into a harder L20.
- Chapter 3: L24 and L29 were softened during curation; L30 remains the clear maximum-pressure exam.
- Chapter 4: L34 is a shallow relief; L39 was replaced because the provisional board was harder than both L38 and L40; L40 now reads as the final chapter exam.
- Chapter 5: L44 and L49 are relief beats; L50 is the strongest deceptive endpoint.

## Freeze result

Selection changes exactly four runtime records: Levels 22, 24, 29, and 39. All other frozen Campaign records remain byte-equivalent at the record level.

Freeze command:

```powershell
pnpm freeze:campaign -- --selection build/campaign-selection.json
```

Required verification:

```powershell
node --import tsx --test test/campaign.test.js
pnpm typecheck
```

The Campaign remains fixed-data-only at runtime. The authoring shortlist and selection files are build artifacts; `src/data/campaign-levels.json` is the runtime source of truth.
