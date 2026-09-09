type PrefetchOutcome<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: unknown }>;

type PrefetchSlot<T> = {
  readonly level: number;
  readonly promise: Promise<PrefetchOutcome<T>>;
  ready: boolean;
};

export class EndlessLevelPrefetch<T> {
  #slot: PrefetchSlot<T> | undefined;
  readonly #generate: (level: number) => Promise<T>;

  constructor(generate: (level: number) => Promise<T>) {
    this.#generate = generate;
  }

  prefetch(level: number): void {
    if (!Number.isSafeInteger(level) || level < 0) {
      throw new RangeError("Endless prefetch level must be a non-negative integer");
    }
    if (this.#slot?.level === level) return;

    let slot: PrefetchSlot<T>;
    const promise = this.#generate(level).then<PrefetchOutcome<T>, PrefetchOutcome<T>>(
      (value) => {
        if (this.#slot === slot) slot.ready = true;
        return Object.freeze({ ok: true as const, value });
      },
      (error: unknown) => Object.freeze({ ok: false as const, error }),
    );
    slot = { level, promise, ready: false };
    this.#slot = slot;
  }

  isReady(level: number): boolean {
    return this.#slot?.level === level && this.#slot.ready;
  }

  async take(level: number): Promise<T> {
    if (!Number.isSafeInteger(level) || level < 0) {
      throw new RangeError("Endless level must be a non-negative integer");
    }
    const slot = this.#slot;
    if (!slot || slot.level !== level) return this.#generate(level);

    const outcome = await slot.promise;
    if (this.#slot === slot) this.#slot = undefined;
    if (outcome.ok) return outcome.value;
    return this.#generate(level);
  }
}
