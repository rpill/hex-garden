export const ART_THEME_IDS = ["premium", "chequered"] as const;
export type ArtThemeId = (typeof ART_THEME_IDS)[number];

export function readArtTheme(search?: string): ArtThemeId {
  const rawSearch = search ?? (typeof globalThis.location === "undefined" ? "" : globalThis.location.search);
  const requested = new URLSearchParams(rawSearch).get("art");
  return requested === "chequered" ? "chequered" : "premium";
}

export const ACTIVE_ART_THEME: ArtThemeId = readArtTheme();
