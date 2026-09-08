# Physical Asset Factory V2 Concept-Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Blender asset factory reproduce the approved warm ivory socket + saturated material-orb concept instead of the washed-out flat V1 render.

**Architecture:** Keep manifest-driven generation, but change the render architecture to pointy-top cells, depth-aware ceramic shading, layered orbs (textured inner core + clear glossy shell), domed/rimmed metals, and a felt preview surface. All tunable values remain in the manifest.

**Tech Stack:** Blender 5.2 Python API, Cycles, JSON manifest, SVG line icons, Python unittest.

**Spec:** Approved visual reference supplied by the user in the current conversation.

## Global Constraints

- Generate one board-cell asset and all 15 runtime piece assets deterministically.
- Pointy-top hex geometry must match the runtime grid.
- Socket radius remains 0.79 and orb radius remains 0.68 unless explicitly revisited.
- Preview must resemble the approved green-felt / warm-ivory / saturated-material concept.
- All materials, lighting and geometry remain manifest-controlled.
- No image-generation dependency is required to regenerate runtime assets.

---

### Task 1: Lock the concept-match render contract

**Files:**
- Modify: `tests/test_asset_factory.py`
- Modify: `art/physical-premium-manifest.json`

- [ ] Add failing tests for pointy orientation, layered orb config, low world light, preview felt and concept-match source hooks.
- [ ] Run tests and verify RED.
- [ ] Add manifest fields required by the new render architecture.
- [ ] Run tests and verify the manifest portion is GREEN.

### Task 2: Rebuild board and preview geometry

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`

- [ ] Remove the 30-degree flat-top rotation from board cells.
- [ ] Add depth-aware warm ceramic material for socket shading.
- [ ] Add felt preview plane and correct pointy-top tiling.
- [ ] Run source-contract tests.

### Task 3: Rebuild physical piece materials

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`

- [ ] Create a textured inner-core material per piece family.
- [ ] Add a separate glossy shell for orb pieces.
- [ ] Add polished rims and stronger surface treatment for metals.
- [ ] Make icon material crisp and slightly luminous.
- [ ] Run tests.

### Task 4: Tune preview placement and documentation

**Files:**
- Modify: `tools/blender/physical_asset_factory.py`
- Modify: `PHYSICAL_ASSET_FACTORY_README_RU.md`

- [ ] Lower pieces into sockets using a manifest-controlled center Z.
- [ ] Document the concept-match controls.
- [ ] Run all factory tests and Python compile checks.
- [ ] Package V2 archive.
