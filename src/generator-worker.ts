import { generateEndlessRunLevel } from "./endless-run.js";
import { generateProgressionLevel } from "./progression.js";
import { generatePuzzleCandidate, type PuzzleCandidateOptions } from "./puzzle-generation.js";
import { isRecord } from "./persistence.js";

interface WorkerPort {
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: unknown): void;
}

function asWorkerPort(value: unknown): WorkerPort {
  if (!isRecord(value) || typeof value.addEventListener !== "function" || typeof value.postMessage !== "function") {
    throw new Error("Generator worker global scope is unavailable");
  }
  return value as unknown as WorkerPort;
}

interface WorkerRequestBase {
  requestId: number;
  level: number;
  campaignSeed?: string;
}

type GeneratorWorkerRequest =
  | { requestId: number; kind: "puzzle-candidate"; options: PuzzleCandidateOptions }
  | (WorkerRequestBase & { kind: "progression" })
  | (WorkerRequestBase & { kind: "endless-run" });

function parseRequest(value: unknown): GeneratorWorkerRequest {
  if (!isRecord(value) || !Number.isSafeInteger(value.requestId)) {
    throw new TypeError("Invalid generator worker request");
  }
  const requestId = value.requestId as number;

  if (value.kind === "puzzle-candidate") {
    if (!isRecord(value.options)) throw new TypeError("Invalid puzzle candidate worker request");
    return {
      requestId,
      kind: "puzzle-candidate",
      options: value.options as unknown as PuzzleCandidateOptions,
    };
  }

  if (!Number.isSafeInteger(value.level)) {
    throw new TypeError("Invalid generator worker request");
  }
  const level = value.level as number;
  const campaignSeed = typeof value.campaignSeed === "string" ? value.campaignSeed : undefined;
  const base = campaignSeed === undefined ? { requestId, level } : { requestId, level, campaignSeed };
  if (value.kind === "progression") return { ...base, kind: "progression" };
  if (value.kind === "endless-run") return { ...base, kind: "endless-run" };
  throw new TypeError("Invalid generator worker request kind");
}

const port = asWorkerPort(globalThis);

port.addEventListener("message", (event) => {
  let requestId: number | undefined;
  try {
    const request = parseRequest(event.data);
    requestId = request.requestId;
    const generated = (() => {
      if (request.kind === "puzzle-candidate") {
        return generatePuzzleCandidate(request.options);
      }
      const campaignSeedOptions = request.campaignSeed === undefined ? {} : { campaignSeed: request.campaignSeed };
      if (request.kind === "progression") {
        return generateProgressionLevel(request.level, campaignSeedOptions);
      }
      return generateEndlessRunLevel(request.level, campaignSeedOptions);
    })();
    const { board: _board, ...result } = generated;
    port.postMessage({ requestId: request.requestId, result });
  } catch (error) {
    port.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
