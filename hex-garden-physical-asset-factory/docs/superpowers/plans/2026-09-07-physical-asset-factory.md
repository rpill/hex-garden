# Physical Asset Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Blender 5.2 asset factory for Hex Garden's one board cell and all 15 physical game pieces.

**Architecture:** A pure-Python core owns manifest validation, icon-path parsing, and export validation. A Blender entrypoint consumes the validated manifest to create geometry/materials/icons and render assets. A separate Blender preview script reuses the same generator module, while PowerShell launchers provide a one-command Windows workflow.

**Tech Stack:** Blender 5.2 Python API, Python 3 standard library, Cycles/Eevee, JSON, SVG path subset, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-07-physical-asset-factory-design.md`

## Global Constraints
- Runtime board remains programmatically tiled from one cell sprite.
- Runtime piece count is exactly 15.
- Runtime images default to 1024×1024 RGBA PNG.
- No hand cropping/resizing is part of the production workflow.
- No dependency on Blender's optional SVG importer.

---

### Task 1: Pure-Python manifest and icon validation

**Files:**
- Create: `tools/physical_assets/factory_core.py`
- Create: `tests/test_asset_factory.py`
- Create: `art/physical-premium-manifest.json`
- Create: `art/physical-icons/*.svg`

**Interfaces:**
- Produces `load_manifest(path) -> dict`, `validate_manifest(manifest, root) -> list[str]`, `parse_svg_paths(path) -> list[list[tuple[float,float]]]`.

- [ ] Write tests that require all 15 ids, enforce socket > piece radius, validate every referenced icon, and parse all shipped SVGs.
- [ ] Run `python -m unittest tests/test_asset_factory.py -v` and confirm RED because `factory_core.py` is absent.
- [ ] Implement only the manifest/icon parsing needed by those tests.
- [ ] Run the same test and confirm GREEN.

### Task 2: Blender generator

**Files:**
- Create: `tools/blender/physical_asset_factory.py`
- Create: `tools/blender/generate_physical_assets.py`

**Interfaces:**
- Consumes the validated manifest and polyline icons from Task 1.
- Produces `board-cell.png`, `piece-*.png`, and `asset-factory-manifest.json` in the configured output directory.

- [ ] Add static tests that inspect the generator source for transparent film, orthographic camera, exact 15-piece loop, board boolean socket, and manifest-driven render size.
- [ ] Run tests and confirm RED because the Blender generator files are absent.
- [ ] Implement board geometry, orb/medallion geometry, material builders, procedural internal details, physical marks, SVG curve projection, and rendering.
- [ ] Run static tests and pure-Python tests to confirm GREEN.

### Task 3: Preview and verification workflow

**Files:**
- Create: `tools/blender/render_physical_asset_preview.py`
- Create: `tools/physical_assets/blender_common.ps1`
- Create: `tools/physical_assets/verify_physical_assets.py`
- Create: `build_physical_assets.ps1`
- Create: `preview_physical_assets.ps1`

**Interfaces:**
- Preview script renders a contact board using the same underlying geometry/material definitions.
- Verifier checks expected output count, dimensions, RGBA/alpha, and alpha-bound centering.

- [ ] Add tests for launcher target paths and verifier expected file list.
- [ ] Run tests and confirm RED.
- [ ] Implement verifier, preview script, and PowerShell launchers.
- [ ] Run tests and confirm GREEN.

### Task 4: Documentation and packaging

**Files:**
- Create: `PHYSICAL_ASSET_FACTORY_README_RU.md`

- [ ] Document Blender 5.2 installation path discovery, UI and background execution, manifest knobs, SVG editing contract, generated outputs, preview workflow, common failures, and game integration paths.
- [ ] Run the full static test suite.
- [ ] Create the root-ready ZIP and verify ZIP integrity.
