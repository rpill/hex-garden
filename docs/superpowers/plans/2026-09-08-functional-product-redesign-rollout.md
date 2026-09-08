# Hex Garden Functional Product Redesign Rollout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved functional Hex Garden redesign as a sequence of independently testable slices before any final art work resumes.

**Architecture:** The redesign is intentionally decomposed into six plans because the approved spec spans generation/content, product persistence/navigation, board assistance, Daily, Endless, and legacy cleanup. Each plan leaves the game runnable and supplies stable interfaces to the next plan; the final plan removes transitional legacy code and runs the full acceptance matrix.

**Tech Stack:** TypeScript, Phaser 3.90, Node >=20, Vite 7.1.3, `node:test`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-08-functional-product-redesign-design.md`

## Global Constraints

- Preserve the audited move rules in `RULES_AUDIT.md`, `src/atom-types.ts`, and `src/board.ts`.
- Public boards use only complete regular hex plates of radius 3/4/5 = 37/61/91 cells.
- The campaign contains exactly 50 fixed levels in five chapters of ten.
- Campaign difficulty changes through decision structure, not chapter-gated mechanics.
- Undo and Restart preserve Clean eligibility; Hint and Rescue invalidate only the current attempt.
- Daily unlocks after Campaign Level 5; Endless unlocks after Level 10.
- Remove Dust, Shop, booster inventory, campaign score, Endless point score/multipliers, and public leaderboard navigation.
- Rewarded ads grant direct Hint/Rescue only after the rewarded callback; no product-level 60-second cooldown.
- Final art assets, Blender UI work, collections, themes, and physical-premium presentation work are out of scope.
- Temporary presentation uses Phaser primitives, circular colored tokens, text/glyphs, and plain controls.
- Preserve persistent language and sound settings; do not migrate old 24-level completion/economy/score data into the new product.

---

## Dependency order

1. **Plan 1 — Fixed plates, scorer, and fixed campaign content**  
   `docs/superpowers/plans/2026-09-08-fixed-plates-scorer-campaign.md`
2. **Plan 2 — Campaign progress, mastery, unlocks, Home, and Chapters**  
   `docs/superpowers/plans/2026-09-08-progress-mastery-navigation.md`
3. **Plan 3 — Board assistance, Clean attempt state, tutorial/completion, minimal Board HUD**  
   `docs/superpowers/plans/2026-09-08-board-assistance-minimal-ui.md`
4. **Plan 4 — Daily mode and 90-day weekly history**  
   `docs/superpowers/plans/2026-09-08-daily-mode.md`
5. **Plan 5 — Endless boards-cleared run redesign**  
   `docs/superpowers/plans/2026-09-08-endless-redesign.md`
6. **Plan 6 — Remove legacy economy/product surfaces and run final functional acceptance**  
   `docs/superpowers/plans/2026-09-08-legacy-cleanup-functional-acceptance.md`

## Checkpoint policy

After each plan:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Do not continue to the next plan if any command fails. Play the new slice manually before adding another mode.

## Content curation checkpoint

Plan 1 deliberately produces a **provisional frozen 50-level campaign** from deterministic candidate ranking so later systems can be built against fixed data. Before the final acceptance plan is considered complete, Levels 1–5 must be manually playtested against their onboarding goals and all 50 levels must be reviewed for puzzle quality. Candidate replacement changes campaign data only; it must not require product-logic changes.

## Commit policy

Use one commit per task in the sub-plans. The uploaded working copy in this ChatGPT session has no `.git`, so ChatGPT cannot create those commits here; execute the listed commit commands in the real repository.
