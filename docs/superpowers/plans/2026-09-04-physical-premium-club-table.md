# Physical Premium / Club Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the B7.1 Board-only physical premium candidate from photographed felt/wood/leather/metal materials while preserving gameplay behavior.

**Architecture:** Pre-render lightweight 2D material surfaces from the supplied CC0 PBR sources. Add them to the existing art preload mapping, replace the premium renderer surface with a NineSlice-backed physical surface wrapper, use a tiled felt Board background, and add one common physical medallion behind board/inventory glyphs. Desktop Board global controls become labeled physical plaques; constrained layouts remain compact.

**Tech Stack:** Phaser 3.90, strict TypeScript, Vite 7, Pillow-based offline asset preparation, Node tests via tsx.

**Spec:** `docs/superpowers/specs/2026-09-04-physical-premium-club-table-design.md`

## Global Constraints

- No gameplay/rules/solver/progression/economy behavior changes.
- Preserve Board responsive layout, tutorial, intro spiral, removal feedback, inventory filtering, and action availability.
- Use current glyphs as semantic content; add a common physical token base rather than changing atom mapping yet.
- B5/B6 cleanup is deferred until visual acceptance.

---

### Task 1: Contract and physical material assets

**Files:**
- Create: `test/physical-premium-contract.test.js`
- Create: `public/assets/physical-premium/**`
- Modify: `src/art-assets.ts`
- Modify: `THIRD_PARTY_ASSETS.md`

- [ ] Write source-contract tests for felt/material frames, physical token base, deep green palette, and labeled desktop Board controls.
- [ ] Run the focused test and verify RED against B6.
- [ ] Generate optimized felt, walnut/leather/brass NineSlice surfaces and token/coin sprites from the supplied material sources.
- [ ] Register their runtime frames and source/license notes.
- [ ] Run the focused test after production code in later tasks and verify GREEN.

### Task 2: Physical surface renderer and felt background

**Files:**
- Modify: `src/game/ui.ts`
- Modify: `src/scene-background.ts`
- Test: `test/physical-premium-contract.test.js`

- [ ] Replace premium flat Graphics surfaces with a `RendererSurface` container backed by Phaser NineSlice material textures while retaining the old Chequered Graphics fallback.
- [ ] Preserve the existing `setTexture`, `setMaterialRole`, `resizeSurface`, hover, press, and visibility API.
- [ ] Use a tiled felt texture for premium scene background and retain the old Graphics background for Chequered comparison.
- [ ] Verify focused contract tests.

### Task 3: Physical Board pieces, tray, and controls

**Files:**
- Modify: `src/game/scenes/BoardScene.ts`
- Modify: `src/game/board/BoardInventory.ts`
- Modify: `src/game/board/BoardHud.ts`
- Modify: `src/game/ui.ts`
- Test: `test/board-presentation-contract.test.js`
- Test: `test/removal-feedback-contract.test.js`
- Test: `test/physical-premium-contract.test.js`

- [ ] Add the common physical medallion image behind every board glyph and preserve its reveal/alpha/scale lifecycle.
- [ ] Add the same medallion behind inventory glyphs; enlarge entries modestly without changing row semantics.
- [ ] Keep the inventory material role as the recessed walnut tray.
- [ ] Replace desktop Pause/Restart/Shop/Settings icon-only squares with short labeled physical plaques; collapse them to icon-only in constrained layouts.
- [ ] Make Move/Undo/Rescue use the physical button surface and preserve all enable/disable behavior.
- [ ] Keep hexes quiet and inset on felt without changing geometry or hit areas.
- [ ] Run focused Board/reveal/removal tests.

### Task 4: Verification and patch handoff

**Files:**
- Modify: `ART_DIRECTION.md`
- Modify: `CURRENT_STATE.md`

- [ ] Record B7 Physical Premium as the live Board candidate, not final art.
- [ ] Run `pnpm typecheck` if dependencies are available.
- [ ] Run `pnpm test` if dependencies are available; at minimum run all source-contract tests that do not require Phaser installation.
- [ ] Run `pnpm build` if dependencies are available.
- [ ] Package changed/new files with repository-relative paths.
- [ ] Do not ask the user to commit until the live screenshot is approved.
