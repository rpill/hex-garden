export type CalloutSide = "top" | "bottom" | "left" | "right";

export interface RectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CalloutPlacementInput {
  targetBounds: RectBounds;
  viewport: Readonly<{ width: number; height: number }>;
  callout: Readonly<{ width: number; height: number }>;
  preferredSides?: readonly CalloutSide[];
  gap?: number;
  margin?: number;
}

export interface CalloutPlacement {
  side: CalloutSide;
  x: number;
  y: number;
}

const ALL_SIDES: readonly CalloutSide[] = ["bottom", "top", "right", "left"];

function overlapArea(a: RectBounds, b: RectBounds): number {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

export function chooseCalloutPlacement({
  targetBounds,
  viewport,
  callout,
  preferredSides = ALL_SIDES,
  gap = 14,
  margin = 12,
}: CalloutPlacementInput): Readonly<CalloutPlacement> {
  const targetX = (targetBounds.left + targetBounds.right) / 2;
  const targetY = (targetBounds.top + targetBounds.bottom) / 2;
  const halfW = callout.width / 2;
  const halfH = callout.height / 2;
  const clampX = (x: number): number =>
    Math.max(margin + halfW, Math.min(viewport.width - margin - halfW, x));
  const clampY = (y: number): number =>
    Math.max(margin + halfH, Math.min(viewport.height - margin - halfH, y));

  const sideOrder: CalloutSide[] = [];
  for (const side of [...preferredSides, ...ALL_SIDES]) {
    if (!sideOrder.includes(side)) sideOrder.push(side);
  }

  const candidateFor = (side: CalloutSide): CalloutPlacement => {
    if (side === "top") {
      return {
        side,
        x: clampX(targetX),
        y: clampY(targetBounds.top - gap - halfH),
      };
    }
    if (side === "bottom") {
      return {
        side,
        x: clampX(targetX),
        y: clampY(targetBounds.bottom + gap + halfH),
      };
    }
    if (side === "right") {
      return {
        side,
        x: clampX(targetBounds.right + gap + halfW),
        y: clampY(targetY),
      };
    }
    return {
      side,
      x: clampX(targetBounds.left - gap - halfW),
      y: clampY(targetY),
    };
  };

  const candidates: readonly CalloutPlacement[] = sideOrder.map(candidateFor);
  const rectFor = (candidate: CalloutPlacement): RectBounds => ({
    left: candidate.x - halfW,
    right: candidate.x + halfW,
    top: candidate.y - halfH,
    bottom: candidate.y + halfH,
  });

  const nonOverlapping = candidates.find(
    (candidate) => overlapArea(rectFor(candidate), targetBounds) === 0,
  );
  if (nonOverlapping) return Object.freeze(nonOverlapping);

  let best = candidates[0];
  if (!best) {
    throw new Error("Callout placement requires at least one candidate side");
  }
  let bestOverlap = overlapArea(rectFor(best), targetBounds);
  for (const candidate of candidates.slice(1)) {
    const area = overlapArea(rectFor(candidate), targetBounds);
    if (area < bestOverlap) {
      best = candidate;
      bestOverlap = area;
    }
  }
  return Object.freeze(best);
}
