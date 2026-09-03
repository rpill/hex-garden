# Hex Garden — Art Direction

## Status

The final visual direction is **not selected**.

The final style is still unresolved. The runtime is currently using a **Chequered Ink tactile-gems / dark-board candidate** as a live evaluation baseline. This candidate is intentionally easy to replace and is not approved final art. Mechanized Magic remains bundled only as rejected legacy runtime art.

## Current valid decisions

- A full visual replacement is allowed as long as gameplay rules and interaction contracts remain unchanged.
- Do not pre-bind the game to paper, garden, alchemy, elements/metals, cozy, casual, fantasy, sci-fi, or any other theme.
- Third-party asset packs are allowed when their commercial-use rights are suitable for the project and bundled licenses/sources are recorded in `THIRD_PARTY_ASSETS.md`.
- Free and paid assets may be considered. The practical preference is roughly USD 0–8 per pack; exceptional packages around USD 10 are acceptable only when their scope clearly justifies it.
- Paid BOOTH listings are excluded because cross-country payment is inconvenient. Free BOOTH assets remain acceptable.
- Non-exclusive assets are acceptable. Identity can come from curation, composition, palette, field presentation, animation, typography, and a small set of custom/high-salience elements rather than from making every source asset exclusive.
- Dynamic labels, counts, prices, scores, and localized strings should remain renderer text rather than being baked into raster UI assets.

## Current live candidate

The active evaluation build uses a deliberately narrow subset of Chequered Ink packs:

- `Puzzle Games Graphics Pack` gems for board pieces;
- renderer-drawn low-contrast hex cells for the board surface; `Board Game Pieces` tokens remain available only as optional experiments;
- renderer-owned Phaser primitives for panels, buttons, level tiles, Shop cards, and completion surfaces; the Cartoon UI pack is no longer the main chrome language;
- `Inventory Icons Graphics Pack` only for selected symbolic assets such as dust, while Shop uses a renderer-drawn cart icon.

The board-piece grammar is shape-based so rules remain readable without relying on the old alchemy theme: diamonds are the common matching family, hearts are the opposite pair, octagons are the ordered metal-chain family, the moon is the catalyst, and the star is reserved for the internal quintessence piece. Internal atom IDs and mechanics remain unchanged.

This is a **comparison baseline**, not a commitment. If the board reads as generic match-3 or the UI feels too mobile-generic, replace the candidate rather than forcing more assets from these packs into the game.


## Active presentation rules

These structural decisions are now part of the current visual direction even though the final art family is still unresolved:

- The board is the visual hero: empty cells recede and pieces carry most of the color/weight.
- Hover is intentionally subtle; selection is stronger but restrained; hints use a distinct attention signal rather than a bright hover flood.
- Back uses one arrow icon plus plain localized text. Pause, Shop, and Settings are icon-only global actions.
- Shop and Settings are direct one-click destinations on key screens, including the Board; returning from them must preserve the current Board run.
- Dust uses one icon-based currency identity across Board, Menu/Level Select, Shop, and completion rewards.
- Campaign level tiles should use meaningful viewport area rather than a tiny dense grid.
- Shop is card-led and visual, not a text-heavy debug list.
- Completion is a compact result card with stable optional reward/unlock rows.

- Tutorial presentation uses exactly three calm steps with one short sentence at a time. It does not use remaining-piece counts as progress, animated target circles, neighbour numbers, or pulsing scale changes.
- Inventory filtering must dim non-matching pieces rather than drawing rings around matches; the inventory surface stays visually attached to the board.
- Level hover preserves the tile's semantic state instead of swapping to a generic hover surface.
- Main UI chrome is renderer-owned and intentionally neutral; third-party raster packs should supply pieces/icons rather than dictate every surface.
- These presentation rules are independent of the current Chequered Ink asset choice and should survive future asset replacement.

## Rejected directions / production methods

- Generating a complete production asset library through separate image-generation requests is rejected because consistent style across independent assets proved unreliable.
- The free Mechanized Magic direction was tested directly in the live Hex Garden UI and rejected as the target style. It reads too much like an RPG/strategy HUD, and several icons read as abilities rather than neutral puzzle pieces.
- The former paper/sketchbook direction is historical inspiration only. It is not a current requirement and should not constrain future sourcing.

## Historical material

Old visual plans and regeneration prompts live under `docs/archive/visual/`. They are historical records only and must not be treated as active requirements unless the user explicitly revives one of them.
