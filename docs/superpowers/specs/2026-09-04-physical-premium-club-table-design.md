# Physical Premium / Club Table — Design

## Goal

Make the Hex Garden Board feel like a real premium gaming table rather than a flat illustrated UI. The emotional target is the tactile calm of billiards, poker, roulette, and the physical presentation quality of Sigmar's Garden / Opus Magnum without copying their art.

## Scope

This first B7.1 pass changes the live Board screen only. Gameplay, board geometry, responsive anchors, intro spiral, removal feedback, economy, scoring, solver, progression, and navigation behavior stay unchanged. Menu / Level Select / Shop / Settings / Leaderboard remain for a later pass after the Board direction is live-approved.

## Material language

- Deep muted green felt table as the scene surface.
- Dark walnut rails/trays and structural edges.
- Brown leather for plaques/button faces.
- Aged brass/bronze for restrained metal trim and coin/token details.
- Materials should come from real photographed/PBR source textures and be pre-rendered into lightweight 2D game surfaces. Phaser still owns layout, text, states, and animation.

The supplied `Fabric078` diffuse is visibly plaid and is **not** used as the table color. Only its fine normal/roughness information is used to derive subtle textile micro-detail over a clean dark-green felt color so the final table does not read as a dish cloth.

## Board surface

The full Board scene sits on dark green felt rather than ivory. Empty hexes are recessed/inlaid markings: close to the felt value, thin warm metal/wood line, subtle inner/shadow edge. They must recede behind pieces.

## Physical piece base

The current Chequered Ink piece glyphs remain temporarily as the semantic symbols, but every piece sits inside one consistent round physical medallion:

- aged-brass outer ring;
- dark leather/stone-like inset;
- shallow top-left highlight and bottom shadow;
- same centered circular footprint for every atom type.

This intentionally restores the visual symmetry/order the user liked in Sigmar's Garden and the previous candidate. The glyph language itself will be replaced later using the uploaded rune packs if this physical object treatment succeeds.

The same medallion base is used in the inventory so the tray shows miniature versions of the actual board objects rather than tiny standalone icons.

## Inventory

The inventory becomes a recessed walnut rack:

- real wood texture on the outer rail;
- dark felt recess inside;
- thin brass inner trim;
- piece medallions enlarged relative to B6;
- counts remain beside each piece and preserve progressive reveal/count-pop behavior.

It stays compact and attached to the board rather than becoming a full-width bar.

## HUD and controls

Desktop global controls stop relying on tiny icon-only squares. Pause, Restart, Shop, and Settings become compact physical plaques with short text labels and optional small secondary glyphs. On constrained mobile layouts they may collapse back to icon-only form to preserve responsive usability.

The top level/remaining display becomes a leather/brass plaque rather than a flat ivory card. Score text remains secondary.

Move / Undo / Rescue use substantial leather-faced, walnut-backed physical buttons. Pressing visually depresses the face by a few pixels and shortens the shadow; hover only catches a restrained brass edge.

## Asset production

Derived runtime surfaces are generated from the user-provided source textures:

- ambientCG `Fabric078` — textile micro-detail, CC0;
- ambientCG `Wood005` — walnut-toned wood source, CC0;
- ambientCG `Metal008` — aged metal/brass-toned source, CC0;
- Poly Haven `brown_leather` — leather source, CC0.

Runtime assets live under `public/assets/physical-premium/` and include only the optimized flattened 2D surfaces required by Phaser.

## B5/B6 handling

B5 and B6 remain uncommitted rejected experiments. Do not physically delete their files in B7.1. After B7 receives live approval, perform one explicit cleanup pass that removes rejected `art-tests`, obsolete theme-switch comparison plumbing, and stale B5/B6 docs/tests. Keep Chequered piece glyph files until their rune/physical replacement is approved.

## Acceptance criteria

1. Background is deep felt, not pale ivory and not flat black.
2. The screen reads as photographed/rendered physical materials rather than outlined Phaser rectangles.
3. Board pieces share one centered symmetrical physical medallion footprint.
4. Inventory reads as a real wooden rack holding miniature pieces.
5. Desktop system controls are not tiny generic icon-only buttons.
6. Board remains the visual hero; HUD and materials do not swamp it.
7. Existing reveal/removal/filter/input behavior remains unchanged.
8. No gameplay/rules/solver/progression changes.
9. B5/B6 cleanup is deferred until live approval.
