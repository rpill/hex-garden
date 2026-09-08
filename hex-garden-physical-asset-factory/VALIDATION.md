# V11 validation

Environment: Windows, Blender 5.2, Cycles/OptiX, NVIDIA RTX 2060.

- Reproduced four original regressions before fixing: a blank material slot on every
  cell face, SVG chords inside the sphere, sphere/socket intersection, lights not
  aimed at the subject. The Blender regression suite now checks the real objects.
- 16 factory tests pass, including construction of all 15 pieces and outward-facing
  filled SVG geometry. A filled-face winding failure found during iteration was fixed.
- The build exports 16 centered 1024×1024 RGBA PNGs, then runs the pixel/provenance
  verifier through Blender. No system Python or pip package is required for this path.
- Visual QA uses the supplied reference images, full-size exported sprites, a full
  37-cell board, a 15-piece family scene, and an exported-PNG contact sheet at large
  and approximately 50px orb diameter.
- Independent code review reported no high/medium findings.

The parent game was not changed or switched to these assets in this task. Its
typecheck passed; its build passed with the output redirected to `.scratch/game-build`
because the existing root `dist/assets` directory could not be cleared (EPERM).
The parent game's tests returned 168 passed / 2 failed in already-modified runtime
files outside this factory:

- `BoardScene uses fresh intro for new fields and restart profile for reset`.
- `AtlasButton icon and padding wrappers satisfy real Phaser contracts`.

Those unrelated source-contract failures were left in place. No claim of a full
game UI smoke test or a fully passing parent-game suite is made here.
