import { GardenBoard } from "./board.js";
import type { DailyPuzzle } from "./daily.js";
import { GardenDatabase } from "./database.js";
import { BoardVariant, type BoardVariantValue } from "./generator.js";
import type { CampaignLevel } from "./campaign.js";
import { getCampaignLevel } from "./campaign-levels.js";
import { DEFAULT_PROGRESSION_SEED, generateProgressionLevel } from "./progression.js";
import { generateEndlessRunLevel, type EndlessRunLevel } from "./endless-run.js";
import type { GeneratedPuzzleCandidate, PuzzleCandidateOptions } from "./puzzle-generation.js";

export async function fetchBoardDatabase(
  url: string | URL,
  fetchImplementation: typeof fetch | undefined = globalThis.fetch,
): Promise<GardenDatabase> {
  if (typeof fetchImplementation !== "function") {
    throw new Error("This environment does not provide fetch()");
  }
  const response = await fetchImplementation(url);
  if (!response.ok) throw new Error(`Could not load board database: HTTP ${response.status}`);
  return new GardenDatabase(await response.arrayBuffer());
}

type ProgressionLevel = ReturnType<typeof generateProgressionLevel>;
type SerializedResult<T extends { board: GardenBoard }> = Omit<T, "board">;
type WorkerResult =
  | SerializedResult<DailyPuzzle>
  | SerializedResult<ProgressionLevel>
  | SerializedResult<EndlessRunLevel>
  | SerializedResult<GeneratedPuzzleCandidate>;
type BrowserResult<T extends { board: GardenBoard }> = Omit<T, "board"> & { board: GardenBoard };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface WorkerLike {
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  addEventListener(type: "error", listener: (event: ErrorEvent) => void): void;
  postMessage(message: unknown): void;
  terminate(): void;
}

export interface BrowserLevelGeneratorOptions {
  workerFactory?: (url: URL) => WorkerLike;
  workerUrl?: URL;
}

interface WorkerResponse {
  requestId: number;
  error?: string;
  result?: WorkerResult;
}

function parseWorkerResponse(value: unknown): WorkerResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.requestId)) return null;
  return {
    requestId: record.requestId as number,
    ...(typeof record.error === "string" ? { error: record.error } : {}),
    ...(typeof record.result === "object" && record.result !== null ? { result: record.result as WorkerResult } : {}),
  };
}

export class BrowserLevelGenerator {
  #nextRequestId = 1;
  #pending = new Map<number, PendingRequest>();
  #worker: WorkerLike;

  constructor({ workerFactory, workerUrl }: BrowserLevelGeneratorOptions = {}) {
    if (workerFactory) {
      this.#worker = workerFactory(workerUrl ?? new URL("./generator-worker.ts", import.meta.url));
    } else {
      if (typeof globalThis.Worker !== "function") throw new Error("This browser does not provide Web Workers");
      this.#worker = workerUrl
        ? new globalThis.Worker(workerUrl, { type: "module", name: "garden-generator" })
        : new globalThis.Worker(new URL("./generator-worker.ts", import.meta.url), {
            type: "module",
            name: "garden-generator",
          });
    }
    this.#worker.addEventListener("message", (event) => this.#handleMessage(event.data));
    this.#worker.addEventListener("error", (event) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message || "Level worker failed");
      for (const { reject } of this.#pending.values()) reject(error);
      this.#pending.clear();
    });
  }

  /**
   * @deprecated Campaign content is frozen and should be read with
   * getCampaignLevel(level). This facade remains while BoardScene callers are
   * migrated; it never posts Campaign work to the generator worker.
   */
  generate(
    level: number,
    _options: { campaignSeed?: string; variant?: BoardVariantValue } = {},
  ): Promise<BrowserResult<CampaignLevel>> {
    const record = getCampaignLevel(level);
    const plateCells = record.plateCells.map((cell) => ({ ...cell }));
    const pieces = record.pieces.map((piece) => ({ ...piece }));
    const solution = record.solution.map((move) =>
      move.map((cell) => ({ ...cell })),
    );
    return Promise.resolve({
      ...record,
      plateCells,
      pieces,
      solution,
      variant: BoardVariant.STANDARD,
      shape: "canonical",
      board: new GardenBoard(pieces),
    });
  }

  generateProgression(
    level: number,
    { campaignSeed = DEFAULT_PROGRESSION_SEED }: { campaignSeed?: string } = {},
  ): Promise<BrowserResult<ProgressionLevel>> {
    return this.#request({ kind: "progression", level, campaignSeed });
  }

  generateEndlessRun(
    level: number,
    { runSeed }: { runSeed: string },
  ): Promise<BrowserResult<EndlessRunLevel>> {
    return this.#request({ kind: "endless-run", level, runSeed });
  }

  generateDaily(dateKey: string): Promise<BrowserResult<DailyPuzzle>> {
    return this.#request({ kind: "daily", dateKey });
  }

  generatePuzzleCandidate(
    options: PuzzleCandidateOptions,
  ): Promise<BrowserResult<GeneratedPuzzleCandidate>> {
    return this.#request({ kind: "puzzle-candidate", options });
  }

  #request<T extends { board: GardenBoard }>(message: Record<string, unknown>): Promise<BrowserResult<T>> {
    const requestId = this.#nextRequestId++;
    return new Promise<BrowserResult<T>>((resolve, reject) => {
      this.#pending.set(requestId, {
        resolve: (value) => resolve(value as BrowserResult<T>),
        reject,
      });
      this.#worker.postMessage({ requestId, ...message });
    });
  }

  terminate(): void {
    this.#worker.terminate();
    const error = new Error("Level generator was terminated");
    for (const { reject } of this.#pending.values()) reject(error);
    this.#pending.clear();
  }

  #handleMessage(value: unknown): void {
    const message = parseWorkerResponse(value);
    if (!message) return;
    const pending = this.#pending.get(message.requestId);
    if (!pending) return;
    this.#pending.delete(message.requestId);
    if (message.error) {
      pending.reject(new Error(message.error));
      return;
    }
    if (!message.result || !Array.isArray((message.result as { pieces?: unknown }).pieces)) {
      pending.reject(new Error("Level worker returned an invalid result"));
      return;
    }
    pending.resolve({ ...message.result, board: new GardenBoard(message.result.pieces) });
  }
}
