export const CAMPAIGN_LEVEL_COUNT = 50;

export const PlateSize = Object.freeze({
  SMALL: "small",
  MEDIUM: "medium",
  LARGE: "large",
} as const);

export type PlateSizeValue = (typeof PlateSize)[keyof typeof PlateSize];

export interface PlateSpec {
  size: PlateSizeValue;
  radius: 3 | 4 | 5;
  cellCount: 37 | 61 | 91;
  minPieces: number;
  maxPieces: number;
}

export const PLATE_SPECS: Readonly<Record<PlateSizeValue, Readonly<PlateSpec>>> = Object.freeze({
  small: Object.freeze({
    size: PlateSize.SMALL,
    radius: 3,
    cellCount: 37,
    minPieces: 21,
    maxPieces: 33,
  }),
  medium: Object.freeze({
    size: PlateSize.MEDIUM,
    radius: 4,
    cellCount: 61,
    minPieces: 31,
    maxPieces: 47,
  }),
  large: Object.freeze({
    size: PlateSize.LARGE,
    radius: 5,
    cellCount: 91,
    minPieces: 43,
    maxPieces: 55,
  }),
});

export const CAMPAIGN_PLATE_SCHEDULE = Object.freeze([
  "small", "small", "small", "small", "small", "small", "small", "medium", "small", "medium",
  "small", "medium", "medium", "small", "medium", "medium", "small", "medium", "medium", "medium",
  "medium", "medium", "small", "medium", "medium", "large", "medium", "small", "medium", "large",
  "medium", "small", "medium", "large", "medium", "medium", "small", "large", "medium", "large",
  "medium", "large", "small", "medium", "large", "medium", "small", "large", "medium", "large",
] as const satisfies readonly PlateSizeValue[]);

export function plateSpec(size: PlateSizeValue): Readonly<PlateSpec> {
  const spec = PLATE_SPECS[size];
  if (!spec) {
    throw new RangeError(`Unknown plate size: ${String(size)}`);
  }
  return spec;
}

export function campaignPlateSize(level: number): PlateSizeValue {
  if (!Number.isSafeInteger(level) || level < 0 || level >= CAMPAIGN_LEVEL_COUNT) {
    throw new RangeError(`level must be an integer from 0 to ${CAMPAIGN_LEVEL_COUNT - 1}`);
  }

  const size = CAMPAIGN_PLATE_SCHEDULE[level];
  if (!size) {
    throw new Error(`Campaign plate schedule is missing level ${level + 1}`);
  }
  return size;
}
