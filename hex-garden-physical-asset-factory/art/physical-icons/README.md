# Physical icon sources

These SVGs are editable source shapes for the physical marks rendered onto non-metal orbs.

## Contract
- Canvas/viewBox: `0 0 100 100`.
- Design around center `(50, 50)`.
- Supported path commands: absolute `M`, `L`, `H`, `V`, `C`, `Q`, `Z`.
- Avoid `A`, relative commands, transforms, strokes converted by CSS, masks, filters, and text.
- The generator ignores SVG colors. Physical material comes from `physical-premium-manifest.json`.
- Explicit `fill="currentColor"` adds a sphere-projected filled surface to a simple closed outline. Compound holes are not supported. Paths without explicit fill remain strokes.
- Unsupported commands fail validation instead of being silently skipped.
- Keep marks simple. They must remain readable when the final game piece is ~50–90 CSS pixels wide.

Metal SVG files are reference templates. Metals use manifest-driven physical markings (`holes`, `slot`, `ring`, `stud`).
