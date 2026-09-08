# Hex Garden Physical Asset Factory — Design

## Goal
Create a deterministic Blender-based asset factory that generates the single physical board-cell sprite and the complete 15-piece visual set for Hex Garden from editable configuration and icon sources, with stable framing, lighting, geometry, materials, and export conventions.

## User-facing workflow
The artist edits one JSON manifest and, when desired, SVG icon files. Running a single Windows PowerShell launcher invokes Blender in background mode, generates all runtime PNGs into `public/assets/physical-premium/`, renders preview sheets, and runs a verifier. No hand cropping, image-generation cleanup, or per-file resizing is part of the production pipeline.

## Assets generated
The factory must generate exactly these runtime pieces: `salt`, `air`, `fire`, `water`, `earth`, `quicksilver`, `gold`, `silver`, `copper`, `iron`, `tin`, `lead`, `vitae`, `mors`, and `quintessence`, plus `board-cell.png`.

## Geometry contract
- Board cell: pointy-top hexagonal ceramic tile.
- Outer cell circumradius: 1.0 Blender units.
- Cell thickness: 0.84 (matching the approved spherical-socket proof; top-down runtime rendering hides the physical depth).
- Spherical socket radius: 0.79.
- Game-piece radius: 0.68.
- Socket is intentionally wider than the piece, preserving the approved visible clearance ring.
- All renders use a centered orthographic camera and fixed framing.
- Runtime PNGs use an identical square canvas and a stable visual center.

## Visual language
The board cell is warm ivory ceramic with a subtle materially rendered surface; the socket is a spherical bowl, not a flat circle. The empty socket must not contain a distracting specular hotspot.

Basic and special pieces are materially distinct physical orbs. Texture/material identity is primary; the symbol is secondary. Symbols are original, simple, thin groove/inlay marks rather than Phaser text or Sigmar's Garden-style alchemical runes.

Metals are materially distinct physical medallions. Their identity uses physical marks such as holes, slots, or recessed rings rather than ordinary UI glyphs.

## Piece language
- Water: deep blue glass, subtle internal bubbles, three-wave mark.
- Air: milky opal, cloudy internal variation, spiral mark.
- Fire: warm red/orange translucent material, crack-like internal variation, eight-point burst mark.
- Earth: green mineral/stone with veins, leaf mark.
- Salt: pale crystalline/frosted material, faceted crystal mark.
- Quicksilver: liquid-metal material, droplet + flow mark.
- Vitae: bright living green glass/resin, sprout mark.
- Mors: black obsidian/smoky glass, eclipse mark.
- Quintessence: violet iridescent glass, five-petal mark.
- Gold: aged gold medallion, five recessed holes.
- Silver: cool silver medallion, four recessed holes.
- Copper: warm hammered copper medallion, three recessed holes.
- Iron: dark steel medallion, one vertical recessed slot.
- Tin: pale matte metal medallion, two recessed holes.
- Lead: dense dark-grey medallion, one recessed central ring.

## Configuration
`art/physical-premium-manifest.json` is the single editable source for render settings, board geometry, piece geometry, material parameters, symbol source, and metal markings. The Blender generator must not require editing hard-coded values for ordinary visual tuning.

## SVG contract
SVGs use a small documented subset: absolute `M`, `L`, `H`, `V`, `C`, `Q`, and `Z` path commands. The generator parses this subset itself, avoiding dependence on Blender's optional SVG importer. Icons use a `0 0 100 100` viewBox and are centered around `(50, 50)`.

## Export contract
- Default runtime size: 1024×1024 RGBA PNG.
- Transparent film/background.
- Cycles by default, with configurable samples and an Eevee option for fast previews.
- Runtime filenames exactly match the game's `piece-<id>.png` naming.
- Preview output goes to `art/physical-premium-preview/`, never into runtime assets.

## Verification
A pure-Python verifier checks manifest coverage, icon existence, generated file dimensions, RGBA mode, alpha presence, and alpha-bounds centering. Static tests run without Blender. Blender execution itself is verified by the user on Blender 5.2.

## Non-goals
This factory does not alter gameplay rules, board coordinates, Phaser layout, HUD/UI, or audio. It does not generate a baked full-board sprite for runtime use. The game continues to build the board programmatically from one cell sprite and one piece sprite per occupied cell.
