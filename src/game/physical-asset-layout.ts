/**
 * Display compensation for the V11 Blender physical-asset factory art.
 *
 * Runtime PNGs are 256×256 premultiplied-alpha Lanczos derivatives of the
 * 1024×1024 Blender masters. Their transparent canvas framing is unchanged, so
 * the gameplay display scales still preserve the factory socket/orb proportion.
 */
export const PHYSICAL_BOARD_CANVAS_SCALE = 2.35;
export const PHYSICAL_PIECE_CANVAS_SCALE = 2.34;

/**
 * UI slots were tuned around the previous tightly-cropped piece canvases.
 * The factory framing keeps more transparent breathing room, so UI-only views enlarge
 * the full canvas while preserving the same visible orb footprint.
 */
export const PHYSICAL_PIECE_UI_CANVAS_SCALE = 1.54;
