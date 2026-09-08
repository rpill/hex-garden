# Hex Garden — Art Direction

## Status

The final visual direction is **not selected**.

**Physical Premium / Club Table** and the **Physical UI Factory** are a **FROZEN EXPERIMENT, not the live runtime presentation**. Their source material and isolated factory tooling may remain in the repository for later reference, but current gameplay must not be judged against or forced to load those premium texture/frame contracts.

The current runtime target is an **asset-free functional redesign with Phaser primitives until product playtest acceptance**. Visual work is intentionally subordinate to validating the redesigned Campaign, Daily, Endless, assistance, progression, and navigation flows.

## Current valid decisions

- A full visual replacement is allowed as long as gameplay rules and interaction contracts remain unchanged.
- Do not pre-bind the game to paper, garden, alchemy, elements/metals, cozy, casual, fantasy, sci-fi, or any other theme.
- Third-party asset packs are allowed when their commercial-use rights are suitable for the project and bundled licenses/sources are recorded in `THIRD_PARTY_ASSETS.md`.
- Free and paid assets may be considered. The practical preference is roughly USD 0–8 per pack; exceptional packages around USD 10 are acceptable only when their scope clearly justifies it.
- Paid BOOTH listings are excluded because cross-country payment is inconvenient. Free BOOTH assets remain acceptable.
- Non-exclusive assets are acceptable. Identity can come from curation, composition, palette, field presentation, animation, typography, and a small set of custom/high-salience elements rather than from making every source asset exclusive.
- Dynamic labels, counts, prices, scores, and localized strings should remain renderer text rather than being baked into raster UI assets.

## Frozen physical experiment

The previous Physical Premium / Club Table pass is retained only as frozen experimental work:

- deep-green felt, walnut, leather, brass, ceramic sockets, and dedicated physical atom renders are **not** the current live presentation contract;
- Physical UI Factory source/manifests and generated rasters may remain for isolated tooling tests and possible future reuse;
- runtime Board/Menu acceptance tests must target functional Phaser primitives rather than premium texture names, frame names, material roles, or Blender output hashes;
- freezing the experiment does **not** mean deleting its factory solely for cleanup; it means stopping it from constraining the current product runtime.

The final art family remains unresolved and can be revisited only after the functional redesign is accepted in playtesting.

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
