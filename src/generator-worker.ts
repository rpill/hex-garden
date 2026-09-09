import { generateEndlessRunLevel } from "./endless-run.js";
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

interface EndlessWorkerRequest {
  requestId: number;
  kind: "endless-run";
  level: number;
  runSeed: string;
}

type GeneratorWorkerRequest =
  | { requestId: number; kind: "puzzle-candidate"; options: PuzzleCandidateOptions }
  | EndlessWorkerRequest;

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

  if (value.kind === "endless-run") {
    if (!Number.isSafeInteger(value.level)) {
      throw new TypeError("Invalid Endless worker request");
    }
    const level = value.level as number;
    if (typeof value.runSeed !== "string" || value.runSeed.length === 0) {
      throw new TypeError("Invalid Endless worker request");
    }
    return { requestId, kind: "endless-run", level, runSeed: value.runSeed };
  }
  throw new TypeError("Invalid generator worker request kind");
}

const port = asWorkerPort(globalThis);

port.addEventListener("message", (event) => {
  let requestId: number | undefined;
  try {
    const request = parseRequest(event.data);
    requestId = request.requestId;
    const generated = request.kind === "puzzle-candidate"
      ? generatePuzzleCandidate(request.options)
      : generateEndlessRunLevel(request.level, { runSeed: request.runSeed });
    const { board: _board, ...result } = generated;
    port.postMessage({ requestId: request.requestId, result });
  } catch (error) {
    port.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
