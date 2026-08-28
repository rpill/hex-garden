# Hex Garden Visual System and Gameplay Vertical Slice

**Status:** approved in chat for specification on 2026-08-28; implementation awaits written-spec review and an implementation plan.

## Goal

Turn the current minimal Phaser prototype into a recognizable hand-inked alchemical garden game without changing puzzle rules, progression, economy, or deterministic level data. The first implementation milestone is one complete `BoardScene` vertical slice that works on desktop, phone portrait, phone landscape, and live orientation changes.

The visual source of truth is the pair of approved 16:9 concepts stored with this specification:

- [Gameplay state A](assets/hex-garden-gameplay-state-a.png): selected Fire with a route ending at Water.
- [Gameplay state B](assets/hex-garden-gameplay-state-b.png): selected Fire pair.

Both references use a faceless Gold symbol: a flat ochre alchemical medallion with a ring and central dot. Anthropomorphic Gold faces are not part of the visual system.

The concepts define style and hierarchy, not a fixed board layout. Runtime coordinates, contents, labels, counts, language, score, and inventory always come from game state.

## Approved Direction

Use a hybrid asset system:

1. Extract and refine expressive art from the approved concepts as transparent project-owned sprites.
2. Keep board geometry, panels, selection rings, arrows, badges, progress bars, dimming, and responsive layout code-native in Phaser.
3. Keep all text live and localized. No screenshot text or numbers become production assets.
4. Build reusable atlases rather than slicing complete screenshots into fixed interface regions.

This preserves the concepts' personality while keeping dynamic levels, Russian/English localization, responsive composition, and interaction states reliable.

Rejected approaches:

- **Whole-screen raster skins:** high initial similarity, but incompatible with arbitrary boards, localization, and responsive layouts.
- **Pure Phaser primitives:** technically robust, but repeats the sterile prototype look the redesign is intended to replace.

## Visual Principles

### Tone

- Warm, tactile paper rather than a dark technical dashboard.
- Imperfect ink outlines and restrained pigment fills.
- Friendly but not childish; alchemical symbols may be lively, but not every object has a face.
- Whitespace is functional and keeps the puzzle legible.
- Small botanical details make cleared space feel alive without becoming a second information layer.

### Hierarchy

1. The board is the largest and highest-contrast interactive object.
2. Selected and free atoms are readable before decoration.
3. Level, score, and dust remain visible but do not shrink the board.
4. Boosters and inventory are reachable with one tap and use consistent positions within each responsive class.
5. Navigation is always visible on-screen; Escape remains only an accelerator.

### Color and State

The palette follows the concepts: warm paper, navy ink, rust Fire, blue Water/Air, olive Earth, pale Salt, muted purple Mors, gold Vitae/Au, and materially distinct metals.

State is never color-only:

- **Free:** full pigment, crisp outline, normal scale.
- **Locked:** reduced pigment plus a visible ink hatch or veil.
- **Selected:** ochre double ring plus a small scale/tween response.
- **Hinted:** navy route/halo distinct from selection.
- **Dead end:** board interaction is blocked and the status card explicitly explains the state.
- **Inventory parity warning:** red count badge plus warning mark, not red text alone.

## Asset Inventory

### Production art extracted or redrawn from the concepts

| Group | Assets | Count | Delivery |
|---|---|---:|---|
| Atom glyphs | `Ai`, `Fi`, `Wa`, `Ea`, `Sa`, `V`, `M`, `Hg`, `Pb`, `Sn`, `Fe`, `Cu`, `Ag`, `Au` | 14 | Transparent atlas sprites |
| Boosters | Move, Undo, Rescue | 3 | Transparent atlas sprites |
| Economy | Dust bottle, dust scatter | 2 | Transparent atlas sprites |
| Board flora | Small sprout/leaf/flower variants | 6 | Transparent atlas sprites |
| Feedback marks | Ink speck, water flick, warning mark | 3 | Transparent atlas sprites |
| Section pictograms | Campaign, Endless, Shop, Leaderboard, Settings | 5 | Transparent atlas sprites |
| Utility pictograms | Back, close, play/next, restart, plus, lock, done, sound on/off, language | 10 | Transparent atlas sprites or compact SVG |
| Progress marks | Completion stamp, unlock seal, assisted mark | 3 | Transparent atlas sprites |
| Foundation | Seamless warm paper tile | 1 | Standalone repeatable texture |

Target total: 47 named assets before atlas packing. Runtime state variants are not separate raster assets.

### Code-native Phaser elements

- Hex cell path and border.
- Board mask and camera/layout bounds.
- Selection rings and hint route.
- Cards, buttons, modal surfaces, separators, and focus outlines.
- Count badges, parity warnings, progress bars, score/dust count-ups.
- Disabled overlays and input hit areas.
- Localized text and every numeric value.

### Typography

- Use one bundled, redistributable, Cyrillic-capable hand-drawn display font after license review.
- Use a legible bundled or system sans-serif for dense microcopy if the display font fails at small sizes.
- Do not load fonts from a CDN.
- Record any bundled third-party font and license in `THIRD_PARTY_ASSETS.md`.
- Inventory counts and parity warnings render at a minimum effective size of 16 px on phone; primary counters target 18 px or larger.

## Concept-to-Phaser Map

| Concept element | Phaser consumer | Responsibility |
|---|---|---|
| Paper surface | Every scene | Shared theme background tile |
| Underlined top heading | All scenes | Shared navigation/header layout |
| Back/menu button | All scenes and blocking overlays | Stable screen-relative navigation target |
| Level and score line | `BoardScene` | Live localized text from runtime state |
| Dust bottle and amount | Menu, Board, Shop, completion overlay | Live economy balance |
| Atom illustrations | `BoardScene` board and inventory | Sprite keyed by internal atom ID |
| Hex outlines | `BoardScene`, `LevelSelectScene` | Phaser geometry, not a screenshot slice |
| Empty-cell flora | `BoardScene` | Deterministic decoration in empty, non-interactive cells |
| Booster cards | `BoardScene`, `ShopScene`, purchase modal | Art icon plus live name/count/price |
| Inventory strip | `BoardScene` | Runtime list containing only initially present atom types |
| Metal chain | `BoardScene`, mechanic-introduction card | Live chain and lock state from rules |
| Selection ring and route arrow | `BoardScene`, tutorial | Phaser state/effect layer |
| Floating `+20` | `BoardScene` | Existing score events with new typography/tween |
| Paper cards | Menu, Shop, Settings, pause, tutorial, economy modal | Shared code-native component skin |
| `DONE`, `PLAY`, `LOCK` seals | `LevelSelectScene` | Live campaign progression state |
| Ink table rows | `LeaderboardScene` | Live fake leaderboard data now; future SDK data later |
| Reward presentation | Completion overlay | Existing score/dust/progress data with new skin |

## Architecture

Rules remain renderer-independent. `GardenBoard`, progression, solver, scoring, economy, and rewarded-ad adapters do not depend on art assets.

The presentation layer gains three boundaries:

1. **Art catalog:** maps stable internal atom/UI IDs to Phaser texture keys. Missing art falls back to current label rendering so a bad asset cannot make a level unplayable.
2. **Theme tokens:** palette, typography, stroke widths, spacing, corner radii, minimum touch sizes, and state alpha values. Scenes consume tokens instead of repeating constants.
3. **Board UI views:** focused helpers for the top HUD, atom inventory, booster dock, pause/completion surfaces, and board pieces. `BoardScene` remains the state coordinator and calls existing game authorities.

This is a targeted decomposition of the oversized `BoardScene`, not a rewrite. Logic and event ordering remain unchanged unless a visual component requires a narrow presentation API.

## Responsive Layout Contract

### Desktop

- Centered board receives the dominant canvas area.
- Top header contains navigation, level/run status, score, and dust.
- Booster controls and atom inventory form a bottom dock.
- Typical atom diameter: 58-72 px, bounded by actual board capacity.

### Phone portrait

- Compact top header with persistent back/menu and dust.
- Board uses the widest safe area below the header.
- Atom inventory becomes two readable rows when required.
- Booster controls remain reachable near the bottom without covering the board.
- Typical atom diameter: 48-58 px where board capacity allows.

### Phone landscape

- Compact header consumes one line.
- A side action dock contains back/menu, Move, Undo, Rescue, and contextual continue/restart.
- Board uses the remaining central area; inventory uses a compact edge strip without forcing the board to thumbnail size.
- Typical atom diameter: 40-52 px where board capacity allows.

### Shared requirements

- Interactive targets are at least 44x44 CSS pixels.
- Orientation changes reflow current state without restarting the level or duplicating input handlers.
- Modals stay fully reachable at all tested viewport sizes.
- Counts, warning badges, and selected/locked states remain distinguishable without zoom.

## Vertical Slice Scope

The first slice restyles one real campaign `BoardScene` flow using runtime level data. The reference level number is not a request to hard-code its composition.

Included:

1. Asset preload and catalog fallback.
2. Paper surface and theme tokens.
3. All atom glyphs needed by public standard rules.
4. Free, locked, selected, hinted, and dead-end presentation.
5. Top HUD, dust, score, and visible navigation.
6. Responsive booster dock and atom inventory.
7. Pair-removal feedback and animated score award.
8. Pause, mechanic-introduction, economy, and completion surfaces used by the selected flow.
9. Desktop, portrait, landscape, and live-orientation verification.

Excluded until slice approval:

- Full restyling of Menu, Level Select, Shop, Settings, and Leaderboard.
- Sound assets or sound design.
- New particles unrelated to existing feedback.
- Changes to rules, campaign content, economy values, scoring, or advertisements.
- New monetization, online leaderboard integration, or Yandex SDK behavior.

## Data Flow and Failure Handling

1. Existing game state emits the same selection/removal/score/economy events.
2. `BoardScene` translates stable IDs and state into view-model values.
3. View helpers render sprites, live labels, state overlays, and hit targets.
4. Responsive layout recalculates positions from the current viewport classification.
5. If a texture is missing or fails to load, the affected item uses the current colored-circle-and-label fallback and logs one diagnostic; play continues.
6. Decorative flora is omitted first under space or performance pressure. It never affects rules or hit testing.

## Verification

Automated verification must preserve existing renderer-independent tests and add coverage for:

- complete art-catalog mapping for all public atom IDs;
- fallback rendering keys for missing assets;
- stable responsive classification and non-overlapping layout bounds;
- inventory counts and parity warning presentation data;
- orientation reflow without state reset;
- no rasterized localized UI strings in the asset manifest.

Manual/browser smoke sizes:

- Desktop: 1920x1080 and 1440x900.
- Phone portrait: 390x844 and 414x896.
- Phone landscape: 844x390 and 896x414.
- Rotate portrait -> landscape -> portrait during an active selection and while a modal is open.

Acceptance criteria:

- The board is visually dominant and never reduced to the tiny scale seen in the earlier prototype.
- Every action is available on-screen without Escape.
- Atom identity, free/locked/selected state, and inventory counts are readable at each target size.
- State A and state B can be represented from runtime state without baked screenshots.
- Gold is always the faceless `ring + dot` medallion.
- Existing rules, scores, economy, persistence, and navigation behavior still pass their tests.
- `pnpm test` and `pnpm build` pass before handoff.

## Delivery Sequence

1. Record this visual policy and specification.
2. Produce a detailed TDD implementation plan after written-spec approval.
3. Prepare production asset isolates and manifests.
4. Add theme/catalog infrastructure and fallbacks.
5. Implement the `BoardScene` vertical slice.
6. Verify all target viewports and live rotation.
7. Present the slice for visual acceptance before migrating remaining scenes.
