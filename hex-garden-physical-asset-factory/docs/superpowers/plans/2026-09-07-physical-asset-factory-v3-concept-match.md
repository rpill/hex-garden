# Physical Asset Factory V3 Concept Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic Blender factory materially and geometrically match the approved Hex Garden physical-board concept much more closely.

**Architecture:** Keep one manifest as the user-facing control surface, one Blender factory as the renderer, and SVGs as editable icon sources. Correct geometry and preview spacing at the source, remove the V2 double-shell washout, and render symbols as groove/inlay layers.

**Tech Stack:** Blender 5.2 Python API, Cycles, Python 3, JSON, SVG subset parser, PowerShell launchers, unittest.

**Spec:** `docs/superpowers/specs/2026-09-07-physical-asset-factory-design.md`

## Global Constraints

- Runtime board is assembled programmatically from one `board-cell.png`.
- Generate exactly 15 piece types plus one board-cell asset.
- Socket radius remains `0.79`; orb radius remains `0.68`.
- Runtime output remains square RGBA PNG.
- Main editable controls remain in `art/physical-premium-manifest.json` and `art/physical-icons/*.svg`.

---

### Task 1: Correct pointy geometry and preview spacing

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `art/physical-premium-manifest.json`
- Test: `tests/test_asset_factory.py`

**Interfaces:**
- Consumes: board circumradius and axial coordinates.
- Produces: actual 30-degree pointy-top geometry and manifest-controlled grid overlap.

- [x] Write failing tests for 30-degree pointy rotation and `grid_spacing_scale`.
- [x] Verify tests fail against V2.
- [x] Rotate cylinder geometry by 30 degrees and apply `grid_spacing_scale=0.984` to board/piece preview positions.
- [x] Run tests and verify pass.

### Task 2: Fix lighting and board material control

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `art/physical-premium-manifest.json`
- Test: `tests/test_asset_factory.py`

**Interfaces:**
- Consumes: sRGB HEX values and lighting numbers from manifest.
- Produces: darker, warmer ivory ceramic and socket depth shading.

- [x] Write failing tests for V3 exposure/world/key/fill limits and HEX controls.
- [x] Verify tests fail against V2.
- [x] Add sRGB HEX conversion and board micro/crackle material controls.
- [x] Lower world/fill/exposure defaults.
- [x] Run tests and verify pass.

### Task 3: Replace washed-out orb layering

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `art/physical-premium-manifest.json`
- Test: `tests/test_asset_factory.py`

**Interfaces:**
- Consumes: per-piece `base_hex`, `accent_hex`, roughness, texture scale/strength.
- Produces: one saturated physical orb body per non-metal piece.

- [x] Write failing test requiring `layered_shell_enabled=false` and `create_orb_body`.
- [x] Verify it fails against V2.
- [x] Build saturated material profiles and disable V2 double-shell by default.
- [x] Preserve bubbles/crystals/sparkles as internal geometry details.
- [x] Run tests and verify pass.

### Task 4: Replace thick symbols with groove/inlay

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `art/physical-premium-manifest.json`
- Test: `tests/test_asset_factory.py`

**Interfaces:**
- Consumes: parsed SVG polylines.
- Produces: dark groove layer + narrow inlay layer projected to the orb surface.

- [x] Write failing tests for groove/inlay widths and low emission.
- [x] Verify they fail against V2.
- [x] Implement `create_icon_inlay` and manifest controls.
- [x] Run tests and verify pass.

### Task 5: Improve metal material differentiation

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `art/physical-premium-manifest.json`

**Interfaces:**
- Consumes: per-metal base/accent HEX, roughness, texture controls.
- Produces: patina variation, roughness variation, micro-wear, existing physical recess markings.

- [x] Use base/accent HEX in metal material.
- [x] Add broad patina noise and high-frequency surface wear.
- [x] Preserve holes/slot/ring physical markings.

### Task 6: Fast single-asset iteration

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `tools/blender/generate_physical_assets.py`
- Modify: `build_physical_assets.ps1`
- Test: `tests/test_asset_factory.py`

**Interfaces:**
- Produces: `generate_selected(..., only=...)` and PowerShell `-Only`.

- [x] Write failing source-contract test.
- [x] Verify failure.
- [x] Implement comma-separated targeted generation.
- [x] Run tests and syntax checks.
