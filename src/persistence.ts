export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asStorage(value: unknown): StorageLike | null | undefined {
  if (value === null || value === undefined) return value;
  if (!isRecord(value)) return undefined;
  if (
    typeof value.getItem !== "function" ||
    typeof value.setItem !== "function" ||
    typeof value.removeItem !== "function"
  ) {
    return undefined;
  }
  return value as unknown as StorageLike;
}
