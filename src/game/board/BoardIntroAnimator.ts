import type Phaser from "phaser";
import {
  BOARD_CENTER,
  hexDistance,
  hexKey,
  type HexCoord,
} from "../../hex.js";

export interface BoardIntroState {
  active: boolean;
  revealedKeys: ReadonlySet<string>;
}

export type BoardIntroProfile = "fresh" | "restart";

export interface BoardIntroTiming {
  totalDurationMs: number;
  staggerMs: number;
  pieceTweenMs: number;
}

function lerp(left: number, right: number, t: number): number {
  return left + (right - left) * Math.max(0, Math.min(1, t));
}

export function boardIntroTiming(
  pieceCount: number,
  profile: BoardIntroProfile,
): Readonly<BoardIntroTiming> {
  const count = Math.max(0, Math.floor(pieceCount));
  if (count <= 1) {
    const pieceTweenMs = profile === "fresh" ? 200 : 140;
    return Object.freeze({
      totalDurationMs: pieceTweenMs,
      staggerMs: 0,
      pieceTweenMs,
    });
  }

  if (profile === "restart") {
    const totalDurationMs = 900;
    const pieceTweenMs = 140;
    return Object.freeze({
      totalDurationMs,
      staggerMs: (totalDurationMs - pieceTweenMs) / (count - 1),
      pieceTweenMs,
    });
  }

  const totalDurationMs =
    count <= 12
      ? 1750
      : count <= 36
      ? lerp(2300, 2800, (count - 13) / 23)
      : lerp(2850, 3150, (count - 37) / 18);
  const pieceTweenMs = 200;
  return Object.freeze({
    totalDurationMs,
    staggerMs: (totalDurationMs - pieceTweenMs) / (count - 1),
    pieceTweenMs,
  });
}

function screenAngle(position: HexCoord): number {
  const dq = position.q - BOARD_CENTER.q;
  const dr = position.r - BOARD_CENTER.r;
  const x = Math.sqrt(3) * (dq + dr / 2);
  const y = 1.5 * dr;
  return Math.atan2(y, x);
}

export function spiralRevealOrder(
  positions: readonly HexCoord[],
): readonly HexCoord[] {
  return [...positions].sort((left, right) => {
    const ringDelta =
      hexDistance(left, BOARD_CENTER) - hexDistance(right, BOARD_CENTER);
    if (ringDelta !== 0) return ringDelta;
    const angleDelta = screenAngle(left) - screenAngle(right);
    if (angleDelta !== 0) return angleDelta;
    return hexKey(left).localeCompare(hexKey(right));
  });
}

export interface BoardIntroAnimatorOptions {
  scene: Phaser.Scene;
  positions: readonly HexCoord[];
  onChange: (state: BoardIntroState) => void;
  onComplete: () => void;
}

export class BoardIntroAnimator {
  readonly #scene: Phaser.Scene;
  readonly #positions: readonly HexCoord[];
  readonly #onChange: (state: BoardIntroState) => void;
  readonly #onComplete: () => void;
  readonly #revealedKeys = new Set<string>();
  readonly #revealStartedAt = new Map<string, number>();
  #events: Phaser.Time.TimerEvent[] = [];
  #active = false;
  #timing: Readonly<BoardIntroTiming> = boardIntroTiming(0, "fresh");

  constructor({ scene, positions, onChange, onComplete }: BoardIntroAnimatorOptions) {
    this.#scene = scene;
    this.#positions = positions;
    this.#onChange = onChange;
    this.#onComplete = onComplete;
  }

  get active(): boolean {
    return this.#active;
  }

  get revealedKeys(): ReadonlySet<string> {
    return this.#revealedKeys;
  }

  entranceProgress(key: string, now = this.#scene.time.now): number {
    if (!this.#revealedKeys.has(key)) return 0;
    if (!this.#active) return 1;
    const startedAt = this.#revealStartedAt.get(key);
    if (startedAt === undefined || this.#timing.pieceTweenMs <= 0) return 1;
    return Math.max(0, Math.min(1, (now - startedAt) / this.#timing.pieceTweenMs));
  }

  start(profile: BoardIntroProfile = "fresh"): void {
    this.stop();
    this.#active = true;
    this.#revealedKeys.clear();
    this.#revealStartedAt.clear();
    const ordered = spiralRevealOrder(this.#positions);
    if (ordered.length === 0) {
      this.finish();
      return;
    }

    const timing = boardIntroTiming(ordered.length, profile);
    this.#timing = timing;
    ordered.forEach((position, index) => {
      const event = this.#scene.time.delayedCall(index * timing.staggerMs, () => {
        if (!this.#active) return;
        const key = hexKey(position);
        this.#revealedKeys.add(key);
        this.#revealStartedAt.set(key, this.#scene.time.now);
        this.#emit(true);
      });
      this.#events.push(event);
    });
    this.#events.push(
      this.#scene.time.delayedCall(timing.totalDurationMs, () => {
        if (this.#active) this.finish();
      }),
    );
  }

  finish(): boolean {
    if (!this.#active) return false;
    this.#cancelEvents();
    for (const position of this.#positions) {
      this.#revealedKeys.add(hexKey(position));
    }
    this.#active = false;
    this.#emit(false);
    this.#onComplete();
    return true;
  }

  stop(): void {
    this.#cancelEvents();
    this.#active = false;
  }

  #cancelEvents(): void {
    for (const event of this.#events) event.remove(false);
    this.#events.length = 0;
  }

  #emit(active: boolean): void {
    this.#onChange({ active, revealedKeys: new Set(this.#revealedKeys) });
  }
}
