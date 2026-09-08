# Premium Tabletop — Ivory + Walnut + Brass Design

## Goal

Replace the current generic dark/B5 test chrome with one cohesive premium-tabletop presentation while preserving the existing Hex Garden gameplay, responsive layout, Board UX, intro/reveal timing, removal feedback, economy behavior, and scene navigation.

This pass is deliberately about **UI surfaces and presentation hierarchy**. Board pieces remain on the current readable Chequered Ink mapping for the first live comparison; the uploaded rune packs are evaluated in a separate piece-language pass after the UI direction proves itself.

## Visual language

The target is a light physical tabletop rather than parchment fantasy or mobile-game chrome.

- **Canvas:** warm ivory/linen, quiet and low-contrast.
- **Primary surface:** matte warm ivory cards with restrained depth.
- **Structural accent:** walnut used as a physical base/tray/edge, not as a border around every element.
- **Metal accent:** muted brass only for emphasis, selected/important states, and small details.
- **Typography:** dark warm ink with clear hierarchy; muted secondary copy; no all-purpose heavy outline.
- **Shadows:** soft and shallow, enough to imply physical layers without glossy beveling.
- **Ornament:** none beyond material edges and simple separators. No RPG corners, rune decoration, scrolls, filigree, or fantasy gold frames.

Initial palette family:

- canvas: `#E9DFC8`
- surface: `#F5EEDC`
- surface-soft: `#DED0B3`
- walnut: `#5A3D2A`
- walnut-dark: `#38271D`
- brass: `#B88A45`
- brass-soft: `#D2B77E`
- text: `#2D2923`
- text-muted: `#746A5E`
- line: `#A99A82`

Exact runtime values may be tuned during implementation, but the relative hierarchy above is fixed.

## Board

The board remains the visual hero and keeps its current position, responsive sizing, plate geometry, hit areas, selection rules, reveal sequence, and removal animation.

Empty cells become quieter warm-neutral hexes against the ivory tabletop. They must not look like raised buttons and must not compete with pieces.

No permanent large frame is added around the board. A very subtle board-zone/value shift is allowed if needed to separate the play area from the global canvas.

The current Chequered Ink pieces remain unchanged for this pass so the UI comparison does not mix two large variables at once.

## Top HUD

The current long framed/boxed feel is removed.

The HUD becomes a small collection of floating tabletop elements:
- level + remaining count as the primary compact plaque;
- campaign/endless score as lighter supporting text or a restrained secondary plaque;
- dust as a compact chip/display near the global controls;
- Pause, Shop, Settings, and Restart remain icon actions and keep their existing gameplay semantics.

The HUD must preserve the existing responsive anchors and BoardScene state-preservation behavior.

## Inventory tray

The inventory becomes the strongest material element outside the pieces.

- Use a low walnut tray/base behind the atom glyphs and counts.
- The tray stays visually attached to the board and follows the existing responsive one/two-row layout behavior.
- Counts remain beside glyphs.
- Filtering semantics remain unchanged: non-matches stay unchanged; matches get restrained positive emphasis.
- Intro behavior remains unchanged: the inventory awakens progressively during the spiral and controls can be visible-but-disabled until the board is active.
- The tray must not turn into a heavy full-width bottom bar.

## Consumable controls

Move / Undo / Rescue remain a distinct group below/near the inventory according to the current responsive layout.

Their surface language is:
- matte ivory face;
- restrained walnut edge/shadow;
- brass emphasis only for hover/active/important states;
- disabled state lowers contrast without becoming illegible.

No glossy mobile bevels or generic fantasy frames.

## System controls

Pause / Restart / Settings / Shop stay visually separate from consumables.

They use compact physical square/round tabletop controls with less visual weight than Move / Undo / Rescue. Their existing actions, availability rules, and session-preserving navigation do not change.

## Mechanic introduction card

The mechanic card becomes a compact matte ivory tabletop card:
- real current atom glyph(s);
- strong title/copy hierarchy;
- restrained walnut/brass edge treatment;
- no decorative fantasy border.

Its staging remains unchanged: the real level geometry is ready, pieces remain presentation-hidden while the card is open, and the spiral starts only after dismissal.

## Completion and modal surfaces

Completion, pause, economy purchase dialog, and similar blocking cards use the same premium tabletop surface family.

Completion remains compact and preserves:
- score/dust count-up behavior;
- progress/unlock rows;
- delayed actions;
- next/exit navigation.

Success/failure states use restrained color accents rather than full saturated panel replacements.

## Other scenes

Menu, Level Select, Shop, Settings, and Leaderboard inherit the same renderer-owned surface system and palette. Their layout and product behavior remain unchanged in this pass.

Level tiles retain semantic-state hover behavior. Shop remains card-led. Dynamic text stays Phaser-rendered.

## Implementation boundary

The premium-tabletop language should be implemented in the renderer-owned UI primitives rather than by adopting another raster UI kit.

Primary implementation surfaces:
- `src/art-assets.ts` — premium palette/font and frame semantics;
- `src/game/ui.ts` — material-aware renderer surfaces and button states;
- `src/scene-background.ts` — light tabletop canvas;
- existing Board HUD/inventory/completion/scene layout code only where a specific material role needs to be expressed without changing layout contracts.

No gameplay/rules/solver/progression files may change.

## B5 bake-off handling

The B5 Adventure/RPG/Space raster UI variants are considered rejected experiments.

During the premium-tabletop implementation they may remain present only long enough to avoid mixing visual cleanup with the first comparison patch. The premium style becomes the default candidate and must not depend on the Kenney raster UI files.

After the user live-verifies the premium candidate, provide a separate cleanup step that explicitly removes:
- rejected B5 raster UI assets under `public/assets/art-tests/{adventure,rpg,space}`;
- the shared B5 gem experiment if it is no longer used;
- B5 art-theme query/cycle plumbing (`src/art-theme.ts` and related imports/tests) if no longer needed;
- stale B5 documentation/source notes;
- any renderer branches that exist only for rejected raster UI themes.

Do **not** delete the current Chequered Ink piece assets until a replacement piece language has been selected and live-verified.

## Acceptance criteria

1. The game reads as light premium tabletop, not parchment fantasy, generic mobile UI, or a Kenney template.
2. The board remains the main visual focus.
3. Inventory clearly reads as a walnut token tray without becoming a full-width bar.
4. UI hierarchy is calmer: fewer boxes, fewer borders, less equal visual weight.
5. System controls remain distinct from consumable controls.
6. Existing responsive desktop / portrait / landscape layout contracts remain intact.
7. Existing tutorial, mechanic-card, spiral reveal, removal feedback, completion, economy, and navigation behaviors remain intact.
8. No B5 Kenney raster UI is required by the premium candidate.
9. The first pass keeps current pieces unchanged; rune-piece evaluation is a separate follow-up.
10. Full verification before handoff: `pnpm typecheck`, `pnpm test`, `pnpm build`.
