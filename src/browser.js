import { GardenBoard } from "./board.js";
import { GardenDatabase } from "./database.js";
import { BoardVariant } from "./generator.js";
import { DEFAULT_CAMPAIGN_SEED } from "./campaign.js";
import { DEFAULT_PROGRESSION_SEED } from "./progression.js";

/** Optional binary loading for a pre-generated fallback or curated campaign. */
export async function fetchBoardDatabase(url, fetchImplementation = globalThis.fetch) {
  if (typeof fetchImplementation !== "function") {
    throw new Error("This environment does not provide fetch()");
  }
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new Error(`Could not load board database: HTTP ${response.status}`);
  }
  return new GardenDatabase(await response.arrayBuffer());
}

/** Generate deterministic levels in a module worker, keeping the render loop responsive. */
export class BrowserLevelGenerator {
  #nextRequestId = 1;
  #pending = new Map();
  #worker;

  constructor({ workerFactory, workerUrl } = {}) {
    const url = workerUrl ?? new URL("./generator-worker.js", import.meta.url);
    const factory =
      workerFactory ??
      ((resolvedUrl) => {
        if (typeof globalThis.Worker !== "function") {
          throw new Error("This browser does not provide Web Workers");
        }
        return new globalThis.Worker(resolvedUrl, {
          type: "module",
          name: "garden-generator",
        });
      });
    this.#worker = factory(url);
    this.#worker.addEventListener("message", (event) => this.#handleMessage(event.data));
    this.#worker.addEventListener("error", (event) => {
      const error = event.error ?? new Error(event.message || "Level worker failed");
      for (const { reject } of this.#pending.values()) reject(error);
      this.#pending.clear();
    });
  }

  generate(
    level,
    {
      campaignSeed = DEFAULT_CAMPAIGN_SEED,
      variant = BoardVariant.STANDARD,
    } = {},
  ) {
    const requestId = this.#nextRequestId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      this.#worker.postMessage({ requestId, level, campaignSeed, variant });
    });
  }

  generateProgression(
    level,
    { campaignSeed = DEFAULT_PROGRESSION_SEED } = {},
  ) {
    const requestId = this.#nextRequestId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(requestId, { resolve, reject });
      this.#worker.postMessage({
        kind: "progression",
        requestId,
        level,
        campaignSeed,
      });
    });
  }

  terminate() {
    this.#worker.terminate();
    const error = new Error("Level generator was terminated");
    for (const { reject } of this.#pending.values()) reject(error);
    this.#pending.clear();
  }

  #handleMessage(message) {
    const pending = this.#pending.get(message.requestId);
    if (!pending) return;
    this.#pending.delete(message.requestId);
    if (message.error) {
      pending.reject(new Error(message.error));
      return;
    }
    pending.resolve({
      ...message.result,
      board: new GardenBoard(message.result.pieces),
    });
  }
}
