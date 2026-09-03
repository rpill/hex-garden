import { generateCampaignLevel } from "./campaign.js";
import { generateEndlessRunLevel } from "./endless-run.js";
import { BoardVariant, type BoardVariantValue } from "./generator.js";
import { generateProgressionLevel } from "./progression.js";
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
  | (WorkerRequestBase & { kind: "progression" })
  | (WorkerRequestBase & { kind: "endless-run" })
  | (WorkerRequestBase & { kind?: undefined; variant?: BoardVariantValue });

function parseRequest(value: unknown): GeneratorWorkerRequest {
  if (!isRecord(value) || !Number.isSafeInteger(value.requestId) || !Number.isSafeInteger(value.level)) {
    throw new TypeError("Invalid generator worker request");
  }
  const requestId = value.requestId as number;
  const level = value.level as number;
  const campaignSeed = typeof value.campaignSeed === "string" ? value.campaignSeed : undefined;
  const base = campaignSeed === undefined ? { requestId, level } : { requestId, level, campaignSeed };
  if (value.kind === "progression") return { ...base, kind: "progression" };
  if (value.kind === "endless-run") return { ...base, kind: "endless-run" };
  const variant = Object.values(BoardVariant).includes(value.variant as BoardVariantValue)
    ? (value.variant as BoardVariantValue)
    : undefined;
  return variant === undefined ? base : { ...base, variant };
}

const port = asWorkerPort(globalThis);

port.addEventListener("message", (event) => {
  let requestId: number | undefined;
  try {
    const request = parseRequest(event.data);
    requestId = request.requestId;
    const campaignSeedOptions = request.campaignSeed === undefined ? {} : { campaignSeed: request.campaignSeed };
    const generated =
      request.kind === "progression"
        ? generateProgressionLevel(request.level, campaignSeedOptions)
        : request.kind === "endless-run"
          ? generateEndlessRunLevel(request.level, campaignSeedOptions)
          : generateCampaignLevel(request.level, {
              ...campaignSeedOptions,
              ...(request.variant === undefined ? {} : { variant: request.variant }),
            });
    const { board: _board, ...result } = generated;
    port.postMessage({ requestId: request.requestId, result });
  } catch (error) {
    port.postMessage({
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
