# Hex Garden — Art Direction

## Status

The final visual direction is **not selected**.

The final style is still unresolved. The current live evaluation candidate is **Physical Premium / Club Table**: a dark-green felt table with real photographed/derived walnut, leather, and aged-brass surfaces. The target is the weighted tactile calm of billiards, poker tables, roulette hardware, and premium physical puzzle pieces rather than a flat illustrated UI or literal casino imagery. The current live Board uses the paused Blender Physical Asset Factory V11 cell and dedicated physical piece family as an evaluation checkpoint; this art is improved but still not approved final piece art. Mechanized Magic remains bundled only as rejected legacy runtime art.

## Current valid decisions

- A full visual replacement is allowed as long as gameplay rules and interaction contracts remain unchanged.
- Do not pre-bind the game to paper, garden, alchemy, elements/metals, cozy, casual, fantasy, sci-fi, or any other theme.
- Third-party asset packs are allowed when their commercial-use rights are suitable for the project and bundled licenses/sources are recorded in `THIRD_PARTY_ASSETS.md`.
- Free and paid assets may be considered. The practical preference is roughly USD 0–8 per pack; exceptional packages around USD 10 are acceptable only when their scope clearly justifies it.
- Paid BOOTH listings are excluded because cross-country payment is inconvenient. Free BOOTH assets remain acceptable.
- Non-exclusive assets are acceptable. Identity can come from curation, composition, palette, field presentation, animation, typography, and a small set of custom/high-salience elements rather than from making every source asset exclusive.
- Dynamic labels, counts, prices, scores, and localized strings should remain renderer text rather than being baked into raster UI assets.

## Current live candidate

The active evaluation build now tests a physical-material Board language:

- the Board scene uses a deep green textile surface derived from real PBR material detail rather than a flat ivory canvas;
- empty hexes are reusable ivory ceramic socket sprites tiled by Phaser;
- all 15 atom types use dedicated centered physical sphere/orb renders from the paused Blender factory iteration rather than an old glyph laid over one generic base;
- the 1024x1024 Blender renders are master art only; browser runtime uses 256x256 high-quality derivatives while preserving the same transparent canvas framing and display-space proportions;
- the bottom inventory is a recessed walnut rack with felt inset and shows miniature versions of the same dedicated physical pieces;
- HUD, Move/Undo/Rescue, and blocking cards use flattened walnut/leather/brass material surfaces instead of flat Phaser rectangles;
- on roomy desktop layouts Pause/Restart/Shop/Settings use short labeled physical plaques instead of four tiny icon-only squares; compact layouts may collapse them to icons;
- the rejected B5 Kenney Adventure/RPG/Space raster UI experiments and the pale B6 Ivory pass remain pending cleanup after live acceptance.

The current dedicated piece family uses its own material/inlay language. Internal atom IDs and mechanics remain unchanged; do not reintroduce old Chequered Ink glyph overlays during premium runtime feedback or transitions.

This is a **live candidate, not a commitment**. The target sensation is weighted, quiet tabletop tactility: substantial materials, centered orderly pieces, crisp press feedback, and eventually a short dry click/tick sound language. Do not drift into parchment fantasy, glossy mobile chrome, literal casino neon, or ornate RPG framing.


## Active presentation rules

These structural decisions are now part of the current visual direction even though the final art family is still unresolved:

- The board is the visual hero: empty cells recede and pieces carry most of the color/weight.
- Hover is intentionally subtle; selection is stronger but restrained; hints use a distinct attention signal rather than a bright hover flood.
- Back uses one arrow icon plus plain localized text. On roomy Board layouts Pause, Restart, Shop, and Settings may use short labeled physical plaques; compact layouts may collapse them to icon-only controls.
- Shop and Settings are direct one-click destinations on key screens, including the Board; returning from them must preserve the current Board run.
- Dust uses one icon-based currency identity across Board, Menu/Level Select, Shop, and completion rewards.
- Campaign level tiles should use meaningful viewport area rather than a tiny dense grid.
- Shop is card-led and visual, not a text-heavy debug list.
- Completion is a compact result card with stable optional reward/unlock rows.

- Tutorial presentation uses exactly three calm contextual steps in this order: matching pair action, three-empty-neighbour freedom rule, remaining-piece count panel. Guidance sits near the thing it explains, never uses a global step header or hard-gates otherwise legal clicks, and tutorial completion presents one obvious Level 1 primary action.
- Inventory filtering leaves non-matching pieces visually unchanged. Matching pieces receive only restrained positive same-shape emphasis; the inventory surface stays visually attached to the board and counts sit beside glyphs rather than over them.
- Level hover preserves the tile's semantic state instead of swapping to a generic hover surface.
- Main UI remains layout/state-owned by Phaser, but the active Board candidate may use derived photographed material surfaces for physical depth. Controls remain floating groups rather than full-width bars. Pause + Restart are a system/session group; Move/Undo/Rescue are a separate consumable group.
- Fresh boards use a skippable centre-out spiral piece reveal long enough to read as a deliberate assembly ritual (roughly 1.6–3.2 seconds by size, with overlapping local entrances). Restart uses the same ordering in a compressed roughly 0.8–1.0 second profile. This is presentation behavior independent of the final asset family and must not change real board state, scoring, or solver rules.
- These presentation rules are independent of the current Chequered Ink asset choice and should survive future asset replacement.

## Rejected directions / production methods

- Generating a complete production asset library through separate image-generation requests is rejected because consistent style across independent assets proved unreliable.
- The free Mechanized Magic direction was tested directly in the live Hex Garden UI and rejected as the target style. It reads too much like an RPG/strategy HUD, and several icons read as abilities rather than neutral puzzle pieces.
- The former paper/sketchbook direction is historical inspiration only. It is not a current requirement and should not constrain future sourcing.

## Historical material

Old visual plans and regeneration prompts live under `docs/archive/visual/`. They are historical records only and must not be treated as active requirements unless the user explicitly revives one of them.
