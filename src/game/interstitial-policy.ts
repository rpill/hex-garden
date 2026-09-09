export const INTERSTITIAL_SESSION_GRACE_MS = 3 * 60 * 1000;
export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;

export interface InterstitialAdGateOptions {
  now?: () => number;
  sessionStartedAtMs?: number;
}

export class InterstitialAdGate {
  readonly #now: () => number;
  readonly #sessionStartedAtMs: number;
  #lastRequestAtMs: number | undefined;

  constructor({
    now = Date.now,
    sessionStartedAtMs = now(),
  }: InterstitialAdGateOptions = {}) {
    this.#now = now;
    this.#sessionStartedAtMs = sessionStartedAtMs;
  }

  tryBegin(eligible = true): boolean {
    if (!eligible) return false;
    const now = this.#now();
    if (now - this.#sessionStartedAtMs < INTERSTITIAL_SESSION_GRACE_MS) return false;
    if (
      this.#lastRequestAtMs !== undefined &&
      now - this.#lastRequestAtMs < INTERSTITIAL_COOLDOWN_MS
    ) {
      return false;
    }
    this.#lastRequestAtMs = now;
    return true;
  }
}

const sharedInterstitialAdGate = new InterstitialAdGate();

export function getInterstitialAdGate(): InterstitialAdGate {
  return sharedInterstitialAdGate;
}
