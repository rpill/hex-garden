# Rules audit

The current mechanics were checked against the locally supplied decompiled source, not inferred from the screenshots or from the previous prototype's terminology.

## Files used for the audit

- `Lightning/BoardState.cs`: occupancy, free-neighbour calculation, metal availability, pair matching, and board mutation.
- `Lightning/GameScreen.cs`: click-selection state machine, standalone Gold removal, and the five-piece Quintessence selection.
- `--qm8JCUDuQNZtzJ6sFYiV_m1K7W4wTbrsmYO7l1MoonRs-.cs`: atom registry, numeric IDs, and the metal predecessor chain.

These files belong to the supplied source tree at `D:\Games\The Zachtronics Solitaire Collection Sources`. No original implementation code or original level coordinates are copied into this project.

## Confirmed behavior

1. Availability requires at least three consecutive empty neighbour positions. The six directions form a circular ring, so a run may cross the last/first direction boundary.
2. An off-plate coordinate is not occupied and therefore counts as empty.
3. The pair table is exactly:
   - identical cardinal elements;
   - Salt + Salt;
   - Salt + any cardinal element;
   - Vitae + Mors;
   - Quicksilver + any non-Gold metal.
4. Metal dependency is global, not adjacency-based: Lead must disappear before Tin, then Iron, Copper, Silver, and Gold.
5. Gold is removed alone when both geometrically free and unlocked.
6. Quintessence requires one free atom of each of the four cardinal elements. The five atoms disappear together.
7. A mismatching ordinary second click replaces the selected atom rather than keeping an invalid pair selected.

The exact metal order is `Pb -> Sn -> Fe -> Cu -> Ag -> Au`. Consequently, removing Fe unlocks Cu. Au remains locked until Ag is removed.

## Original layout topology audit

The 50,000 standard masks were analysed separately from their atom types:

- 27,742 masks are invariant under a 60-degree rotation;
- 20,169 are invariant under 120 degrees but not 60;
- 2,089 are invariant under 180 degrees but not 120 or 60;
- zero masks are fully rotationally asymmetric.

The apparent irregularity of an ordinary screenshot comes mainly from asymmetric atom-type placement. Occupancy itself is built from rotational orbits around the centre. The notable mask containing only centre Gold and the two complete outer rings occurs 2,204 times (4.408%).

Before the generator rewrite, 500 generated boards exposed an average of 28.13 atoms initially, versus 6.764 in the original sample; Gold had only 2.652 occupied neighbours versus 4.446. This demonstrated that solution replay alone was insufficient: the previous random reverse placement was solvable but had the wrong topology.

## Level generation contract

The project does not load or ship the original `.dat` layouts. It procedurally selects new rotational orbit combinations, assigns fresh type positions and a forward removal schedule, then rejects the result unless replaying it through `SigmarsGardenBoard.select()` empties the board.

This proves that every generated starting layout has at least one complete solution. It does not imply that every possible player choice preserves solvability.
