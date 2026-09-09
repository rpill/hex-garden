# Hex Garden — Functional Redesign Manual Acceptance

## Acceptance status

**NOT YET APPROVED — manual browser playtest is still required.**

This document is the final Plan 6 product/responsive checkpoint. Automated evidence may prove state transitions, persistence boundaries, solver/rewarded policy, and layout contracts, but it cannot answer the subjective product questions in the last section and it cannot prove touch comfort on a real phone.

Do **not** reopen final art direction / Physical Premium runtime work until every required manual row below has a recorded result and every product question is answered YES or has a follow-up product task.

## Automated preflight evidence

Fresh reconstructed-tree evidence before manual playtest:

| Check | Result | Notes |
| --- | --- | --- |
| Prior responsive/navigation/completion + Campaign/Daily/Endless/persistence baseline | **PASS — 112/112** | Pre-Daily-Archive baseline; retained as historical supporting evidence |
| Daily Archive focused regression | **PASS — 53/53** | Calendar/progress/archive scene/Board routing/utility navigation/interstitial/rewarded contracts; `0 fail`, `0 skip` |
| Rewarded/Yandex assistance and storage contracts | **PASS — 35/35** | Prior supporting evidence includes early-close/unavailable reward denial and player-data writes |
| Frozen Campaign certificate replay | **PASS — 50/50** | Prior supporting evidence from `scripts/check-campaign.mjs 50` |
| Full normal `pnpm test` / `typecheck` / `build` gate for this Daily Archive tree | **LOCAL RUN REQUIRED** | This environment has no project `node_modules`; Corepack cannot reach npm (`EAI_AGAIN registry.npmjs.org`) |
| Live `pnpm yandex:dev` smoke in this ChatGPT environment | **NOT RUN** | Dependency install is unavailable here (`EAI_AGAIN registry.npmjs.org`) |

Automated PASS is supporting evidence only. It does not replace the manual rows below.

## Recommended manual setup

Run the current checkout locally with installed dependencies:

```powershell
pnpm check:campaign
pnpm test
pnpm typecheck
pnpm build
pnpm yandex:dev
```

Use these representative viewport sizes in browser responsive mode, then repeat the phone checks on an actual touch device if available:

- **Desktop landscape:** `1280 × 720`
- **Phone portrait:** `390 × 844`
- **Phone landscape:** `844 × 390`

For persistence checks, refresh/reopen the page after changing progress/settings. For first-launch checks, use a genuinely fresh/reset dev player-data state rather than an already-progressed profile.

Result convention used below:

- `☐ PASS` — behavior was manually observed and accepted.
- `☐ FAIL` — behavior was manually observed and failed; write the defect in Notes.
- `☐ N/A` — use only when the exact scenario cannot apply in the tested environment; explain why.

---

## 1. Desktop landscape — 1280 × 720

| ID | Manual scenario | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| D-01 | Start from a fresh profile. | First launch enters Tutorial; completing Tutorial leads into Campaign Level 1 without obsolete Shop/score/economy UI. | ☐ PASS ☐ FAIL | |
| D-02 | Complete Level 1, return Home, press Continue. | Continue clearly offers the next Campaign destination and produces an immediate one-more-level path. | ☐ PASS ☐ FAIL | |
| D-03 | Open Chapters from Home and move between Home/Chapters/Board. | Five chapters of ten levels are reachable; navigation never requires keyboard-only input. | ☐ PASS ☐ FAIL | |
| D-04 | Progress through Level 5 and return Home. | Daily becomes visible after the first 5 Campaign solves and not before. | ☐ PASS ☐ FAIL | |
| D-05 | Progress through Level 10 and return Home. | Endless becomes visible after the first 10 Campaign solves and not before. | ☐ PASS ☐ FAIL | |
| D-06 | On Campaign Levels 1–5 request Hint/Rescue where valid. | Onboarding assistance is free; solver verifies the action first; Hint/Rescue mark only the current attempt assisted. | ☐ PASS ☐ FAIL | |
| D-07 | On Campaign Level 6+ request a valid Hint/Rescue. Close rewarded early once, then complete rewarded once. | Early close/error/unavailable grants no action; confirmed rewarded grants exactly the solver-verified action. | ☐ PASS ☐ FAIL | |
| D-08 | Use Undo and Restart in Campaign before any Hint/Rescue. | Both are free and preserve Clean eligibility. | ☐ PASS ☐ FAIL | |
| D-09 | Finish one Campaign level assisted, then replay it clean. | First result is Solved-with-help; later clean replay upgrades it to Clean without blocking progression. | ☐ PASS ☐ FAIL | |
| D-10 | Open Daily, refresh on the same Moscow date, complete/replay it. | Same date keeps the same board; Solved can upgrade to Clean; no currency/chest/Shop reward flow appears. | ☐ PASS ☐ FAIL | |
| D-11 | Inspect Daily week history and open Archive. | Monday–Sunday row remains readable; Archive exposes the trusted rolling 90-day calendar after Daily unlock. | ☐ PASS ☐ FAIL | |
| D-12 | Start Endless and clear several boards. | Run uses consecutive boards; 37 → 61 → 91 staging is apparent; next board starts automatically; result is boards cleared, never points. | ☐ PASS ☐ FAIL | |
| D-13 | In Endless use Undo before dead end, then Hint in another run. | Undo remains free/unassisted; verified+rewarded Hint permanently marks only that run assisted. | ☐ PASS ☐ FAIL | |
| D-14 | Reach a true Endless dead end, use Rescue, then reach another true dead end. | Normal Undo is unavailable at dead end; one verified+rewarded Rescue restores a safe history state; second true dead end ends the run. | ☐ PASS ☐ FAIL | |
| D-15 | Finish a clean Endless run and an assisted run with a larger board count. | Assisted best is stored separately and cannot replace the canonical clean best shown on Home. | ☐ PASS ☐ FAIL | |
| D-16 | Enter Settings from Home and from a paused Board; toggle language and sound, return, refresh. | Return path is correct; Russian/English and sound persist; Board resumes without losing attempt state. | ☐ PASS ☐ FAIL | |
| D-17 | Refresh/reopen after Campaign/Daily/Endless/settings changes. | Persistent product state survives through the player-data boundary where applicable; live Endless run itself is not resumed. | ☐ PASS ☐ FAIL | |

### Desktop verdict

- ☐ PASS
- ☐ FAIL
- Notes:

---

## 2. Phone portrait — 390 × 844

Test at least one board from each plate size. Suggested Campaign examples from the current frozen dataset: any 37-cell level, any 61-cell level, and one radius-5 / 91-cell level such as Level 26 or later.

| ID | Manual scenario | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| P-01 | Home with Campaign only, then with Daily, then with Daily + Endless unlocked. | Continue remains the dominant action; secondary cards/actions never visually overtake it. | ☐ PASS ☐ FAIL | |
| P-02 | Open a 37-cell Board. | Full canonical plate is visible and readable; no important piece is hidden under HUD/inventory. | ☐ PASS ☐ FAIL | |
| P-03 | Open a 61-cell Board. | Full canonical plate remains visible/readable and individual tokens are comfortably tappable. | ☐ PASS ☐ FAIL | |
| P-04 | Open a 91-cell Board. | Full canonical plate remains visible/readable; tokens and labels are still distinguishable enough for play. | ☐ PASS ☐ FAIL | |
| P-05 | Play using only on-screen controls. | Undo and Hint are always reachable without keyboard; pause/secondary actions are accessible. | ☐ PASS ☐ FAIL | |
| P-06 | Open Pause/Settings/Chapters and return to Board. | No required navigation is clipped or keyboard-only; returning preserves the intended Board state. | ☐ PASS ☐ FAIL | |
| P-07 | Trigger Campaign dead-end overlay. | Restart and Rescue controls fit entirely inside the viewport and remain tappable. | ☐ PASS ☐ FAIL | |
| P-08 | Trigger Campaign completion with and without Try Clean. | Title/status/mastery/actions fit without clipping; primary Next remains obvious. | ☐ PASS ☐ FAIL | |
| P-09 | Trigger Daily completion. | Daily result + weekly summary fit without clipping. | ☐ PASS ☐ FAIL | |
| P-10 | Trigger Endless completion, both clean and assisted. | Boards-cleared result, clean-best copy, Try Again and Home fit without clipping. | ☐ PASS ☐ FAIL | |
| P-11 | Rotate/rescale portrait viewport while Home, Chapters, Board, Settings and an overlay are open. | Layout recomputes live; controls remain reachable after resize. | ☐ PASS ☐ FAIL | |

### Phone portrait verdict

- ☐ PASS
- ☐ FAIL
- Notes:

---

## 3. Phone landscape — 844 × 390

**Known pre-playtest risk:** the current Board layout can clamp a 91-cell short-landscape board to `hexSize = 9`. That keeps the canonical plate on screen, and input hit targets are forced to at least 42 px, but the visual token diameter can be only about 12 px and neighboring hit circles overlap heavily. This row must be judged by actual touch/click behavior; automated layout tests are not sufficient.

| ID | Manual scenario | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| L-01 | Home with Daily + Endless unlocked. | Daily and Endless fit side-by-side; Chapters/Settings remain on screen; Continue stays dominant. | ☐ PASS ☐ FAIL | |
| L-02 | Open a 37-cell Board. | Full plate is visible and comfortably clickable; secondary UI does not dominate the board. | ☐ PASS ☐ FAIL | |
| L-03 | Open a 61-cell Board. | Full plate remains visible and token selection remains accurate. | ☐ PASS ☐ FAIL | |
| L-04 | Open a 91-cell Board and deliberately tap several adjacent pieces near center/edges. | Tokens are not visually too small for play and taps do not select neighboring pieces due to overlapping hit targets. | ☐ PASS ☐ FAIL | **Critical manual check.** |
| L-05 | Use Undo/Hint/pause and any overflow/secondary controls on Board. | All controls remain reachable and usable without covering essential board information. | ☐ PASS ☐ FAIL | |
| L-06 | Open Chapters. | All five chapter rows fit/reflow without clipped level buttons. | ☐ PASS ☐ FAIL | |
| L-07 | Inspect Daily card/week row on Home. | Week row remains readable at short height. | ☐ PASS ☐ FAIL | |
| L-08 | Trigger Campaign completion and dead-end overlays. | Both overlays fit vertically; no action is clipped below the viewport. | ☐ PASS ☐ FAIL | |
| L-09 | Trigger Daily completion. | Daily result and week summary fit vertically. | ☐ PASS ☐ FAIL | |
| L-10 | Trigger Endless completion. | Boards-cleared result, assisted/clean-best copy, Try Again and Home all fit vertically. | ☐ PASS ☐ FAIL | |
| L-11 | Rotate/rescale between `844×390` and portrait while a Board/overlay is open. | Full plate and controls re-layout correctly after orientation change. | ☐ PASS ☐ FAIL | |

### Phone landscape verdict

- ☐ PASS
- ☐ FAIL
- Notes:

---

## Daily Archive acceptance

DA-01  Home shows ARCHIVE · 90 DAYS only after Daily unlocks.
DA-02  Archive opens on trusted current Moscow month and shows only months intersecting the 90-day window.
DA-03  Future dates and dates older than today-89 are not playable.
DA-04  Historical date launches the deterministic Daily for that exact dateKey.
DA-05  Historical Solved replay can upgrade to Clean; Clean never downgrades.
DA-06  Historical completion does not repair Daily streak.
DA-07  Today's Daily launched from Archive can count on time but still returns to Archive.
DA-08  Archive -> Rules/Settings -> Back resumes Archive without resetting the selected month.
DA-09  Archive-origin completion primary action returns to Archive after the normal Daily interstitial opportunity.
DA-10  Trusted-time failure disables Archive instead of falling back to device time.
DA-11  Mobile landscape keeps month arrows, 7-column calendar, streak header, and date cells readable/clickable.

---

## 4. Product acceptance questions

These are **human product judgments**, not engineering assertions. Answer every row after playing enough of the relevant mode. A NO is not a reason to resume art; it creates a new product/design task first.

| Product question | YES | NO | Notes / evidence from playtest |
| --- | :---: | :---: | --- |
| Does **Next** create a convincing “one more level” loop? | ☐ | ☐ | |
| Do the five chapters feel meaningfully different **without introducing new mechanics**? | ☐ | ☐ | |
| Does **Clean** motivate replay/mastery without blocking ordinary progression? | ☐ | ☐ | |
| Does **Daily** provide a real reason to return? | ☐ | ☐ | |
| Does Daily Archive plus the on-time streak create a useful return loop without making missed days feel punitive? | ☐ | ☐ | |
| Does **Endless** have enough tension even though pre-dead-end Undo is free? | ☐ | ☐ | |
| Are **Hint / Rescue** useful enough to justify rewarded ads without encouraging ad farming? | ☐ | ☐ | |
| Do **37 / 61 / 91** plates provide enough variation in session duration? | ☐ | ☐ | |
| Does a fixed canonical plate feel stronger/more legible than variable board silhouettes? | ☐ | ☐ | |

---

## 5. Acceptance decision

Complete this only after Sections 1–4 have been manually exercised.

### Functional product ready for final art?

- ☐ **YES — ACCEPTED.** Desktop, portrait, and landscape manual matrices pass; every product question is YES or has an explicitly accepted exception.
- ☐ **NO — NOT ACCEPTED.** One or more failures/product NOs require a new bounded or architectural product task before final art resumes.

### Blocking issues / follow-up tasks

1. 
2. 
3. 

### Playtest context

- Date:
- Build/commit:
- Browser(s):
- Desktop viewport/device:
- Portrait device/viewport:
- Landscape device/viewport:
- Tester:

## Final commit — only after acceptance is actually recorded

When the manual matrix is filled and the acceptance decision is no longer pending:

```powershell
git add docs/functional-redesign-acceptance.md
git commit -m "docs: record functional redesign playtest acceptance"
```
