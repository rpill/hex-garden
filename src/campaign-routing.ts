export type CampaignHomeReveal = "daily" | "endless" | "campaign-complete";

export type CampaignPostCompletionDestination =
  | Readonly<{ kind: "home"; reveal: CampaignHomeReveal }>
  | Readonly<{ kind: "chapter-next"; level: number }>
  | Readonly<{ kind: "next"; level: number }>;

export function campaignPostCompletionDestination(
  level: number,
): CampaignPostCompletionDestination {
  if (level === 4) return Object.freeze({ kind: "home" as const, reveal: "daily" as const });
  if (level === 9) return Object.freeze({ kind: "home" as const, reveal: "endless" as const });
  if (level === 49) {
    return Object.freeze({ kind: "home" as const, reveal: "campaign-complete" as const });
  }
  if (level === 19 || level === 29 || level === 39) {
    return Object.freeze({ kind: "chapter-next" as const, level: level + 1 });
  }
  return Object.freeze({ kind: "next" as const, level: level + 1 });
}
